import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import type { OpenAiItem } from "./chat.service";
import type { OpenAIResponseSchema } from "../constants";
import { parseToolArgs, ToolValidationError } from "../utils/tool-args-parser";
import type { ExtractDataArgs } from "../types/tool-args.types";
import { callOpenAI, callOpenAIForMessage } from "./openai-call";
import { handleAskFollowup } from "./tool-handlers/ask-followup.handler";
import { handleExtractData } from "./tool-handlers/extract-data.handler";
import { handleFinalizeTextMessage } from "./tool-handlers/finalize-text-message.handler";
import { handleRenderChart } from "./tool-handlers/render-chart.handler";
import { logger } from "../utils/logger";
import { buildDataSummary } from "../utils/obfuscate-pivot-data";
import { generatePivotCSV } from "../utils/pivot-grid-data-csv-transformer";
import { PivotGridResponse } from "../types/pivot-grid-response.types";
import type OpenAI from "openai";

const MAX_RETRY_ATTEMPTS = 3;

interface CreateModelResponseOptions {
    suggestConversationName?: boolean;
    userTextMessage?: string;
    availableFieldNames?: string[];
}

export interface ToolCallResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: PivotGridResponse;
    pivotCsv?: string;
    errorResponse?: string | Object;
}

// ── Module-level helpers ─────────────────────────────────────────────────────

function followupFallback(message: string, suggestions: string[], callId: string) {
    return handleAskFollowup(
        { toolName: "ask_followup", message, userMessageSuggestions: suggestions },
        callId
    );
}

async function requestNextCallAfterParseError(
    call: OpenAI.Responses.ResponseFunctionToolCall,
    responseOutput: unknown[],
    parseErrorMessage: string,
    attempt: number,
    context: string,
    baseInput: ResponseInputItem[],
    primaryTools: OpenAI.Responses.Tool[],
    openAiItems: OpenAiItem[]
): Promise<{
    call: OpenAI.Responses.ResponseFunctionToolCall;
    responseOutput: unknown[];
} | null> {
    const parseErrorOutput = `Tool argument parse failed: ${parseErrorMessage}. Please fix tool arguments and try again.`;

    openAiItems.push({
        type: "function_call_output",
        callId: call.call_id,
        output: parseErrorOutput,
    });

    if (attempt >= MAX_RETRY_ATTEMPTS) {
        logger.error("openai", `Parse failed at ${context} on final attempt`, {
            attempt,
            callId: call.call_id,
            error: parseErrorMessage,
        });
        return null;
    }

    logger.warn("openai", `Parse failed at ${context}, requesting corrected tool call`, {
        attempt,
        callId: call.call_id,
        error: parseErrorMessage,
    });

    const parseRetryInput: ResponseInputItem[] = [
        ...baseInput,
        ...(responseOutput as unknown as ResponseInputItem[]),
        {
            type: "function_call_output",
            call_id: call.call_id,
            output: parseErrorOutput,
        } as ResponseInputItem,
    ];

    const {
        response: parseRetryResponse,
        functionCalls: parseRetryCalls,
        reasoningItems: parseRetryReasoning,
    } = await callOpenAI(parseRetryInput, primaryTools);

    for (const item of parseRetryReasoning) {
        openAiItems.push({ type: "reasoning", reasoningItem: item });
    }

    if (parseRetryCalls.length === 0) {
        logger.error("openai", `Parse recovery at ${context}: model returned no function_call`);
        return null;
    }

    const nextCall = parseRetryCalls[0]!;
    openAiItems.push({
        type: "function_call",
        callId: nextCall.call_id,
        name: nextCall.name,
        arguments: nextCall.arguments,
    });

    return {
        call: nextCall,
        responseOutput: parseRetryResponse.output,
    };
}

// ── Main orchestration ───────────────────────────────────────────────────────

export async function createModelResponse(
    input: ResponseInputItem[],
    metadataId: number,
    options?: CreateModelResponseOptions
): Promise<ToolCallResult> {
    const openAiItems: OpenAiItem[] = [];

    try {
        let errorResponse: string | Object | undefined;

        const conversationNameSuggestionPromise =
            options?.suggestConversationName && options.userTextMessage?.trim()
                ? generateConversationNameSuggestion(options.userTextMessage)
                : Promise.resolve(undefined);

        const withConversationNameSuggestion = async (
            structuredOutput: OpenAIResponseSchema
        ): Promise<OpenAIResponseSchema> => {
            const suggestion = await conversationNameSuggestionPromise;
            if (!suggestion) return structuredOutput;
            return { ...structuredOutput, conversationNameSuggestion: suggestion };
        };

        // ── First call: extract_data or ask_followup ─────────────────────────
        const primaryTools = [getExtractDataToolDefinition(), getAskFollowupToolDefinition()];

        const { response: firstResponse, functionCalls: firstCalls, reasoningItems } =
            await callOpenAI(input, primaryTools);

        if (firstCalls.length === 0) {
            logger.error("openai", "1st call: no function_call in output");
            throw new Error("Model did not return a function call.");
        }
        if (firstCalls.length > 1) {
            logger.warn("openai", `1st call: ${firstCalls.length} function calls returned, using first`);
        }

        for (const item of reasoningItems) {
            openAiItems.push({ type: "reasoning", reasoningItem: item });
        }

        let primaryCall = firstCalls[0]!;
        openAiItems.push({
            type: "function_call",
            callId: primaryCall.call_id,
            name: primaryCall.name,
            arguments: primaryCall.arguments,
        });

        let primaryArgs: ReturnType<typeof parseToolArgs> | undefined;
        let primaryParseOutput: unknown[] = firstResponse.output;
        let primaryParseAttempt = 1;

        while (!primaryArgs) {
            try {
                primaryArgs = parseToolArgs(primaryCall.name, primaryCall.arguments, {
                    availableFieldNames: options?.availableFieldNames,
                });
            } catch (error) {
                if (!(error instanceof ToolValidationError)) throw error;

                const next = await requestNextCallAfterParseError(
                    primaryCall,
                    primaryParseOutput,
                    error.message,
                    primaryParseAttempt,
                    "primary",
                    input,
                    primaryTools,
                    openAiItems
                );

                if (!next) {
                    const fb = followupFallback(
                        "Nao consegui processar a resposta gerada. Pode reformular sua pergunta para eu tentar novamente?",
                        [
                            "Reformule a pergunta com mais clareza",
                            "Detalhe melhor quais dados voce precisa",
                            "Tente uma consulta mais simples e direta",
                        ],
                        `${primaryCall.call_id}-primary-parse-error`
                    );
                    openAiItems.push(...fb.openAiItems);
                    return {
                        structuredOutput: await withConversationNameSuggestion(fb.structuredOutput),
                        openAiItems,
                        errorResponse: error.message,
                    };
                }

                primaryCall = next.call;
                primaryParseOutput = next.responseOutput;
                primaryParseAttempt += 1;
            }
        }

        logger.tool(primaryCall.name, { metadataId });

        // ── ask_followup: return immediately ─────────────────────────────────
        if (primaryArgs.toolName === "ask_followup") {
            const result = handleAskFollowup(primaryArgs, primaryCall.call_id);
            openAiItems.push(...result.openAiItems);
            return {
                structuredOutput: await withConversationNameSuggestion(result.structuredOutput),
                openAiItems,
            };
        }

        if (primaryArgs.toolName !== "extract_data") {
            throw new Error(`Unexpected tool: ${primaryArgs.toolName}`);
        }

        // ── extract_data: execute with retry loop ─────────────────────────────
        let executionData: PivotGridResponse | undefined;
        let currentCall = primaryCall;
        let currentArgs: ExtractDataArgs = primaryArgs;
        let lastResponse = firstResponse;

        for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
            logger.tool("extract_data", { attempt, metadataId });

            const result = await handleExtractData(currentArgs, metadataId);

            if (result.success) {
                executionData = result.data;
                errorResponse = undefined;
                break;
            }

            errorResponse = result.error.raw ?? result.error.message;
            logger.error("openai", `Attempt ${attempt}/${MAX_RETRY_ATTEMPTS} failed`, {
                error: result.error.message,
            });

            if (attempt >= MAX_RETRY_ATTEMPTS || !result.error.retriable) {
                if (!result.error.retriable) {
                    logger.error("openai", "Non-retriable error, stopping retries");
                }
                break;
            }

            const errorOutput = `Query execution failed with error: ${result.error.message}. Please fix the query and try again.`;

            openAiItems.push({
                type: "function_call_output",
                callId: currentCall.call_id,
                output: errorOutput,
            });

            const retryInput: ResponseInputItem[] = [
                ...input,
                ...(lastResponse.output as unknown as ResponseInputItem[]),
                {
                    type: "function_call_output",
                    call_id: currentCall.call_id,
                    output: errorOutput,
                } as ResponseInputItem,
            ];

            const { response: retryResponse, functionCalls: retryCalls, reasoningItems: retryReasoning } =
                await callOpenAI(retryInput, primaryTools);

            for (const item of retryReasoning) {
                openAiItems.push({ type: "reasoning", reasoningItem: item });
            }

            if (retryCalls.length === 0 || retryCalls[0]!.name !== "extract_data") {
                logger.error("openai", `Retry ${attempt}: model did not return extract_data`);

                if (retryCalls.length > 0 && retryCalls[0]!.name === "ask_followup") {
                    const followupCall = retryCalls[0]!;
                    let followupArgs: ReturnType<typeof parseToolArgs> | undefined;
                    try {
                        followupArgs = parseToolArgs("ask_followup", followupCall.arguments);
                    } catch (error) {
                        if (error instanceof ToolValidationError) {
                            await requestNextCallAfterParseError(
                                followupCall,
                                retryResponse.output,
                                error.message,
                                attempt,
                                "retry-ask_followup",
                                input,
                                primaryTools,
                                openAiItems
                            );
                            break;
                        }
                        throw error;
                    }

                    openAiItems.push({
                        type: "function_call",
                        callId: followupCall.call_id,
                        name: followupCall.name,
                        arguments: followupCall.arguments,
                    });

                    if (followupArgs?.toolName === "ask_followup") {
                        const followupResult = handleAskFollowup(followupArgs, followupCall.call_id);
                        openAiItems.push(...followupResult.openAiItems);
                        return {
                            structuredOutput: await withConversationNameSuggestion(
                                followupResult.structuredOutput
                            ),
                            openAiItems,
                            errorResponse,
                        };
                    }
                }
                break;
            }

            currentCall = retryCalls[0]!;
            openAiItems.push({
                type: "function_call",
                callId: currentCall.call_id,
                name: currentCall.name,
                arguments: currentCall.arguments,
            });

            try {
                currentArgs = parseToolArgs("extract_data", currentCall.arguments, {
                    availableFieldNames: options?.availableFieldNames,
                }) as ExtractDataArgs;
            } catch (error) {
                if (!(error instanceof ToolValidationError)) throw error;

                const next = await requestNextCallAfterParseError(
                    currentCall,
                    retryResponse.output,
                    error.message,
                    attempt + 1,
                    "retry-extract_data",
                    input,
                    primaryTools,
                    openAiItems
                );

                if (!next) break;

                currentCall = next.call;
                lastResponse = { ...lastResponse, output: next.responseOutput } as OpenAI.Responses.Response;

                try {
                    currentArgs = parseToolArgs("extract_data", currentCall.arguments, {
                        availableFieldNames: options?.availableFieldNames,
                    }) as ExtractDataArgs;
                } catch (secondError) {
                    if (secondError instanceof ToolValidationError) {
                        await requestNextCallAfterParseError(
                            currentCall,
                            next.responseOutput,
                            secondError.message,
                            attempt + 2,
                            "retry-extract_data-second",
                            input,
                            primaryTools,
                            openAiItems
                        );
                        break;
                    }
                    throw secondError;
                }

                logger.info("openai", `Retry ${attempt}: new query generated after parse error`);
                continue;
            }
            lastResponse = retryResponse;
            logger.info("openai", `Retry ${attempt}: new query generated`);
        }

        // ── Build pivot CSV and data output ──────────────────────────────────
        let pivotCsv: string | undefined;
        if (executionData) {
            try {
                pivotCsv = generatePivotCSV(executionData, currentArgs.query);
            } catch {
                // pivot CSV generation failed, continue without it
            }
        }

        let dataOutput: string;
        if (executionData) {
            dataOutput = buildDataSummary(executionData, pivotCsv);
        } else if (errorResponse) {
            dataOutput = `Query execution failed: ${typeof errorResponse === "string" ? errorResponse : JSON.stringify(errorResponse)}`;
        } else {
            dataOutput = "Query executed but no data was returned.";
        }

        const extractDataFunctionCallOutput: OpenAiItem = {
            type: "function_call_output",
            callId: currentCall.call_id,
            output: dataOutput,
        };
        openAiItems.push(extractDataFunctionCallOutput);

        // ── If CHART or TEXT, make a second call to finalize output ───────────
        let chartConfig: object | undefined;
        let finalMessage = currentArgs.message;

        if (currentArgs.renderType === "CHART") {
            try {
                const chartResult = await handleRenderChart(
                    input,
                    lastResponse.output,
                    extractDataFunctionCallOutput,
                    executionData,
                    currentArgs.query
                );
                openAiItems.push(...chartResult.openAiItems);
                chartConfig = chartResult.chartConfig;
            } catch (error) {
                logger.error("openai", "CHART finalization failed", { error: String(error) });
                const fb = followupFallback(
                    "Tive um problema ao gerar o grafico. Pode tentar reformular a solicitacao?",
                    [
                        "Solicite um tipo de grafico diferente",
                        "Tente uma consulta mais simples",
                        "Prefira visualizar como tabela",
                    ],
                    `${currentCall.call_id}-chart-error`
                );
                openAiItems.push(...fb.openAiItems);
                return {
                    structuredOutput: await withConversationNameSuggestion(fb.structuredOutput),
                    openAiItems,
                    executionData,
                    pivotCsv,
                    errorResponse,
                };
            }
        } else if (currentArgs.renderType === "TEXT") {
            try {
                const textResult = await handleFinalizeTextMessage(
                    input,
                    lastResponse.output,
                    extractDataFunctionCallOutput
                );
                openAiItems.push(...textResult.openAiItems);

                if (!textResult.success || !textResult.finalMessage) {
                    const fb = followupFallback(
                        "Nao consegui consolidar os valores finais para responder com seguranca. Pode reformular a pergunta com mais contexto?",
                        [
                            "Mostre apenas o total do periodo atual",
                            "Liste os 5 principais valores para eu escolher",
                            "Especifique o indicador e o periodo desejado",
                        ],
                        `${currentCall.call_id}-text-fallback`
                    );
                    openAiItems.push(...fb.openAiItems);
                    return {
                        structuredOutput: await withConversationNameSuggestion(fb.structuredOutput),
                        openAiItems,
                        executionData,
                        pivotCsv,
                        errorResponse,
                    };
                }

                finalMessage = textResult.finalMessage;
            } catch (error) {
                logger.error("openai", "TEXT finalization failed", { error: String(error) });
                const fb = followupFallback(
                    "Tive um problema ao montar a resposta final em texto. Pode tentar novamente com um recorte mais especifico?",
                    [
                        "Quero apenas um numero consolidado",
                        "Traga os 3 principais valores",
                        "Compare somente os dois ultimos periodos",
                    ],
                    `${currentCall.call_id}-text-error`
                );
                openAiItems.push(...fb.openAiItems);
                return {
                    structuredOutput: await withConversationNameSuggestion(fb.structuredOutput),
                    openAiItems,
                    executionData,
                    pivotCsv,
                    errorResponse,
                };
            }
        }

        // ── Return final result ───────────────────────────────────────────────
        return {
            structuredOutput: await withConversationNameSuggestion({
                action: "EXTRACT_DATA",
                message: finalMessage,
                userMessageSuggestions: currentArgs.userMessageSuggestions,
                renderType: currentArgs.renderType,
                query: currentArgs.query,
                chartConfig,
            }),
            openAiItems,
            executionData,
            pivotCsv,
            errorResponse,
        };
    } catch (error: unknown) {
        logger.error("openai", "Unhandled error in createModelResponse", { error: String(error) });
        const fb = followupFallback(
            "Ocorreu um erro inesperado ao processar sua solicitacao. Tente novamente.",
            ["Reformule a pergunta", "Tente uma consulta mais simples"],
            "top-level-error"
        );
        openAiItems.push(...fb.openAiItems);
        return {
            structuredOutput: fb.structuredOutput,
            openAiItems,
            errorResponse: error instanceof Error ? error.message : String(error),
        };
    }
}

// ── Conversation name suggestion ─────────────────────────────────────────────

function sanitizeConversationName(text: string): string {
    return text
        .replace(/[\r\n\t]+/g, " ")
        .replace(/^['"\s]+|['"\s]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 60);
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

async function generateConversationNameSuggestion(
    userTextMessage: string
): Promise<string | undefined> {
    try {
        const prompt = [
            "Sugira um nome curto para a conversa em portugues (pt-BR).",
            "Regras:",
            "- Retorne somente o nome, sem aspas e sem pontuacao final.",
            "- Maximo de 6 palavras.",
            "- Seja especifico ao assunto principal da pergunta do usuario.",
            `Pergunta do usuario: ${userTextMessage}`,
        ].join("\n");

        const response = await callOpenAIForMessage([
            {
                role: "developer",
                content: prompt,
            } as ResponseInputItem,
        ]);

        const rawSuggestion = extractResponseText(response);
        if (!rawSuggestion) return undefined;

        const suggestion = sanitizeConversationName(rawSuggestion);
        return suggestion || undefined;
    } catch (error) {
        logger.warn("conversation_name", "Failed to generate conversation name suggestion", {
            error: String(error),
        });
        return undefined;
    }
}
