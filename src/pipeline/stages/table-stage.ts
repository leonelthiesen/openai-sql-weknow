import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../../services/chat.service";
import type { OpenAIResponseSchema } from "../../constants";
import type { PivotGridResponse } from "../../types/pivot-grid-response.types";
import { executeExtractDataWithRetry } from "./extract-data-shared";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";
import { jobStore } from "../job-store";

export interface TableStageParams {
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

export interface StageResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: PivotGridResponse;
    errorResponse?: string | Object;
    chartHtml?: string;
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
    extras?: { executionData?: PivotGridResponse; errorResponse?: string | Object }
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

export async function runTableStage(params: TableStageParams): Promise<StageResult> {
    const { jobId, parsedCall, parsedArgs, responseOutput, baseInput, tools, metadataId, openAiItems, parseOptions } = params;

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

    const { executionData, finalArgs, finalCall } = retryResult;
    const { errorResponse } = retryResult;

    if (!executionData) {
        return buildFallbackResult(
            "Nao consegui executar a consulta apos varias tentativas. Pode reformular sua pergunta?",
            FALLBACK_SUGGESTIONS,
            `${finalCall.call_id}-table-exhausted`,
            openAiItems,
            { errorResponse }
        );
    }

    // Add function_call_output for the successful execution
    openAiItems.push({
        type: "function_call_output",
        callId: finalCall.call_id,
        output: JSON.stringify(executionData),
    });

    return {
        structuredOutput: {
            action: "EXTRACT_DATA",
            message: finalArgs.message,
            userMessageSuggestions: finalArgs.userMessageSuggestions,
            renderType: finalArgs.renderType,
            query: finalArgs.query,
        },
        openAiItems,
        executionData,
        errorResponse,
    };
}
