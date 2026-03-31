import { TBooleanOperator } from "./TBooleanOperator";
import { TComparisonOperator } from "./TComparisonOperator";
import { TFieldType } from "./TFieldType";
import { TSortDirection } from "./TSortDirection";

export type LLMStructuredOutputAction = "FOLLOWUP_NEEDED" | "EXTRACT_DATA";

export interface LLMStructuredOutput {
    action: LLMStructuredOutputAction;
    message: string;
    userMessageSuggestions: string[];
    query: LLMQuery;
    chartConfig?: object;
    renderType: 'CHART' | 'TABLE' | 'TEXT';
}

export interface LLMDimension {
    completeName: string;
    title: string;
}

export type LLMAggregateFunction =
    | "NONE"
    | "COUNT"
    | "COUNT_DISTINCT"
    | "SUM"
    | "MAX"
    | "MIN"
    | "AVG"
    | "LIST"
    | "LIST_DISTINCT"
    | "SUM_DISTINCT"
    | "AVG_DISTINCT";

export interface LLMMeasure {
    completeName: string;
    aggregateFunction: LLMAggregateFunction;
    title: string;
}

export interface LLMSort {
    completeName: string;
    direction: TSortDirection;
    aggregateFunction: LLMAggregateFunction;
}

export interface LLMQuery {
    calculatedFields: LLMCalculatedField[];
    categoryDimensions: LLMDimension[];
    seriesDimensions?: LLMDimension[];
    measures: LLMMeasure[];
    categorySort?: LLMSort[];
    seriesSort?: LLMSort[];
    filters: LLMWhereFilters;
    havingFilters: LLMHavingFilters;
    recsMax?: number;
}

export interface LLMCalculatedField {
    completeName?: string,
    dataType?: TFieldType,
    formula?: string,
    hasAggregateFunction?: boolean,
    hasAnalyticFunction?: boolean,
    title?: string,
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
    aggregateFunction: LLMAggregateFunction;
    not: boolean;
    operator: TComparisonOperator;
    values: LLMFilterValue[];
}
