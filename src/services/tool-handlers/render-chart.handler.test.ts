import { describe, it, expect } from "vitest";
import { hydrateChartConfig, buildDeveloperMessage } from "./render-chart.handler";
import { TFieldType } from "../../models/TFieldType";
import type { PivotGridResponse, PivotGridColumn } from "../../types/pivot-grid-response.types";

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
        values.forEach((v, i) => { row[`d${i}`] = v; });
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

describe("hydrateChartConfig", () => {
    const cols = [
        makeCol("vendas.empresa", 17),           // d0 - category
        makeCol("vendas.total", 15, TFieldType.ftFloat), // d1 - measure
    ];
    const data = makeData(cols, [
        ["Empresa A", "1000.50"],
        ["Empresa B", "2000.75"],
        ["Empresa C", "3000.00"],
    ]);

    it("replaces xAxis.data with real category values", () => {
        const config = {
            xAxis: { data: ["fake1", "fake2", "fake3"] },
            series: [{ id: "vendas.total", data: [1, 2, 3] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.xAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("replaces series.data with real numeric values", () => {
        const config = {
            xAxis: { data: ["fake1", "fake2", "fake3"] },
            series: [{ id: "vendas.total", data: [1, 2, 3] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.series[0].data).toEqual([1000.50, 2000.75, 3000.00]);
    });

    it("handles array-style xAxis", () => {
        const config = {
            xAxis: [{ data: ["fake1", "fake2"] }],
            series: [{ id: "vendas.total", data: [1, 2] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.xAxis[0].data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("handles yAxis replacement for horizontal charts", () => {
        const config = {
            yAxis: { data: ["fake1", "fake2"] },
            xAxis: { type: "value" },
            series: [{ id: "vendas.total", data: [1, 2] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.yAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("replaces xAxis.data using id when it matches a category column", () => {
        const config = {
            xAxis: { id: "vendas.empresa", data: ["fake1", "fake2"] },
            series: [{ id: "vendas.total", data: [1, 2] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.xAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("replaces yAxis.data using id for horizontal charts", () => {
        const config = {
            yAxis: { id: "vendas.empresa", data: ["fake1"] },
            xAxis: { type: "value" },
            series: [{ id: "vendas.total", data: [1] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.yAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("matches each axis to the correct category column by id", () => {
        const twoCatCols = [
            makeCol("vendas.regiao", 17),
            makeCol("vendas.empresa", 17),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
        ];
        const twoCatData = makeData(twoCatCols, [
            ["Sul", "Empresa A", "100"],
            ["Norte", "Empresa B", "200"],
        ]);

        const config = {
            xAxis: { id: "vendas.empresa", data: ["fake"] },
            yAxis: { id: "vendas.regiao", data: ["fake"] },
            series: [{ id: "vendas.total", data: [1] }],
        };

        const result = hydrateChartConfig(config, twoCatData) as any;
        expect(result.xAxis.data).toEqual(["Empresa A", "Empresa B"]);
        expect(result.yAxis.data).toEqual(["Sul", "Norte"]);
    });

    it("falls back to primary category when axis has no id", () => {
        const config = {
            xAxis: { data: ["fake1"] },
            series: [{ id: "vendas.total", data: [1] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.xAxis.data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("handles array-style axis with id", () => {
        const config = {
            xAxis: [{ id: "vendas.empresa", data: ["fake"] }],
            series: [{ id: "vendas.total", data: [1] }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.xAxis[0].data).toEqual(["Empresa A", "Empresa B", "Empresa C"]);
    });

    it("leaves series without matching id untouched", () => {
        const config = {
            xAxis: { data: ["fake1"] },
            series: [
                { id: "vendas.total", data: [1] },
                { id: "unknown.field", data: [99] },
                { name: "no-id-series", data: [42] },
            ],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.series[1].data).toEqual([99]);
        expect(result.series[2].data).toEqual([42]);
    });

    it("returns config as-is when rows are empty", () => {
        const emptyData = makeData(cols, []);
        const config = { xAxis: { data: ["a"] }, series: [{ id: "vendas.total", data: [1] }] };

        const result = hydrateChartConfig(config, emptyData);
        expect(result).toEqual(config);
    });

    it("does not mutate the original config", () => {
        const config = {
            xAxis: { data: ["fake1"] },
            series: [{ id: "vendas.total", data: [1] }],
        };
        const original = JSON.parse(JSON.stringify(config));

        hydrateChartConfig(config, data);
        expect(config).toEqual(original);
    });

    it("handles dataset.source pattern", () => {
        const config = {
            dataset: { source: [["Empresa", "Total"], ["fake", 1]] },
            series: [{ type: "bar" }],
        };

        const result = hydrateChartConfig(config, data) as any;
        expect(result.dataset.source[0]).toEqual(["vendas.empresa", "vendas.total"]);
        expect(result.dataset.source[1]).toEqual(["Empresa A", 1000.50]);
        expect(result.dataset.source).toHaveLength(4); // header + 3 rows
    });

    it("handles multiple measure series", () => {
        const multiCols = [
            makeCol("vendas.empresa", 17),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
            makeCol("vendas.qtd", 15, TFieldType.ftInteger),
        ];
        const multiData = makeData(multiCols, [
            ["A", "100", "5"],
            ["B", "200", "10"],
        ]);

        const config = {
            xAxis: { data: ["fake"] },
            series: [
                { id: "vendas.total", data: [1] },
                { id: "vendas.qtd", data: [1] },
            ],
        };

        const result = hydrateChartConfig(config, multiData) as any;
        expect(result.series[0].data).toEqual([100, 200]);
        expect(result.series[1].data).toEqual([5, 10]);
    });

    describe("fallback heuristic", () => {
        const multiCols = [
            makeCol("vendas.empresa", 17),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
            makeCol("vendas.qtd", 15, TFieldType.ftInteger),
        ];
        const multiData = makeData(multiCols, [
            ["A", "100", "5"],
            ["B", "200", "10"],
        ]);

        it("assigns series without id positionally when counts match", () => {
            const config = {
                xAxis: { data: ["fake"] },
                series: [
                    { name: "Total", type: "bar", data: [1] },
                    { name: "Qtd", type: "bar", data: [1] },
                ],
            };

            const result = hydrateChartConfig(config, multiData) as any;
            expect(result.series[0].id).toBe("vendas.total");
            expect(result.series[0].data).toEqual([100, 200]);
            expect(result.series[1].id).toBe("vendas.qtd");
            expect(result.series[1].data).toEqual([5, 10]);
        });

        it("matches series by name when counts differ", () => {
            const config = {
                xAxis: { data: ["fake"] },
                series: [
                    { name: "vendas.total", type: "bar", data: [1] },
                ],
            };

            const result = hydrateChartConfig(config, multiData) as any;
            expect(result.series[0].id).toBe("vendas.total");
            expect(result.series[0].data).toEqual([100, 200]);
        });

        it("does not affect series with valid id", () => {
            const config = {
                xAxis: { data: ["fake"] },
                series: [
                    { id: "vendas.total", data: [1] },
                    { name: "Qtd", type: "bar", data: [1] },
                ],
            };

            const result = hydrateChartConfig(config, multiData) as any;
            // id-matched series hydrated normally
            expect(result.series[0].data).toEqual([100, 200]);
            // single unmatched series, single unmatched measure → positional
            expect(result.series[1].id).toBe("vendas.qtd");
            expect(result.series[1].data).toEqual([5, 10]);
        });

        it("leaves unmatched series untouched when no name match and counts differ", () => {
            const config = {
                xAxis: { data: ["fake"] },
                series: [
                    { name: "Something Else", type: "bar", data: [42] },
                ],
            };

            // 1 unmatched series vs 2 unmatched measures → counts differ, no name match
            const result = hydrateChartConfig(config, multiData) as any;
            expect(result.series[0].data).toEqual([42]);
            expect(result.series[0].id).toBeUndefined();
        });
    });
});

describe("buildDeveloperMessage", () => {
    it("returns generic message when no executionData", () => {
        const msg = buildDeveloperMessage();
        expect(msg).toContain("extract_data tool was called");
        expect(msg).not.toContain("CRITICAL");
    });

    it("includes column info and examples for both axes and series", () => {
        const cols = [
            makeCol("vendas.empresa", 17),
            makeCol("vendas.total", 15, TFieldType.ftFloat),
        ];
        const data = makeData(cols, [["A", "100"]]);

        const msg = buildDeveloperMessage(data);
        expect(msg).toContain("CRITICAL");
        expect(msg).toContain("vendas.empresa");
        expect(msg).toContain("vendas.total");
        expect(msg).toContain('"id": "vendas.total"');
        expect(msg).toContain('"id": "vendas.empresa"');
        expect(msg).toContain("Example axis structure");
        expect(msg).toContain("Example series structure");
    });
});
