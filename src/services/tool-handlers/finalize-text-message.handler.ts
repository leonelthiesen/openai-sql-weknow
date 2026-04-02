import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { getExtractTextValuesToolDefinition } from "../../models/tool-definitions";
import { logger } from "../../utils/logger";
import { parseToolArgs } from "../../utils/tool-args-parser";
import type {
    ExtractTextValuesArgs,
    TextValueItem,
    TextValueObject,
    TextValuePrimitive,
} from "../../types/tool-args.types";
import type { OpenAiItem } from "../chat.service";
import { callOpenAI, callOpenAIForMessage, extractFunctionCalls } from "../openai-call";

export interface NormalizedTextValue {
    label?: string;
    value: string;
    unit?: string;
}

export interface FinalizeTextMessageResult {
    success: boolean;
    finalMessage?: string;
    openAiItems: OpenAiItem[];
    values?: NormalizedTextValue[];
    failureReason?: string;
}

function isTextValueObject(value: TextValueItem): value is TextValueObject {
    return typeof value === "object" && value !== null && "value" in value;
}

function normalizePrimitive(value: TextValuePrimitive | null): string {
    if (value === null) return "nulo";
    if (typeof value === "boolean") return value ? "sim" : "nao";
    return String(value);
}

function normalizeValues(values: TextValueItem[]): NormalizedTextValue[] {
    return values.map((item) => {
        if (isTextValueObject(item)) {
            return {
                label: item.label,
                value: normalizePrimitive(item.value),
                unit: item.unit,
            };
        }

        return { value: normalizePrimitive(item) };
    });
}

function buildValueExtractionDeveloperMessage(): string {
    return [
        "The extract_data tool already executed successfully and the data summary/CSV context is available.",
        "Now call extract_text_values and return only the values needed for the final TEXT response.",
        "Use values as a list. Values may be primitive or objects with label/value/unit.",
        "Do not write the final user-facing message in this step.",
    ].join("\n");
}

function buildFinalTextDeveloperMessage(values: NormalizedTextValue[]): string {
    const mode = values.length <= 5 ? "LIST" : "SUMMARY";

    return [
        "Escreva a mensagem final para o usuario em portugues (pt-BR).",
        "Use linguagem simples para usuarios nao tecnicos.",
        `Modo de resposta: ${mode}.`,
        "Se o modo for LIST, mostre os itens de forma objetiva.",
        "Se o modo for SUMMARY, destaque os principais insights sem listar tudo.",
        "Nao invente valores.",
        "Valores normalizados para usar na mensagem:",
        JSON.stringify(values),
    ].join("\n");
}

function extractResponseText(response: OpenAI.Responses.Response): string | undefined {
    const outputText = (response as any).output_text;
    if (typeof outputText === "string" && outputText.trim()) {
        return outputText.trim();
    }

    for (const item of response.output as any[]) {
        if (item?.type !== "message" || !Array.isArray(item.content)) continue;

        const chunks: string[] = [];
        for (const contentPart of item.content) {
            if (contentPart?.type === "output_text" && typeof contentPart.text === "string") {
                chunks.push(contentPart.text);
            }
        }

        if (chunks.length > 0) {
            return chunks.join("\n").trim();
        }
    }

    return undefined;
}

function toFunctionCallOutputItem(callId: string, output: string): ResponseInputItem {
    return {
        type: "function_call_output",
        call_id: callId,
        output,
    } as ResponseInputItem;
}

export async function handleFinalizeTextMessage(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    extractDataCallOutput: OpenAiItem
): Promise<FinalizeTextMessageResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    const valueExtractionDeveloperMessage = buildValueExtractionDeveloperMessage();
    openAiItems.push({
        type: "message",
        role: "developer",
        content: valueExtractionDeveloperMessage,
    });

    const secondCallInput: ResponseInputItem[] = [
        ...baseInput,
        ...(lastResponseOutput as unknown as ResponseInputItem[]),
        {
            type: extractDataCallOutput.type,
            call_id: extractDataCallOutput.callId || "",
            output: extractDataCallOutput.output || "",
        } as ResponseInputItem,
        {
            role: "developer",
            content: valueExtractionDeveloperMessage,
        } as ResponseInputItem,
    ];

    const { response: valuesResponse } = await callOpenAI(secondCallInput, [getExtractTextValuesToolDefinition()]);
    const valueCalls = extractFunctionCalls(valuesResponse);

    if (valueCalls.length === 0 || valueCalls[0]!.name !== "extract_text_values") {
        logger.warn("extract_text_values", "No valid function_call in text values response");
        return {
            success: false,
            openAiItems,
            failureReason: "No valid extract_text_values tool call.",
        };
    }

    const valueCall = valueCalls[0]!;
    const parsed = parseToolArgs("extract_text_values", valueCall.arguments);

    if (parsed.toolName !== "extract_text_values") {
        return {
            success: false,
            openAiItems,
            failureReason: "Invalid extract_text_values tool payload.",
        };
    }

    const valueArgs = parsed as ExtractTextValuesArgs;
    const normalizedValues = normalizeValues(valueArgs.values);

    if (normalizedValues.length === 0) {
        return {
            success: false,
            openAiItems,
            failureReason: "extract_text_values returned an empty values list.",
        };
    }

    openAiItems.push({
        type: "function_call",
        callId: valueCall.call_id,
        name: valueCall.name,
        arguments: valueCall.arguments,
    });

    const normalizedValuesJson = JSON.stringify({ values: normalizedValues });
    openAiItems.push({
        type: "function_call_output",
        callId: valueCall.call_id,
        output: normalizedValuesJson,
    });

    const finalMessageDeveloperMessage = buildFinalTextDeveloperMessage(normalizedValues);
    openAiItems.push({
        type: "message",
        role: "developer",
        content: finalMessageDeveloperMessage,
    });

    const thirdCallInput: ResponseInputItem[] = [
        ...secondCallInput,
        ...(valuesResponse.output as unknown as ResponseInputItem[]),
        toFunctionCallOutputItem(valueCall.call_id, normalizedValuesJson),
        {
            role: "developer",
            content: finalMessageDeveloperMessage,
        } as ResponseInputItem,
    ];

    const finalResponse = await callOpenAIForMessage(thirdCallInput);
    const finalMessage = extractResponseText(finalResponse);

    if (!finalMessage) {
        logger.warn("text_final_message", "No assistant text found in final OpenAI response");
        return {
            success: false,
            openAiItems,
            values: normalizedValues,
            failureReason: "No final message returned by model.",
        };
    }

    openAiItems.push({
        type: "message",
        role: "assistant",
        content: finalMessage,
    });

    logger.toolResult("text_final_message", {
        success: true,
        durationMs: Date.now() - startTime,
        valuesCount: normalizedValues.length,
    });

    return {
        success: true,
        finalMessage,
        values: normalizedValues,
        openAiItems,
    };
}
