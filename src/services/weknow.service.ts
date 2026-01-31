/* global window */

import fetch from "node-fetch";
import crypto from "crypto";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { ObjectTypes, GridConfig, ChartConfig } from "../constants";

interface MetadataSummaryCache {
  [metadataId: number]: any;
}

let metadataSummaryCache: MetadataSummaryCache = {};

function getUrl(path: string): string {
  return `http://${process.env.WEKNOW_API_HOST || "localhost"}/weknow/datasnap/rest/${path}`;
}

interface AuthenticationResponse {
  accessToken?: string;
  [key: string]: any;
}

export async function authenticate(
  userName: string,
  password: string,
  clientAppType: string,
  accountToken: string
): Promise<AuthenticationResponse> {
  const url = getUrl("TSecurityApi/Authenticate");

  const passwordHash64 = crypto
    .createHash("sha512")
    .update(process.env.WEKNOW_PASSWORD_SALT + password)
    .digest("base64");

  const body = { userName, passwordHash64, clientAppType, accountToken };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return response.json() as Promise<AuthenticationResponse>;
}

export async function getMetadataSummary(metadataId: number, accessToken: string): Promise<any> {
  if (metadataSummaryCache[metadataId]) {
    return metadataSummaryCache[metadataId];
  }

  const url = getUrl("TMetadataApi/Summary");

  const body = { metadataId, accessToken };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  metadataSummaryCache[metadataId] = await response.json();
  return metadataSummaryCache[metadataId];
}

interface ExecuteComponentResponse {
  [key: string]: any;
}

export async function executeComponent(
  contents: string,
  accessToken: string
): Promise<ExecuteComponentResponse> {
  const url = getUrl("TComponentApi/Execute");

  const body = { contents, accessToken };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return response.json() as Promise<ExecuteComponentResponse>;
}

export async function executeMetadata(metadataId: number, accessToken: string): Promise<any> {
  const url = getUrl("TMetadataApi/Execute");

  const body = { metadataId, accessToken };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}

export async function renderComponent(
  config: GridConfig | ChartConfig,
  data: any
): Promise<Buffer> {
  const browser: Browser = await puppeteer.launch({
    executablePath: process.env.CHROME_EXECUTABLE_PATH,
    // headless: false,
    // devtools: true,
    // args:[
    //     '--start-maximized'
    // ]
  });

  const page: Page = await browser.newPage();

  await page.evaluateOnNewDocument((accountToken: string) => {
    // @ts-ignore - window is available in browser context
    if (!window.wknw) {
      // @ts-ignore
      window.wknw = {
        requestStartValues: function () {
          // @ts-ignore
          window.wknwweb.setStartValues({
            accountToken,
            accessToken: "testToken",
          });
        },
        allComponentsLoaded: function () {
          console.log("allComponentsLoaded");
        },
      };
    }
  }, process.env.WEKNOW_ACCOUNT_TOKEN as string);

  const origin = `http://${process.env.WEKNOW_API_HOST || "localhost"}:${process.env.WEKNOW_API_PORT || "80"}`;
  await page.goto(`${origin}/#/desktopstart`);
  await page.goto(`${origin}/#/objectViewer`);
  await page.evaluate(
    (config: GridConfig | ChartConfig, data: any) => {
      // @ts-ignore - window is available in browser context
      window.wknwweb.setObjectContents(config);
      // @ts-ignore
      window.wknwweb.setObjectData(data);
    },
    config,
    data
  );

  if (config.type === ObjectTypes.Table) {
    await page.waitForSelector(".dx-datagrid, .component-load-error", {
      visible: true,
    });
  } else if (config.type === ObjectTypes.Chart) {
    await page.waitForSelector(".highcharts-container, .component-load-error", {
      visible: true,
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const binaryScreenshot = await page.screenshot({
    encoding: "binary",
    type: "png",
  });

  await browser.close();

  return binaryScreenshot as Buffer;
}
