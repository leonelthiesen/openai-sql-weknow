import { describe, expect, it } from "vitest";
import { toEChartsDataset, classify, pickPivotAxes, SECTION } from "./to-echarts-dataset";
import type { PivotGridColumn } from "../types/pivot-grid-response.types";

function makeCol(
    overrides: Partial<PivotGridColumn> & { completeName: string },
): PivotGridColumn {
    return {
        dataType: 1,
        section: SECTION.DIMENSION,
        header: { caption: overrides.completeName },
        expanded: false,
        wordWrap: false,
        visible: true,
        ...overrides,
    };
}

describe("classify", () => {
    it("classifies columns by section", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION }),
            makeCol({ completeName: "product", section: SECTION.SERIES }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, dataType: 7 }),
        ];
        const result = classify(cols);
        expect(result.categoryDims).toHaveLength(1);
        expect(result.categoryDims[0]!.col.completeName).toBe("month");
        expect(result.seriesDims).toHaveLength(1);
        expect(result.seriesDims[0]!.col.completeName).toBe("product");
        expect(result.measures).toHaveLength(1);
        expect(result.measures[0]!.col.completeName).toBe("revenue");
    });

    it("filters out invisible columns", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION }),
            makeCol({ completeName: "hidden", section: SECTION.DIMENSION, visible: false }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE }),
        ];
        const result = classify(cols);
        expect(result.categoryDims).toHaveLength(1);
    });

    it("filters out columns without completeName", () => {
        const cols = [
            makeCol({ completeName: "", section: SECTION.DIMENSION }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE }),
        ];
        const result = classify(cols);
        expect(result.categoryDims).toHaveLength(0);
    });
});

describe("pickPivotAxes", () => {
    it("uses axisDim hint when provided", () => {
        const cols = [
            makeCol({ completeName: "state", section: SECTION.DIMENSION }),
            makeCol({ completeName: "yearMonth", section: SECTION.DIMENSION }),
        ];
        const classified = classify(cols);
        const dims = [...classified.categoryDims, ...classified.seriesDims];
        const rows = [["MG", 202101], ["PR", 202102]];

        const result = pickPivotAxes(dims, rows, { axisDim: "state" });
        expect(result.axis.col.completeName).toBe("state");
        expect(result.series.col.completeName).toBe("yearMonth");
    });

    it("picks temporal dim as axis when no hint", () => {
        const cols = [
            makeCol({ completeName: "state", section: SECTION.DIMENSION }),
            makeCol({ completeName: "yearMonth", section: SECTION.DIMENSION }),
        ];
        const classified = classify(cols);
        const dims = [...classified.categoryDims, ...classified.seriesDims];
        const rows = [["MG", 202101], ["PR", 202102]];

        const result = pickPivotAxes(dims, rows);
        expect(result.axis.col.completeName).toBe("yearMonth");
        expect(result.series.col.completeName).toBe("state");
    });

    it("picks higher cardinality as axis when no temporal", () => {
        const cols = [
            makeCol({ completeName: "product", section: SECTION.DIMENSION }),
            makeCol({ completeName: "category", section: SECTION.DIMENSION }),
        ];
        const classified = classify(cols);
        const dims = [...classified.categoryDims, ...classified.seriesDims];
        // product has 4 unique values, category has 2
        const rows = [
            ["A", "X"], ["B", "X"], ["C", "Y"], ["D", "Y"],
        ];

        const result = pickPivotAxes(dims, rows);
        expect(result.axis.col.completeName).toBe("product");
        expect(result.series.col.completeName).toBe("category");
    });
});

describe("toEChartsDataset", () => {
    // ── KPI ──────────────────────────────────────────────────────────────────

    it("KPI: 0 dims + 1 measure", () => {
        const cols = [
            makeCol({ completeName: "total", section: SECTION.MEASURE, dataType: 7, header: { caption: "Total" } }),
        ];
        const rows = [[42]];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("kpi");
        expect(result.dataset.source).toEqual([["Total"], [42]]);
        expect(result.measures).toHaveLength(1);
    });

    it("KPI: 0 dims + N measures", () => {
        const cols = [
            makeCol({ completeName: "total", section: SECTION.MEASURE, header: { caption: "Total" } }),
            makeCol({ completeName: "count", section: SECTION.MEASURE, header: { caption: "Qtd" } }),
        ];
        const rows = [[100, 5]];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("kpi");
        expect(result.dataset.source).toEqual([["Total", "Qtd"], [100, 5]]);
    });

    // ── Simple ───────────────────────────────────────────────────────────────

    it("Simple: 1 dim + 1 measure", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [["Jan", 100], ["Feb", 200]];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("simple");
        expect(result.axisDim!.col.completeName).toBe("month");
        expect(result.dataset.source).toEqual([
            ["Mês", "Receita"],
            ["Jan", 100],
            ["Feb", 200],
        ]);
    });

    it("Simple: 1 dim + N measures", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
            makeCol({ completeName: "quantity", section: SECTION.MEASURE, header: { caption: "Qtd" } }),
        ];
        const rows = [["Jan", 100, 10], ["Feb", 200, 20]];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("simple");
        expect(result.dataset.source).toEqual([
            ["Mês", "Receita", "Qtd"],
            ["Jan", 100, 10],
            ["Feb", 200, 20],
        ]);
        expect(result.measures).toHaveLength(2);
    });

    // ── Pivot: 2 dims + 1 measure ────────────────────────────────────────────

    it("Pivot: 2 cat dims + 1 measure, temporal detected", () => {
        const cols = [
            makeCol({ completeName: "state", section: SECTION.DIMENSION, header: { caption: "Estado" } }),
            makeCol({ completeName: "yearMonth", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [
            ["MG", 202101, 1],
            ["PR", 202101, 1],
            ["GO", 202102, 1],
            ["PE", 202102, 1],
            ["RS", 202102, 2],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        expect(result.axisDim!.col.completeName).toBe("yearMonth");
        expect(result.seriesDim!.col.completeName).toBe("state");
        expect(result.seriesValues).toEqual(["MG", "PR", "GO", "PE", "RS"]);

        // Header: [Mês, MG, PR, GO, PE, RS]
        expect(result.dataset.source[0]).toEqual(["Mês", "MG", "PR", "GO", "PE", "RS"]);
        // Row for 202101: [202101, 1, 1, 0, 0, 0]
        expect(result.dataset.source[1]).toEqual([202101, 1, 1, 0, 0, 0]);
        // Row for 202102: [202102, 0, 0, 1, 1, 2]
        expect(result.dataset.source[2]).toEqual([202102, 0, 0, 1, 1, 2]);
    });

    it("Pivot: axisDim override", () => {
        const cols = [
            makeCol({ completeName: "state", section: SECTION.DIMENSION, header: { caption: "Estado" } }),
            makeCol({ completeName: "yearMonth", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [
            ["MG", 202101, 1],
            ["MG", 202102, 2],
        ];

        // Override: use state as axis instead of temporal yearMonth
        const result = toEChartsDataset(cols, rows, { axisDim: "state" });

        expect(result.axisDim!.col.completeName).toBe("state");
        expect(result.seriesDim!.col.completeName).toBe("yearMonth");
    });

    // ── Pivot: 2 dims + N measures ───────────────────────────────────────────

    it("Pivot: 2 dims + 2 measures → suffixed columns", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "product", section: SECTION.DIMENSION, header: { caption: "Produto" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
            makeCol({ completeName: "quantity", section: SECTION.MEASURE, header: { caption: "Qtd" } }),
        ];
        const rows = [
            ["Jan", "A", 100, 10],
            ["Jan", "B", 200, 20],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        // seriesValues should be: A · Receita, A · Qtd, B · Receita, B · Qtd
        expect(result.seriesValues).toEqual([
            "A · Receita", "A · Qtd", "B · Receita", "B · Qtd",
        ]);
        expect(result.dataset.source[0]).toEqual([
            "Mês", "A · Receita", "A · Qtd", "B · Receita", "B · Qtd",
        ]);
        expect(result.dataset.source[1]).toEqual(["Jan", 100, 10, 200, 20]);
    });

    // ── Section 16 (series dim) ──────────────────────────────────────────────

    it("Section-16 columns are treated as dims for pivot", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "product", section: SECTION.SERIES, header: { caption: "Produto" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [
            ["Jan", "A", 100],
            ["Jan", "B", 200],
            ["Feb", "A", 150],
            ["Feb", "B", 250],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        expect(result.seriesValues).toEqual(["A", "B"]);
        expect(result.dataset.source).toEqual([
            ["Mês", "A", "B"],
            ["Jan", 100, 200],
            ["Feb", 150, 250],
        ]);
    });

    // ── 3+ dims → compound axis key ─────────────────────────────────────────

    it("3 dims → compound axis key", () => {
        const cols = [
            makeCol({ completeName: "year", section: SECTION.DIMENSION, header: { caption: "Ano" } }),
            makeCol({ completeName: "state", section: SECTION.DIMENSION, header: { caption: "Estado" } }),
            makeCol({ completeName: "product", section: SECTION.DIMENSION, header: { caption: "Produto" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        // year has higher cardinality (4 unique), state has 2 unique, product has 2 unique
        const rows = [
            [2021, "MG", "A", 100],
            [2022, "MG", "A", 200],
            [2023, "PR", "B", 300],
            [2024, "PR", "B", 400],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        // year (4 unique) → axis, state (2 unique) → series, product in extras → compound axis
        expect(result.compoundAxisDims).toBeDefined();
    });

    // ── Null/empty series values → "(vazio)" ─────────────────────────────────

    it("null series values become (vazio)", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "product", section: SECTION.DIMENSION, header: { caption: "Produto" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [
            ["Jan", null, 100],
            ["Jan", "A", 200],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        expect(result.seriesValues).toContain("(vazio)");
    });

    // ── Sparse data → null cells ─────────────────────────────────────────────

    it("sparse data fills missing cells with 0", () => {
        const cols = [
            makeCol({ completeName: "month", section: SECTION.DIMENSION, header: { caption: "Mês" } }),
            makeCol({ completeName: "product", section: SECTION.DIMENSION, header: { caption: "Produto" } }),
            makeCol({ completeName: "revenue", section: SECTION.MEASURE, header: { caption: "Receita" } }),
        ];
        const rows = [
            ["Jan", "A", 100],
            ["Feb", "B", 200],
        ];

        const result = toEChartsDataset(cols, rows);

        expect(result.layout).toBe("pivot");
        // Jan has A but not B, Feb has B but not A
        expect(result.dataset.source[1]).toEqual(["Jan", 100, 0]);
        expect(result.dataset.source[2]).toEqual(["Feb", 0, 200]);
    });
});
