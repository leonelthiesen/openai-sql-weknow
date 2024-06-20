/* global window */

import 'dotenv/config';
import OpenAI from 'openai';
import { ObjectTypes, SYSTEM_MESSAGE, baseGridConfig } from './constants.js';
import process from 'process';
import sql from './db.js'
import { createRequire } from "module";
import { authenticate, executeComponent, getMetadataSummary } from './weknow.js';
import puppeteer from 'puppeteer-core';
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
        auth = await authenticate(process.env.WEKNOW_USER_NAME, process.env.WEKNOW_PASSWORD, process.env.WEKNOW_CLIENT_TYPE, process.env.WEKNOW_ACCOUNT_TOKEN);
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
        let metadataSummary = await getMetadataSummary(userMessage.metadataId, auth.accessToken);
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
        let executionResults = await executeComponent(weknowGridConfig, auth.accessToken);

        console.log('Rendering Weknow component...');
        let gridBinaryScreenshot = null;
        try {
            gridBinaryScreenshot = await renderWeknowComponent(weknowGridConfig, executionResults);            
        } catch (error) {
            console.log(error);            
        }

        console.log('Saving chat completion results...');
        await saveChatCompletionResults({
            systemMessage: systemMessage,
            userMessage: userMessage.message,
            completion: completionSql,
            gridResult: gridBinaryScreenshot
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

async function saveChatCompletionResults({ systemMessage, userMessage, completion, gridResult }) {
    const chatCompletions = await sql`
        insert into chat_completions
            (system_message, user_message, completion, grid_result)
        values
            (${ systemMessage }, ${ userMessage }, ${ completion }, ${ gridResult })
        returning system_message, user_message, completion, grid_result
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
            const columnSqlText = sqlParser.exprToSQL(column.expr);
            
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

async function renderWeknowComponent (config, data) {
    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_EXECUTABLE_PATH,
        // headless: false,
        // devtools: true,
        // args:[
        //     '--start-maximized'
        // ]
    });

    const page = await browser.newPage();

    await page.evaluateOnNewDocument((accountToken) => {
        if (!window.wknw) {
            window.wknw = {
                requestStartValues: function () {
                    window.wknwweb.setStartValues({
                        accountToken,
                        accessToken: 'testToken'
                    })
                },
                allComponentsLoaded: function () {
                    console.log('allComponentsLoaded');
                }
            };
        }
    }, process.env.WEKNOW_ACCOUNT_TOKEN);
    await page.goto('http://localhost:4200/#/desktopstart');
    await page.goto('http://localhost:4200/#/objectViewer');
    await page.evaluate((config, data) => {
        window.wknwweb.setObjectContents(config)
        window.wknwweb.setObjectData(data)

    }, config, data);

    await page.evaluate((config, data) => {
        window.wknwweb.setObjectContents(config)
        window.wknwweb.setObjectData(data)
    }, config, data);

    if (config.type === ObjectTypes.Table) {
        await page.waitForSelector('.dx-data-row');
    } else if (config.type === ObjectTypes.Chart) {
        await page.waitForSelector('.highcharts-container');
    }

    const binaryScreenshot = await page.screenshot({
        encoding: 'binary',
        type: 'png',
    });

    await browser.close();

    return binaryScreenshot;
}