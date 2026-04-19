import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../../services/chat.service";
import type { StageResult } from "./table-stage";
import { executeExtractDataWithRetry } from "./extract-data-shared";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";
import { handleFinalizeTextMessage } from "../../services/tool-handlers/finalize-text-message.handler";
import { jobStore } from "../job-store";
import { logger } from "../../utils/logger";

export interface TextStageParams {
    jobId: string;
    parsedCall: OpenAI.Responses.ResponseFunctionToolCall;
    parsedArgs: ExtractDataArgs;
    responseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    metadataId: number;
    openAiItems: OpenAiItem[];
    parseOptions?: { availableFieldNames?: string[] };
}

const FALLBACK_SUGGESTIONS = [
    "Reformule a pergunta com mais clareza",
    "Detalhe melhor quais dados voce precisa",
    "Tente uma consulta mais simples e direta",
];

function buildFallbackResult(
    message: string,
    suggestions: string[],
    callId: string,
    openAiItems: OpenAiItem[],
    extras?: { executionData?: import("../../types/pivot-grid-response.types").PivotGridResponse; errorResponse?: string | Object }
): StageResult {
    const result = handleAskFollowup(
        { toolName: "ask_followup", message, userMessageSuggestions: suggestions },
        callId
    );
    openAiItems.push(...result.openAiItems);
    return {
        structuredOutput: result.structuredOutput,
        openAiItems,
        executionData: extras?.executionData,
        errorResponse: extras?.errorResponse,
    };
}

export async function runTextStage(params: TextStageParams): Promise<StageResult> {
    const { jobId, parsedCall, parsedArgs, responseOutput, baseInput, tools, metadataId, openAiItems, parseOptions } = params;

    // ── Execute query with retry ─────────────────────────────────────────────
    const retryResult = await executeExtractDataWithRetry({
        initialCall: parsedCall,
        initialArgs: parsedArgs,
        initialResponseOutput: responseOutput,
        baseInput,
        tools,
        metadataId,
        openAiItems,
        parseOptions,
        onAttemptStart: (attempt) => {
            jobStore.emitEvent(jobId, {
                type: "query_executing",
                payload: { jobId, attempt },
            });
        },
        onDataReceived: (rowCount) => {
            jobStore.emitEvent(jobId, {
                type: "data_received",
                payload: { jobId, rowCount },
            });
        },
    });

    if (retryResult.earlyReturn) {
        return retryResult.earlyReturn;
    }

    const { executionData, finalArgs, finalCall, finalResponseOutput } = retryResult;
    const { errorResponse } = retryResult;

    if (!executionData) {
        return buildFallbackResult(
            "Nao consegui executar a consulta apos varias tentativas. Pode reformular sua pergunta?",
            FALLBACK_SUGGESTIONS,
            `${finalCall.call_id}-text-exhausted`,
            openAiItems,
            { errorResponse }
        );
    }

    // ── Build data output ────────────────────────────────────────────────────
    const extractDataFunctionCallOutput: OpenAiItem = {
        type: "function_call_output",
        callId: finalCall.call_id,
        output: JSON.stringify(executionData),
    };
    openAiItems.push(extractDataFunctionCallOutput);

    // ── Second LLM call: finalize text message ───────────────────────────────
    jobStore.emitEvent(jobId, {
        type: "text_finalizing",
        payload: { jobId },
    });

    let finalMessage = finalArgs.message;

    try {
        const textResult = await handleFinalizeTextMessage(
            baseInput,
            finalResponseOutput,
            extractDataFunctionCallOutput
        );
        openAiItems.push(...textResult.openAiItems);

        if (!textResult.success || !textResult.finalMessage) {
            return buildFallbackResult(
                "Nao consegui consolidar os valores finais para responder com seguranca. Pode reformular a pergunta com mais contexto?",
                [
                    "Mostre apenas o total do periodo atual",
                    "Liste os 5 principais valores para eu escolher",
                    "Especifique o indicador e o periodo desejado",
                ],
                `${finalCall.call_id}-text-fallback`,
                openAiItems,
                { executionData, errorResponse }
            );
        }

        finalMessage = textResult.finalMessage;
    } catch (error) {
        logger.error("openai", "TEXT finalization failed", { error: String(error) });
        return buildFallbackResult(
            "Tive um problema ao montar a resposta final em texto. Pode tentar novamente com um recorte mais especifico?",
            [
                "Quero apenas um numero consolidado",
                "Traga os 3 principais valores",
                "Compare somente os dois ultimos periodos",
            ],
            `${finalCall.call_id}-text-error`,
            openAiItems,
            { executionData, errorResponse }
        );
    }

    return {
        structuredOutput: {
            action: "EXTRACT_DATA",
            message: finalMessage,
            userMessageSuggestions: finalArgs.userMessageSuggestions,
            renderType: finalArgs.renderType,
            query: finalArgs.query,
        },
        openAiItems,
        executionData,
        errorResponse,
    };
}
