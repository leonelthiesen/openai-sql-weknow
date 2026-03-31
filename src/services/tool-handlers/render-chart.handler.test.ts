import { describe, it, expect } from "vitest";
import { hydrateChartConfig, buildDeveloperMessage, buildChartDataManifest } from "./render-chart.handler";
import type { ChartDataManifest } from "./render-chart.handler";
import { TFieldType } from "../../models/TFieldType";
import type { PivotGridResponse, PivotGridColumn } from "../../types/pivot-grid-response.types";
import type { LLMQuery } from "../../models/llm-structured-output.models";

function makeCol(completeName: string, section: number, dataType = TFieldType.ftString): PivotGridColumn {
    return {
        completeName,
        dataType,
        section,
        header: { caption: completeName },
        expanded: false,
        wordWrap: false,
        visible: true,
    };
}

function makeData(
    cols: PivotGridColumn[],
    rowData: string[][]
): PivotGridResponse {
    const rows = rowData.map((values) => {
        const row: Record<string, string> = {};
        values.forEach((v, i) => { row[`d${i + 1}`] = v; });
        return row;
    }) as any;

    return {
        rows,
        cols,
        totals: { internalValues: [], displayValues: [], formattings: [], valueFormattings: [] },
        formattings: [],
        valueFormattings: [],
        showRecordCount: false,
        showRowTitle: false,
        showColumnTitle: false,
        showDataTitle: false,
        metaValues: [],
        dataInfo: { source: 0, dateTime: "2025-01-01" },
        showSubtotalColumn: false,
        showSubtotalRow: false,
        showGrandTotalColumn: false,
        showGrandTotalRow: false,
        serverInfo: { version: "1.0" },
    };
}

function makeManifest(labels: string[], datasets: { label: string; data: number[] }[]): ChartDataManifest {
    return {
        labels,
        datasets: datasets.map((ds, i) => ({ index: i, label: ds.label, data: ds.data })),
    };
}

describe("hydrateChartConfig", () => {
    const manifest = makeManifest(
        ["Empresa A", "Empresa B", "Empresa C"],
        [{ label: "vendas.total - ", data: [1000.50, 2000.75, 3000.00] }]
    );

    it("replaces xAxis.data with manifest labels", () => {
        const config = {
            xAxis: { type: "category", data: ["fake1", "fake2", "fake3"] },
            series: [{ name: "Total", data: [0, 0, 0] }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.xAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("replaces series.data with manifest data by position", () => {
        const config = {
            xAxis: { type: "category", data: ["fake1", "fake2", "fake3"] },
            series: [{ name: "Total", data: [0, 0, 0] }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.series[0].data).toEqual([1000.50, 2000.75, 3000.00]);
        expect(result.series[0].name).toBe("vendas.total - ");
    });

    it("assigns unique series IDs", () => {
        const config = {
            xAxis: { type: "category", data: ["fake"] },
            series: [{ name: "Total", data: [0] }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.series[0].id).toBe("series-0");
    });

    it("handles array-style xAxis", () => {
        const config = {
            xAxis: [{ type: "category", data: ["fake1", "fake2"] }],
            series: [{ name: "Total", data: [0, 0] }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.xAxis[0].data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("handles yAxis replacement for horizontal charts", () => {
        const config = {
            yAxis: { type: "category", data: ["fake1", "fake2"] },
            xAxis: { type: "value" },
            series: [{ name: "Total", data: [0, 0] }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.yAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("returns config as-is when labels are empty", () => {
        const emptyManifest = makeManifest([], []);
        const config = { xAxis: { data: ["a"] }, series: [{ data: [1] }] };

        const result = hydrateChartConfig(config, emptyManifest);
        expect(result).toEqual(config);
    });

    it("does not mutate the original config", () => {
        const config = {
            xAxis: { type: "category", data: ["fake1"] },
            series: [{ name: "Total", data: [0] }],
        };
        const original = JSON.parse(JSON.stringify(config));

        hydrateChartConfig(config, manifest);
        expect(config).toEqual(original);
    });

    it("handles dataset.source pattern", () => {
        const config = {
            dataset: { source: [["Empresa", "Total"], ["fake", 1]] },
            series: [{ type: "bar" }],
        };

        const result = hydrateChartConfig(config, manifest) as any;
        expect(result.dataset.source[0]).toEqual(["Category", "vendas.total - "]);
        expect(result.dataset.source[1]).toEqual(["Empresa A", 1000.50]);
        expect(result.dataset.source).toHaveLength(4); // header + 3 rows
    });

    it("handles multiple measure series", () => {
        const multiManifest = makeManifest(
            ["A", "B"],
            [
                { label: "vendas.total - ", data: [100, 200] },
                { label: "vendas.qtd - ", data: [5, 10] },
            ]
        );

        const config = {
            xAxis: { type: "category", data: ["fake"] },
            series: [
                { name: "Total", data: [0] },
                { name: "Qtd", data: [0] },
            ],
        };

        const result = hydrateChartConfig(config, multiManifest) as any;
        expect(result.series[0].data).toEqual([100, 200]);
        expect(result.series[1].data).toEqual([5, 10]);
    });

    it("adds missing series when LLM creates fewer than manifest", () => {
        const multiManifest = makeManifest(
            ["A", "B"],
            [
                { label: "Receita - ", data: [100, 200] },
                { label: "Custo - ", data: [50, 80] },
            ]
        );

        const config = {
            xAxis: { type: "category", data: ["fake"] },
            series: [{ name: "Total", type: "line", data: [0] }],
        };

        const result = hydrateChartConfig(config, multiManifest) as any;
        expect(result.series).toHaveLength(2);
        expect(result.series[1].name).toBe("Custo - ");
        expect(result.series[1].data).toEqual([50, 80]);
        expect(result.series[1].type).toBe("line");
    });

    it("truncates extra series when LLM creates more than manifest", () => {
        const singleManifest = makeManifest(
            ["A", "B"],
            [{ label: "Total - ", data: [100, 200] }]
        );

        const config = {
            xAxis: { type: "category", data: ["fake"] },
            series: [
                { name: "Total", data: [0] },
                { name: "Extra", data: [0] },
            ],
        };

        const result = hydrateChartConfig(config, singleManifest) as any;
        expect(result.series).toHaveLength(1);
        expect(result.series[0].name).toBe("Total - ");
    });

    it("handles series with unique IDs for ECharts transitions", () => {
        const multiManifest = makeManifest(
            ["A"],
            [
                { label: "Serie 1", data: [10] },
                { label: "Serie 2", data: [20] },
            ]
        );

        const config = {
            xAxis: { type: "category", data: ["fake"] },
            series: [
                { name: "S1", data: [0] },
                { name: "S2", data: [0] },
            ],
        };

        const result = hydrateChartConfig(config, multiManifest) as any;
        expect(result.series[0].id).toBe("series-0");
        expect(result.series[1].id).toBe("series-1");
    });
});

describe("buildChartDataManifest", () => {
    it("builds manifest from PivotGridResponse and LLMQuery", () => {
        const cols = [
            makeCol("vendas.empresa", 17),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
        ];
        const data = makeData(cols, [
            ["Empresa A", "1000"],
            ["Empresa B", "2000"],
        ]);

        const query: LLMQuery = {
            calculatedFields: [],
            categoryDimensions: [{ completeName: "vendas.empresa", title: "Empresa" }],
            measures: [{ completeName: "vendas.total", aggregateFunction: "SUM", title: "Total" }],
            filters: { completeName: "", filters: [], join: 0 as any, not: false, operator: 0 as any, values: [] },
            havingFilters: { completeName: "", filters: [], join: 0 as any, aggregateFunction: "NONE", not: false, operator: 0 as any, values: [] },
        };

        const manifest = buildChartDataManifest(data, query);
        expect(manifest.labels).toEqual(["Empresa A", "Empresa B"]);
        expect(manifest.datasets).toHaveLength(1);
        expect(manifest.datasets[0]!.label).toBe("Total - ");
        expect(manifest.datasets[0]!.data).toEqual([1000, 2000]);
    });

    it("handles multiple measures with series dimensions", () => {
        const cols = [
            makeCol("vendas.empresa", 17),
            makeCol("vendas.ano", 16),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
        ];
        const data = makeData(cols, [
            ["Empresa A", "2024", "100"],
            ["Empresa A", "2025", "150"],
            ["Empresa B", "2024", "200"],
            ["Empresa B", "2025", "250"],
        ]);

        const query: LLMQuery = {
            calculatedFields: [],
            categoryDimensions: [{ completeName: "vendas.empresa", title: "Empresa" }],
            seriesDimensions: [{ completeName: "vendas.ano", title: "Ano" }],
            measures: [{ completeName: "vendas.total", aggregateFunction: "SUM", title: "Total" }],
            filters: { completeName: "", filters: [], join: 0 as any, not: false, operator: 0 as any, values: [] },
            havingFilters: { completeName: "", filters: [], join: 0 as any, aggregateFunction: "NONE", not: false, operator: 0 as any, values: [] },
        };

        const manifest = buildChartDataManifest(data, query);
        expect(manifest.labels).toEqual(["Empresa A", "Empresa B"]);
        expect(manifest.datasets).toHaveLength(2);
        // transformToChartData sorts series alphabetically
        expect(manifest.datasets[0]!.label).toBe("Total - 2024");
        expect(manifest.datasets[0]!.data).toEqual([100, 200]);
        expect(manifest.datasets[1]!.label).toBe("Total - 2025");
        expect(manifest.datasets[1]!.data).toEqual([150, 250]);
    });
});

describe("buildDeveloperMessage", () => {
    it("returns generic message when no manifest", () => {
        const msg = buildDeveloperMessage();
        expect(msg).toContain("extract_data tool was called");
        expect(msg).not.toContain("CRITICAL");
    });

    it("includes structural requirements when manifest is provided", () => {
        const manifest = makeManifest(
            ["Empresa A", "Empresa B"],
            [
                { label: "Total", data: [100, 200] },
                { label: "Qtd", data: [5, 10] },
            ]
        );

        const msg = buildDeveloperMessage(manifest);
        expect(msg).toContain("CRITICAL STRUCTURAL REQUIREMENTS");
        expect(msg).toContain("exactly 2 series objects");
        expect(msg).toContain("exactly 2 elements");
        expect(msg).toContain('[0] "Total"');
        expect(msg).toContain('[1] "Qtd"');
        expect(msg).toContain("Empresa A");
        expect(msg).not.toContain("completeName");
        expect(msg).toContain("Do NOT set");
    });

    it("truncates long label lists with total count", () => {
        const labels = Array.from({ length: 25 }, (_, i) => `Label ${i}`);
        const manifest = makeManifest(labels, [{ label: "M1", data: new Array(25).fill(0) }]);

        const msg = buildDeveloperMessage(manifest);
        expect(msg).toContain("25 total");
    });
});
