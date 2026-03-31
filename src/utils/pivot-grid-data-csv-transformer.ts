import { LLMQuery } from "../models/llm-structured-output.models";
import { PivotGridResponse, RowKey } from "../types/pivot-grid-response.types";

/**
 * Gera um CSV pivotado a partir dos dados brutos e da configuração de visualização.
 * @param apiResponse - resposta da API com rows e cols
 * @param queryConfig - configuração com dimensões e medidas
 * @returns string CSV com cabeçalho e dados
 */
export function generatePivotCSV(apiResponse: PivotGridResponse, queryConfig: LLMQuery): string {
    // 1. Mapear nome completo -> chave no row (d1, d2, ...)
    const colNameToKey: Record<string, RowKey> = {};
    apiResponse.cols.forEach((col, idx) => {
        colNameToKey[col.completeName] = `d${idx + 1}`;
    });

    // 2. Obter as chaves das categorias, séries e medidas
    const categoryKeys = queryConfig.categoryDimensions.map(cat => colNameToKey[cat.completeName]!) || [];
    const seriesKeys = queryConfig.seriesDimensions?.map(ser => colNameToKey[ser.completeName]!) || [];

    const measureItems = queryConfig.measures.map(measure => {
        const measureName = typeof measure === 'string' ? measure : measure.completeName;
        const measureKey = colNameToKey[measureName];
        if (!measureKey) throw new Error(`Measure "${measureName}" not found in columns`);
        const measureTitle = typeof measure === 'string' ? measure : (measure.title || measure.completeName);
        return { name: measureName, key: measureKey, title: measureTitle };
    });

    // 3. Estrutura para agregação: Map<categoria, Map<combinação_medida_série, valor>>
    const pivotData: Map<string, Map<string, number>> = new Map();

    for (const row of apiResponse.rows) {
        // Construir chave da categoria (concatenação dos valores das dimensões)
        const categoryValues = categoryKeys.map(key => row[key] ?? '');
        const categoryKey = categoryValues.join(' | ');

        // Construir chave da série (concatenação dos valores das dimensões de série)
        const seriesValues = seriesKeys.map(key => row[key] ?? '');
        const seriesKey = seriesValues.join(' | ');

        // Para cada medida, combinar com a série para formar uma coluna
        for (const measure of measureItems) {
            const columnKey = `${measure.title} - ${seriesKey}`; // ou outra formatação desejada

            const valueStr = row[measure.key];
            const value = parseFloat(valueStr ?? '0');
            if (isNaN(value)) continue;

            if (!pivotData.has(categoryKey)) {
                pivotData.set(categoryKey, new Map());
            }
            const rowMap = pivotData.get(categoryKey)!;
            const current = rowMap.get(columnKey) ?? 0;
            rowMap.set(columnKey, current + value);
        }
    }

    // 4. Construir o CSV
    if (pivotData.size === 0) {
        return ''; // sem dados
    }

    // Coletar todas as colunas (combinações de medida e série) que aparecem
    const allColumns = new Set<string>();
    for (const rowMap of pivotData.values()) {
        for (const col of rowMap.keys()) {
            allColumns.add(col);
        }
    }
    const sortedColumns = Array.from(allColumns).sort();

    // Cabeçalho: colunas de categorias + as colunas pivotadas
    const headerRow = [...queryConfig.categoryDimensions.map(dim => dim.completeName), ...sortedColumns];
    const rows: string[][] = [headerRow];

    // Para cada categoria, gerar uma linha
    for (const [categoryKey, rowMap] of pivotData.entries()) {
        const categoryValues = categoryKey.split(' | '); // separador consistente
        const rowCells = [...categoryValues];
        for (const col of sortedColumns) {
            const value = rowMap.get(col) ?? 0;
            rowCells.push(value.toString());
        }
        rows.push(rowCells);
    }

    // Serializar para CSV (escapando vírgulas e aspas se necessário)
    const escapeCSV = (cell: string): string => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    };

    return rows.map(row => row.map(escapeCSV).join(',')).join('\n');
}
