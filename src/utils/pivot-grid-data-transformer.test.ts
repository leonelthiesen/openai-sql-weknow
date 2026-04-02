import { describe, it, expect } from "vitest";
import { transformToChartData } from "./pivot-grid-data-transformer";
import type { PivotGridResponse, PivotGridColumn } from "../types/pivot-grid-response.types";
import type { LLMQuery, LLMDimension, LLMMeasure } from "../models/llm-structured-output.models";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCol(overrides: Partial<PivotGridColumn> & { completeName: string }): PivotGridColumn {
    return {
        dataType: 0,
        section: 17,
        header: { caption: overrides.completeName },
        expanded: false,
        wordWrap: false,
        visible: true,
        ...overrides,
    };
}

function makeResponse(rows: Record<string, string>[], cols: PivotGridColumn[]): PivotGridResponse {
    return {
        rows: rows as any,
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

function makeDimension(completeName: string, title?: string): LLMDimension {
    return { completeName, title: title ?? completeName };
}

function makeMeasure(completeName: string, title?: string): LLMMeasure {
    return { completeName, aggregateFunction: "SUM", title: title ?? completeName };
}

function makeQuery(overrides: Partial<LLMQuery> & Pick<LLMQuery, "categoryDimensions" | "measures">): LLMQuery {
    return {
        calculatedFields: [],
        filters: {} as any,
        havingFilters: {} as any,
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("transformToChartData", () => {

    // ── column-to-key mapping ────────────────────────────────────────────

    describe("column-to-key mapping", () => {
        it("maps column completeName to d1, d2, ... (1-indexed)", () => {
            const cols = [
                makeCol({ completeName: "campo.a" }),
                makeCol({ completeName: "campo.b" }),
                makeCol({ completeName: "campo.c" }),
            ];
            const rows = [{ d1: "Cat1", d2: "10", d3: "20" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("campo.a")],
                measures: [makeMeasure("campo.b", "B"), makeMeasure("campo.c", "C")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["Cat1"]);
            expect(result.datasets).toHaveLength(2);
            expect(result.datasets[0].data).toEqual([10]);
            expect(result.datasets[1].data).toEqual([20]);
        });
    });

    // ── basic transformation ─────────────────────────────────────────────

    describe("basic transformation", () => {
        it("returns labels and one dataset for a simple query", () => {
            const cols = [
                makeCol({ completeName: "produto.nome" }),
                makeCol({ completeName: "vendas.total" }),
            ];
            const rows = [
                { d1: "Produto A", d2: "100" },
                { d1: "Produto B", d2: "200" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("produto.nome")],
                measures: [makeMeasure("vendas.total", "Total")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["Produto A", "Produto B"]);
            expect(result.datasets).toHaveLength(1);
            expect(result.datasets[0].label).toBe("Total");
            expect(result.datasets[0].data).toEqual([100, 200]);
        });

        it("returns empty labels and datasets for empty rows", () => {
            const cols = [
                makeCol({ completeName: "produto.nome" }),
                makeCol({ completeName: "vendas.total" }),
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("produto.nome")],
                measures: [makeMeasure("vendas.total")],
            });

            const result = transformToChartData(makeResponse([], cols), query);

            expect(result.labels).toEqual([]);
            expect(result.datasets).toEqual([]);
        });

        it("preserves labels order from query result rows", () => {
            const cols = [
                makeCol({ completeName: "animal.nome" }),
                makeCol({ completeName: "animal.peso" }),
            ];
            const rows = [
                { d1: "Zebra", d2: "300" },
                { d1: "Apple", d2: "100" },
                { d1: "Mango", d2: "200" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("animal.nome")],
                measures: [makeMeasure("animal.peso", "Peso")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["Zebra", "Apple", "Mango"]);
            expect(result.datasets[0].data).toEqual([300, 100, 200]);
        });
    });

    // ── multiple category dimensions ─────────────────────────────────────

    describe("multiple category dimensions", () => {
        it("concatenates multiple category values with ' | ' separator", () => {
            const cols = [
                makeCol({ completeName: "regiao.nome" }),
                makeCol({ completeName: "cidade.nome" }),
                makeCol({ completeName: "vendas.total" }),
            ];
            const rows = [
                { d1: "Norte", d2: "Oslo", d3: "50" },
                { d1: "Sul", d2: "Roma", d3: "80" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("regiao.nome"), makeDimension("cidade.nome")],
                measures: [makeMeasure("vendas.total", "Total")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["Norte | Oslo", "Sul | Roma"]);
            expect(result.datasets[0].data).toEqual([50, 80]);
        });

        it("falls back to empty string for undefined category value", () => {
            const cols = [
                makeCol({ completeName: "regiao.nome" }),
                makeCol({ completeName: "cidade.nome" }),
                makeCol({ completeName: "vendas.total" }),
            ];
            // d1 is missing in this row
            const rows = [{ d2: "Oslo", d3: "50" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("regiao.nome"), makeDimension("cidade.nome")],
                measures: [makeMeasure("vendas.total", "Total")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual([" | Oslo"]);
        });
    });

    // ── series dimensions ────────────────────────────────────────────────

    describe("series dimensions", () => {
        it("creates separate datasets per series value", () => {
            const cols = [
                makeCol({ completeName: "produto.nome" }),
                makeCol({ completeName: "periodo.ano" }),
                makeCol({ completeName: "vendas.total" }),
            ];
            const rows = [
                { d1: "A", d2: "2024", d3: "10" },
                { d1: "A", d2: "2025", d3: "20" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("produto.nome")],
                seriesDimensions: [makeDimension("periodo.ano")],
                measures: [makeMeasure("vendas.total", "Total")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["A"]);
            expect(result.datasets).toHaveLength(2);
            expect(result.datasets[0]).toEqual({ label: "Total - 2024", data: [10] });
            expect(result.datasets[1]).toEqual({ label: "Total - 2025", data: [20] });
        });

        it("series datasets are sorted alphabetically", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "ser" }),
                makeCol({ completeName: "val" }),
            ];
            const rows = [
                { d1: "X", d2: "Zebra", d3: "1" },
                { d1: "X", d2: "Alpha", d3: "2" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: [makeDimension("ser")],
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets[0].label).toBe("Val - Alpha");
            expect(result.datasets[1].label).toBe("Val - Zebra");
        });

        it("concatenates multiple series dimensions with ' | '", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "ano" }),
                makeCol({ completeName: "trimestre" }),
                makeCol({ completeName: "val" }),
            ];
            const rows = [{ d1: "X", d2: "2024", d3: "Q1", d4: "100" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: [makeDimension("ano"), makeDimension("trimestre")],
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets[0].label).toBe("Val - 2024 | Q1");
        });

        it("seriesDimensions undefined yields single dataset with measure title only", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const rows = [{ d1: "A", d2: "5" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: undefined,
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets).toHaveLength(1);
            expect(result.datasets[0].label).toBe("Val");
        });

        it("empty seriesDimensions array yields single dataset with measure title only", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const rows = [{ d1: "A", d2: "5" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: [],
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets).toHaveLength(1);
            expect(result.datasets[0].label).toBe("Val");
        });

        it("fills 0 for missing category+series combinations", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "ser" }),
                makeCol({ completeName: "val" }),
            ];
            const rows = [
                { d1: "A", d2: "X", d3: "5" },
                { d1: "B", d2: "Y", d3: "8" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: [makeDimension("ser")],
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["A", "B"]);
            // X series: A=5, B=0 (missing)
            const datasetX = result.datasets.find(d => d.label === "Val - X")!;
            expect(datasetX.data).toEqual([5, 0]);
            // Y series: A=0 (missing), B=8
            const datasetY = result.datasets.find(d => d.label === "Val - Y")!;
            expect(datasetY.data).toEqual([0, 8]);
        });
    });

    // ── multiple measures ────────────────────────────────────────────────

    describe("multiple measures", () => {
        it("creates datasets for each measure (no series)", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "receita" }),
                makeCol({ completeName: "custo" }),
            ];
            const rows = [
                { d1: "A", d2: "100", d3: "40" },
                { d1: "B", d2: "200", d3: "80" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: [makeMeasure("receita", "Receita"), makeMeasure("custo", "Custo")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets).toHaveLength(2);
            expect(result.datasets[0]).toEqual({ label: "Receita", data: [100, 200] });
            expect(result.datasets[1]).toEqual({ label: "Custo", data: [40, 80] });
        });

        it("creates datasets for each measure x series combination", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "ser" }),
                makeCol({ completeName: "m1" }),
                makeCol({ completeName: "m2" }),
            ];
            const rows = [
                { d1: "A", d2: "X", d3: "10", d4: "1" },
                { d1: "A", d2: "Y", d3: "20", d4: "2" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                seriesDimensions: [makeDimension("ser")],
                measures: [makeMeasure("m1", "M1"), makeMeasure("m2", "M2")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            // 2 measures x 2 series = 4 datasets
            expect(result.datasets).toHaveLength(4);
            const labels = result.datasets.map(d => d.label);
            expect(labels).toContain("M1 - X");
            expect(labels).toContain("M1 - Y");
            expect(labels).toContain("M2 - X");
            expect(labels).toContain("M2 - Y");
        });
    });

    // ── aggregation ──────────────────────────────────────────────────────

    describe("aggregation", () => {
        it("sums duplicate category+series combinations", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "val" }),
            ];
            const rows = [
                { d1: "A", d2: "10" },
                { d1: "A", d2: "20" },
                { d1: "A", d2: "5" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: [makeMeasure("val", "Val")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.labels).toEqual(["A"]);
            expect(result.datasets[0].data).toEqual([35]);
        });

        it("aggregates each measure independently", () => {
            const cols = [
                makeCol({ completeName: "cat" }),
                makeCol({ completeName: "m1" }),
                makeCol({ completeName: "m2" }),
            ];
            const rows = [
                { d1: "A", d2: "10", d3: "1" },
                { d1: "A", d2: "20", d3: "2" },
            ];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: [makeMeasure("m1", "M1"), makeMeasure("m2", "M2")],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets.find(d => d.label === "M1")!.data).toEqual([30]);
            expect(result.datasets.find(d => d.label === "M2")!.data).toEqual([3]);
        });
    });

    // ── value parsing ────────────────────────────────────────────────────

    describe("value parsing", () => {
        const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
        const query = makeQuery({
            categoryDimensions: [makeDimension("cat")],
            measures: [makeMeasure("val", "Val")],
        });

        it("parses string values as floats", () => {
            const rows = [{ d1: "A", d2: "123.45" }];
            const result = transformToChartData(makeResponse(rows, cols), query);
            expect(result.datasets[0].data).toEqual([123.45]);
        });

        it("treats undefined value as 0", () => {
            // d2 is missing from the row
            const rows = [{ d1: "A" }];
            const result = transformToChartData(makeResponse(rows, cols), query);
            expect(result.datasets[0].data).toEqual([0]);
        });

        it("treats empty string value as 0", () => {
            const rows = [{ d1: "A", d2: "" }];
            const result = transformToChartData(makeResponse(rows, cols), query);
            expect(result.datasets[0].data).toEqual([0]);
        });

        it("skips NaN values (does not add to aggregation)", () => {
            const rows = [
                { d1: "A", d2: "not-a-number" },
                { d1: "A", d2: "10" },
            ];
            const result = transformToChartData(makeResponse(rows, cols), query);
            // NaN row is skipped, only 10 is summed
            expect(result.datasets[0].data).toEqual([10]);
        });
    });

    // ── error handling ───────────────────────────────────────────────────

    describe("error handling", () => {
        it("throws when measure completeName is not found in columns", () => {
            const cols = [makeCol({ completeName: "cat" })];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: [makeMeasure("unknown.field", "Unknown")],
            });

            expect(() => transformToChartData(makeResponse([], cols), query))
                .toThrow('Measure "unknown.field" not found in columns');
        });

        it("throws when category key is undefined (with at least one row)", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const rows = [{ d1: "A", d2: "10" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("nonexistent.field")],
                measures: [makeMeasure("val")],
            });

            expect(() => transformToChartData(makeResponse(rows, cols), query))
                .toThrow("Category key is undefined for category dimension");
        });

        it("does not throw for undefined category key when rows are empty", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const query = makeQuery({
                categoryDimensions: [makeDimension("nonexistent.field")],
                measures: [makeMeasure("val")],
            });

            const result = transformToChartData(makeResponse([], cols), query);
            expect(result.labels).toEqual([]);
            expect(result.datasets).toEqual([]);
        });
    });

    // ── measures as strings ──────────────────────────────────────────────

    describe("measures as strings", () => {
        it("handles measure as plain string", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const rows = [{ d1: "A", d2: "42" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: ["val" as any],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            expect(result.datasets[0].label).toBe("val");
            expect(result.datasets[0].data).toEqual([42]);
        });

        it("uses measure.title for dataset label, falls back to completeName when title is empty", () => {
            const cols = [makeCol({ completeName: "cat" }), makeCol({ completeName: "val" })];
            const rows = [{ d1: "A", d2: "7" }];
            const query = makeQuery({
                categoryDimensions: [makeDimension("cat")],
                measures: [{ completeName: "val", aggregateFunction: "SUM", title: "" }],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            // title is empty string -> falsy -> falls back to completeName
            expect(result.datasets[0].label).toBe("val");
        });
    });

    // ── integration / realistic scenario ─────────────────────────────────

    describe("integration", () => {
        it("handles a realistic multi-dimension, multi-measure, multi-series scenario", () => {
            const cols = [
                makeCol({ completeName: "regiao.nome" }),     // d1
                makeCol({ completeName: "produto.tipo" }),    // d2
                makeCol({ completeName: "periodo.ano" }),     // d3
                makeCol({ completeName: "canal.nome" }),      // d4
                makeCol({ completeName: "vendas.receita" }),  // d5
                makeCol({ completeName: "vendas.custo" }),    // d6
            ];
            const rows = [
                { d1: "Norte", d2: "Eletronico", d3: "2024", d4: "Online",  d5: "100", d6: "40" },
                { d1: "Norte", d2: "Eletronico", d3: "2024", d4: "Loja",    d5: "50",  d6: "20" },
                { d1: "Norte", d2: "Eletronico", d3: "2025", d4: "Online",  d5: "120", d6: "45" },
                { d1: "Sul",   d2: "Roupa",      d3: "2024", d4: "Online",  d5: "80",  d6: "30" },
                { d1: "Sul",   d2: "Roupa",      d3: "2024", d4: "Online",  d5: "20",  d6: "10" }, // duplicate -> aggregates
                { d1: "Sul",   d2: "Roupa",      d3: "2025", d4: "Loja",    d5: "90",  d6: "35" },
            ];
            const query = makeQuery({
                categoryDimensions: [
                    makeDimension("regiao.nome", "Regiao"),
                    makeDimension("produto.tipo", "Produto"),
                ],
                seriesDimensions: [
                    makeDimension("periodo.ano", "Ano"),
                    makeDimension("canal.nome", "Canal"),
                ],
                measures: [
                    makeMeasure("vendas.receita", "Receita"),
                    makeMeasure("vendas.custo", "Custo"),
                ],
            });

            const result = transformToChartData(makeResponse(rows, cols), query);

            // Categories: "Norte | Eletronico", "Sul | Roupa" (sorted)
            expect(result.labels).toEqual(["Norte | Eletronico", "Sul | Roupa"]);

            // Series combos: "2024 | Loja", "2024 | Online", "2025 | Loja", "2025 | Online"
            // 2 measures x 4 series = 8 datasets
            expect(result.datasets).toHaveLength(8);

            // Verify specific aggregated values
            const receitaOnline2024 = result.datasets.find(d => d.label === "Receita - 2024 | Online")!;
            // Norte|Eletronico: 100, Sul|Roupa: 80+20=100
            expect(receitaOnline2024.data).toEqual([100, 100]);

            const receitaLoja2024 = result.datasets.find(d => d.label === "Receita - 2024 | Loja")!;
            // Norte|Eletronico: 50, Sul|Roupa: 0 (no row)
            expect(receitaLoja2024.data).toEqual([50, 0]);

            const custoOnline2025 = result.datasets.find(d => d.label === "Custo - 2025 | Online")!;
            // Norte|Eletronico: 45, Sul|Roupa: 0
            expect(custoOnline2025.data).toEqual([45, 0]);

            const custoLoja2025 = result.datasets.find(d => d.label === "Custo - 2025 | Loja")!;
            // Norte|Eletronico: 0, Sul|Roupa: 35
            expect(custoLoja2025.data).toEqual([0, 35]);
        });
    });
});
