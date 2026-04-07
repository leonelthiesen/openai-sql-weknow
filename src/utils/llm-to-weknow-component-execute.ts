import {
    LLMAggregateFunction,
    LLMHavingFilterCondition,
    LLMComparisonOperator,
    LLMWhereFilterCondition,
    LLMHavingFilters,
    LLMStructuredOutput,
    LLMWhereFilters,
} from "../models/llm-structured-output.models";
import { TComponentApi_TExecutePivotTableCustomInput, TCustomFilterValueMode, TCustomHavingFilter, TCustomHavingFilterRoot, TCustomWhereFilter, TCustomWhereFilterRoot } from "../models/dashboard-object-dto-custom.models";
import { TGridBaseType } from "../models/TGridBaseType";
import { TComponentType } from "../models/TComponentType";
import { TComparisonOperator } from "../models/TComparisonOperator";
import { TMeasureFunction } from "../models/TMeasureFunction";
import { TSortDirection } from "../models/TSortDirection";

function toMeasureFunction (aggregateFunction: LLMAggregateFunction): TMeasureFunction {
    switch (aggregateFunction) {
        case "NONE":
            return TMeasureFunction.fnNone;
        case "COUNT":
            return TMeasureFunction.fnCount;
        case "COUNT_DISTINCT":
            return TMeasureFunction.fnDistinctCount;
        case "SUM":
            return TMeasureFunction.fnSum;
        case "MAX":
            return TMeasureFunction.fnMax;
        case "MIN":
            return TMeasureFunction.fnMin;
        case "AVG":
            return TMeasureFunction.fnAverage;
        case "LIST":
            return TMeasureFunction.fnList;
        case "LIST_DISTINCT":
            return TMeasureFunction.fnDistinctList;
        case "SUM_DISTINCT":
            return TMeasureFunction.fnDistinctSum;
        case "AVG_DISTINCT":
            return TMeasureFunction.fnDistinctAverage;
        default: {
            const exhaustiveCheck: never = aggregateFunction;
            throw new Error(`Unsupported aggregateFunction: ${String(exhaustiveCheck)}`);
        }
    }
}

function toComparisonOperator (comparisonOperator: LLMComparisonOperator): TComparisonOperator {
    switch (comparisonOperator) {
        case "LIKE":
            return TComparisonOperator.coLike;
        case "=":
            return TComparisonOperator.coEqual;
        case "!=":
            return TComparisonOperator.coDifferent;
        case ">":
            return TComparisonOperator.coBiggerThan;
        case ">=":
            return TComparisonOperator.coBiggerOrEqualThan;
        case "<":
            return TComparisonOperator.coLowerThan;
        case "<=":
            return TComparisonOperator.coLowerOrEqualThan;
        case "STARTS_WITH":
            return TComparisonOperator.coStartsWith;
        case "ENDS_WITH":
            return TComparisonOperator.coEndsWith;
        case "IN":
            return TComparisonOperator.coIn;
        case "BETWEEN":
            return TComparisonOperator.coBetween;
        case "IS_NULL":
            return TComparisonOperator.coIsNull;
        default: {
            const exhaustiveCheck: never = comparisonOperator;
            throw new Error(`Unsupported comparisonOperator: ${String(exhaustiveCheck)}`);
        }
    }
}

function toSortDirection(direction: unknown): TSortDirection {
    switch (direction) {
        case "ASC":
            return TSortDirection.sdAsc;
        case "DESC":
            return TSortDirection.sdDesc;
        default:
            return TSortDirection.sdNone;
    }
}

/**
 * Converte LLMWhereFilters para TCustomWhereFilter
 */
function convertWhereFilterNode (llmFilters: LLMWhereFilters): TCustomWhereFilter | undefined {
    if (!llmFilters || typeof llmFilters !== "object") {
        return undefined;
    }

    if (!("completeName" in llmFilters)) {
        const childFilters = Array.isArray(llmFilters.filters)
            ? llmFilters.filters
                .map(f => convertWhereFilterNode(f))
                .filter(f => f !== undefined) as TCustomWhereFilter[]
            : [];

        return {
            join: llmFilters.join,
            filters: childFilters,
        };
    }

    const condition = llmFilters as LLMWhereFilterCondition;

    const filter: TCustomWhereFilter = {
        completeName: condition.completeName,
        join: condition.join,
        not: condition.not,
        operator: toComparisonOperator(condition.operator),
    };

    if (condition.values && condition.values.length > 0) {
        filter.values = {
            fixedValues: condition.values,
            mode: TCustomFilterValueMode.fvmFixed
        };
    }

    if (condition.filters && condition.filters.length > 0) {
        filter.filters = condition.filters
            .map(f => convertWhereFilterNode(f))
            .filter(f => f !== undefined) as TCustomWhereFilter[];
    }

    return filter;
}

function convertWhereFiltersRoot (llmFilters: LLMWhereFilters): TCustomWhereFilterRoot | undefined {
    if (!llmFilters || typeof llmFilters !== "object") {
        return undefined;
    }

    if (!Array.isArray(llmFilters.filters)) {
        return undefined;
    }

    return {
        join: llmFilters.join,
        filters: llmFilters.filters
            .map(f => convertWhereFilterNode(f))
            .filter(f => f !== undefined) as TCustomWhereFilter[],
    };
}

/**
 * Converte LLMHavingFilters para TCustomHavingFilter
 */
function convertHavingFilterNode (llmFilters: LLMHavingFilters): TCustomHavingFilter | undefined {
    if (!llmFilters || typeof llmFilters !== "object") {
        return undefined;
    }

    if (!("completeName" in llmFilters)) {
        const childFilters = Array.isArray(llmFilters.filters)
            ? llmFilters.filters
                .map(f => convertHavingFilterNode(f))
                .filter(f => f !== undefined) as TCustomHavingFilter[]
            : [];

        return {
            join: llmFilters.join,
            filters: childFilters,
        };
    }

    const condition = llmFilters as LLMHavingFilterCondition;

    const filter: TCustomHavingFilter = {
        completeName: condition.completeName,
        join: condition.join,
        not: condition.not,
        operator: toComparisonOperator(condition.operator),
        measureFunction: toMeasureFunction(condition.aggregateFunction),
    };

    if (condition.values && condition.values.length > 0) {
        filter.values = {
            fixedValues: condition.values,
            mode: TCustomFilterValueMode.fvmFixed
        };
    }

    if (condition.filters && condition.filters.length > 0) {
        filter.filters = condition.filters
            .map(f => convertHavingFilterNode(f))
            .filter(f => f !== undefined) as TCustomHavingFilter[];
    }

    return filter;
}

function convertHavingFiltersRoot (llmFilters: LLMHavingFilters): TCustomHavingFilterRoot | undefined {
    if (!llmFilters || typeof llmFilters !== "object") {
        return undefined;
    }

    if (!Array.isArray(llmFilters.filters)) {
        return undefined;
    }

    return {
        join: llmFilters.join,
        filters: llmFilters.filters
            .map(f => convertHavingFilterNode(f))
            .filter(f => f !== undefined) as TCustomHavingFilter[],
    };
}

/**
 * Transforma uma mensagem LLMStructuredOutput em TComponentApi_TExecutePivotTableCustomInput
 * Usa gridBaseType gbtMultiDimension (pivot table) com cols/rows/measures.
 *
 * Mapeamento:
 * - query.seriesDimensions → gridView.cols (séries/colunas, section 16)
 * - query.categoryDimensions → gridView.rows (categorias/rótulos, section 17)
 * - query.measures → gridView.measures (medidas, section 15)
 * - query.seriesSort → gridView.colSort
 * - query.categorySort → gridView.rowSort
 */
export function transformLLMToComponentExecuteInput (
    botMessageContent: string | LLMStructuredOutput,
    metadataId: number
): TComponentApi_TExecutePivotTableCustomInput | null {
    if (typeof botMessageContent === 'string') {
        return null;
    }

    const llmOutput = botMessageContent as LLMStructuredOutput;

    if (llmOutput.action !== 'EXTRACT_DATA' || !llmOutput.query) {
        return null;
    }

    const query = llmOutput.query;

    // Converte os calculated fields
    const calculatedFields = query.calculatedFields?.filter(cf => cf.completeName)?.map(cf => ({
        completeName: cf.completeName,
        dataType: cf.dataType,
        formula: cf.formula,
        hasAggregateFunction: cf.hasAggregateFunction,
        hasAnalyticFunction: cf.hasAnalyticFunction,
        title: cf.title
    })) || [];

    // cols = séries (section 16)
    const cols = (query.seriesDimensions ?? [])
        .filter(dim => dim.completeName)
        .map(dim => ({
            completeName: dim.completeName,
            title: dim.title,
        }));

    // rows = categorias (section 17)
    const rows = (query.categoryDimensions ?? [])
        .filter(dim => dim.completeName)
        .map(dim => ({
            completeName: dim.completeName,
            title: dim.title,
        }));

    // measures (section 15)
    const measures = (query.measures ?? [])
        .filter(m => m.completeName)
        .map(m => ({
            completeName: m.completeName,
            measureFunction: toMeasureFunction(m.aggregateFunction),
            title: m.title,
        }));

    // colSort = seriesSort
    const colSort = (query.seriesSort ?? [])
        .filter(s => s.completeName)
        .map(s => ({
            completeName: s.completeName,
            direction: toSortDirection(s.direction),
            measureFunction: toMeasureFunction(s.aggregateFunction),
        }));

    // rowSort = categorySort
    const rowSort = (query.categorySort ?? [])
        .filter(s => s.completeName)
        .map(s => ({
            completeName: s.completeName,
            direction: toSortDirection(s.direction),
            measureFunction: toMeasureFunction(s.aggregateFunction),
        }));

    // Converte os filtros
    const whereFilters = query.filters ? convertWhereFiltersRoot(query.filters) : undefined;
    const havingFilters = query.havingFilters ? convertHavingFiltersRoot(query.havingFilters) : undefined;

    // Monta o objeto final (pivot table)
    const executeInput: TComponentApi_TExecutePivotTableCustomInput = {
        contents: {
            calculatedFields: calculatedFields.length > 0 ? calculatedFields : undefined,
            dataSource: {
                metadataId: metadataId,
            },
            version: "5.2.1",
            type: TComponentType.ctGrid,
            whereFilters: whereFilters,
            gridView: {
                gridBaseType: TGridBaseType.gbtMultiDimension,
                cols: cols.length > 0 ? cols : undefined,
                rows: rows.length > 0 ? rows : undefined,
                measures: measures.length > 0 ? measures : undefined,
                colSort: colSort.length > 0 ? colSort : undefined,
                rowSort: rowSort.length > 0 ? rowSort : undefined,
                havingFilters: havingFilters,
            }
        },
        // recsMax: query.recsMax
    };

    return executeInput;
}
