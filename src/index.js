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
    let auth = await authenticate(process.env.WEKNOW_USER_NAME, process.env.WEKNOW_PASSWORD, process.env.WEKNOW_CLIENT_TYPE, process.env.WEKNOW_ACCOUNT_TOKEN);

    for (let userMessage of userTestMessages) {
        let metadataSummary = await getMetadataSummary(userMessage.metadataId, auth.accessToken);
        let fields = convertTreeViewInList(metadataSummary.fields);
        let completeNameOptions = fields.map((field) => field.completeName);
        let completeNameOptionsList = completeNameOptions.join('\n');
        let systemMessage = SYSTEM_MESSAGE + completeNameOptionsList;

        let completionSql = await getChatCompletion(systemMessage, userMessage.message);
        let ast = parseSql(completionSql);
        let weknowGridConfig = createWeknowGridConfigFromAst(userMessage.metadataId, ast);
        let executionResults = await executeComponent(weknowGridConfig, auth.accessToken);

        let gridBinaryScreenshot = await renderWeknowComponent(weknowGridConfig, executionResults);

        await saveChatCompletionResults({
            systemMessage: systemMessage,
            userMessage: userMessage.message,
            completion: completionSql,
            gridResult: gridBinaryScreenshot
        });
    }

    sql.end();

    return;
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
    let firstStatement = sqlAst[0];
    if (firstStatement.type !== 'select' || !firstStatement.columns || firstStatement.columns.length === 0) {
        return null;
    }

    let weknowGridConfig = structuredClone(baseGridConfig);
    weknowGridConfig.data.metadataId = metadataId;

    weknowGridConfig.data.columns = firstStatement.columns.map((column) => {
        return {
            completeName: column.expr.column,
            title: column.as || column.expr.column
        };
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