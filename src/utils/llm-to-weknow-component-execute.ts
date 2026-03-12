import { LLMHavingFilters, LLMPosWindowFunctionFilters, LLMQueryColumn, LLMStructuredOutput, LLMWhereFilters } from "../models/llm-structured-output.models";
import { TComponentApi_TExecuteInputCustom, TCustomFilterValueMode, TCustomHavingFilter, TCustomWhereFilter } from "../models/dashboard-object-dto-custom.models";
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
function convertHavingAndPosWindowFilters (llmFilters: LLMHavingFilters | LLMPosWindowFunctionFilters): TCustomHavingFilter | undefined {
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
        filter.filters = llmFilters.filters.map(f => convertHavingAndPosWindowFilters(f)).filter(f => f !== undefined) as TCustomHavingFilter[];
    }

    return filter;
}

/**
 * Transforma uma mensagem LLMStructuredOutput em TComponentApi_TExecuteInputCustom
 * @param botMessage - Mensagem do bot com conteúdo estruturado
 * @param metadataId - ID do metadata para execução
 * @returns Objeto no formato TComponentApi_TExecuteInputCustom ou null se não for possível converter
 */
export function transformLLMToComponentExecuteInput (
    botMessageContent: string | LLMStructuredOutput,
    metadataId: number
): TComponentApi_TExecuteInputCustom | null {
    // Verifica se o conteúdo é do tipo LLMStructuredOutput
    if (typeof botMessageContent === 'string') {
        return null;
    }

    const llmOutput = botMessageContent as LLMStructuredOutput;

    // Verifica se a ação é EXECUTE_QUERY
    if (llmOutput.action !== 'EXECUTE_QUERY' || !llmOutput.query) {
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

    // Converte as colunas
    const columns = query.columns?.filter((col: LLMQueryColumn) => col.completeName)?.map((col: LLMQueryColumn) => ({
        completeName: col.completeName,
        distinct: col.distinct,
        measureFunction: col.measureFunction || TMeasureFunction.fnNone,
        title: col.title,
        viewMode: 0
    })) || [];

    // Converte o sort
    const sort = query.sort?.filter(s => s.completeName)?.map(s => ({
        completeName: s.completeName,
        direction: s.direction,
        measureFunction: s.measureFunction || TMeasureFunction.fnNone
    })) || [];

    // Converte os filtros
    const whereFilters = query.filters ? convertWhereFilters(query.filters) : undefined;
    const havingFilters = query.havingFilters ? convertHavingAndPosWindowFilters(query.havingFilters) : undefined;
    const posWindowFunctionFilters = query.posWindowFunctionFilters ? convertHavingAndPosWindowFilters(query.posWindowFunctionFilters) : undefined;

    // Monta o objeto final
    const executeInput: TComponentApi_TExecuteInputCustom = {
    // const executeInput: any = {
        contents: {
            calculatedFields: calculatedFields.length > 0 ? calculatedFields : undefined,
            dataSource: {
                metadataId: metadataId,
            },
            version: "5.2.1",
            type: TComponentType.ctGrid,
            whereFilters: whereFilters,
            gridView: {
                columns: columns,
                gridBaseType: TGridBaseType.gbtSingleDimension,
                havingFilters: havingFilters,
                posWindowFunctionFilters: posWindowFunctionFilters,
                sort: sort,
            }
        }
    };

    return executeInput;
}
