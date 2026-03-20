import OpenAI from "openai";
import { MODEL_INSTRUCTIONS, type OpenAIResponseSchema } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import {
    getExecuteQueryToolDefinition,
    getRenderChartToolDefinition,
    getAskFollowupToolDefinition,
} from "../models/tool-definitions";
import { generateFakeData } from "../utils/fake-data";
import type { ExecutionData, OpenAiItem } from "./chat.service";
import * as weknowService from "./weknow.service";
import { transformLLMToComponentExecuteInput } from "../utils/llm-to-weknow-component-execute";
import type {
    LLMStructuredOutput,
    SimplifiedChartDefinition,
} from "../models/llm-structured-output.models";
import { transformChartDefinitionToECharts } from "../utils/chart-definition-to-echarts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = "gpt-5-mini-2025-08-07";

const SHARED_OPTIONS = {
    model: MODEL,
    reasoning: { effort: "minimal" as const },
    include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

export interface ToolCallResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: ExecutionData;
    errorResponse?: string | Object;
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === "string") {
        return error;
    }

    return JSON.stringify(error);
}

function transformExecuteResult(data: any): ExecutionData {
    let dimensions: string[] = [];
    let source: (string | number | null)[][] = [];
    if (data && data.cols && data.rows) {
        dimensions = data.cols.map((col: any) => col.completeName);
        source = data.rows.map((row: any) => row.cells.map((cell: any) => cell.value));
    }
    return { dimensions, source };
}

export async function createModelResponse(
    input: ResponseInputItem[],
    metadataId: number
): Promise<ToolCallResult> {
    const openAiItems: OpenAiItem[] = [];

    // ── First call: execute_query or ask_followup ────────────────────────────
    const firstResponse = await openai.responses.create({
        ...SHARED_OPTIONS,
        instructions: MODEL_INSTRUCTIONS,
        input,
        tools: [getExecuteQueryToolDefinition(), getAskFollowupToolDefinition()],
        tool_choice: "required",
    });

    const firstCalls = firstResponse.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === "function_call"
    );

    if (firstCalls.length === 0) {
        console.error("[openai] 1st call: no function_call in output", JSON.stringify(firstResponse.output, null, 2));
        throw new Error("Model did not return a function call.");
    }

    if (firstCalls.length > 1) {
        console.warn(`[openai] 1st call: ${firstCalls.length} function calls returned, using first`);
    }

    const primaryCall = firstCalls[0]!;
    const primaryArgs = JSON.parse(primaryCall.arguments);

    // Collect reasoning items from first response
    const reasoningItems = firstResponse.output.filter(
        (item) => item.type === "reasoning"
    );
    for (const item of reasoningItems) {
        openAiItems.push({ type: "reasoning", reasoningItem: item });
    }

    // Collect function_call item
    openAiItems.push({
        type: "function_call",
        callId: primaryCall.call_id,
        name: primaryCall.name,
        arguments: primaryCall.arguments,
    });

    // ── ask_followup: nothing more to do ────────────────────────────────────
    if (primaryCall.name === "ask_followup") {
        // Collect function_call_output
        openAiItems.push({
            type: "function_call_output",
            callId: primaryCall.call_id,
            output: "Message delivered to the user.",
        });

        return {
            structuredOutput: {
                action: "FOLLOWUP_NEEDED",
                message: primaryArgs.message,
                userMessageSuggestions: primaryArgs.userMessageSuggestions,
            },
            openAiItems,
        };
    }

    // ── execute_query: execute real query via WeKnow, with retry on failure ──
    const MAX_RETRY_ATTEMPTS = 3;

    let executionData: ExecutionData | undefined;
    let errorResponse: string | Object | undefined;
    let currentCall = primaryCall;
    let currentArgs = primaryArgs;
    let lastResponse = firstResponse;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        const structuredOutputForExec = {
            action: "EXECUTE_QUERY" as const,
            message: currentArgs.message,
            renderType: currentArgs.renderType,
            query: currentArgs.query,
            userMessageSuggestions: currentArgs.userMessageSuggestions,
        } satisfies LLMStructuredOutput;

        const executeInput = transformLLMToComponentExecuteInput(structuredOutputForExec, metadataId);
        if (!executeInput) break;

        try {
            const accessToken = await weknowService.getAccessToken();
            executeInput.accessToken = accessToken;
            const executeResult = await weknowService.executeComponent(JSON.stringify(executeInput));
            executionData = transformExecuteResult(executeResult);
            errorResponse = undefined;
            break; // Success — exit retry loop
        } catch (error: any) {
            errorResponse = error;
            const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error);
            console.error(`[openai] Tentativa ${attempt}/${MAX_RETRY_ATTEMPTS} falhou:`, errorMessage);

            if (attempt >= MAX_RETRY_ATTEMPTS) {
                console.error("[openai] Todas as tentativas falharam.");
                break;
            }

            // Send error back to OpenAI so it can fix the query
            const errorOutput = `Query execution failed with error: ${errorMessage}. Please fix the query and try again.`;

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

            const retryResponse = await openai.responses.create({
                ...SHARED_OPTIONS,
                instructions: MODEL_INSTRUCTIONS,
                input: retryInput,
                tools: [getExecuteQueryToolDefinition(), getAskFollowupToolDefinition()],
                tool_choice: "required",
            });

            // Collect reasoning items from retry response
            for (const item of retryResponse.output.filter((item) => item.type === "reasoning")) {
                openAiItems.push({ type: "reasoning", reasoningItem: item });
            }

            const retryCalls = retryResponse.output.filter(
                (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
                    item.type === "function_call"
            );

            if (retryCalls.length === 0 || retryCalls[0]!.name !== "execute_query") {
                console.error(`[openai] Retry ${attempt}: model did not return execute_query`);
                // If model switched to ask_followup, treat as final answer
                if (retryCalls.length > 0 && retryCalls[0]!.name === "ask_followup") {
                    const followupArgs = JSON.parse(retryCalls[0]!.arguments);
                    openAiItems.push({
                        type: "function_call",
                        callId: retryCalls[0]!.call_id,
                        name: retryCalls[0]!.name,
                        arguments: retryCalls[0]!.arguments,
                    });
                    openAiItems.push({
                        type: "function_call_output",
                        callId: retryCalls[0]!.call_id,
                        output: "Message delivered to the user.",
                    });
                    return {
                        structuredOutput: {
                            action: "FOLLOWUP_NEEDED",
                            message: followupArgs.message,
                            userMessageSuggestions: followupArgs.userMessageSuggestions,
                        },
                        openAiItems,
                        errorResponse,
                    };
                }
                break;
            }

            currentCall = retryCalls[0]!;
            currentArgs = JSON.parse(currentCall.arguments);
            lastResponse = retryResponse;

            openAiItems.push({
                type: "function_call",
                callId: currentCall.call_id,
                name: currentCall.name,
                arguments: currentCall.arguments,
            });

            console.log(`[openai] Retry ${attempt}: nova query gerada: ${currentArgs.query}`);
        }
    }

    // Use real data if available, otherwise fall back to fake data for the LLM context
    const dataForLLM = executionData
        ? { dimensions: executionData.dimensions, source: executionData.source.slice(0, 20) }
        : generateFakeData(currentArgs.query);

    // Collect function_call_output for execute_query
    const executeQueryOutput = executionData
        ? "Query executed successfully. Result (first rows): " + JSON.stringify(dataForLLM)
        : "Query executed successfully. Result using fabricated data: " + JSON.stringify(dataForLLM);

    const executeQueryFunctionCallOutput: OpenAiItem = {
        type: "function_call_output" as const,
        callId: currentCall.call_id,
        output: executeQueryOutput,
    }

    openAiItems.push(executeQueryFunctionCallOutput);

    let chartConfig: object | undefined;

    if (currentArgs.renderType === "CHART") {
        // ── Second call: render_chart_config ──────────────────────────────
        const developerContent = [
            "The execute_query tool was called and sample query results are provided.",
            "Use this information to render an appropriate chart.",
            // "Generate a simplified chart definition (not Apache ECharts JSON).",
            // "The backend will transform your definition into Apache ECharts.",
        ].join("\n");

        // Add developer message to openAiItems
        openAiItems.push({
            type: "message",
            role: "developer",
            content: developerContent,
        });

        const secondCallInput: ResponseInputItem[] = [
            ...input,
            ...(lastResponse.output as unknown as ResponseInputItem[]),
            {
                type: executeQueryFunctionCallOutput.type,
                call_id: executeQueryFunctionCallOutput.callId || "",
                output: executeQueryOutput
            } as ResponseInputItem,
            {
                role: "developer",
                content: developerContent,
            } as ResponseInputItem,
        ];

        const secondResponse = await openai.responses.create({
            ...SHARED_OPTIONS,
            instructions: MODEL_INSTRUCTIONS,
            input: secondCallInput,
            tools: [getRenderChartToolDefinition()],
            tool_choice: "required",
        });

        const chartCalls = secondResponse.output.filter(
            (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
                item.type === "function_call"
        );

        if (chartCalls.length > 0) {
            const chartCall = chartCalls[0]!;
            chartConfig = JSON.parse(chartCall.arguments).chartConfig;
            // const chartDefinition = JSON.parse(chartCall.arguments)
            //     .chartDefinition as SimplifiedChartDefinition;

            // const chartExecutionData = executionData ?? dataForLLM;

            // try {
            //     chartConfig = transformChartDefinitionToECharts(chartDefinition, chartExecutionData);
            // } catch (error: unknown) {
            //     const errorMessage = toErrorMessage(error);
            //     console.error("[openai] Erro ao transformar definicao simplificada de grafico:", errorMessage);
            //     errorResponse = errorMessage;
            // }

            // Collect chart function_call and output
            openAiItems.push({
                type: "function_call",
                callId: chartCall.call_id,
                name: chartCall.name,
                arguments: chartCall.arguments,
            });
            openAiItems.push({
                type: "function_call_output",
                callId: chartCall.call_id,
                output: "OK",
            });
        } else {
            console.error("[openai] 2nd call: no function_call in output", JSON.stringify(secondResponse.output, null, 2));
        }
    }

    return {
        structuredOutput: {
            action: "EXECUTE_QUERY",
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
