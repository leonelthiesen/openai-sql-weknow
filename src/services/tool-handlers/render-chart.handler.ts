import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "../chat.service";
import { callOpenAI, extractFunctionCalls } from "../openai-call";
import { getRenderChartToolDefinition } from "../../models/tool-definitions";
import { parseToolArgs } from "../../utils/tool-args-parser";
import type { RenderChartArgs } from "../../types/tool-args.types";
import { logger } from "../../utils/logger";

export interface RenderChartResult {
    chartConfig?: object;
    openAiItems: OpenAiItem[];
}

export async function handleRenderChart(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    executeQueryCallOutput: OpenAiItem
): Promise<RenderChartResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    const developerContent = [
        "The execute_query tool was called and sample query results are provided.",
        "Use this information to render an appropriate chart.",
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
            type: executeQueryCallOutput.type,
            call_id: executeQueryCallOutput.callId || "",
            output: executeQueryCallOutput.output || "",
        } as ResponseInputItem,
        {
            role: "developer",
            content: developerContent,
        } as ResponseInputItem,
    ];

    const { response } = await callOpenAI(secondCallInput, [getRenderChartToolDefinition()]);
    const chartCalls = extractFunctionCalls(response);

    if (chartCalls.length === 0) {
        logger.warn("render_chart", "No function_call in chart response output");
        return { openAiItems };
    }

    const chartCall = chartCalls[0]!;
    const chartArgs = parseToolArgs("render_chart_config", chartCall.arguments) as RenderChartArgs;

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

    logger.toolResult("render_chart_config", {
        success: true,
        durationMs: Date.now() - startTime,
    });

    return { chartConfig: chartArgs.chartConfig, openAiItems };
}
