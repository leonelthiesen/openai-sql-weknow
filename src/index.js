import 'dotenv/config';
import OpenAI from 'openai';
import { SYSTEM_MESSAGE, baseGridConfig } from './constants.js';
import process from 'process';
import sql from './db.js'
import * as weknow from './weknow.js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const userTestMessages = require("../data/user-test-messages.json");

const { Parser } = require('node-sql-parser');

let models = {
    gpt4: "gpt-4",
    gpt35Turbo: "gpt-3.5-turbo",
};

await main();

// console.log(process._getActiveHandles());
// console.log(process._getActiveRequests());

async function main() {
    let auth;
    try {
        auth = await weknow.authenticate(process.env.WEKNOW_USER_NAME, process.env.WEKNOW_PASSWORD, process.env.WEKNOW_CLIENT_TYPE, process.env.WEKNOW_ACCOUNT_TOKEN);
    } catch (error) {
        exit(error);
        return;
    }
    if (auth && auth.error) {
        exit(auth.error);
        return;
    }

    if (auth) {
        await processMessages(auth);
    }
}

async function processMessages(auth) {
    console.log('Processing messages...');
    for (let userMessage of userTestMessages) {
        console.log('Processing message:', userMessage);
        console.log('Getting metadata summary...');
        let metadataSummary = await weknow.getMetadataSummary(userMessage.metadataId, auth.accessToken);
        let fields = convertTreeViewInList(metadataSummary.fields || []);
        let completeNameOptions = fields.map((field) => field.completeName);
        let completeNameOptionsList = completeNameOptions.join('\n');
        let systemMessage = SYSTEM_MESSAGE + completeNameOptionsList;

        console.log('Getting chat completion...');
        let completionSql = await getChatCompletion(systemMessage, userMessage.message);

        console.log('Parsing SQL...');
        let ast = parseSql(completionSql);

        console.log('Creating Weknow grid config...');
        let weknowGridConfig = createWeknowGridConfigFromAst(userMessage.metadataId, ast);

        console.log('Executing Weknow component...');
        let error = null;
        let executionResults = await weknow.executeComponent(weknowGridConfig, auth.accessToken);
        if (executionResults.error) {
            error = executionResults;
        }

        console.log('Rendering Weknow component...');
        let gridBinaryScreenshot = null;
        try {
            gridBinaryScreenshot = await weknow.renderComponent(weknowGridConfig, executionResults);
        } catch (error) {
            console.log(error);
        }

        console.log('Saving chat completion results...');
        await saveChatCompletionResults({
            systemMessage: systemMessage,
            userMessage: userMessage.message,
            completion: completionSql,
            gridResult: gridBinaryScreenshot,
            weknowGridConfig: JSON.stringify(weknowGridConfig),
            error: error ? JSON.stringify(error) : null
        });
        console.log('Finished processing message:', userMessage);
    }
    console.log('Finished processing messages.');

    exit();
}

function exit(error) {
    if (error) {
        console.log(error);
    }
    sql.end();
}

function convertTreeViewInList (treeView) {
    var tempFieldList = [];
    treeView.forEach((field) => {
        if (field.isField) {
            const listField = { ...field };
            delete listField.items;
            tempFieldList.push(listField);
        }
        if (field.items) {
            let parentRef = field.completeName;
            if (!field.isField) {
                parentRef = null;
            }
            var tempChildFields = convertTreeViewInList(field.items, parentRef);
            tempFieldList = tempFieldList.concat(tempChildFields);
        }
    });
    return tempFieldList;
}

async function saveChatCompletionResults({ systemMessage, userMessage, completion, gridResult, weknowGridConfig, error }) {
    const chatCompletions = await sql`
        insert into chat_completions
            (system_message, user_message, completion, grid_result, weknow_grid_config, error)
        values
            (${ systemMessage }, ${ userMessage }, ${ completion }, ${ gridResult }, ${ weknowGridConfig }, ${ error })
        returning system_message, user_message, completion, grid_result, weknow_grid_config, error
    `;
    return chatCompletions;
}

function parseSql (sqlString) {
    let sqlParser = new Parser();
    const ast = sqlParser.astify(sqlString);
    return ast;
}

function createWeknowGridConfigFromAst (metadataId, sqlAst) {
    let statement = sqlAst[0];
    if (!Array.isArray(sqlAst)) {
        statement = sqlAst;
    }

    if (statement.type !== 'select' || !statement.columns || statement.columns.length === 0) {
        return null;
    }

    let weknowGridConfig = structuredClone(baseGridConfig);
    weknowGridConfig.data.metadataId = metadataId;

    weknowGridConfig.data.columns = [];
    let calculatedFieldsCount = 0;
    statement.columns.forEach((column) => {
        let completeName = column.expr.column;
        let title = column.as || column.expr.column;

        if (column.expr.type !== 'column_ref') {
            calculatedFieldsCount++;
            function convertColumnRef (object) {
                if (object.type === 'column_ref') {
                    object.column = `%${object.column}%`;
                }
                for (let key in object) {
                    if (typeof object[key] === 'object' && object[key] !== null) {
                        convertColumnRef(object[key]);
                    }
                }
            }

            convertColumnRef(column.expr);

            const DataTypes = {
                X: 1
            };

            const FieldTypes = {
                X: 1
            };

            const CalculatedFieldTypes = {
                X: 2
            };

            let sqlParser = new Parser();
            let columnSqlText = sqlParser.exprToSQL(column.expr).replace(/`/g, '');

            completeName = 'calculatedField' + calculatedFieldsCount;

            if (title === undefined) {
                title = completeName;
            }

            let calculatedField = {
                completeName: completeName,
                dataType: DataTypes.X,
                fieldTipe: FieldTypes.X,
                formula: columnSqlText,
                hasAggregateFunction: true, // TODO: pegar do ast?
                isAggregated: true, // TODO: pegar do ast?
                isMeasure: true, //TODO: pegar do ast?
                title: title,
                type: CalculatedFieldTypes.X
            };
            if (!weknowGridConfig.data.calculatedFields) {
                weknowGridConfig.data.calculatedFields = [];
            }
            weknowGridConfig.data.calculatedFields.push(calculatedField);
        }

        weknowGridConfig.data.columns.push({
            completeName,
            title
        });
    });

    return weknowGridConfig;
}

async function getChatCompletion (systemMessage, userMessage) {
    let openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    const chatCompletion = await openai.chat.completions.create({
        model: models.gpt35Turbo,
        messages: [{
            role: "system",
            content: systemMessage
        }, {
            role: "user",
            content: userMessage
        }],
        temperature: 0,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    });

    return chatCompletion.choices[0].message.content;
}
