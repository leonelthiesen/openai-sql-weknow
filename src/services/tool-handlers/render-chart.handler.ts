import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "../chat.service";
import { callOpenAI, extractFunctionCalls } from "../openai-call";
import { getRenderChartToolDefinition } from "../../models/tool-definitions";
import { parseToolArgs } from "../../utils/tool-args-parser";
import type { RenderChartArgs } from "../../types/tool-args.types";
import type { PivotGridResponse } from "../../types/pivot-grid-response.types";
import type { LLMQuery } from "../../models/llm-structured-output.models";
import { transformToChartData, type ChartData } from "../../utils/pivot-grid-data-transformer";
import { logger } from "../../utils/logger";

export interface RenderChartResult {
    chartConfig?: object;
    openAiItems: OpenAiItem[];
}

// ── Chart data manifest ──────────────────────────────────────────────────────

export interface ChartDataManifest {
    labels: string[];
    datasets: { index: number; label: string; data: number[] }[];
}

export function buildChartDataManifest(
    data: PivotGridResponse,
    queryConfig: LLMQuery
): ChartDataManifest {
    const chartData: ChartData = transformToChartData(data, queryConfig);

    return {
        labels: chartData.labels,
        datasets: chartData.datasets.map((ds, i) => ({
            index: i,
            label: ds.label,
            data: ds.data,
        })),
    };
}

// ── Hydrate ECharts config with manifest data (positional) ───────────────────

function setCategoryAxisData(axis: any, labels: string[]): void {
    if (!axis) return;

    const items = Array.isArray(axis) ? axis : [axis];
    for (const ax of items) {
        if (ax && (ax.type === "category" || Array.isArray(ax.data))) {
            ax.data = labels;
        }
    }
}

function hydrateDatasetFromManifest(config: any, manifest: ChartDataManifest): boolean {
    if (!config.dataset) return false;

    const dataset = Array.isArray(config.dataset) ? config.dataset[0] : config.dataset;
    if (!dataset || !Array.isArray(dataset.source)) return false;

    const header = ["Category", ...manifest.datasets.map((ds) => ds.label)];
    const rows = manifest.labels.map((label, rowIdx) => {
        return [label, ...manifest.datasets.map((ds) => ds.data[rowIdx] ?? 0)];
    });

    dataset.source = [header, ...rows];
    return true;
}

export function hydrateChartConfig(
    chartConfig: object,
    manifest: ChartDataManifest
): object {
    if (manifest.labels.length === 0) return chartConfig;

    const config: any = JSON.parse(JSON.stringify(chartConfig));

    // Handle dataset.source pattern first
    if (hydrateDatasetFromManifest(config, manifest)) {
        return config;
    }

    // Replace category axis data
    setCategoryAxisData(config.xAxis, manifest.labels);
    setCategoryAxisData(config.yAxis, manifest.labels);

    // Replace series data by position
    if (Array.isArray(config.series)) {
        for (let i = 0; i < config.series.length; i++) {
            if (i < manifest.datasets.length) {
                const ds = manifest.datasets[i]!;
                config.series[i].data = ds.data;
                config.series[i].name = ds.label;
                config.series[i].id = `series-${i}`;
            }
        }

        // If LLM created fewer series than manifest, add missing ones
        if (config.series.length < manifest.datasets.length) {
            const templateType = config.series[0]?.type ?? "bar";
            for (let i = config.series.length; i < manifest.datasets.length; i++) {
                const ds = manifest.datasets[i]!;
                config.series.push({
                    id: `series-${i}`,
                    name: ds.label,
                    type: templateType,
                    data: ds.data,
                });
            }
            logger.warn("render_chart_config", `Added ${manifest.datasets.length - config.series.length} missing series`);
        }

        // If LLM created more series than manifest, truncate
        if (config.series.length > manifest.datasets.length) {
            logger.warn(
                "render_chart_config",
                `Truncating ${config.series.length - manifest.datasets.length} extra series`
            );
            config.series.length = manifest.datasets.length;
        }
    }

    return config;
}

// ── Developer message builder ────────────────────────────────────────────────

export function buildDeveloperMessage(manifest?: ChartDataManifest): string {
    const lines = [
        "The query was executed and column schema with OBFUSCATED CSV sample data are provided.",
        "Use the schema and OBFUSCATED CSV data with the user's request to render an appropriate chart configuration.",
    ];

    if (manifest && manifest.datasets.length > 0) {
        lines.push(
            "",
            "CRITICAL STRUCTURAL REQUIREMENTS:",
            `- You MUST create exactly ${manifest.datasets.length} series objects, in the order listed below.`,
            "- The data arrays will be REPLACED with real values after generation. Use placeholder arrays of the correct length.",
            `- Each series.data placeholder MUST have exactly ${manifest.labels.length} elements (use zeros).`,
            "- Set xAxis (or yAxis for horizontal charts) with type \"category\" and a placeholder data array.",
            "- Do NOT set \"id\" on series or axes — IDs are managed automatically.",
            "- Focus on chart type, colors, tooltip, legend, and visual formatting.",
            "",
            `Category labels (${manifest.labels.length} items):`,
            JSON.stringify(manifest.labels.slice(0, 20)) + (manifest.labels.length > 20 ? ` ... (${manifest.labels.length} total)` : ""),
            "",
            `Series to create (exactly ${manifest.datasets.length}, in this order):`,
        );

        for (let i = 0; i < manifest.datasets.length; i++) {
            lines.push(`  [${i}] "${manifest.datasets[i]!.label}"`);
        }

        lines.push(
            "",
            "Example structure:",
            `{`,
            `  "xAxis": { "type": "category", "data": [${new Array(Math.min(manifest.labels.length, 3)).fill(0).join(", ")}${manifest.labels.length > 3 ? ", ..." : ""}] },`,
            `  "yAxis": { "type": "value" },`,
            `  "series": [`,
        );

        for (let i = 0; i < Math.min(manifest.datasets.length, 2); i++) {
            const ds = manifest.datasets[i]!;
            const comma = i < Math.min(manifest.datasets.length, 2) - 1 ? "," : "";
            lines.push(`    { "name": "${ds.label}", "type": "bar", "data": [${new Array(Math.min(manifest.labels.length, 3)).fill(0).join(", ")}${manifest.labels.length > 3 ? ", ..." : ""}] }${comma}`);
        }

        if (manifest.datasets.length > 2) {
            lines.push(`    // ... ${manifest.datasets.length - 2} more series`);
        }

        lines.push(`  ]`, `}`);
    }

    return lines.join("\n");
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handleRenderChart(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    extractDataCallOutput: OpenAiItem,
    executionData?: PivotGridResponse,
    queryConfig?: LLMQuery
): Promise<RenderChartResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    // Build manifest from real data if both are available
    let manifest: ChartDataManifest | undefined;
    if (executionData && queryConfig) {
        try {
            manifest = buildChartDataManifest(executionData, queryConfig);
        } catch (err) {
            logger.error("render_chart_config", "Failed to build chart data manifest", { error: String(err) });
        }
    }

    const developerContent = buildDeveloperMessage(manifest);

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

    const { response } = await callOpenAI(secondCallInput, [getRenderChartToolDefinition()]);
    const chartCalls = extractFunctionCalls(response);

    if (chartCalls.length === 0) {
        logger.warn("render_chart_config", "No function_call in chart response output");
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

    const finalConfig = manifest
        ? hydrateChartConfig(chartArgs.chartConfig, manifest)
        : chartArgs.chartConfig;

    return { chartConfig: finalConfig, openAiItems };
}
