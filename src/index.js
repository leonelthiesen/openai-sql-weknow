import 'dotenv/config';
import { ObjectTypes, SYSTEM_MESSAGE } from './constants.js';
import process from 'process';
import sql from './db.js'
import weknowService from './services/weknow.service.js';
import { createRequire } from "module";
import { createWeknowConfigFromSql } from './services/ast-to-weknow.service.js';
const require = createRequire(import.meta.url);
const userTestMessages = require("../data/user-test-messages.json");
import { parseArgs } from 'node:util';
import { convertTreeViewInList } from './utils/utils.js';
import openAiService from './services/open-ai.service.js';


await main();

// console.log(process._getActiveHandles());
// console.log(process._getActiveRequests());

async function main() {
    let auth;
    try {
        auth = await weknowService.authenticate(process.env.WEKNOW_USER_NAME, process.env.WEKNOW_PASSWORD, process.env.WEKNOW_CLIENT_TYPE, process.env.WEKNOW_ACCOUNT_TOKEN);
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
    let metadataSummary = await weknowService.getMetadataSummary(metadataId, auth.accessToken);
    let fields = convertTreeViewInList(metadataSummary.fields || []);
    let completeNameList = fields.map((field) => field.completeName);
    let completeNameStringList = completeNameList.join('\n');
    let systemMessage = SYSTEM_MESSAGE + completeNameStringList;

    console.log('Getting chat completion...');
    let completionSql = await openAiService.getChatCompletion(systemMessage, userMessage);

    console.log('Creating Weknow config...');
    let { weknowConfig, ast } = createWeknowConfigFromSql(metadataId, ObjectTypes.Chart, completeNameList, completionSql);

    console.log('Executing Weknow component...');
    let error = null;
    let executionResults = await weknowService.executeComponent(weknowConfig, auth.accessToken);
    if (executionResults.error) {
        error = executionResults;
    }

    console.log('Rendering Weknow component...');
    let renderScreenshot = null;
    try {
        renderScreenshot = await weknowService.renderComponent(weknowConfig, executionResults);
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
