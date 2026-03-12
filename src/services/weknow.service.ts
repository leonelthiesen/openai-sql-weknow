import fetch from "node-fetch";
import { encryptWithPublicKey } from "../utils/utils";

interface MetadataSummaryCache {
  [metadataId: number]: any;
}

let metadataSummaryCache: MetadataSummaryCache = {};

let cachedAccessToken: string | null = null;

export async function getPublicKey(accountToken: string): Promise<string> {
  const url = getUrl("TServerApi/Hello");

  const body = { accountToken };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  await throwIfError(response, "getPublicKey");

  const data: any = await response.json();
  return data?.serverInfo?.security?.publicKey;
}

export async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  const accountToken = process.env.WEKNOW_ACCOUNT_TOKEN ?? "";

  const publicKey = await getPublicKey(accountToken);

  const url = getUrl("TSecurityApi/Authenticate");

  let passwordEncrypted = encryptWithPublicKey(process.env.WEKNOW_PASSWORD ?? "", publicKey);

  const body = {
    userName: process.env.WEKNOW_USER_NAME ?? "",
    passwordEncrypted,
    clientAppType: process.env.WEKNOW_CLIENT_TYPE ?? "API",
    accountToken,
  };

  const response = await fetch(url, {
    method: "post",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  await throwIfError(response, "getAccessToken");

  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const match = setCookie.match(/^[^=]+=([^;]+)/);
    if (match) {
      cachedAccessToken = match[1] ?? null;
    }
  }

  if (!cachedAccessToken) {
    throw new Error("Falha na autenticação: não foi possível extrair o accessToken dos cookies.");
  }

  return cachedAccessToken;
}

function getUrl(path: string): string {
  return `http://${process.env.WEKNOW_API_HOST || "localhost"}/weknow/datasnap/rest/${path}`;
}

async function throwIfError(response: Awaited<ReturnType<typeof fetch>>, context: string): Promise<void> {
  if (response.status !== 200) {
    const body: any = await response.json().catch(() => null);
    if (body?.error) throw body;
    throw new Error(`${context} falhou com status ${response.status}`);
  }
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

  await throwIfError(response, "getMetadataSummary");

  metadataSummaryCache[metadataId] = await response.json();
  return metadataSummaryCache[metadataId];
}

interface ExecuteComponentResponse {
  [key: string]: any;
}

export async function executeComponent(
  body: string,
): Promise<ExecuteComponentResponse> {
  const url = getUrl("TComponentApi/Execute");

  const response = await fetch(url, {
    method: "post",
    body,
    headers: { "Content-Type": "application/json" },
  });

  await throwIfError(response, "executeComponent");

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

  await throwIfError(response, "executeMetadata");

  return response.json();
}
