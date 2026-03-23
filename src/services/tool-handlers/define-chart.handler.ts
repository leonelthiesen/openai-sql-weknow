import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "../chat.service";
import { callOpenAI, extractFunctionCalls } from "../openai-call";
import { getDefineChartToolDefinition } from "../../models/tool-definitions";
import { parseToolArgs } from "../../utils/tool-args-parser";
import type { DefineChartArgs } from "../../types/tool-args.types";
import type { SimplifiedChartDefinition } from "../../models/llm-structured-output.models";
import { logger } from "../../utils/logger";

export interface DefineChartResult {
    chartDefinition?: SimplifiedChartDefinition;
    openAiItems: OpenAiItem[];
}

export async function handleDefineChart(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    extractDataCallOutput: OpenAiItem
): Promise<DefineChartResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    const developerContent = [
        "The extract_data tool was called and sample query results are provided.",
        "Use this information to define an appropriate chart configuration.",
    ].join("\n");

    openAiItems.push({
        type: "message",
        role: "developer",
        content: developerContent,
    });

    const secondCallInput: ResponseInputItem[] = [
        ...baseInput,
        ...(lastResponseOutput as unknown as ResponseInputItem[]),
        {
            type: extractDataCallOutput.type,
            call_id: extractDataCallOutput.callId || "",
            output: extractDataCallOutput.output || "",
        } as ResponseInputItem,
        {
            role: "developer",
            content: developerContent,
        } as ResponseInputItem,
    ];

    const { response } = await callOpenAI(secondCallInput, [getDefineChartToolDefinition()]);
    const chartCalls = extractFunctionCalls(response);

    if (chartCalls.length === 0) {
        logger.warn("define_chart", "No function_call in chart response output");
        return { openAiItems };
    }

    const chartCall = chartCalls[0]!;
    const chartArgs = parseToolArgs("define_chart", chartCall.arguments) as DefineChartArgs;

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

    logger.toolResult("define_chart", {
        success: true,
        durationMs: Date.now() - startTime,
    });

    return { chartDefinition: chartArgs.chartDefinition, openAiItems };
}
