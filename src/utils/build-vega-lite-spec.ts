import type { ChartConfig } from "../models/chart-config.schema";
import type { EChartsDatasetResult, DatasetSource } from "./to-echarts-dataset";

// ── Encoding type mapping ────────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
    quantitative: "quantitative",
    nominal: "nominal",
    ordinal: "ordinal",
    temporal: "temporal",
};

// ── Mark mapping ─────────────────────────────────────────────────────────────

type VegaLiteMark =
    | string
    | { type: string; [key: string]: unknown };

function resolveMarkAndOverrides(
    chartType: ChartConfig["chart_type"]
): { mark: VegaLiteMark; extraEncoding?: Record<string, unknown> } {
    switch (chartType) {
        case "bar":
            return { mark: { type: "bar", tooltip: true } };
        case "line":
            return { mark: { type: "line", tooltip: true, point: true } };
        case "area":
            return { mark: { type: "area", tooltip: true, line: true, opacity: 0.6 } };
        case "pie":
            return { mark: { type: "arc", tooltip: true } };
        case "donut":
            return { mark: { type: "arc", tooltip: true, innerRadius: 60 } };
        case "scatter":
            return { mark: { type: "point", tooltip: true, size: 80 } };
        case "bubble":
            return { mark: { type: "point", tooltip: true } };
        case "heatmap":
            return { mark: { type: "rect", tooltip: true } };
        case "histogram":
            return {
                mark: { type: "bar", tooltip: true },
                extraEncoding: { x: { bin: true } },
            };
    }
}

// ── Convert dataset source (array-of-arrays) to array-of-objects ─────────────

function datasetSourceToObjects(source: DatasetSource): Record<string, unknown>[] {
    if (source.length < 2) return [];
    const header = source[0] as string[];
    return source.slice(1).map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < header.length; i++) {
            obj[header[i]!] = row[i];
        }
        return obj;
    });
}

// ── Build encoding channel ───────────────────────────────────────────────────

interface EncodingDef {
    field: string;
    type: string;
    label: string;
}

function buildChannel(enc: EncodingDef, overrides?: Record<string, unknown>): Record<string, unknown> {
    return {
        field: enc.field,
        type: TYPE_MAP[enc.type] ?? "nominal",
        title: enc.label,
        ...overrides,
    };
}

// ── Build tooltip array from all active encodings ────────────────────────────

function buildTooltip(config: ChartConfig, datasetResult: EChartsDatasetResult): Record<string, unknown>[] {
    const tooltip: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    // For pivot layout with fold, add the series and value fields
    if (datasetResult.layout === "pivot" && datasetResult.seriesValues?.length) {
        tooltip.push(
            { field: "series", type: "nominal", title: datasetResult.seriesDim?.label ?? "Série" },
            { field: "value", type: "quantitative", title: datasetResult.measures[0]?.label ?? "Valor" },
        );
        if (datasetResult.axisDim) {
            tooltip.push({ field: datasetResult.axisDim.label, type: "nominal", title: datasetResult.axisDim.label });
        }
        return tooltip;
    }

    for (const [, enc] of Object.entries(config.encodings)) {
        if (enc && !seen.has(enc.field)) {
            seen.add(enc.field);
            tooltip.push({
                field: enc.field,
                type: TYPE_MAP[enc.type] ?? "nominal",
                title: enc.label,
            });
        }
    }

    return tooltip;
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildVegaLiteSpec(
    config: ChartConfig,
    datasetResult: EChartsDatasetResult,
): Record<string, unknown> {
    const { mark, extraEncoding } = resolveMarkAndOverrides(config.chart_type);
    const isPolar = config.chart_type === "pie" || config.chart_type === "donut";

    const encoding: Record<string, unknown> = {};
    const transforms: Record<string, unknown>[] = [];

    const useFold = datasetResult.layout === "pivot"
        && datasetResult.seriesValues?.length
        && !isPolar;

    // ── x / y ────────────────────────────────────────────────────────────────
    if (config.encodings.x && !isPolar) {
        encoding.x = buildChannel(config.encodings.x, extraEncoding?.x as Record<string, unknown>);
    } else if (datasetResult.axisDim && !isPolar) {
        encoding.x = {
            field: datasetResult.axisDim.label,
            type: "nominal",
            title: datasetResult.axisDim.label,
        };
    }

    if (useFold) {
        transforms.push({
            fold: datasetResult.seriesValues!,
            as: ["series", "value"],
        });
        encoding.y = {
            field: "value",
            type: "quantitative",
            title: config.encodings.y?.label ?? datasetResult.measures.map(m => m.label).join(", "),
        };
        encoding.color = {
            field: "series",
            type: "nominal",
            title: datasetResult.seriesDim?.label ?? "Série",
        };
    } else {
        if (config.encodings.y && !isPolar) {
            encoding.y = buildChannel(config.encodings.y);
        }

        // ── color ────────────────────────────────────────────────────────────
        if (config.encodings.color) {
            if (isPolar) {
                encoding.color = buildChannel(config.encodings.color);
            } else {
                encoding.color = buildChannel(config.encodings.color, { legend: { title: config.encodings.color.label } });
            }
        }
    }

    // ── theta (pie / donut) ──────────────────────────────────────────────────
    if (config.encodings.theta && isPolar) {
        encoding.theta = buildChannel(config.encodings.theta, { stack: true });
    }

    // ── size (bubble) ────────────────────────────────────────────────────────
    if (config.encodings.size && config.chart_type === "bubble") {
        encoding.size = buildChannel(config.encodings.size, {
            scale: { range: [50, 1000] },
        });
    }

    // ── heatmap color as quantitative fill ───────────────────────────────────
    if (config.chart_type === "heatmap" && config.encodings.color) {
        encoding.color = buildChannel(config.encodings.color, {
            scale: { scheme: "blues" },
            legend: { title: config.encodings.color.label },
        });
    }

    // ── tooltip ──────────────────────────────────────────────────────────────
    encoding.tooltip = buildTooltip(config, datasetResult);

    // ── Assemble spec ────────────────────────────────────────────────────────
    const spec: Record<string, unknown> = {
        $schema: "https://vega.github.io/schema/vega-lite/v5.json",
        data: { values: datasetSourceToObjects(datasetResult.dataset.source) },
        ...(transforms.length > 0 ? { transform: transforms } : {}),
        mark,
        encoding,
        width: "container",
        height: "container",
        config: {
            font: "Inter, sans-serif",
            background: "transparent",
            view: { stroke: null },
        },
    };

    return spec;
}
