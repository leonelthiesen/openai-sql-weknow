import type { ChartConfig } from "../models/chart-config.schema";
import type { EChartsDatasetResult } from "./to-echarts-dataset";

// ── Types ────────────────────────────────────────────────────────────────────

type EChartsOption = Record<string, unknown>;
type SeriesItem = Record<string, unknown>;

// ── Shared building blocks ───────────────────────────────────────────────────

function baseLegend(): Record<string, unknown> {
    return { type: "scroll", bottom: 0 };
}

function baseTooltip(trigger: "axis" | "item"): Record<string, unknown> {
    return { trigger, axisPointer: { type: "shadow" } };
}

function categoryAxis(label: string): Record<string, unknown> {
    return {
        type: "category",
        name: label,
        axisLabel: { rotate: 30 },
    };
}

function valueAxis(label: string): Record<string, unknown> {
    return {
        type: "value",
        name: label,
    };
}

function baseTitle(): Record<string, unknown> {
    return {
        show: false,
    };
}

function baseGrid(): Record<string, unknown> {
    return {
        // Reduce this value (e.g., to 10px or 5%)
        // to fill the space previously occupied by the title
        top: '20px'
    };
}

// ── Series builders per layout ───────────────────────────────────────────────

function buildSeriesForPivot(
    result: EChartsDatasetResult,
    chartType: string,
    stack?: string,
): SeriesItem[] {
    if (!result.seriesValues?.length) return [];

    const axisField = result.axisDim!.label;
    return result.seriesValues.map(col => {
        const item: SeriesItem = {
            type: chartType,
            name: col,
            encode: { x: axisField, y: col },
        };
        if (stack) item.stack = stack;
        if (chartType === "area") item.areaStyle = {};
        return item;
    });
}

function buildSeriesForSimple(
    result: EChartsDatasetResult,
    chartType: string,
    config: ChartConfig,
    stack?: string,
): SeriesItem[] {
    const axisField = result.axisDim!.label;
    return result.measures.map(m => {
        const item: SeriesItem = {
            type: chartType,
            name: m.label,
            encode: { x: axisField, y: m.label },
        };
        if (stack) item.stack = stack;
        if (chartType === "area") item.areaStyle = {};
        if (result.measures.length === 1) item.name = config.encodings.y?.label ?? m.label;
        return item;
    });
}

// ── Chart type handlers ──────────────────────────────────────────────────────

function buildCartesian(
    result: EChartsDatasetResult,
    config: ChartConfig,
    echartsType: string,
): EChartsOption {
    const xLabel = config.encodings.x?.label ?? result.axisDim?.label ?? "";
    const yLabel = config.encodings.y?.label ?? result.measures[0]?.label ?? "";

    const series = result.layout === "pivot"
        ? buildSeriesForPivot(result, echartsType)
        : buildSeriesForSimple(result, echartsType, config);

    return {
        dataset: result.dataset,
        legend: baseLegend(),
        tooltip: baseTooltip("axis"),
        xAxis: categoryAxis(xLabel),
        yAxis: valueAxis(yLabel),
        series,
        title: baseTitle(),
        grid: baseGrid(),
    };
}

function buildPie(
    result: EChartsDatasetResult,
    config: ChartConfig,
    isDonut: boolean,
): EChartsOption {
    // Pie uses the first dim as name, first measure as value
    const nameField = result.axisDim?.label ?? result.measures[0]?.label ?? "";
    const valueField = result.measures[0]?.label ?? "";

    const series: SeriesItem = {
        type: "pie",
        encode: { itemName: nameField, value: valueField },
    };

    if (isDonut) {
        series.radius = ["40%", "70%"];
    } else {
        series.radius = "65%";
    }

    // For pivot layout, collapse series values into a single dimension
    if (result.layout === "pivot" && result.seriesValues?.length) {
        // Rebuild dataset: each series value becomes a row with [name, value]
        const colLabel = config.encodings.color?.label ?? config.encodings.theta?.label ?? "Categoria";
        const valLabel = config.encodings.theta?.label ?? result.measures[0]?.label ?? "Valor";
        const source = result.dataset.source;
        const header = source[0] as string[];

        const newSource: (string | number | boolean | null)[][] = [[colLabel, valLabel]];
        // Sum each series column across all data rows
        for (let c = 1; c < header.length; c++) {
            let total = 0;
            for (let r = 1; r < source.length; r++) {
                const v = source[r]![c];
                if (typeof v === "number") total += v;
            }
            newSource.push([header[c]!, total]);
        }

        series.encode = { itemName: colLabel, value: valLabel };
        return {
            dataset: { source: newSource },
            legend: baseLegend(),
            tooltip: baseTooltip("item"),
            series: [series],
            title: baseTitle(),
            grid: baseGrid(),
        };
    }

    return {
        dataset: result.dataset,
        legend: baseLegend(),
        tooltip: baseTooltip("item"),
        series: [series],
        title: baseTitle(),
        grid: baseGrid(),
    };
}

function buildScatter(
    result: EChartsDatasetResult,
    config: ChartConfig,
    isBubble: boolean,
): EChartsOption {
    const xField = config.encodings.x?.field ?? result.measures[0]?.label ?? "";
    const yField = config.encodings.y?.field ?? result.measures[1]?.label ?? result.measures[0]?.label ?? "";
    const xLabel = config.encodings.x?.label ?? xField;
    const yLabel = config.encodings.y?.label ?? yField;

    const series: SeriesItem = {
        type: "scatter",
        encode: { x: xField, y: yField },
        symbolSize: 10,
    };

    if (isBubble && config.encodings.size) {
        series.symbolSize = undefined;
        // Bubble: size is handled via visualMap or custom function
        series.encode = { ...series.encode as object, size: config.encodings.size.field };
    }

    const option: EChartsOption = {
        dataset: result.dataset,
        legend: baseLegend(),
        tooltip: baseTooltip("item"),
        xAxis: { type: "value", name: xLabel },
        yAxis: { type: "value", name: yLabel },
        series: [series],
        title: baseTitle(),
        grid: baseGrid(),
    };

    return option;
}

function buildHeatmap(
    result: EChartsDatasetResult,
    config: ChartConfig,
): EChartsOption {
    const xField = config.encodings.x?.field ?? result.axisDim?.label ?? "";
    const yField = config.encodings.y?.field ?? result.seriesDim?.label ?? result.measures[0]?.label ?? "";
    const colorField = config.encodings.color?.field ?? result.measures[0]?.label ?? "";

    return {
        dataset: result.dataset,
        legend: { show: false },
        tooltip: baseTooltip("item"),
        xAxis: categoryAxis(config.encodings.x?.label ?? xField),
        yAxis: categoryAxis(config.encodings.y?.label ?? yField),
        visualMap: {
            min: 0,
            max: "dataMax",
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: 0,
        },
        series: [{
            type: "heatmap",
            encode: { x: xField, y: yField, value: colorField },
        }],
        title: baseTitle(),
        grid: baseGrid(),
    };
}

function buildKpiOption(result: EChartsDatasetResult): EChartsOption {
    // KPI: return just the dataset; the frontend typically renders this differently
    return {
        dataset: result.dataset,
        series: [],
        tooltip: baseTooltip("item"),
        legend: { show: false },
        title: baseTitle(),
        grid: baseGrid(),
    };
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildEchartsOption(
    result: EChartsDatasetResult,
    config: ChartConfig,
): EChartsOption {
    if (result.layout === "kpi") {
        return buildKpiOption(result);
    }

    switch (config.chart_type) {
        case "bar":
            return buildCartesian(result, config, "bar");
        case "line":
            return buildCartesian(result, config, "line");
        case "area":
            return buildCartesian(result, config, "area");
        case "pie":
            return buildPie(result, config, false);
        case "donut":
            return buildPie(result, config, true);
        case "scatter":
            return buildScatter(result, config, false);
        case "bubble":
            return buildScatter(result, config, true);
        case "heatmap":
            return buildHeatmap(result, config);
        case "histogram":
            // Histogram is a bar chart with continuous x-axis
            return buildCartesian(result, config, "bar");
        default:
            return buildCartesian(result, config, "bar");
    }
}
