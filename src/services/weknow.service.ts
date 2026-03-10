/* global window */

import fetch from "node-fetch";
import crypto from "crypto";

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
