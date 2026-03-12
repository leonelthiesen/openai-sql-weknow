import { TBooleanOperator } from "./TBooleanOperator";
import { TComparisonOperator } from "./TComparisonOperator";
import { TFieldType } from "./TFieldType";
import { TMeasureFunction } from "./TMeasureFunction";
import { TSortDirection } from "./TSortDirection";

export type LLMStructuredOutputAction = "FOLLOWUP_NEEDED" | "EXECUTE_QUERY";

export interface LLMStructuredOutput {
    action: LLMStructuredOutputAction;
    message: string;
    userMessageSuggestions: string[];
    query: LLMQuery;
    chartConfig?: any;
    renderType: 'CHART' | 'TABLE' | 'TEXT';
}

export interface LLMQuery {
    calculatedFields: LLMCalculatedField[];
    columns: LLMQueryColumn[];
    sort: LLMQuerySort[];
    filters: LLMWhereFilters;
    havingFilters: LLMHavingFilters;
    posWindowFunctionFilters: LLMPosWindowFunctionFilters
}

export interface LLMCalculatedField {
    completeName?: string,
    dataType?: TFieldType,
    formula?: string,
    hasAggregateFunction?: boolean,
    hasAnalyticFunction?: boolean,
    title?: string,
}

export interface LLMQueryColumn {
    completeName: string;
    distinct: boolean;
    measureFunction: TMeasureFunction;
    title: string;
}

export interface LLMQuerySort {
    completeName: string;
    direction: TSortDirection;
    measureFunction: TMeasureFunction;
}

export type LLMFilterValue = string | number | boolean | null;

export interface LLMWhereFilters {
    completeName: string;
    filters: LLMWhereFilters[];
    join: TBooleanOperator;
    not: boolean;
    operator: TComparisonOperator;
    values: LLMFilterValue[];
}

export interface LLMHavingFilters {
    completeName: string;
    filters: LLMHavingFilters[];
    join: TBooleanOperator;
    measureFunction: TMeasureFunction;
    not: boolean;
    operator: TComparisonOperator;
    values: LLMFilterValue[];
}

export interface LLMPosWindowFunctionFilters {
    completeName: string;
    filters: LLMPosWindowFunctionFilters[];
    join: TBooleanOperator;
    measureFunction: TMeasureFunction;
    not: boolean;
    operator: TComparisonOperator;
    values: LLMFilterValue[];
}
