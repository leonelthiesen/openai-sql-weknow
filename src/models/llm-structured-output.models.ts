import { TBooleanOperator } from "./TBooleanOperator";
import { TComparisonOperator } from "./TComparisonOperator";
import { TFieldType } from "./TFieldType";
import { TMeasureFunction } from "./TMeasureFunction";
import { TSortDirection } from "./TSortDirection";

export type LLMStructuredOutputAction = "FOLLOWUP_NEEDED" | "EXTRACT_DATA";

export type SimplifiedChartType = "bar" | "line" | "area" | "pie";
export type SimplifiedChartSeriesType = "bar" | "line" | "area";
export type SimplifiedAxisPosition = "left" | "right";
export type SimplifiedAxisFormat = "number" | "currency" | "percent";
export type SimplifiedLegendPosition = "bottom" | "right" | "top" | "left" | "none";
export type SimplifiedFormatterFunction = string;

export interface SimplifiedChartAxisDefinition {
    index: number;
    name?: string;
    position?: SimplifiedAxisPosition;
    format?: SimplifiedAxisFormat;
    formatterFunction?: SimplifiedFormatterFunction;
    currencySymbol?: string;
    decimals?: number;
    min?: number;
    max?: number;
}

export interface SimplifiedChartSeriesDefinition {
    field: string;
    name: string;
    seriesType?: SimplifiedChartSeriesType;
    yAxisIndex?: number;
    stackGroup?: number;
    color?: string;
    smooth?: boolean;
    showLabels?: boolean;
    labelFormatterFunction?: SimplifiedFormatterFunction;
}

export interface SimplifiedChartLegendDefinition {
    position?: SimplifiedLegendPosition;
}

export interface SimplifiedChartTooltipDefinition {
    formatterFunction?: SimplifiedFormatterFunction;
}

export interface SimplifiedChartDefinition {
    chartType: SimplifiedChartType;
    categoryField: string;
    title?: string;
    series: SimplifiedChartSeriesDefinition[];
    axes?: SimplifiedChartAxisDefinition[];
    legend?: SimplifiedChartLegendDefinition;
    tooltip?: SimplifiedChartTooltipDefinition;
}

export interface LLMStructuredOutput {
    action: LLMStructuredOutputAction;
    message: string;
    userMessageSuggestions: string[];
    query: LLMQuery;
    // chartConfig?: SimplifiedChartDefinition;
    chartConfig?: any;
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
