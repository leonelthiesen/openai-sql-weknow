import 'dotenv/config';
import OpenAI from 'openai';
import { SYSTEM_MESSAGE } from './constants.js';
import process from 'process';
import sql from './db.js'
import * as weknow from './weknow.js';
import { createRequire } from "module";
import { createWeknowGridConfigFromSql } from './astToWeknowConfig.js';
const require = createRequire(import.meta.url);
const userTestMessages = require("../data/user-test-messages.json");

const OpenAiModels = {
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

        console.log('Creating Weknow grid config...');
        let { weknowGridConfig, ast } = createWeknowGridConfigFromSql(userMessage.metadataId, completionSql);

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
            ast: JSON.stringify(ast),
            weknowGridConfig: JSON.stringify(weknowGridConfig),
            gridResult: gridBinaryScreenshot,
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

async function saveChatCompletionResults({ systemMessage, userMessage, completion, ast, weknowGridConfig, gridResult, error }) {
    const chatCompletions = await sql`
        insert into chat_completions
            (system_message, user_message, completion, ast, weknow_grid_config, grid_result, error)
        values
            (${ systemMessage }, ${ userMessage }, ${ completion }, ${ast}, ${ weknowGridConfig }, ${ gridResult }, ${ error })
        returning system_message, user_message, completion, ast, weknow_grid_config, grid_result, error
    `;
    return chatCompletions;
}

async function getChatCompletion (systemMessage, userMessage) {
    let openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    const chatCompletion = await openai.chat.completions.create({
        model: OpenAiModels.gpt35Turbo,
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
