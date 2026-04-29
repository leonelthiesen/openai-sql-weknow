import { describe, expect, it } from "vitest";
import { pivotSeriesColumns } from "./pivot-series-columns";
import type { PivotGridColumn } from "../types/pivot-grid-response.types";

function makeCol(
    overrides: Partial<PivotGridColumn> & { completeName: string },
): PivotGridColumn {
    return {
        dataType: 1,
        section: 17,
        header: { caption: overrides.completeName },
        expanded: false,
        wordWrap: false,
        visible: true,
        ...overrides,
    };
}

describe("pivotSeriesColumns", () => {
    it("returns unchanged when no section-16 cols exist", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [["Jan", 100], ["Feb", 200]];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toBe(cols);
        expect(result.rows).toBe(rows);
        expect(result.pivotMetadata).toEqual({
            wasPivoted: false,
            seriesDimensionNames: [],
            measureNames: [],
            pivotedColumnNames: [],
        });
    });

    it("pivots single series + single measure", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", "A", 100],
            ["Jan", "B", 200],
            ["Feb", "A", 150],
            ["Feb", "B", 250],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(3);
        expect(result.cols[0]!.completeName).toBe("month");
        expect(result.cols[0]!.section).toBe(17);
        expect(result.cols[1]!.completeName).toBe("A");
        expect(result.cols[1]!.section).toBe(15);
        expect(result.cols[1]!.dataType).toBe(7);
        expect(result.cols[2]!.completeName).toBe("B");
        expect(result.cols[2]!.section).toBe(15);

        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toEqual(["Jan", 100, 200]);
        expect(result.rows[1]).toEqual(["Feb", 150, 250]);

        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product"],
            measureNames: ["revenue"],
            pivotedColumnNames: ["A", "B"],
        });
    });

    it("pivots single series + multiple measures", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7, header: { caption: "Revenue" } }),
            makeCol({ completeName: "quantity", section: 15, dataType: 3, header: { caption: "Quantity" } }),
        ];
        const rows = [
            ["Jan", "A", 100, 10],
            ["Jan", "B", 200, 20],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(5);
        expect(result.cols[0]!.completeName).toBe("month");
        expect(result.cols[1]!.completeName).toBe("A - Revenue");
        expect(result.cols[1]!.dataType).toBe(7);
        expect(result.cols[2]!.completeName).toBe("A - Quantity");
        expect(result.cols[2]!.dataType).toBe(3);
        expect(result.cols[3]!.completeName).toBe("B - Revenue");
        expect(result.cols[4]!.completeName).toBe("B - Quantity");

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual(["Jan", 100, 10, 200, 20]);

        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product"],
            measureNames: ["revenue", "quantity"],
            pivotedColumnNames: ["A - Revenue", "A - Quantity", "B - Revenue", "B - Quantity"],
        });
    });

    it("pivots multiple series dimensions", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "region", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", "A", "North", 100],
            ["Jan", "A", "South", 200],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(3);
        expect(result.cols[0]!.completeName).toBe("month");
        expect(result.cols[1]!.completeName).toBe("A / North");
        expect(result.cols[2]!.completeName).toBe("A / South");

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual(["Jan", 100, 200]);

        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product", "region"],
            measureNames: ["revenue"],
            pivotedColumnNames: ["A / North", "A / South"],
        });
    });

    it("pivots multiple series + multiple measures", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "region", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7, header: { caption: "Revenue" } }),
            makeCol({ completeName: "quantity", section: 15, dataType: 3, header: { caption: "Quantity" } }),
        ];
        const rows = [
            ["Jan", "A", "North", 100, 10],
            ["Jan", "B", "South", 200, 20],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(5);
        expect(result.cols[1]!.completeName).toBe("A / North - Revenue");
        expect(result.cols[2]!.completeName).toBe("A / North - Quantity");
        expect(result.cols[3]!.completeName).toBe("B / South - Revenue");
        expect(result.cols[4]!.completeName).toBe("B / South - Quantity");

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual(["Jan", 100, 10, 200, 20]);

        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product", "region"],
            measureNames: ["revenue", "quantity"],
            pivotedColumnNames: ["A / North - Revenue", "A / North - Quantity", "B / South - Revenue", "B / South - Quantity"],
        });
    });

    it("handles no category dimensions (collapses to 1 row)", () => {
        const cols = [
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["A", 100],
            ["B", 200],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(2);
        expect(result.cols[0]!.completeName).toBe("A");
        expect(result.cols[1]!.completeName).toBe("B");

        expect(result.rows).toHaveLength(1);
        expect(result.rows[0]).toEqual([100, 200]);

        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product"],
            measureNames: ["revenue"],
            pivotedColumnNames: ["A", "B"],
        });
    });

    it("handles sparse data with null for missing combinations", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", "A", 100],
            ["Feb", "B", 250],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(3);
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toEqual(["Jan", 100, null]);
        expect(result.rows[1]).toEqual(["Feb", null, 250]);
        expect(result.pivotMetadata.wasPivoted).toBe(true);
        expect(result.pivotMetadata.pivotedColumnNames).toEqual(["A", "B"]);
    });

    it("returns category cols only when rows are empty", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows: number[][] = [];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols).toHaveLength(1);
        expect(result.cols[0]!.completeName).toBe("month");
        expect(result.rows).toHaveLength(0);
        expect(result.pivotMetadata).toEqual({
            wasPivoted: true,
            seriesDimensionNames: ["product"],
            measureNames: ["revenue"],
            pivotedColumnNames: [],
        });
    });

    it("preserves dataType and formatOptions on pivoted columns", () => {
        const formatOptions = {
            format: 2,
            showThousandSeparator: true,
            thousandSeparator: ".",
            decimalSeparator: ",",
            decimals: 2,
        };
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7, formatOptions }),
        ];
        const rows = [["Jan", "A", 100]];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols[1]!.dataType).toBe(7);
        expect(result.cols[1]!.formatOptions).toEqual(formatOptions);
        expect(result.cols[1]!.formatOptions).not.toBe(formatOptions);
        expect(result.pivotMetadata.wasPivoted).toBe(true);
    });

    it("preserves series value order (first appearance)", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", "C", 300],
            ["Jan", "A", 100],
            ["Jan", "B", 200],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols[1]!.completeName).toBe("C");
        expect(result.cols[2]!.completeName).toBe("A");
        expect(result.cols[3]!.completeName).toBe("B");
        expect(result.pivotMetadata.pivotedColumnNames).toEqual(["C", "A", "B"]);
    });

    it("handles null/empty series values as '(vazio)'", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", null, 100],
            ["Jan", "A", 200],
        ];

        const result = pivotSeriesColumns(cols, rows);

        expect(result.cols[1]!.completeName).toBe("(vazio)");
        expect(result.cols[2]!.completeName).toBe("A");

        expect(result.rows[0]).toEqual(["Jan", 100, 200]);
        expect(result.pivotMetadata.pivotedColumnNames).toEqual(["(vazio)", "A"]);
    });

    it("does not mutate original cols and rows", () => {
        const cols = [
            makeCol({ completeName: "month", section: 17 }),
            makeCol({ completeName: "product", section: 16 }),
            makeCol({ completeName: "revenue", section: 15, dataType: 7 }),
        ];
        const rows = [
            ["Jan", "A", 100],
            ["Feb", "B", 200],
        ];

        const originalCols = [...cols];
        const originalRows = rows.map(r => [...r]);

        pivotSeriesColumns(cols, rows);

        expect(cols).toEqual(originalCols);
        expect(rows).toEqual(originalRows);
    });
});
