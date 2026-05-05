import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
    getRequestFieldValuesToolDefinition,
} from "../models/tool-definitions";
import type { OpenAiItem } from "../services/chat.service";
import * as chatService from "../services/chat.service";
import { callOpenAI } from "../services/openai-call";
import { parseWithRetry } from "../services/parse-with-retry";
import { extractResponseText } from "../utils/extract-response-text";
import { logger } from "../utils/logger";
import { jobStore, ApprovalTimeoutError, type Job } from "./job-store";
import { runTableStage } from "./stages/table-stage";
import { runTextStage } from "./stages/text-stage";
import { runChartStage } from "./stages/chart-stage";
import { runFollowupStage } from "./stages/followup-stage";
import { handleAskFollowup } from "../services/tool-handlers/ask-followup.handler";
import { fetchFieldValues, buildDeniedResult } from "../services/tool-handlers/request-field-values.handler";
import type { StageResult } from "./stages/table-stage";
import { pipelineStorage, type PipelineContext } from "./pipeline-context";
import { writePipelineLog } from "./pipeline-log-writer";
import { toInputItems } from "../services/llm-retry";
import type { ResponseInputItem } from "openai/resources/responses/responses";

const PARSE_FALLBACK_SUGGESTIONS = [
    "Reformule a pergunta com mais clareza",
    "Detalhe melhor quais dados voce precisa",
    "Tente uma consulta mais simples e direta",
];

const MAX_FIELD_VALUE_REQUESTS = 10;

export async function runPipeline(job: Job): Promise<void> {
    const ctx: PipelineContext = {
        jobId: job.id,
        conversationId: job.conversationId,
        llmCalls: [],
    };

    await pipelineStorage.run(ctx, () => _runPipelineInner(job));

    await writePipelineLog(ctx, jobStore.getJob(job.id) ?? job);
}

async function _runPipelineInner(job: Job): Promise<void> {
    const { id: jobId, conversationId, userId, metadataId, input, options } = job;
    const openAiItems: OpenAiItem[] = [];

    try {
        jobStore.emitEvent(jobId, {
            type: "llm_call_started",
            payload: { jobId },
        });

        const primaryTools = [
            getExtractDataToolDefinition(),
            getAskFollowupToolDefinition(),
            getRequestFieldValuesToolDefinition(),
        ];

        let currentInput: ResponseInputItem[] = input;
        let fieldValueRequestCount = 0;
        let stageResult: StageResult | undefined;

        // ── Main dispatch loop ───────────────────────────────────────────────
        while (true) {
            const { response: currentResponse, functionCalls: currentCalls } =
                await callOpenAI(currentInput, primaryTools);

            for (const item of currentResponse.output.filter((i) => i.type === "reasoning")) {
                openAiItems.push({ type: "reasoning", reasoningItem: item });
            }

            // ── No tool call: direct text response ───────────────────────────
            if (currentCalls.length === 0) {
                const textContent = extractResponseText(currentResponse);
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
                break;
            }

            if (currentCalls.length > 1) {
                logger.warn("openai", `LLM call: ${currentCalls.length} function calls returned, using first`);
            }

            const primaryCall = currentCalls[0]!;
            openAiItems.push({
                type: "function_call",
                callId: primaryCall.call_id,
                name: primaryCall.name,
                arguments: primaryCall.arguments,
            });

            const parsed = await parseWithRetry({
                call: primaryCall,
                responseOutput: currentResponse.output,
                baseInput: currentInput,
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
                break;
            }

            const primaryArgs = parsed.args;

            // ── request_field_values: pause and await user approval ───────────
            if (primaryArgs.toolName === "request_field_values") {
                fieldValueRequestCount++;

                if (fieldValueRequestCount > MAX_FIELD_VALUE_REQUESTS) {
                    logger.warn("pipeline", "Safety cap: too many request_field_values calls");
                    const outputStr = JSON.stringify({ error: "Número máximo de solicitações de valores atingido." });
                    openAiItems.push({ type: "function_call_output", callId: primaryCall.call_id, output: outputStr });
                    currentInput = buildNextInput(currentInput, parsed.responseOutput, primaryCall.call_id, outputStr);

                    const fallback = handleAskFollowup(
                        {
                            toolName: "ask_followup",
                            message: "Não consegui processar a solicitação. Tente reformular a pergunta.",
                            userMessageSuggestions: PARSE_FALLBACK_SUGGESTIONS,
                        },
                        "too-many-field-requests"
                    );
                    openAiItems.push(...fallback.openAiItems);
                    stageResult = { structuredOutput: fallback.structuredOutput, openAiItems };
                    break;
                }

                jobStore.emitEvent(jobId, {
                    type: "field_values_requested",
                    payload: {
                        jobId,
                        fieldCompleteName: primaryArgs.fieldCompleteName,
                        reason: primaryArgs.reason,
                    },
                });

                let fieldResult;
                try {
                    const approved = await jobStore.waitForApproval(jobId);
                    if (approved) {
                        jobStore.emitEvent(jobId, {
                            type: "field_values_fetching",
                            payload: { jobId, fieldCompleteName: primaryArgs.fieldCompleteName },
                        });
                        fieldResult = await fetchFieldValues(primaryArgs.fieldCompleteName, metadataId);
                    } else {
                        fieldResult = buildDeniedResult(primaryArgs.fieldCompleteName);
                    }
                } catch (err) {
                    if (err instanceof ApprovalTimeoutError) {
                        logger.warn("pipeline", `Approval timeout for field ${primaryArgs.fieldCompleteName}`);
                        fieldResult = buildDeniedResult(primaryArgs.fieldCompleteName);
                    } else {
                        throw err;
                    }
                }

                const outputStr = JSON.stringify(fieldResult);
                openAiItems.push({ type: "function_call_output", callId: primaryCall.call_id, output: outputStr });
                currentInput = buildNextInput(currentInput, parsed.responseOutput, primaryCall.call_id, outputStr);
                continue;
            }

            // ── Terminal tool calls ──────────────────────────────────────────
            logger.tool(parsed.call.name, { metadataId });

            jobStore.emitEvent(jobId, {
                type: "tool_selected",
                payload: {
                    jobId,
                    tool: primaryArgs.toolName,
                    renderType: primaryArgs.toolName === "extract_data" ? primaryArgs.renderType : undefined,
                },
            });

            const stageParams = {
                jobId,
                parsedCall: parsed.call,
                parsedArgs: primaryArgs,
                responseOutput: parsed.responseOutput as unknown[],
                baseInput: currentInput,
                tools: primaryTools,
                metadataId,
                openAiItems,
                parseOptions: { availableFieldNames: options?.availableFieldNames },
            };

            if (primaryArgs.toolName === "ask_followup") {
                stageResult = runFollowupStage({
                    parsedArgs: primaryArgs,
                    callId: parsed.call.call_id,
                    openAiItems,
                });
            } else if (primaryArgs.toolName === "extract_data") {
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
                throw new Error(`Unexpected tool: ${(primaryArgs as { toolName: string }).toolName}`);
            }
            break;
        }

        // ── Persist assistant message ────────────────────────────────────────
        const assistantMessage = await chatService.createAppMessage(conversationId, userId, {
            role: "assistant",
            parsedContent: stageResult!.structuredOutput,
            executionData: stageResult!.executionData,
            datasetResult: stageResult!.datasetResult,
            errorResponse: stageResult!.errorResponse,
            chartEchartsOption: stageResult!.chartEchartsOption,
            chartVegaLiteSpec: stageResult!.chartVegaLiteSpec,
            openAiItems: stageResult!.openAiItems,
        });

        // ── Emit: completed ──────────────────────────────────────────────────
        jobStore.emitEvent(jobId, {
            type: "completed",
            payload: {
                jobId,
                result: {
                    structuredOutput: stageResult!.structuredOutput,
                    openAiItems: stageResult!.openAiItems,
                    datasetResult: stageResult!.datasetResult,
                    errorResponse: stageResult!.errorResponse,
                    chartEchartsOption: stageResult!.chartEchartsOption,
                    chartVegaLiteSpec: stageResult!.chartVegaLiteSpec,
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

function buildNextInput(
    currentInput: ResponseInputItem[],
    responseOutput: unknown[],
    callId: string,
    outputStr: string
): ResponseInputItem[] {
    return [
        ...currentInput,
        ...toInputItems(responseOutput),
        { type: "function_call_output", call_id: callId, output: outputStr } as ResponseInputItem,
    ];
}
