import { TBooleanOperator } from "./TBooleanOperator";
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

export type LLMComparisonOperator =
    | "LIKE"
    | "="
    | "!="
    | ">"
    | ">="
    | "<"
    | "<="
    | "IN"
    | "BETWEEN"
    | "IS_NULL"
    | "STARTS_WITH"
    | "ENDS_WITH";

export interface LLMMeasure {
    completeName: string;
    aggregateFunction: LLMAggregateFunction;
    title: string;
}

export type LLMSortDirection = "ASC" | "DESC";

export interface LLMSort {
    completeName: string;
    direction?: LLMSortDirection;
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

export interface LLMWhereFilterGroup {
    filters: LLMWhereFilters[];
    join: TBooleanOperator;
}

export interface LLMWhereFilterCondition {
    completeName: string;
    filters: LLMWhereFilters[];
    join: TBooleanOperator;
    not: boolean;
    operator: LLMComparisonOperator;
    values: LLMFilterValue[];
}

export type LLMWhereFilters = LLMWhereFilterGroup | LLMWhereFilterCondition;

export interface LLMHavingFilterGroup {
    filters: LLMHavingFilters[];
    join: TBooleanOperator;
}

export interface LLMHavingFilterCondition {
    completeName: string;
    filters: LLMHavingFilters[];
    join: TBooleanOperator;
    aggregateFunction: LLMAggregateFunction;
    not: boolean;
    operator: LLMComparisonOperator;
    values: LLMFilterValue[];
}

export type LLMHavingFilters = LLMHavingFilterGroup | LLMHavingFilterCondition;
