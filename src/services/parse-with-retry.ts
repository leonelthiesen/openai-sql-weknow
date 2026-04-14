import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "./chat.service";
import type { ParsedToolArgs } from "../types/tool-args.types";
import { parseToolArgs, ToolValidationError } from "../utils/tool-args-parser";
import { requestCorrectedCall, MAX_RETRY_ATTEMPTS } from "./llm-retry";
import { logger } from "../utils/logger";

export interface ParseWithRetryParams {
    call: OpenAI.Responses.ResponseFunctionToolCall;
    responseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    openAiItems: OpenAiItem[];
    parseOptions?: { availableFieldNames?: string[] };
}

export interface ParseWithRetryResult<T extends ParsedToolArgs = ParsedToolArgs> {
    args: T;
    call: OpenAI.Responses.ResponseFunctionToolCall;
    responseOutput: unknown[];
}

/**
 * Attempts to parse tool arguments, retrying via LLM correction if parsing
 * fails with a ToolValidationError. Returns null if all attempts are exhausted.
 */
export async function parseWithRetry<T extends ParsedToolArgs = ParsedToolArgs>(
    params: ParseWithRetryParams
): Promise<ParseWithRetryResult<T> | null> {
    let { call, responseOutput } = params;
    const { baseInput, tools, openAiItems, parseOptions } = params;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        try {
            const args = parseToolArgs(call.name, call.arguments, {
                availableFieldNames: parseOptions?.availableFieldNames,
            }) as T;
            return { args, call, responseOutput };
        } catch (error) {
            if (!(error instanceof ToolValidationError)) throw error;

            logger.warn("parse_with_retry", `Parse failed on attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`, {
                tool: call.name,
                callId: call.call_id,
                error: error.message,
            });

            if (attempt >= MAX_RETRY_ATTEMPTS) {
                return null;
            }

            const next = await requestCorrectedCall({
                failedCall: call,
                errorOutput: `Tool argument parse failed: ${error.message}. Please fix tool arguments and try again.`,
                currentResponseOutput: responseOutput,
                baseInput,
                tools,
                openAiItems,
            });

            if (!next) {
                return null;
            }

            call = next.call;
            responseOutput = next.responseOutput;
        }
    }

    return null;
}
