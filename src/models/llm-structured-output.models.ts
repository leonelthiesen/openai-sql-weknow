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

export type LLMBooleanOperator = "AND" | "OR";

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
}

export type LLMCalculatedFieldType = "String" | "Number" | "Date" | "Time" | "DateTime";

export interface LLMCalculatedField {
    completeName?: string,
    dataType?: LLMCalculatedFieldType,
    formula?: string,
    hasAggregateFunction?: boolean,
    hasAnalyticFunction?: boolean,
    title?: string,
}

export type LLMFilterValue = string | number | boolean | null;

export interface LLMWhereFilterGroup {
    filters: LLMWhereFilters[];
    join: LLMBooleanOperator;
}

export interface LLMWhereFilterCondition {
    completeName: string;
    filters: LLMWhereFilters[];
    join: LLMBooleanOperator;
    not: boolean;
    operator: LLMComparisonOperator;
    values: LLMFilterValue[];
}

export type LLMWhereFilters = LLMWhereFilterGroup | LLMWhereFilterCondition;

export interface LLMHavingFilterGroup {
    filters: LLMHavingFilters[];
    join: LLMBooleanOperator;
}

export interface LLMHavingFilterCondition {
    completeName: string;
    filters: LLMHavingFilters[];
    join: LLMBooleanOperator;
    aggregateFunction: LLMAggregateFunction;
    not: boolean;
    operator: LLMComparisonOperator;
    values: LLMFilterValue[];
}

export type LLMHavingFilters = LLMHavingFilterGroup | LLMHavingFilterCondition;
