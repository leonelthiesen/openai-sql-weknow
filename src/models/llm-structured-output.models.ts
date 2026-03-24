import { TBooleanOperator } from "./TBooleanOperator";
import { TComparisonOperator } from "./TComparisonOperator";
import { TFieldType } from "./TFieldType";
import { TMeasureFunction } from "./TMeasureFunction";
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

export interface LLMMeasure {
    completeName: string;
    measureFunction: TMeasureFunction;
    title: string;
}

export interface LLMSort {
    completeName: string;
    direction: TSortDirection;
    measureFunction: TMeasureFunction;
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
    measureFunction: TMeasureFunction;
    not: boolean;
    operator: TComparisonOperator;
    values: LLMFilterValue[];
}
