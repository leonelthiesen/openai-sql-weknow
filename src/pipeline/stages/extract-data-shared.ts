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

const MAX_EMPTY_RETRIES = 2;

const EMPTY_RESULT_OUTPUT =
    "Query executed successfully but returned 0 rows. The query was syntactically valid; no records match the criteria. " +
    "Decide how to respond: either call ask_followup to confirm with the user (e.g. broaden the period or remove a filter), " +
    "or call extract_data again with deliberately relaxed filters if you can clearly infer a less restrictive query. " +
    "Do NOT invent values for string fields you have not previously fetched via request_field_values.";

const EMPTY_CAP_FALLBACK_MESSAGE =
    "Nao encontrei dados para os criterios informados, mesmo apos tentar ajustar a consulta. Pode revisar o periodo, os filtros ou trazer mais detalhes?";

const EMPTY_CAP_FALLBACK_SUGGESTIONS = [
    "Ampliar o periodo de analise",
    "Remover algum filtro especifico",
    "Verificar se ha dados disponiveis para esse caso",
];

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
    let emptyRetryCount = 0;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        onAttemptStart?.(attempt);
        logger.tool("extract_data", { attempt, metadataId });

        const result = await handleExtractData(currentArgs, metadataId);

        if (result.success) {
            // Keep only cols that have a completeName
            const keptColEntries = result.data.cols
                .map((col, idx) => ({ col, idx }))
                .filter(({ col }) => !!col.completeName);

            // Original indices of section-15 cols (among kept cols)
            const section15OrigIndices = new Set(
                keptColEntries
                    .filter(({ col }) => col.section === 15)
                    .map(({ idx }) => idx)
            );

            // Filter rows: drop rows with null/empty in any section-15 col, then remap to array
            const filteredRows = (result.data.rows ?? [])
                .filter(row => {
                    let hasAllValuesEmpty = [...section15OrigIndices].every(origIdx => {
                        const val = row[origIdx];
                        return val === null || val === undefined || val === "";
                    });

                    return !hasAllValuesEmpty;
                })
                .map(row => keptColEntries.map(({ idx: origIdx }) => row[origIdx] ?? null));

            result.data.cols = keptColEntries.map(({ col }) => col);
            result.data.rows = filteredRows;

            // Empty result: re-prompt the LLM (capped) so it can ask_followup or relax filters.
            if (result.data.rows.length === 0) {
                onDataReceived?.(0);
                emptyRetryCount++;

                if (emptyRetryCount > MAX_EMPTY_RETRIES) {
                    logger.warn("openai", `Empty-result cap reached (${MAX_EMPTY_RETRIES}); falling back to ask_followup`);
                    openAiItems.push({
                        type: "function_call_output",
                        callId: currentCall.call_id,
                        output: EMPTY_RESULT_OUTPUT,
                    });

                    const fallbackCallId = `${currentCall.call_id}-empty-result-exhausted`;
                    openAiItems.push({
                        type: "function_call",
                        callId: fallbackCallId,
                        name: "ask_followup",
                        arguments: JSON.stringify({
                            toolName: "ask_followup",
                            message: EMPTY_CAP_FALLBACK_MESSAGE,
                            userMessageSuggestions: EMPTY_CAP_FALLBACK_SUGGESTIONS,
                        }),
                    });
                    const fallback = handleAskFollowup(
                        {
                            toolName: "ask_followup",
                            message: EMPTY_CAP_FALLBACK_MESSAGE,
                            userMessageSuggestions: EMPTY_CAP_FALLBACK_SUGGESTIONS,
                        },
                        fallbackCallId,
                    );
                    openAiItems.push(...fallback.openAiItems);

                    return {
                        executionData: result.data,
                        finalCall: currentCall,
                        finalArgs: currentArgs,
                        finalResponseOutput: currentResponseOutput,
                        earlyReturn: {
                            structuredOutput: fallback.structuredOutput,
                            openAiItems,
                            executionData: result.data,
                        },
                    };
                }

                logger.info("openai", `Empty-retry ${emptyRetryCount}/${MAX_EMPTY_RETRIES}: requesting next action from model`);

                const next = await requestCorrectedCall({
                    failedCall: currentCall,
                    errorOutput: EMPTY_RESULT_OUTPUT,
                    currentResponseOutput,
                    baseInput,
                    tools,
                    openAiItems,
                });

                if (!next) {
                    logger.error("openai", `Empty-retry ${emptyRetryCount}: model returned no function_call`);
                    break;
                }

                if (next.call.name === "ask_followup") {
                    let followupArgs;
                    try {
                        followupArgs = parseToolArgs("ask_followup", next.call.arguments);
                    } catch (parseError) {
                        if (!(parseError instanceof ToolValidationError)) throw parseError;
                        logger.error("openai", `Empty-retry ${emptyRetryCount}: ask_followup parse error`, {
                            error: parseError.message,
                        });
                        break;
                    }

                    if (followupArgs?.toolName === "ask_followup") {
                        const followupResult = handleAskFollowup(followupArgs, next.call.call_id);
                        openAiItems.push(...followupResult.openAiItems);
                        return {
                            finalCall: currentCall,
                            finalArgs: currentArgs,
                            finalResponseOutput: currentResponseOutput,
                            earlyReturn: {
                                structuredOutput: followupResult.structuredOutput,
                                openAiItems,
                            },
                        };
                    }
                    break;
                }

                if (next.call.name !== "extract_data") {
                    logger.error("openai", `Empty-retry ${emptyRetryCount}: model did not return extract_data`);
                    break;
                }

                const parsedNext = await parseWithRetry<ExtractDataArgs>({
                    call: next.call,
                    responseOutput: next.responseOutput,
                    baseInput,
                    tools,
                    openAiItems,
                    parseOptions: { availableFieldNames: parseOptions?.availableFieldNames },
                });

                if (!parsedNext || parsedNext.args.toolName !== "extract_data") {
                    break;
                }

                currentCall = parsedNext.call;
                currentArgs = parsedNext.args;
                currentResponseOutput = parsedNext.responseOutput;
                logger.info("openai", `Empty-retry ${emptyRetryCount}: new query generated`);
                continue;
            }

            onDataReceived?.(result.data.rows.length);
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
