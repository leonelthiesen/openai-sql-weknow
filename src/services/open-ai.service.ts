import type { ResponseInputItem } from "openai/resources/responses/responses";
import type OpenAI from "openai";
import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import type { OpenAiItem } from "./chat.service";
import type { OpenAIResponseSchema } from "../constants";
import type { ExtractDataArgs } from "../types/tool-args.types";
import { parseToolArgs, ToolValidationError } from "../utils/tool-args-parser";
import { callOpenAI, callOpenAIForMessage } from "./openai-call";
import { requestCorrectedCall, MAX_RETRY_ATTEMPTS } from "./llm-retry";
import { parseWithRetry } from "./parse-with-retry";
import { handleAskFollowup } from "./tool-handlers/ask-followup.handler";
import { handleExtractData } from "./tool-handlers/extract-data.handler";
import { handleFinalizeTextMessage } from "./tool-handlers/finalize-text-message.handler";
import { handleRenderChart } from "./tool-handlers/render-chart.handler";
import { logger } from "../utils/logger";
import { extractResponseText } from "../utils/extract-response-text";
import { buildDataSummary, buildTextDataSummary } from "../utils/obfuscate-pivot-data";
import { generatePivotCSV } from "../utils/pivot-grid-data-csv-transformer";
import { PivotGridResponse } from "../types/pivot-grid-response.types";

interface CreateModelResponseOptions {
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

function buildFallbackResult(
    opts: {
        message: string;
        suggestions: string[];
        callId: string;
        executionData?: PivotGridResponse;
        pivotCsv?: string;
        errorResponse?: string | Object;
    },
    openAiItems: OpenAiItem[]
): ToolCallResult {
    const result = handleAskFollowup(
        { toolName: "ask_followup", message: opts.message, userMessageSuggestions: opts.suggestions },
        opts.callId
    );
    openAiItems.push(...result.openAiItems);
    return {
        structuredOutput: result.structuredOutput,
        openAiItems,
        executionData: opts.executionData,
        pivotCsv: opts.pivotCsv,
        errorResponse: opts.errorResponse,
    };
}

const PARSE_FALLBACK_SUGGESTIONS = [
    "Reformule a pergunta com mais clareza",
    "Detalhe melhor quais dados voce precisa",
    "Tente uma consulta mais simples e direta",
];

// ── Extract data execution with retry ───────────────────────────────────────

interface ExecuteWithRetryParams {
    initialCall: OpenAI.Responses.ResponseFunctionToolCall;
    initialArgs: ExtractDataArgs;
    initialResponseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    metadataId: number;
    openAiItems: OpenAiItem[];
    parseOptions?: { availableFieldNames?: string[] };
}

interface ExecuteWithRetryResult {
    executionData?: PivotGridResponse;
    errorResponse?: string | Object;
    finalCall: OpenAI.Responses.ResponseFunctionToolCall;
    finalArgs: ExtractDataArgs;
    finalResponseOutput: unknown[];
    earlyReturn?: ToolCallResult;
}

async function executeExtractDataWithRetry(params: ExecuteWithRetryParams): Promise<ExecuteWithRetryResult> {
    const { baseInput, tools, metadataId, openAiItems, parseOptions } = params;
    let currentCall = params.initialCall;
    let currentArgs = params.initialArgs;
    let currentResponseOutput = params.initialResponseOutput;
    let errorResponse: string | Object | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        logger.tool("extract_data", { attempt, metadataId });

        const result = await handleExtractData(currentArgs, metadataId);

        if (result.success) {
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

// ── Main orchestration ───────────────────────────────────────────────────────

export async function createModelResponse(
    input: ResponseInputItem[],
    metadataId: number,
    options?: CreateModelResponseOptions
): Promise<ToolCallResult> {
    const openAiItems: OpenAiItem[] = [];

    try {
        // ── First call: extract_data or ask_followup ─────────────────────────
        const primaryTools = [getExtractDataToolDefinition(), getAskFollowupToolDefinition()];

        const { response: firstResponse, functionCalls: firstCalls, reasoningItems } =
            await callOpenAI(input, primaryTools);

        if (firstCalls.length === 0) {
            const textContent = extractResponseText(firstResponse);
            const messageText = textContent ?? "Desculpe, não consegui processar sua solicitação.";

            for (const item of reasoningItems) {
                openAiItems.push({ type: "reasoning", reasoningItem: item });
            }

            openAiItems.push({
                type: "message",
                role: "assistant",
                content: messageText,
            });

            return {
                structuredOutput: {
                    action: "TEXT_RESPONSE" as const,
                    message: messageText,
                    userMessageSuggestions: [],
                },
                openAiItems,
            };
        }
        if (firstCalls.length > 1) {
            logger.warn("openai", `1st call: ${firstCalls.length} function calls returned, using first`);
        }

        for (const item of reasoningItems) {
            openAiItems.push({ type: "reasoning", reasoningItem: item });
        }

        const primaryCall = firstCalls[0]!;
        openAiItems.push({
            type: "function_call",
            callId: primaryCall.call_id,
            name: primaryCall.name,
            arguments: primaryCall.arguments,
        });

        // ── Parse primary call args (with retry) ────────────────────────────
        const parsed = await parseWithRetry({
            call: primaryCall,
            responseOutput: firstResponse.output,
            baseInput: input,
            tools: primaryTools,
            openAiItems,
            parseOptions: { availableFieldNames: options?.availableFieldNames },
        });

        if (!parsed) {
            return buildFallbackResult({
                message: "Nao consegui processar a resposta gerada. Pode reformular sua pergunta para eu tentar novamente?",
                suggestions: PARSE_FALLBACK_SUGGESTIONS,
                callId: `${primaryCall.call_id}-primary-parse-error`,
            }, openAiItems);
        }

        const primaryArgs = parsed.args;
        logger.tool(parsed.call.name, { metadataId });

        // ── ask_followup: return immediately ─────────────────────────────────
        if (primaryArgs.toolName === "ask_followup") {
            const result = handleAskFollowup(primaryArgs, parsed.call.call_id);
            openAiItems.push(...result.openAiItems);
            return { structuredOutput: result.structuredOutput, openAiItems };
        }

        if (primaryArgs.toolName !== "extract_data") {
            throw new Error(`Unexpected tool: ${primaryArgs.toolName}`);
        }

        // ── extract_data: execute with retry loop ────────────────────────────
        const retryResult = await executeExtractDataWithRetry({
            initialCall: parsed.call,
            initialArgs: primaryArgs,
            initialResponseOutput: parsed.responseOutput,
            baseInput: input,
            tools: primaryTools,
            metadataId,
            openAiItems,
            parseOptions: { availableFieldNames: options?.availableFieldNames },
        });

        if (retryResult.earlyReturn) {
            return retryResult.earlyReturn;
        }

        const { executionData, finalCall: currentCall, finalArgs: currentArgs, finalResponseOutput } = retryResult;
        let { errorResponse } = retryResult;

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
            dataOutput = currentArgs.renderType === "TEXT"
                ? buildTextDataSummary(executionData, pivotCsv)
                : buildDataSummary(executionData, pivotCsv);
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
                    finalResponseOutput,
                    extractDataFunctionCallOutput,
                    executionData,
                    currentArgs.query
                );
                openAiItems.push(...chartResult.openAiItems);
                chartConfig = chartResult.chartConfig;
            } catch (error) {
                logger.error("openai", "CHART finalization failed", { error: String(error) });
                return buildFallbackResult({
                    message: "Tive um problema ao gerar o grafico. Pode tentar reformular a solicitacao?",
                    suggestions: [
                        "Solicite um tipo de grafico diferente",
                        "Tente uma consulta mais simples",
                        "Prefira visualizar como tabela",
                    ],
                    callId: `${currentCall.call_id}-chart-error`,
                    executionData,
                    pivotCsv,
                    errorResponse,
                }, openAiItems);
            }
        } else if (currentArgs.renderType === "TEXT") {
            try {
                const textResult = await handleFinalizeTextMessage(
                    input,
                    finalResponseOutput,
                    extractDataFunctionCallOutput
                );
                openAiItems.push(...textResult.openAiItems);

                if (!textResult.success || !textResult.finalMessage) {
                    return buildFallbackResult({
                        message: "Nao consegui consolidar os valores finais para responder com seguranca. Pode reformular a pergunta com mais contexto?",
                        suggestions: [
                            "Mostre apenas o total do periodo atual",
                            "Liste os 5 principais valores para eu escolher",
                            "Especifique o indicador e o periodo desejado",
                        ],
                        callId: `${currentCall.call_id}-text-fallback`,
                        executionData,
                        pivotCsv,
                        errorResponse,
                    }, openAiItems);
                }

                finalMessage = textResult.finalMessage;
            } catch (error) {
                logger.error("openai", "TEXT finalization failed", { error: String(error) });
                return buildFallbackResult({
                    message: "Tive um problema ao montar a resposta final em texto. Pode tentar novamente com um recorte mais especifico?",
                    suggestions: [
                        "Quero apenas um numero consolidado",
                        "Traga os 3 principais valores",
                        "Compare somente os dois ultimos periodos",
                    ],
                    callId: `${currentCall.call_id}-text-error`,
                    executionData,
                    pivotCsv,
                    errorResponse,
                }, openAiItems);
            }
        }

        // ── Return final result ───────────────────────────────────────────────
        return {
            structuredOutput: {
                action: "EXTRACT_DATA",
                message: finalMessage,
                userMessageSuggestions: currentArgs.userMessageSuggestions,
                renderType: currentArgs.renderType,
                query: currentArgs.query,
                chartConfig,
            },
            openAiItems,
            executionData,
            pivotCsv,
            errorResponse,
        };
    } catch (error: unknown) {
        logger.error("openai", "Unhandled error in createModelResponse", { error: String(error) });
        return buildFallbackResult({
            message: "Ocorreu um erro inesperado ao processar sua solicitacao. Tente novamente.",
            suggestions: ["Reformule a pergunta", "Tente uma consulta mais simples"],
            callId: "top-level-error",
            errorResponse: error instanceof Error ? error.message : String(error),
        }, openAiItems);
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

export async function generateConversationNameSuggestion(
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
