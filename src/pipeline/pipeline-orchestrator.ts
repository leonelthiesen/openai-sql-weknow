import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import type { OpenAiItem } from "../services/chat.service";
import * as chatService from "../services/chat.service";
import { callOpenAI } from "../services/openai-call";
import { parseWithRetry } from "../services/parse-with-retry";
import { extractResponseText } from "../utils/extract-response-text";
import { logger } from "../utils/logger";
import { jobStore, type Job } from "./job-store";
import { runTableStage } from "./stages/table-stage";
import { runTextStage } from "./stages/text-stage";
import { runChartStage } from "./stages/chart-stage";
import { runFollowupStage } from "./stages/followup-stage";
import { handleAskFollowup } from "../services/tool-handlers/ask-followup.handler";
import type { StageResult } from "./stages/table-stage";

const PARSE_FALLBACK_SUGGESTIONS = [
    "Reformule a pergunta com mais clareza",
    "Detalhe melhor quais dados voce precisa",
    "Tente uma consulta mais simples e direta",
];

export async function runPipeline(job: Job): Promise<void> {
    const { id: jobId, conversationId, userId, metadataId, input, options } = job;
    const openAiItems: OpenAiItem[] = [];

    try {
        // ── Emit: llm_call_started ───────────────────────────────────────────
        jobStore.emitEvent(jobId, {
            type: "llm_call_started",
            payload: { jobId },
        });


        // ── First LLM call ───────────────────────────────────────────────────
        const primaryTools = [getExtractDataToolDefinition(), getAskFollowupToolDefinition()];
        const { response: firstResponse, functionCalls: firstCalls } =
            await callOpenAI(input, primaryTools);

        // Collect reasoning items
        for (const item of firstResponse.output.filter((item) => item.type === "reasoning")) {
            openAiItems.push({ type: "reasoning", reasoningItem: item });
        }

        let stageResult: StageResult;

        // ── No tool call: direct text response ───────────────────────────────
        if (firstCalls.length === 0) {
            const textContent = extractResponseText(firstResponse);
            const messageText = textContent ?? "Desculpe, não consegui processar sua solicitação.";

            openAiItems.push({
                type: "message",
                role: "assistant",
                content: messageText,
            });

            jobStore.emitEvent(jobId, {
                type: "tool_selected",
                payload: { jobId, tool: "none" },
            });

            stageResult = {
                structuredOutput: {
                    action: "TEXT_RESPONSE" as const,
                    message: messageText,
                    userMessageSuggestions: [],
                },
                openAiItems,
            };
        } else {
            if (firstCalls.length > 1) {
                logger.warn("openai", `1st call: ${firstCalls.length} function calls returned, using first`);
            }

            const primaryCall = firstCalls[0]!;
            openAiItems.push({
                type: "function_call",
                callId: primaryCall.call_id,
                name: primaryCall.name,
                arguments: primaryCall.arguments,
            });

            // ── Parse primary call args (with retry) ─────────────────────────
            const parsed = await parseWithRetry({
                call: primaryCall,
                responseOutput: firstResponse.output,
                baseInput: input,
                tools: primaryTools,
                openAiItems,
                parseOptions: { availableFieldNames: options?.availableFieldNames },
            });

            if (!parsed) {
                const fallback = handleAskFollowup(
                    {
                        toolName: "ask_followup",
                        message: "Nao consegui processar a resposta gerada. Pode reformular sua pergunta para eu tentar novamente?",
                        userMessageSuggestions: PARSE_FALLBACK_SUGGESTIONS,
                    },
                    primaryCall.call_id
                );
                openAiItems.push(...fallback.openAiItems);
                stageResult = {
                    structuredOutput: fallback.structuredOutput,
                    openAiItems,
                };
            } else {
                const primaryArgs = parsed.args;
                logger.tool(parsed.call.name, { metadataId });

                // ── Emit: tool_selected ──────────────────────────────────────
                jobStore.emitEvent(jobId, {
                    type: "tool_selected",
                    payload: {
                        jobId,
                        tool: primaryArgs.toolName,
                        renderType: primaryArgs.toolName === "extract_data" ? primaryArgs.renderType : undefined,
                    },
                });

                // ── Dispatch to stage ────────────────────────────────────────
                if (primaryArgs.toolName === "ask_followup") {
                    stageResult = runFollowupStage({
                        parsedArgs: primaryArgs,
                        callId: parsed.call.call_id,
                        openAiItems,
                    });
                } else if (primaryArgs.toolName === "extract_data") {
                    const stageParams = {
                        jobId,
                        parsedCall: parsed.call,
                        parsedArgs: primaryArgs,
                        responseOutput: parsed.responseOutput as unknown[],
                        baseInput: input,
                        tools: primaryTools,
                        metadataId,
                        openAiItems,
                        parseOptions: { availableFieldNames: options?.availableFieldNames },
                    };

                    switch (primaryArgs.renderType) {
                        case "TABLE":
                            stageResult = await runTableStage(stageParams);
                            break;
                        case "TEXT":
                            stageResult = await runTextStage(stageParams);
                            break;
                        case "CHART":
                            stageResult = await runChartStage({ ...stageParams });
                            break;
                        default:
                            stageResult = await runTableStage(stageParams);
                    }
                } else {
                    throw new Error(`Unexpected tool: ${primaryArgs.toolName}`);
                }
            }
        }

        // ── Persist assistant message ────────────────────────────────────────
        const assistantMessage = await chatService.createAppMessage(conversationId, userId, {
            role: "assistant",
            parsedContent: stageResult.structuredOutput,
            executionData: stageResult.executionData,
            errorResponse: stageResult.errorResponse,
            chartHtml: stageResult.chartHtml,
            openAiItems: stageResult.openAiItems,
        });

        // ── Emit: completed ──────────────────────────────────────────────────
        jobStore.emitEvent(jobId, {
            type: "completed",
            payload: {
                jobId,
                result: {
                    structuredOutput: stageResult.structuredOutput,
                    openAiItems: stageResult.openAiItems,
                    executionData: stageResult.executionData,
                    errorResponse: stageResult.errorResponse,
                    chartHtml: stageResult.chartHtml,
                    userMessageId: job.userMessageId!,
                    assistantMessageId: assistantMessage.id,
                },
            },
        });
    } catch (error: unknown) {
        logger.error("pipeline", "Unhandled error in runPipeline", {
            error: error instanceof Error ? error.message : String(error),
        });

        // Attempt to persist a fallback assistant message
        try {
            openAiItems.push({
                type: "function_call",
                callId: "top-level-error",
                name: "ask_followup",
                arguments: JSON.stringify({ toolName: "ask_followup", message: "Ocorreu um erro inesperado ao processar sua solicitacao. Tente novamente.", userMessageSuggestions: ["Reformule a pergunta", "Tente uma consulta mais simples"] }),
            });
            const fallback = handleAskFollowup(
                {
                    toolName: "ask_followup",
                    message: "Ocorreu um erro inesperado ao processar sua solicitacao. Tente novamente.",
                    userMessageSuggestions: ["Reformule a pergunta", "Tente uma consulta mais simples"],
                },
                "top-level-error"
            );
            openAiItems.push(...fallback.openAiItems);

            const assistantMessage = await chatService.createAppMessage(conversationId, userId, {
                role: "assistant",
                parsedContent: fallback.structuredOutput,
                errorResponse: error instanceof Error ? error.message : String(error),
                openAiItems,
            });

            jobStore.emitEvent(jobId, {
                type: "failed",
                payload: {
                    jobId,
                    error: error instanceof Error ? error.message : String(error),
                },
            });

            // Even on failure, include the assistant message id so the client can fetch it
            const job = jobStore.getJob(jobId);
            if (job) {
                job.result = {
                    structuredOutput: fallback.structuredOutput,
                    openAiItems,
                    errorResponse: error instanceof Error ? error.message : String(error),
                    userMessageId: job.userMessageId!,
                    assistantMessageId: assistantMessage.id,
                };
            }
        } catch (persistError) {
            logger.error("pipeline", "Failed to persist fallback message", {
                error: String(persistError),
            });
            jobStore.emitEvent(jobId, {
                type: "failed",
                payload: {
                    jobId,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
        }
    }
}
