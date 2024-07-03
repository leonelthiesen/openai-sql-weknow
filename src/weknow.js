/* global window */

import fetch from 'node-fetch';
import crypto from 'crypto';
import puppeteer from 'puppeteer-core';
import { ObjectTypes } from './constants.js';

let metadataSummaryCache = {};

function getUrl(path) {
    return `http://${process.env.WEKNOW_API_HOST || 'localhost'}/weknow/datasnap/rest/${path}`;
}

export async function authenticate(userName, password, clientAppType, accountToken) {
    let url = getUrl('TSecurityApi/Authenticate');

    const passwordHash64 = crypto.createHash('sha512').update(process.env.WEKNOW_PASSWORD_SALT + password).digest('base64');

    const body = { userName, passwordHash64, clientAppType, accountToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
}

export async function getMetadataSummary(metadataId, accessToken) {
    if (metadataSummaryCache[metadataId]) {
        return metadataSummaryCache[metadataId];
    }

    let url = getUrl('TMetadataApi/Summary');

    const body = { metadataId, accessToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    metadataSummaryCache[metadataId] = await response.json();
    return await metadataSummaryCache[metadataId];
}

export async function executeComponent(contents, accessToken) {
    let url = getUrl('TComponentApi/Execute');

    const body = { contents, accessToken };

    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
}

export async function renderComponent (config, data) {
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

    let origin = `http://${process.env.WEKNOW_API_HOST || 'localhost'}:${process.env.WEKNOW_API_PORT || '80'}`;
    await page.goto(`${origin}/#/desktopstart`);
    await page.goto(`${origin}/#/objectViewer`);
    await page.evaluate((config, data) => {
        window.wknwweb.setObjectContents(config)
        window.wknwweb.setObjectData(data)

    }, config, data);

    await page.evaluate((config, data) => {
        window.wknwweb.setObjectContents(config)
        window.wknwweb.setObjectData(data)
    }, config, data);

    if (config.type === ObjectTypes.Table) {
        await page.waitForSelector('.dx-datagrid, .component-load-error', { visible: true });
    } else if (config.type === ObjectTypes.Chart) {
        await page.waitForSelector('.highcharts-container, .component-load-error', { visible: true });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const binaryScreenshot = await page.screenshot({
        encoding: 'binary',
        type: 'png',
    });

    await browser.close();

    return binaryScreenshot;
}
