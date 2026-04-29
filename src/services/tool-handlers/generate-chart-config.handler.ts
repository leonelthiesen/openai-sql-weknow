import type { ResponseInputItem } from "openai/resources/responses/responses";
import { logger } from "../../utils/logger";
import type { OpenAiItem } from "../chat.service";
import { callOpenAIForStructuredMessage } from "../openai-call";
import { toInputItems } from "../llm-retry";
import { ChartConfigSchema, type ChartConfig } from "../../models/chart-config.schema";

export interface GenerateChartConfigResult {
    success: boolean;
    config?: ChartConfig;
    openAiItems: OpenAiItem[];
    failureReason?: string;
}

function buildChartConfigPrompt(schema: string, retryHint?: string): string {
    const lines = [
        "You are a data visualization specialist.",
        "Given a SQL view schema and a user request, return ONLY a JSON config for a chart — no explanation, no markdown, no code.",
        "",
        "Rules:",
        "- Use only fields that exist in the schema",
        "- Choose the most appropriate chart_type for the request",
        "- Map fields to visual encodings: x, y, color, size, theta, label",
        "- Each encoding must include: field, type (quantitative | nominal | ordinal | temporal), label",
        "- Available chart types: bar, line, area, pie, donut, scatter, bubble, heatmap, histogram",
        "- The SQL query will handle all grouping and aggregation.",
        "- Assume the data is already in its final aggregated form.",
        "",
        "## Dimension roles",
        "- Fields with role 'category dimension' should map to the x-axis (or theta for pie/donut).",
        "- Fields with role 'series dimension' should map to the color encoding (they will be pivoted into separate series automatically).",
        "- Fields with role 'measure (aggregated)' should map to y (or theta value for pie/donut).",
    ];
    lines.push(
        "",
        `Schema: ${schema}`,
    );
    if (retryHint) {
        lines.push("", retryHint);
    }
    return lines.join("\n");
}

export async function handleGenerateChartConfig(params: {
    schema: string;
    baseInput: ResponseInputItem[];
    lastResponseOutput: unknown[];
    extractDataCallOutput: OpenAiItem;
    retryHint?: string;
}): Promise<GenerateChartConfigResult> {
    const { schema, baseInput, lastResponseOutput, extractDataCallOutput, retryHint } = params;
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    if (!extractDataCallOutput.callId || typeof extractDataCallOutput.output !== "string") {
        return {
            success: false,
            openAiItems,
            failureReason: "Missing extract_data output context for chart config generation.",
        };
    }

    const developerMessage = buildChartConfigPrompt(schema, retryHint);
    openAiItems.push({
        type: "message",
        role: "developer",
        content: developerMessage,
    });

    const finalInput: ResponseInputItem[] = [
        ...baseInput,
        ...toInputItems(lastResponseOutput),
        {
            type: extractDataCallOutput.type,
            call_id: extractDataCallOutput.callId,
            output: extractDataCallOutput.output,
        } as ResponseInputItem,
        {
            role: "developer",
            content: developerMessage,
        } as ResponseInputItem,
    ];

    try {
        const { parsed } = await callOpenAIForStructuredMessage(finalInput, ChartConfigSchema, "chart_config");

        openAiItems.push({
            type: "message",
            role: "assistant",
            content: JSON.stringify(parsed),
        });

        logger.toolResult("chart_config", {
            success: true,
            durationMs: Date.now() - startTime,
        });

        return {
            success: true,
            config: parsed,
            openAiItems,
        };
    } catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);
        logger.error("chart_config", "Failed to generate chart config", { error: failureReason });

        return {
            success: false,
            openAiItems,
            failureReason,
        };
    }
}
