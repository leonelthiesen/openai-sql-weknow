import { describe, expect, it } from "vitest";
import { buildEchartsOption } from "./build-echarts-option";
import type { EChartsDatasetResult, ClassifiedColumn } from "./to-echarts-dataset";
import type { ChartConfig } from "../models/chart-config.schema";
import type { PivotGridColumn } from "../types/pivot-grid-response.types";

function makeCc(completeName: string, section: number, caption?: string): ClassifiedColumn {
    return {
        col: {
            completeName,
            dataType: 1,
            section,
            header: { caption: caption ?? completeName },
            expanded: false,
            wordWrap: false,
            visible: true,
        } satisfies PivotGridColumn,
        index: 0,
        label: caption ?? completeName,
    };
}

function makeConfig(overrides: Partial<ChartConfig> = {}): ChartConfig {
    return {
        chart_type: "bar",
        title: "Test",
        encodings: {
            x: { field: "month", type: "nominal", label: "Mês" },
            y: { field: "revenue", type: "quantitative", label: "Receita" },
            color: null,
            size: null,
            theta: null,
            label: null,
        },
        ...overrides,
    };
}

describe("buildEchartsOption", () => {
    it("bar chart with simple layout", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "Receita"], ["Jan", 100], ["Feb", 200]] },
            layout: "simple",
            axisDim: makeCc("month", 17, "Mês"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig();

        const option = buildEchartsOption(result, config);

        expect(option.dataset).toBe(result.dataset);
        expect(option.xAxis).toEqual(expect.objectContaining({ type: "category", name: "Mês" }));
        expect(option.yAxis).toEqual(expect.objectContaining({ type: "value", name: "Receita" }));
        expect(option.tooltip).toEqual({ trigger: "axis" });
        expect(option.legend).toEqual(expect.objectContaining({ type: "scroll" }));

        const series = option.series as any[];
        expect(series).toHaveLength(1);
        expect(series[0].type).toBe("bar");
        expect(series[0].encode).toEqual({ x: "Mês", y: "Receita" });
    });

    it("bar chart with pivot layout → one series per seriesValue", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "MG", "PR"], ["Jan", 100, 200], ["Feb", 150, 250]] },
            layout: "pivot",
            axisDim: makeCc("yearMonth", 17, "Mês"),
            seriesDim: makeCc("state", 17, "Estado"),
            measures: [makeCc("revenue", 15, "Receita")],
            seriesValues: ["MG", "PR"],
        };
        const config = makeConfig();

        const option = buildEchartsOption(result, config);

        const series = option.series as any[];
        expect(series).toHaveLength(2);
        expect(series[0].name).toBe("MG");
        expect(series[0].encode).toEqual({ x: "Mês", y: "MG" });
        expect(series[1].name).toBe("PR");
        expect(series[1].encode).toEqual({ x: "Mês", y: "PR" });
    });

    it("line chart produces line series", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "Receita"], ["Jan", 100]] },
            layout: "simple",
            axisDim: makeCc("month", 17, "Mês"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig({ chart_type: "line" });

        const option = buildEchartsOption(result, config);
        const series = option.series as any[];
        expect(series[0].type).toBe("line");
    });

    it("area chart includes areaStyle", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "Receita"], ["Jan", 100]] },
            layout: "simple",
            axisDim: makeCc("month", 17, "Mês"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig({ chart_type: "area" });

        const option = buildEchartsOption(result, config);
        const series = option.series as any[];
        expect(series[0].areaStyle).toEqual({});
    });

    it("pie chart with simple layout", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Produto", "Receita"], ["A", 100], ["B", 200]] },
            layout: "simple",
            axisDim: makeCc("product", 17, "Produto"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig({
            chart_type: "pie",
            encodings: {
                x: null,
                y: null,
                theta: { field: "revenue", type: "quantitative", label: "Receita" },
                color: { field: "product", type: "nominal", label: "Produto" },
                size: null,
                label: null,
            },
        });

        const option = buildEchartsOption(result, config);
        const series = option.series as any[];
        expect(series).toHaveLength(1);
        expect(series[0].type).toBe("pie");
        expect(series[0].radius).toBe("65%");
        expect(option.tooltip).toEqual({ trigger: "item" });
    });

    it("donut chart has inner radius", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Produto", "Receita"], ["A", 100]] },
            layout: "simple",
            axisDim: makeCc("product", 17, "Produto"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig({
            chart_type: "donut",
            encodings: {
                x: null, y: null, size: null, label: null,
                theta: { field: "revenue", type: "quantitative", label: "Receita" },
                color: { field: "product", type: "nominal", label: "Produto" },
            },
        });

        const option = buildEchartsOption(result, config);
        const series = option.series as any[];
        expect(series[0].radius).toEqual(["40%", "70%"]);
    });

    it("KPI layout returns empty series", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Total"], [42]] },
            layout: "kpi",
            measures: [makeCc("total", 15, "Total")],
        };
        const config = makeConfig();

        const option = buildEchartsOption(result, config);
        expect((option.series as any[]).length).toBe(0);
        expect(option.legend).toEqual({ show: false });
    });

    it("legend is positioned at bottom with scroll", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "Receita"], ["Jan", 100]] },
            layout: "simple",
            axisDim: makeCc("month", 17, "Mês"),
            measures: [makeCc("revenue", 15, "Receita")],
        };
        const config = makeConfig();

        const option = buildEchartsOption(result, config);
        expect(option.legend).toEqual(expect.objectContaining({ type: "scroll", bottom: 0 }));
    });

    it("pie with pivot layout collapses series into rows", () => {
        const result: EChartsDatasetResult = {
            dataset: { source: [["Mês", "MG", "PR"], ["Jan", 100, 200], ["Feb", 150, 250]] },
            layout: "pivot",
            axisDim: makeCc("yearMonth", 17, "Mês"),
            seriesDim: makeCc("state", 17, "Estado"),
            measures: [makeCc("revenue", 15, "Receita")],
            seriesValues: ["MG", "PR"],
        };
        const config = makeConfig({
            chart_type: "pie",
            encodings: {
                x: null, y: null, size: null, label: null,
                theta: { field: "revenue", type: "quantitative", label: "Receita" },
                color: { field: "state", type: "nominal", label: "Estado" },
            },
        });

        const option = buildEchartsOption(result, config);
        const ds = option.dataset as any;
        // Should have collapsed pivot: [["Estado", "Receita"], ["MG", 250], ["PR", 450]]
        expect(ds.source).toHaveLength(3); // header + 2 series
        expect(ds.source[0]).toEqual(["Estado", "Receita"]);
        expect(ds.source[1]).toEqual(["MG", 250]);
        expect(ds.source[2]).toEqual(["PR", 450]);
    });
});
