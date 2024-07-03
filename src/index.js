import 'dotenv/config';
import OpenAI from 'openai';
import { ObjectTypes, SYSTEM_MESSAGE } from './constants.js';
import process from 'process';
import sql from './db.js'
import * as weknow from './weknow.js';
import { createRequire } from "module";
import { createWeknowConfigFromSql } from './astToWeknowConfig.js';
const require = createRequire(import.meta.url);
const userTestMessages = require("../data/user-test-messages.json");
import { parseArgs } from 'node:util';

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

    const options = {
        'msg': {
            type: 'string',
            short: 'm',
        }
    };

    const { values } = parseArgs({ options, tokens: true });
    let userMessage = userTestMessages[0];
    if (values.msg) {
        userMessage = values.msg
    }

    if (auth) {
        await processMessage(userMessage, auth);
    }
    exit();
}

async function processMessage(userMessage, auth) {
    console.log('Processing message:', userMessage);
    console.log('Getting metadata summary...');
    let metadataId = process.env.METADATA_ID;
    let metadataSummary = await weknow.getMetadataSummary(metadataId, auth.accessToken);
    let fields = convertTreeViewInList(metadataSummary.fields || []);
    let completeNameList = fields.map((field) => field.completeName);
    let completeNameStringList = completeNameList.join('\n');
    let systemMessage = SYSTEM_MESSAGE + completeNameStringList;

    console.log('Getting chat completion...');
    let completionSql = await getChatCompletion(systemMessage, userMessage);

    console.log('Creating Weknow config...');
    let { weknowConfig, ast } = createWeknowConfigFromSql(metadataId, ObjectTypes.Chart, completeNameList, completionSql);

    console.log('Executing Weknow component...');
    let error = null;
    let executionResults = await weknow.executeComponent(weknowConfig, auth.accessToken);
    if (executionResults.error) {
        error = executionResults;
    }

    console.log('Rendering Weknow component...');
    let renderScreenshot = null;
    try {
        renderScreenshot = await weknow.renderComponent(weknowConfig, executionResults);
    } catch (error) {
        console.log(error);
    }

    console.log('Saving chat completion results...');
    await saveChatCompletionResults({
        systemMessage,
        userMessage,
        completion: completionSql,
        ast: JSON.stringify(ast),
        weknowConfig: JSON.stringify(weknowConfig),
        renderResult: renderScreenshot,
        error: error ? JSON.stringify(error) : null
    });
    console.log('Finished processing message:', userMessage);
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

// function shouldGenerateChart () {
//     return false;
// }

async function saveChatCompletionResults({ systemMessage, userMessage, completion, ast, weknowConfig, renderResult, error }) {
    const chatCompletions = await sql`
        insert into chat_completions
            (system_message, user_message, completion, ast, weknow_config, render_result, error)
        values
            (${ systemMessage }, ${ userMessage }, ${ completion }, ${ast}, ${ weknowConfig }, ${ renderResult }, ${ error })
        returning system_message, user_message, completion, ast, weknow_config, render_result, error
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
