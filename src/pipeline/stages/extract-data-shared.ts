import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { PivotGridResponse } from "../../types/pivot-grid-response.types";
import type { OpenAiItem } from "../../services/chat.service";
import { handleExtractData } from "../../services/tool-handlers/extract-data.handler";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";
import { requestCorrectedCall, MAX_RETRY_ATTEMPTS } from "../../services/llm-retry";
import { parseWithRetry } from "../../services/parse-with-retry";
import { parseToolArgs, ToolValidationError } from "../../utils/tool-args-parser";
import { logger } from "../../utils/logger";

// Re-export for stage consumers
export { MAX_RETRY_ATTEMPTS } from "../../services/llm-retry";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ExecuteWithRetryParams {
    initialCall: OpenAI.Responses.ResponseFunctionToolCall;
    initialArgs: ExtractDataArgs;
    initialResponseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    metadataId: number;
    openAiItems: OpenAiItem[];
    parseOptions?: { availableFieldNames?: string[] };
    onAttemptStart?: (attempt: number) => void;
    onDataReceived?: (rowCount: number) => void;
}

export interface ExecuteWithRetryResult {
    executionData?: PivotGridResponse;
    errorResponse?: string | Object;
    finalCall: OpenAI.Responses.ResponseFunctionToolCall;
    finalArgs: ExtractDataArgs;
    finalResponseOutput: unknown[];
    earlyReturn?: {
        structuredOutput: import("../../constants").OpenAIResponseSchema;
        openAiItems: OpenAiItem[];
        executionData?: PivotGridResponse;
        errorResponse?: string | Object;
    };
}

// ── Extract data execution with retry ────────────────────────────────────────

export async function executeExtractDataWithRetry(
    params: ExecuteWithRetryParams
): Promise<ExecuteWithRetryResult> {
    const { baseInput, tools, metadataId, openAiItems, parseOptions, onAttemptStart, onDataReceived } = params;
    let currentCall = params.initialCall;
    let currentArgs = params.initialArgs;
    let currentResponseOutput = params.initialResponseOutput;
    let errorResponse: string | Object | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        onAttemptStart?.(attempt);
        logger.tool("extract_data", { attempt, metadataId });

        const result = await handleExtractData(currentArgs, metadataId);

        if (result.success) {
            onDataReceived?.(result.data.rows ? result.data.rows.length : 0);
            return {
                executionData: result.data,
                finalCall: currentCall,
                finalArgs: currentArgs,
                finalResponseOutput: currentResponseOutput,
            };
        }

        errorResponse = result.error.raw ?? result.error.message;
        logger.error("openai", `Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed`, {
            error: result.error.message,
        });

        const errorOutput = `Query execution failed with error: ${result.error.message}. Please fix the query and try again.`;
        openAiItems.push({
            type: "function_call_output",
            callId: currentCall.call_id,
            output: errorOutput,
        });

        if (attempt >= MAX_RETRY_ATTEMPTS || !result.error.retriable) {
            if (!result.error.retriable) {
                logger.error("openai", "Non-retriable error, stopping retries");
            }
            break;
        }

        const next = await requestCorrectedCall({
            failedCall: currentCall,
            errorOutput,
            currentResponseOutput,
            baseInput,
            tools,
            openAiItems,
        });

        if (!next) {
            logger.error("openai", `Retry ${attempt}: model returned no function_call`);
            break;
        }

        // Model switched to ask_followup
        if (next.call.name === "ask_followup") {
            let followupArgs;
            try {
                followupArgs = parseToolArgs("ask_followup", next.call.arguments);
            } catch (parseError) {
                if (!(parseError instanceof ToolValidationError)) throw parseError;
                logger.error("openai", `Retry ${attempt}: ask_followup parse error`, {
                    error: parseError.message,
                });
                break;
            }

            if (followupArgs?.toolName === "ask_followup") {
                const followupResult = handleAskFollowup(followupArgs, next.call.call_id);
                openAiItems.push(...followupResult.openAiItems);
                return {
                    errorResponse,
                    finalCall: currentCall,
                    finalArgs: currentArgs,
                    finalResponseOutput: currentResponseOutput,
                    earlyReturn: {
                        structuredOutput: followupResult.structuredOutput,
                        openAiItems,
                        errorResponse,
                    },
                };
            }
            break;
        }

        if (next.call.name !== "extract_data") {
            logger.error("openai", `Retry ${attempt}: model did not return extract_data`);
            break;
        }

        // Parse the corrected extract_data args (with retry)
        const parsed = await parseWithRetry<ExtractDataArgs>({
            call: next.call,
            responseOutput: next.responseOutput,
            baseInput,
            tools,
            openAiItems,
            parseOptions: { availableFieldNames: parseOptions?.availableFieldNames },
        });

        if (!parsed || parsed.args.toolName !== "extract_data") {
            break;
        }

        currentCall = parsed.call;
        currentArgs = parsed.args;
        currentResponseOutput = parsed.responseOutput;
        logger.info("openai", `Retry ${attempt}: new query generated`);
    }

    return {
        errorResponse,
        finalCall: currentCall,
        finalArgs: currentArgs,
        finalResponseOutput: currentResponseOutput,
    };
}
