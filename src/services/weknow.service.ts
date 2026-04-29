import fetch from "node-fetch";
import { TFieldType } from "../models/TFieldType";
import type {
  PivotGridCellValue,
  PivotGridResponse,
  RawPivotGridResponse,
  RawPivotGridRow,
} from "../types/pivot-grid-response.types";
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

  let userName = process.env.WEKNOW_USER_NAME ?? "";
  let passwordEncrypted = encryptWithPublicKey(process.env.WEKNOW_PASSWORD ?? "", publicKey);

  const body = {
    userName,
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
  return `${process.env.WEKNOW_API_SCHEME || "http://"}${process.env.WEKNOW_API_HOST || "localhost"}/weknow/datasnap/rest/${path}`;
}

function extractWeKnowErrorMessage(body: any, defaultMessage: string): string {
    if (!body) {
        return defaultMessage;
    }

    const errorObj = body;

    if (typeof errorObj === "string") {
        return errorObj;
    }

    if (typeof errorObj === "object") {
        // Formato: { errorMessage: { title, text, details } }
        if (errorObj.errorMessage && typeof errorObj.errorMessage === "object") {
            const parts = [errorObj.errorMessage.text, errorObj.errorMessage.details].filter(Boolean);
            return parts.join("\n") || defaultMessage;
        }

        // Formato: { error: { msg, ttl, dtls } }
        if (errorObj.error && typeof errorObj.error === "object") {
            const parts = [errorObj.error.msg || errorObj.error.message, errorObj.error.dtls].filter(Boolean);
            return parts.join("\n") || defaultMessage;
        }

        // Formato: { error: "string" }
        if (errorObj.error && typeof errorObj.error === "string") {
            return errorObj.error;
        }

        // Formato: { text: "string" }
        if (typeof errorObj.text === "string") {
            return errorObj.text;
        }

        // Formato: { message: "string" }
        if (typeof errorObj.message === "string") {
            return errorObj.message;
        }
    }

    return defaultMessage;
}

async function throwIfError(response: Awaited<ReturnType<typeof fetch>>, context: string): Promise<void> {
    if (response.status !== 200) {
        const body: any = await response.json().catch((error) => {
            console.error(`Failed to parse error response from ${context}:`, error);
            return null;
        });
        const defaultMessage = `${context} falhou com status ${response.status}`;
        const message = extractWeKnowErrorMessage(body, defaultMessage);
        throw new Error(message);
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

export async function executePivotGridComponent(
  body: string,
): Promise<PivotGridResponse> {
  const url = getUrl("TComponentApi/Execute");

  const response = await fetch(url, {
    method: "post",
    body,
    headers: { "Content-Type": "application/json" },
  });

  await throwIfError(response, "executePivotGridComponent");

  const rawResponse = await response.json() as RawPivotGridResponse;
  return normalizePivotGridResponse(rawResponse);
}

function normalizePivotGridResponse(raw: RawPivotGridResponse): PivotGridResponse {
  const rows = raw.rows.map((row) => normalizePivotGridRow(row, raw.cols));
  return {
    ...raw,
    rows,
  };
}

function normalizePivotGridRow(
  row: RawPivotGridRow,
  cols: RawPivotGridResponse["cols"],
): PivotGridResponse["rows"][number] {
  return cols.map((col, idx) => {
    const key = `d${idx + 1}` as const;
    const rawValue = row[key];
    if (rawValue === undefined) return null;
    return normalizeCellValue(rawValue, col.dataType);
  });
}

function normalizeCellValue(value: string, dataType: number): PivotGridCellValue {
  switch (dataType) {
    case TFieldType.ftBoolean:
      return normalizeBoolean(value);

    case TFieldType.ftSmallint:
    case TFieldType.ftInteger:
    case TFieldType.ftWord:
    case TFieldType.ftFloat:
    case TFieldType.ftCurrency:
    case TFieldType.ftBCD:
    case TFieldType.ftAutoInc:
    case TFieldType.ftLargeint:
    case TFieldType.ftFMTBcd:
    case TFieldType.ftLongWord:
    case TFieldType.ftShortint:
    case TFieldType.ftByte:
    case TFieldType.ftExtended:
    case TFieldType.ftSingle:
      return normalizeNumber(value);

    case TFieldType.ftDate:
    case TFieldType.ftTime:
    case TFieldType.ftDateTime:
    case TFieldType.ftTimeStamp:
    case TFieldType.ftOraTimeStamp:
    case TFieldType.ftTimeStampOffset:
      return normalizeDateTime(value);

    case TFieldType.ftUnknown:
    case TFieldType.ftString:
    case TFieldType.ftBytes:
    case TFieldType.ftVarBytes:
    case TFieldType.ftBlob:
    case TFieldType.ftMemo:
    case TFieldType.ftGraphic:
    case TFieldType.ftFmtMemo:
    case TFieldType.ftParadoxOle:
    case TFieldType.ftDBaseOle:
    case TFieldType.ftTypedBinary:
    case TFieldType.ftCursor:
    case TFieldType.ftFixedChar:
    case TFieldType.ftWideString:
    case TFieldType.ftADT:
    case TFieldType.ftArray:
    case TFieldType.ftReference:
    case TFieldType.ftDataSet:
    case TFieldType.ftOraBlob:
    case TFieldType.ftOraClob:
    case TFieldType.ftVariant:
    case TFieldType.ftInterface:
    case TFieldType.ftIDispatch:
    case TFieldType.ftGuid:
    case TFieldType.ftFixedWideChar:
    case TFieldType.ftWideMemo:
    case TFieldType.ftOraInterval:
    case TFieldType.ftConnection:
    case TFieldType.ftParams:
    case TFieldType.ftStream:
    case TFieldType.ftObject:
      return value;

    default:
      return value;
  }
}

function normalizeBoolean(value: string): PivotGridCellValue {
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "t", "yes", "y", "sim", "s"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "f", "no", "n", "nao", "não"].includes(normalized)) {
    return false;
  }
  return value;
}

function normalizeNumber(value: string): PivotGridCellValue {
  const parsed = parseLocalizedNumber(value);
  if (parsed == null || Number.isNaN(parsed)) {
    return value;
  }
  return parsed;
}

function normalizeDateTime(value: string): PivotGridCellValue {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

function parseLocalizedNumber(value: string): number | null {
  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const withoutSpaces = raw.replace(/\s+/g, "");
  const sanitized = withoutSpaces.replace(/[^\d,.-]/g, "");
  if (!sanitized) {
    return null;
  }

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");

  let normalized = sanitized;
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = sanitized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = sanitized.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    normalized = sanitized.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
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
