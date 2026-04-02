import { describe, expect, it } from "vitest";
import { parseToolArgs, ToolValidationError } from "./tool-args-parser";

function makeExtractDataArgs(operator: unknown) {
    return JSON.stringify({
        message: "Mensagem",
        userMessageSuggestions: [],
        renderType: "TABLE",
        query: {
            measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
            filters: {
                join: 0,
                filters: [
                    {
                        completeName: "dim.status",
                        filters: [],
                        join: 0,
                        not: false,
                        operator,
                        values: ["ativo"],
                    },
                ],
            },
            havingFilters: {
                join: 0,
                filters: [
                    {
                        completeName: "mes.total",
                        filters: [],
                        join: 0,
                        aggregateFunction: "SUM",
                        not: false,
                        operator: "LIKE",
                        values: ["1"],
                    },
                ],
            },
        },
    });
}

describe("parseToolArgs extract_data comparison operator validation", () => {
    it("accepts textual SQL operator values", () => {
        const parsed = parseToolArgs("extract_data", makeExtractDataArgs("IN"));

        if (parsed.toolName !== "extract_data") {
            throw new Error("Unexpected tool name");
        }

        const firstFilter = parsed.query.filters.filters[0];
        if (!firstFilter || !("operator" in firstFilter)) {
            throw new Error("Expected first where filter condition with operator");
        }

        expect(parsed.query.filters.join).toBe(0);
        expect(firstFilter.operator).toBe("IN");
    });

    it("rejects legacy numeric operators", () => {
        expect(() => parseToolArgs("extract_data", makeExtractDataArgs(0))).toThrow(ToolValidationError);
    });

    it("rejects root whereFilters with leaf-only fields", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                filters: {
                    completeName: "dim.status",
                    join: 0,
                    operator: "=",
                    values: ["ativo"],
                    filters: [],
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });

    it("rejects root whereFilters without join", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                filters: {
                    filters: [],
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });

    it("rejects root whereFilters without filters", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                filters: {
                    join: 0,
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });

    it("rejects root havingFilters with condition fields", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                havingFilters: {
                    completeName: "mes.total",
                    join: 0,
                    aggregateFunction: "SUM",
                    operator: ">",
                    values: [1],
                    filters: [],
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });

    it("rejects root havingFilters without join", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                havingFilters: {
                    filters: [],
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });

    it("rejects root havingFilters without filters", () => {
        const args = JSON.stringify({
            message: "Mensagem",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                havingFilters: {
                    join: 0,
                },
            },
        });

        expect(() => parseToolArgs("extract_data", args)).toThrow(ToolValidationError);
    });
});

function makeExtractDataArgsWithCalculatedFormula(formula: string) {
    return JSON.stringify({
        message: "Mensagem",
        userMessageSuggestions: [],
        renderType: "TABLE",
        query: {
            calculatedFields: [
                {
                    completeName: "cf_total_ajustado",
                    dataType: 6,
                    formula,
                    hasAggregateFunction: false,
                },
            ],
            measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
        },
    });
}

describe("parseToolArgs extract_data calculatedFields validation", () => {
    const availableFieldNames = ["mes.total", "dim.valor", "dim.status"];

    it("accepts calculated formula referencing offered fields with percent delimiters", () => {
        const args = makeExtractDataArgsWithCalculatedFormula("COALESCE(%dim.valor%, 0) * 1.1");

        const parsed = parseToolArgs("extract_data", args, { availableFieldNames });

        expect(parsed.toolName).toBe("extract_data");
    });

    it("rejects calculated formula referencing unknown field", () => {
        const args = makeExtractDataArgsWithCalculatedFormula("COALESCE(%dim.inexistente%, 0)");

        expect(() =>
            parseToolArgs("extract_data", args, { availableFieldNames })
        ).toThrow(ToolValidationError);
    });

    it("rejects calculated formula with raw field reference without percent delimiters", () => {
        const args = makeExtractDataArgsWithCalculatedFormula("COALESCE(dim.valor, 0)");

        expect(() =>
            parseToolArgs("extract_data", args, { availableFieldNames })
        ).toThrow(ToolValidationError);
    });
});
