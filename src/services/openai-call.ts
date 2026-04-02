import OpenAI from "openai";
import { MODEL_INSTRUCTIONS } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransientOpenAIError(error: unknown): boolean {
    return (
        error instanceof OpenAI.APIConnectionError ||
        error instanceof OpenAI.RateLimitError ||
        error instanceof OpenAI.InternalServerError
    );
}

// const MODEL = "gpt-5-mini-2025-08-07";
const MODEL = "gpt-5.1-codex-mini";

const SHARED_OPTIONS = {
    model: MODEL,
    reasoning: { effort: "low" as const },
    include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

export interface OpenAICallResult {
    response: OpenAI.Responses.Response;
    functionCalls: OpenAI.Responses.ResponseFunctionToolCall[];
    reasoningItems: OpenAI.Responses.ResponseOutputItem[];
}

export async function callOpenAI(
    input: ResponseInputItem[],
    tools: OpenAI.Responses.Tool[],
    toolChoice: "required" | "auto" = "required"
): Promise<OpenAICallResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await openai.responses.create({
                ...SHARED_OPTIONS,
                instructions: MODEL_INSTRUCTIONS,
                input,
                tools,
                tool_choice: toolChoice,
            });
            const functionCalls = extractFunctionCalls(response);
            const reasoningItems = response.output.filter((item) => item.type === "reasoning");
            return { response, functionCalls, reasoningItems };
        } catch (error) {
            lastError = error;
            if (attempt < 3 && isTransientOpenAIError(error)) {
                await sleep(1000);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export async function callOpenAIForMessage(
    input: ResponseInputItem[]
): Promise<OpenAI.Responses.Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            return await openai.responses.create({
                ...SHARED_OPTIONS,
                instructions: MODEL_INSTRUCTIONS,
                input,
            });
        } catch (error) {
            lastError = error;
            if (attempt < 3 && isTransientOpenAIError(error)) {
                await sleep(1000);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

export function extractFunctionCalls(
    response: OpenAI.Responses.Response
): OpenAI.Responses.ResponseFunctionToolCall[] {
    return response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === "function_call"
    );
}
