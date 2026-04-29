import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { MODEL_INSTRUCTIONS } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { z } from "zod/v4";
import { pipelineStorage } from "../pipeline/pipeline-context";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransientOpenAIError(error: unknown): boolean {
    return (
        error instanceof OpenAI.APIConnectionError ||
        error instanceof OpenAI.RateLimitError ||
        error instanceof OpenAI.InternalServerError
    );
}

// const MODEL = "gpt-5.1-codex-mini";
const MODEL = "gpt-5.4-mini";

const SHARED_OPTIONS = {
    model: MODEL,
    // reasoning: { effort: "low" as const },
    include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

// Preços por 1M tokens para gpt-5.1-codex-mini (USD)
// const PRICE_INPUT_PER_M = 0.25;
// const PRICE_CACHED_INPUT_PER_M = 0.025;
// const PRICE_OUTPUT_PER_M = 2.00;

// Preços por 1M tokens para gpt-5.4-mini (USD)
const PRICE_INPUT_PER_M = 0.75;
const PRICE_CACHED_INPUT_PER_M = 0.08;
const PRICE_OUTPUT_PER_M = 4.50;

function logCost(usage: OpenAI.Responses.Response["usage"]): void {
    if (!usage) return;
    const cachedInput = usage.input_tokens_details.cached_tokens;
    const uncachedInput = usage.input_tokens - cachedInput;
    const reasoningOutput = usage.output_tokens_details.reasoning_tokens;
    const regularOutput = usage.output_tokens - reasoningOutput;

    const usd =
        (uncachedInput * PRICE_INPUT_PER_M +
            cachedInput * PRICE_CACHED_INPUT_PER_M +
            regularOutput * PRICE_OUTPUT_PER_M +
            reasoningOutput * PRICE_OUTPUT_PER_M) /
        1_000_000;

    const rate = parseFloat(process.env.USD_BRL_RATE ?? "5.00");
    const brl = usd * rate;

    console.log(
        `[LLM cost] in=${uncachedInput} cached=${cachedInput} out=${regularOutput} reasoning=${reasoningOutput} | USD $${usd.toFixed(6)} → R$ ${brl.toFixed(4)}`
    );
}

export interface OpenAICallResult {
    response: OpenAI.Responses.Response;
    functionCalls: OpenAI.Responses.ResponseFunctionToolCall[];
}

export async function callOpenAI(
    input: ResponseInputItem[],
    tools: OpenAI.Responses.Tool[],
    toolChoice: "required" | "auto" = "auto"
): Promise<OpenAICallResult> {
    const ctx = pipelineStorage.getStore();
    const callIndex = ctx ? ctx.llmCalls.length : -1;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

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
            logCost(response.usage);
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAI",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    response,
                });
            }
            return { response, functionCalls };
        } catch (error) {
            lastError = error;
            if (attempt < 3 && isTransientOpenAIError(error)) {
                await sleep(1000);
                continue;
            }
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAI",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            throw error;
        }
    }
    throw lastError;
}

export async function callOpenAIForMessage(
    input: ResponseInputItem[]
): Promise<OpenAI.Responses.Response> {
    const ctx = pipelineStorage.getStore();
    const callIndex = ctx ? ctx.llmCalls.length : -1;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await openai.responses.create({
                ...SHARED_OPTIONS,
                instructions: MODEL_INSTRUCTIONS,
                input,
            });
            logCost(response.usage);
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAIForMessage",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    response,
                });
            }
            return response;
        } catch (error) {
            lastError = error;
            if (attempt < 3 && isTransientOpenAIError(error)) {
                await sleep(1000);
                continue;
            }
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAIForMessage",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            throw error;
        }
    }
    throw lastError;
}

export async function callOpenAIForStructuredMessage<T extends z.ZodTypeAny>(
    input: ResponseInputItem[],
    schema: T,
    schemaName: string
): Promise<{ response: OpenAI.Responses.Response; parsed: z.infer<T> }> {
    const ctx = pipelineStorage.getStore();
    const callIndex = ctx ? ctx.llmCalls.length : -1;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await openai.responses.parse({
                ...SHARED_OPTIONS,
                instructions: MODEL_INSTRUCTIONS,
                input,
                text: { format: zodTextFormat(schema, schemaName) },
            });
            logCost(response.usage);
            const parsed = response.output_parsed as z.infer<T> | null;
            if (parsed === null) {
                throw new Error("LLM não retornou conteúdo estruturado (recusa ou saída vazia)");
            }
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAIForStructuredMessage",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    response,
                });
            }
            return { response, parsed };
        } catch (error) {
            lastError = error;
            if (attempt < 3 && isTransientOpenAIError(error)) {
                await sleep(1000);
                continue;
            }
            if (ctx) {
                ctx.llmCalls.push({
                    index: callIndex,
                    callType: "callOpenAIForStructuredMessage",
                    startedAt,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startMs,
                    input,
                    error: error instanceof Error ? error.message : String(error),
                });
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
