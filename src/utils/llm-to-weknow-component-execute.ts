import { LLMHavingFilters, LLMStructuredOutput, LLMWhereFilters } from "../models/llm-structured-output.models";
import { TComponentApi_TExecutePivotTableCustomInput, TCustomFilterValueMode, TCustomHavingFilter, TCustomWhereFilter } from "../models/dashboard-object-dto-custom.models";
import { TGridBaseType } from "../models/TGridBaseType";
import { TComponentType } from "../models/TComponentType";
import { TMeasureFunction } from "../models/TMeasureFunction";

/**
 * Converte LLMWhereFilters para TCustomWhereFilter
 */
function convertWhereFilters (llmFilters: LLMWhereFilters): TCustomWhereFilter | undefined {
    if (!llmFilters || !llmFilters.completeName) {
        return undefined;
    }

    const filter: TCustomWhereFilter = {
        completeName: llmFilters.completeName,
        join: llmFilters.join,
        not: llmFilters.not,
        operator: llmFilters.operator,
    };

    if (llmFilters.values && llmFilters.values.length > 0) {
        filter.values = {
            fixedValues: llmFilters.values,
            mode: TCustomFilterValueMode.fvmFixed
        };
    }

    if (llmFilters.filters && llmFilters.filters.length > 0) {
        filter.filters = llmFilters.filters.map(f => convertWhereFilters(f)).filter(f => f !== undefined) as TCustomWhereFilter[];
    }

    return filter;
}

/**
 * Converte LLMHavingFilters para TCustomHavingFilter
 */
function convertHavingFilters (llmFilters: LLMHavingFilters): TCustomHavingFilter | undefined {
    if (!llmFilters || !llmFilters.completeName) {
        return undefined;
    }

    const filter: TCustomHavingFilter = {
        completeName: llmFilters.completeName,
        join: llmFilters.join,
        not: llmFilters.not,
        operator: llmFilters.operator,
        measureFunction: llmFilters.measureFunction,
    };

    if (llmFilters.values && llmFilters.values.length > 0) {
        filter.values = {
            fixedValues: llmFilters.values,
            mode: TCustomFilterValueMode.fvmFixed
        };
    }

    if (llmFilters.filters && llmFilters.filters.length > 0) {
        filter.filters = llmFilters.filters.map(f => convertHavingFilters(f)).filter(f => f !== undefined) as TCustomHavingFilter[];
    }

    return filter;
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
            measureFunction: m.measureFunction || TMeasureFunction.fnNone,
            title: m.title,
        }));

    // colSort = seriesSort
    const colSort = (query.seriesSort ?? [])
        .filter(s => s.completeName)
        .map(s => ({
            completeName: s.completeName,
            direction: s.direction,
            measureFunction: s.measureFunction || TMeasureFunction.fnNone,
        }));

    // rowSort = categorySort
    const rowSort = (query.categorySort ?? [])
        .filter(s => s.completeName)
        .map(s => ({
            completeName: s.completeName,
            direction: s.direction,
            measureFunction: s.measureFunction || TMeasureFunction.fnNone,
        }));

    // Converte os filtros
    const whereFilters = query.filters ? convertWhereFilters(query.filters) : undefined;
    const havingFilters = query.havingFilters ? convertHavingFilters(query.havingFilters) : undefined;

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
        recsMax: query.recsMax
    };

    return executeInput;
}
