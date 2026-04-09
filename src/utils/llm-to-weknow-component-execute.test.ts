import { describe, expect, it } from "vitest";
import { transformLLMToComponentExecuteInput } from "./llm-to-weknow-component-execute";
import { TComparisonOperator } from "../models/TComparisonOperator";
import { LLMComparisonOperator, LLMStructuredOutput } from "../models/llm-structured-output.models";
import { TFieldType } from "../models/TFieldType";
import { TSortDirection } from "../models/TSortDirection";

function makeStructuredOutput(operator: LLMComparisonOperator | string) {
    return {
        action: "EXTRACT_DATA" as const,
        message: "ok",
        userMessageSuggestions: [],
        renderType: "TABLE" as const,
        query: {
            calculatedFields: [],
            categoryDimensions: [{ completeName: "dim.category", title: "Categoria" }],
            measures: [{ completeName: "mes.total", aggregateFunction: "SUM" as const, title: "Total" }],
            filters: {
                join: "AND",
                filters: [
                    {
                        completeName: "dim.subcategory",
                        filters: [],
                        join: "AND",
                        not: false,
                        operator: operator as LLMComparisonOperator,
                        values: ["A"],
                    },
                ],
            },
            havingFilters: {
                join: "AND",
                filters: [
                    {
                        completeName: "mes.total",
                        filters: [],
                        join: "AND",
                        aggregateFunction: "SUM",
                        not: false,
                        operator: "IS_NULL" as const,
                        values: [],
                    },
                ],
            },
        },
    } as LLMStructuredOutput;
}

describe("transformLLMToComponentExecuteInput comparison operator mapping", () => {
    it("maps textual comparison operators to internal enum", () => {
        const output = transformLLMToComponentExecuteInput(makeStructuredOutput("STARTS_WITH"), 10);

        expect(output).not.toBeNull();
        expect(output?.contents?.whereFilters?.join).toBe(0);
        expect(output?.contents?.whereFilters?.filters?.[0]?.operator).toBe(TComparisonOperator.coStartsWith);
        expect(output?.contents?.gridView?.havingFilters?.join).toBe(0);
        expect(output?.contents?.gridView?.havingFilters?.filters?.[0]?.operator).toBe(TComparisonOperator.coIsNull);
    });

    it("throws for unsupported comparison operator", () => {
        expect(() => transformLLMToComponentExecuteInput(makeStructuredOutput("<>"), 10)).toThrow(
            "Unsupported comparisonOperator"
        );
    });
});

describe("transformLLMToComponentExecuteInput sort direction normalization", () => {
    it("maps ASC and DESC to TSortDirection enum", () => {
        const output = transformLLMToComponentExecuteInput({
            action: "EXTRACT_DATA",
            message: "ok",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                calculatedFields: [],
                categoryDimensions: [{ completeName: "dim.category", title: "Categoria" }],
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                categorySort: [{ completeName: "dim.category", direction: "ASC", aggregateFunction: "NONE" }],
                seriesSort: [{ completeName: "mes.total", direction: "DESC", aggregateFunction: "SUM" }],
                filters: { join: "AND", filters: [] },
                havingFilters: { join: "AND", filters: [] },
            },
        }, 10);

        expect(output?.contents?.gridView?.rowSort?.[0]?.direction).toBe(TSortDirection.sdAsc);
        expect(output?.contents?.gridView?.colSort?.[0]?.direction).toBe(TSortDirection.sdDesc);
    });

    it("defaults to sdNone when direction is missing or invalid", () => {
        const output = transformLLMToComponentExecuteInput({
            action: "EXTRACT_DATA",
            message: "ok",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                calculatedFields: [],
                categoryDimensions: [{ completeName: "dim.category", title: "Categoria" }],
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                categorySort: [{ completeName: "dim.category", aggregateFunction: "NONE" }],
                seriesSort: [{ completeName: "mes.total", direction: "INVALID" as any, aggregateFunction: "SUM" }],
                filters: { join: "AND", filters: [] },
                havingFilters: { join: "AND", filters: [] },
            },
        }, 10);

        expect(output?.contents?.gridView?.rowSort?.[0]?.direction).toBe(TSortDirection.sdNone);
        expect(output?.contents?.gridView?.colSort?.[0]?.direction).toBe(TSortDirection.sdNone);
    });
});

describe("transformLLMToComponentExecuteInput calculated field dataType mapping", () => {
    it("maps tool schema textual dataType values to TFieldType", () => {
        const output = transformLLMToComponentExecuteInput({
            action: "EXTRACT_DATA",
            message: "ok",
            userMessageSuggestions: [],
            renderType: "TABLE",
            query: {
                calculatedFields: [
                    {
                        completeName: "cf_texto",
                        dataType: "String",
                        formula: "%cliente.nome%",
                        hasAggregateFunction: false,
                    },
                    {
                        completeName: "cf_total",
                        dataType: "Number",
                        formula: "SUM(%vendas.total%)",
                        hasAggregateFunction: true,
                    },
                    {
                        completeName: "cf_data",
                        dataType: "Date",
                        formula: "%vendas.data%",
                        hasAggregateFunction: false,
                    },
                    {
                        completeName: "cf_hora",
                        dataType: "Time",
                        formula: "%vendas.hora%",
                        hasAggregateFunction: false,
                    },
                    {
                        completeName: "cf_data_hora",
                        dataType: "DateTime",
                        formula: "%vendas.data_hora%",
                        hasAggregateFunction: false,
                    },
                ],
                categoryDimensions: [{ completeName: "dim.category", title: "Categoria" }],
                measures: [{ completeName: "mes.total", aggregateFunction: "SUM", title: "Total" }],
                filters: { join: "AND", filters: [] },
                havingFilters: { join: "AND", filters: [] },
            },
        }, 10);

        expect(output?.contents?.calculatedFields?.[0]?.dataType).toBe(TFieldType.ftString);
        expect(output?.contents?.calculatedFields?.[1]?.dataType).toBe(TFieldType.ftFloat);
        expect(output?.contents?.calculatedFields?.[2]?.dataType).toBe(TFieldType.ftDate);
        expect(output?.contents?.calculatedFields?.[3]?.dataType).toBe(TFieldType.ftTime);
        expect(output?.contents?.calculatedFields?.[4]?.dataType).toBe(TFieldType.ftDateTime);
    });
});
