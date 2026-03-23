import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
    getExtractDataToolDefinition,
    getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import { generateFakeData } from "../utils/fake-data";
import type { ExecutionData, OpenAiItem } from "./chat.service";
import type { OpenAIResponseSchema } from "../constants";
import { parseToolArgs } from "../utils/tool-args-parser";
import type { ExtractDataArgs } from "../types/tool-args.types";
import { callOpenAI } from "./openai-call";
import { handleAskFollowup } from "./tool-handlers/ask-followup.handler";
import { handleExtractData } from "./tool-handlers/extract-data.handler";
import { handleDefineChart } from "./tool-handlers/define-chart.handler";
import { logger } from "../utils/logger";
import { transformChartDefinitionToECharts } from "../utils/chart-definition-to-echarts";

const MAX_RETRY_ATTEMPTS = 3;

export interface ToolCallResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: ExecutionData;
    errorResponse?: string | Object;
}

export async function createModelResponse(
    input: ResponseInputItem[],
    metadataId: number
): Promise<ToolCallResult> {
    const openAiItems: OpenAiItem[] = [];

    // ── First call: extract_data or ask_followup ─────────────────────────────
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

    // Collect reasoning items
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

    const primaryArgs = parseToolArgs(primaryCall.name, primaryCall.arguments);
    logger.tool(primaryCall.name, { metadataId });

    // ── ask_followup: return immediately ─────────────────────────────────────
    if (primaryArgs.toolName === "ask_followup") {
        const result = handleAskFollowup(primaryArgs, primaryCall.call_id);
        openAiItems.push(...result.openAiItems);
        return { structuredOutput: result.structuredOutput, openAiItems };
    }

    // ── extract_data: execute with retry loop ────────────────────────────────
    if (primaryArgs.toolName !== "extract_data") {
        throw new Error(`Unexpected tool: ${primaryArgs.toolName}`);
    }

    let executionData: ExecutionData | undefined;
    let errorResponse: string | Object | undefined;
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

        // Execution failed
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

        // Send error back to OpenAI for query correction
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

            // If model switched to ask_followup, treat as final answer
            if (retryCalls.length > 0 && retryCalls[0]!.name === "ask_followup") {
                const followupCall = retryCalls[0]!;
                const followupArgs = parseToolArgs("ask_followup", followupCall.arguments);

                openAiItems.push({
                    type: "function_call",
                    callId: followupCall.call_id,
                    name: followupCall.name,
                    arguments: followupCall.arguments,
                });

                if (followupArgs.toolName === "ask_followup") {
                    const followupResult = handleAskFollowup(followupArgs, followupCall.call_id);
                    openAiItems.push(...followupResult.openAiItems);
                    return {
                        structuredOutput: followupResult.structuredOutput,
                        openAiItems,
                        errorResponse,
                    };
                }
            }
            break;
        }

        currentCall = retryCalls[0]!;
        currentArgs = parseToolArgs("extract_data", currentCall.arguments) as ExtractDataArgs;
        lastResponse = retryResponse;

        openAiItems.push({
            type: "function_call",
            callId: currentCall.call_id,
            name: currentCall.name,
            arguments: currentCall.arguments,
        });

        logger.info("openai", `Retry ${attempt}: new query generated`);
    }

    // ── Build execution output for LLM context ──────────────────────────────
    const dataForLLM = executionData
        ? { dimensions: executionData.dimensions, source: executionData.source.slice(0, 20) }
        : generateFakeData(currentArgs.query);

    const extractDataOutput = executionData
        ? "Query executed successfully. Result (first rows): " + JSON.stringify(dataForLLM)
        : "Query executed successfully. Result using fabricated data: " + JSON.stringify(dataForLLM);

    const extractDataFunctionCallOutput: OpenAiItem = {
        type: "function_call_output",
        callId: currentCall.call_id,
        output: extractDataOutput,
    };
    openAiItems.push(extractDataFunctionCallOutput);

    // ── CHART: second call for define_chart ───────────────────────────────────
    let chartDefinition: object | undefined;
    let chartConfig: object | undefined;

    if (currentArgs.renderType === "CHART") {
        const chartResult = await handleDefineChart(
            input,
            lastResponse.output,
            extractDataFunctionCallOutput
        );
        openAiItems.push(...chartResult.openAiItems);
        chartDefinition = chartResult.chartDefinition;
        chartConfig = transformChartDefinitionToECharts(chartDefinition as any, executionData as any); // Validate chart definition against execution data
    }

    // ── Return final result ──────────────────────────────────────────────────
    return {
        structuredOutput: {
            action: "EXTRACT_DATA",
            message: currentArgs.message,
            userMessageSuggestions: currentArgs.userMessageSuggestions,
            renderType: currentArgs.renderType,
            query: currentArgs.query,
            chartConfig,
        },
        openAiItems,
        executionData,
        errorResponse,
    };
}
