import { describe, it, expect } from "vitest";
import { buildDataSummary, classifyColumn, DataObfuscator } from "./obfuscate-pivot-data";
import { TFieldType } from "../models/TFieldType";
import type { PivotGridResponse, PivotGridColumn } from "../types/pivot-grid-response.types";

function makeCol(overrides: Partial<PivotGridColumn> & { completeName: string; section: number }): PivotGridColumn {
    return {
        dataType: TFieldType.ftString,
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
        metaValues: [{ title: "Test", linkName: "test", completeName: "test.field" }],
        dataInfo: { source: 0, dateTime: "2025-01-01" },
        showSubtotalColumn: false,
        showSubtotalRow: false,
        showGrandTotalColumn: false,
        showGrandTotalRow: false,
        serverInfo: { version: "1.0" },
    };
}

describe("classifyColumn", () => {
    it("classifies measure section as number", () => {
        const col = makeCol({ completeName: "total", section: 15, dataType: TFieldType.ftString });
        expect(classifyColumn(col)).toBe("number");
    });

    it("classifies date dataType as date", () => {
        const col = makeCol({ completeName: "data_venda", section: 17, dataType: TFieldType.ftDate });
        expect(classifyColumn(col)).toBe("date");
    });

    it("classifies numeric dataType as number", () => {
        const col = makeCol({ completeName: "valor", section: 17, dataType: TFieldType.ftFloat });
        expect(classifyColumn(col)).toBe("number");
    });

    it("classifies id columns by name", () => {
        const col = makeCol({ completeName: "client_id", section: 17, dataType: TFieldType.ftString });
        expect(classifyColumn(col)).toBe("id");
    });

    it("classifies string columns as text", () => {
        const col = makeCol({ completeName: "empresa", section: 17, dataType: TFieldType.ftString });
        expect(classifyColumn(col)).toBe("text");
    });
});

describe("DataObfuscator", () => {
    it("returns same value for same input (deterministic)", () => {
        const obf = new DataObfuscator(123);
        const first = obf.obfuscate("Empresa ABC", 0, "text");
        const second = obf.obfuscate("Empresa ABC", 0, "text");
        expect(first).toBe(second);
    });

    it("returns different values for different inputs", () => {
        const obf = new DataObfuscator(123);
        const a = obf.obfuscate("Empresa ABC", 0, "text");
        const b = obf.obfuscate("Empresa XYZ", 0, "text");
        expect(a).not.toBe(b);
    });

    it("obfuscates numbers preserving decimal places", () => {
        const obf = new DataObfuscator(42);
        const result = obf.obfuscate("1234.56", 0, "number");
        expect(result).toMatch(/^\d+\.\d{2}$/);
        expect(result).not.toBe("1234.56");
    });

    it("obfuscates dates returning valid date strings", () => {
        const obf = new DataObfuscator(42);
        const result = obf.obfuscate("2025-06-15", 0, "date");
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(result).not.toBe("2025-06-15");
    });

    it("returns empty string for empty input", () => {
        const obf = new DataObfuscator(42);
        expect(obf.obfuscate("", 0, "text")).toBe("");
    });

    it("obfuscates IDs as numeric strings", () => {
        const obf = new DataObfuscator(42);
        const result = obf.obfuscate("42", 0, "id");
        expect(Number(result)).toBeGreaterThanOrEqual(1000);
        expect(Number(result)).toBeLessThanOrEqual(9999);
    });
});

describe("buildDataSummary", () => {
    it("includes all expected sections", () => {
        const cols = [
            makeCol({ completeName: "empresa", section: 17, dataType: TFieldType.ftString }),
            makeCol({ completeName: "total", section: 15, dataType: TFieldType.ftFloat }),
        ];
        const rows = [
            { d0: "Empresa Real", d1: "5000.00" },
            { d0: "Outra Empresa", d1: "3000.50" },
        ];
        const data = makeResponse(rows, cols);
        const result = buildDataSummary(data);

        expect(result).toContain("Query executed successfully.");
        expect(result).toContain("## Schema");
        expect(result).toContain("## Sample Data (first 10 rows, obfuscated)");
        expect(result).toContain("Total rows: 2");
        expect(result).toContain("| 0 | empresa |");
        expect(result).toContain("| 1 | total |");
    });

    it("handles empty rows", () => {
        const cols = [
            makeCol({ completeName: "empresa", section: 17, dataType: TFieldType.ftString }),
        ];
        const data = makeResponse([], cols);
        const result = buildDataSummary(data);

        expect(result).toContain("Query executed successfully.");
        expect(result).toContain("## Schema");
        expect(result).not.toContain("## Sample Data");
        expect(result).toContain("Total rows: 0");
    });

    it("does not contain real data values", () => {
        const cols = [
            makeCol({ completeName: "empresa", section: 17, dataType: TFieldType.ftString }),
        ];
        const rows = [{ d0: "Dados Secretos LTDA" }];
        const data = makeResponse(rows, cols);
        const result = buildDataSummary(data);

        expect(result).not.toContain("Dados Secretos LTDA");
    });

    it("handles CSV values with commas and quotes", () => {
        const cols = [
            makeCol({ completeName: "empresa", section: 17, dataType: TFieldType.ftString }),
        ];
        // The obfuscated output (not the input) needs quoting — test that the function doesn't crash
        const rows = [{ d0: 'Value with "quotes" and, commas' }];
        const data = makeResponse(rows, cols);
        const result = buildDataSummary(data);

        expect(result).toContain("Total rows: 1");
    });

    it("limits sample to 10 rows", () => {
        const cols = [
            makeCol({ completeName: "nome", section: 17, dataType: TFieldType.ftString }),
        ];
        const rows = Array.from({ length: 25 }, (_, i) => ({ d0: `Name ${i}` }));
        const data = makeResponse(rows, cols);
        const result = buildDataSummary(data);

        // Header + 10 data rows = 11 lines in CSV block
        const csvSection = result.split("## Sample Data (first 10 rows, obfuscated)\n")[1]!;
        const csvLines = csvSection.split("\n\nTotal rows:")[0]!.split("\n");
        expect(csvLines).toHaveLength(11); // 1 header + 10 data
        expect(result).toContain("Total rows: 25");
    });
});
