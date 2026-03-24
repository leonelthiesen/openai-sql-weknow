import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "../chat.service";
import { callOpenAI, extractFunctionCalls } from "../openai-call";
import { getRenderChartToolDefinition } from "../../models/tool-definitions";
import { parseToolArgs } from "../../utils/tool-args-parser";
import type { RenderChartArgs } from "../../types/tool-args.types";
import type { PivotGridResponse, PivotGridColumn } from "../../types/pivot-grid-response.types";
import { logger } from "../../utils/logger";

const CATEGORY_SECTION = 17;
const MEASURE_SECTION = 15;

export interface RenderChartResult {
    chartConfig?: object;
    openAiItems: OpenAiItem[];
}

// ── Hydrate ECharts config with real data ────────────────────────────────────

function buildColumnIndexMap(cols: PivotGridColumn[]): Map<string, number> {
    const map = new Map<string, number>();
    for (let i = 0; i < cols.length; i++) {
        map.set(cols[i]!.completeName, i);
    }
    return map;
}

function extractColumnValues(data: PivotGridResponse, colIndex: number): string[] {
    return data.rows.map((row) => {
        let key = `d${colIndex + 1}` as `d${number}`;
        const value = row[key];
        return value != null ? String(value) : "";
    });
}

function parseNumericValue(value: string): string | number {
    if (value === "" || value == null) return 0;
    const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? value : num;
}

function hydrateAxisItem(
    ax: any,
    data: PivotGridResponse,
    colIndexMap: Map<string, number>,
    fallbackValues: string[]
): void {
    if (!ax || !Array.isArray(ax.data)) return;

    if (ax.id && colIndexMap.has(ax.id)) {
        ax.data = extractColumnValues(data, colIndexMap.get(ax.id)!);
    } else if (fallbackValues.length > 0) {
        ax.data = fallbackValues;
    }
}

function replaceAxisData(
    axis: any,
    data: PivotGridResponse,
    colIndexMap: Map<string, number>,
    fallbackValues: string[]
): void {
    if (!axis) return;

    if (Array.isArray(axis)) {
        for (const ax of axis) {
            hydrateAxisItem(ax, data, colIndexMap, fallbackValues);
        }
    } else {
        hydrateAxisItem(axis, data, colIndexMap, fallbackValues);
    }
}

function hydrateDataset(config: any, data: PivotGridResponse, _colIndexMap: Map<string, number>): void {
    if (!config.dataset) return;

    const dataset = Array.isArray(config.dataset) ? config.dataset[0] : config.dataset;
    if (!dataset || !Array.isArray(dataset.source)) return;

    const header = data.cols.map((col) => col.header.caption);
    const rows = data.rows.map((row) => {
        return data.cols.map((col, i) => {
            const value = row[`d${i + 1}` as `d${number}`] ?? "";
            return col.section === CATEGORY_SECTION ? value : parseNumericValue(value);
        });
    });

    dataset.source = [header, ...rows];
}

export function hydrateChartConfig(
    chartConfig: object,
    data: PivotGridResponse
): object {
    if (data.rows.length === 0) return chartConfig;

    const config = JSON.parse(JSON.stringify(chartConfig));
    const colIndexMap = buildColumnIndexMap(data.cols);

    // Find category columns and extract their values
    const categoryCols = data.cols
        .map((col, i) => ({ col, index: i }))
        .filter(({ col }) => col.section === CATEGORY_SECTION);

    const primaryCategoryValues = categoryCols.length > 0
        ? extractColumnValues(data, categoryCols[0]!.index)
        : [];

    // Replace axis data with real category values (id-based or fallback)
    replaceAxisData(config.xAxis, data, colIndexMap, primaryCategoryValues);
    replaceAxisData(config.yAxis, data, colIndexMap, primaryCategoryValues);

    // Replace series data using id → completeName mapping
    if (Array.isArray(config.series)) {
        const matchedCompleteNames = new Set<string>();

        for (const series of config.series) {
            if (!series.id || !colIndexMap.has(series.id)) continue;

            const colIndex = colIndexMap.get(series.id)!;
            const values = extractColumnValues(data, colIndex);
            series.data = values.map(parseNumericValue);
            matchedCompleteNames.add(series.id);
        }

        // Fallback: assign unmatched series to unmatched measure columns
        const unmatchedMeasures = data.cols
            .filter((col) => col.section === MEASURE_SECTION && !matchedCompleteNames.has(col.completeName));
        const unmatchedSeries = config.series
            .filter((s: any) => !s.id || !colIndexMap.has(s.id));

        if (unmatchedSeries.length > 0 && unmatchedMeasures.length > 0) {
            if (unmatchedSeries.length === unmatchedMeasures.length) {
                // Positional match when counts align
                for (let i = 0; i < unmatchedSeries.length; i++) {
                    const col = unmatchedMeasures[i]!;
                    const colIndex = colIndexMap.get(col.completeName)!;
                    const values = extractColumnValues(data, colIndex);
                    unmatchedSeries[i].id = col.completeName;
                    unmatchedSeries[i].data = values.map(parseNumericValue);
                }
            } else {
                // Name-based matching
                for (const series of unmatchedSeries) {
                    if (!series.name) continue;
                    const seriesName = String(series.name).toLowerCase();
                    const match = unmatchedMeasures.find(
                        (col) => col.header.caption.toLowerCase() === seriesName
                    );
                    if (match) {
                        const colIndex = colIndexMap.get(match.completeName)!;
                        const values = extractColumnValues(data, colIndex);
                        series.id = match.completeName;
                        series.data = values.map(parseNumericValue);
                    }
                }
            }
        }
    }

    // Handle dataset pattern
    hydrateDataset(config, data, colIndexMap);

    return config;
}

// ── Developer message builder ────────────────────────────────────────────────

export function buildDeveloperMessage(executionData?: PivotGridResponse): string {
    const lines = [
        "The extract_data tool was called and sample query results are provided.",
        "Use this information and the user's request to render an appropriate chart configuration.",
    ];

    if (executionData && executionData.cols.length > 0) {
        const categoryCols = executionData.cols.filter((c) => c.section === CATEGORY_SECTION);
        const measureCols = executionData.cols.filter((c) => c.section === MEASURE_SECTION);

        lines.push(
            "",
            "CRITICAL: Every series object MUST include an \"id\" property set to the exact completeName of the corresponding measure column. Every axis (xAxis/yAxis) that uses \"data\" MUST include an \"id\" set to the exact completeName of the corresponding category column. Without this, real data will NOT be displayed.",
        );

        if (categoryCols.length > 0) {
            const catList = categoryCols.map((c) => `"${c.completeName}" (${c.header.caption})`).join(", ");
            lines.push(`Category columns (use for axis data, set id to completeName): ${catList}`);

            const catExample = categoryCols[0]!;
            lines.push(
                "",
                "Example axis structure:",
                `{ "id": "${catExample.completeName}", "type": "category", "data": [...] }`,
            );
        }

        if (measureCols.length > 0) {
            const measList = measureCols.map((c) => `"${c.completeName}" (${c.header.caption})`).join(", ");
            lines.push(`Measure columns (use as series, set id to completeName): ${measList}`);

            const example = measureCols[0]!;
            lines.push(
                "",
                "Example series structure:",
                `{ "id": "${example.completeName}", "name": "${example.header.caption}", "type": "bar", "data": [...] }`,
            );
        }
    }

    return lines.join("\n");
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function handleRenderChart(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    extractDataCallOutput: OpenAiItem,
    executionData?: PivotGridResponse
): Promise<RenderChartResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    const developerContent = buildDeveloperMessage(executionData);

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

    const finalConfig = executionData
        ? hydrateChartConfig(chartArgs.chartConfig, executionData)
        : chartArgs.chartConfig;

    return { chartConfig: finalConfig, openAiItems };
}
