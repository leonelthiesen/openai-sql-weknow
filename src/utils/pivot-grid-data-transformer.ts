import { LLMQuery } from "../models/llm-structured-output.models";
import { PivotGridCellValue, PivotGridResponse, RowKey } from "../types/pivot-grid-response.types";

export interface Dataset {
  label: string;
  data: number[];
}

export interface ChartData {
  labels: string[];
  datasets: Dataset[];
}

function toDisplayValue(value: PivotGridCellValue | undefined): string {
    if (value == null) {
        return "";
    }
    return String(value);
}

function toNumericValue(value: PivotGridCellValue | undefined): number | null {
    if (value == null || value === "") {
        return 0;
    }

    if (typeof value === "number") {
        return Number.isNaN(value) ? null : value;
    }

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function formatMeasureSeriesLabel(measureTitle: string, seriesKey: string): string {
    return seriesKey ? `${measureTitle} - ${seriesKey}` : measureTitle;
}


export function transformToChartData(
    apiResponse: PivotGridResponse,
    queryConfig: LLMQuery
): ChartData {
    // 1. Mapear nome completo -> chave no row (d1, d2, ...)
    const colNameToKey: Record<string, RowKey> = {};
    apiResponse.cols.forEach((col, idx) => {
        colNameToKey[col.completeName] = `d${idx + 1}`;
    });

    // 2. Obter as chaves das categorias, séries e medidas
    const categoryKeys = queryConfig.categoryDimensions.map(cat => colNameToKey[cat.completeName]!);
    const seriesKeys = queryConfig.seriesDimensions?.map(ser => colNameToKey[ser.completeName]!) || [];

    const measureItems = queryConfig.measures.map(measure => {
        const measureName = typeof measure === 'string' ? measure : measure.completeName;
        const measureKey = colNameToKey[measureName];
        if (!measureKey) throw new Error(`Measure "${measureName}" not found in columns`);
        const measureTitle = typeof measure === 'string' ? measure : (measure.title || measure.completeName);
        return { name: measureName, key: measureKey, title: measureTitle };
    });

    // 3. Estrutura para agregação: Map<medida, Map<categoria, Map<série, valor>>>
    const measuresAgg: Map<string, Map<string, Map<string, number>>> = new Map();
    for (const measure of measureItems) {
        measuresAgg.set(measure.title, new Map());
    }

    // 4. Processar cada linha
    for (const row of apiResponse.rows) {
        // Construir chave da categoria (concatenação dos valores das dimensões)
        const categoryValues = categoryKeys.map(key => {
            if (key === undefined) {
                throw new Error(`Category key is undefined for category dimension. Check if the completeName matches a column.`);
            }

            return toDisplayValue(row[key]);
        });
        const categoryKey = categoryValues.join(' | '); // separador configurável

        // Construir chave da série (concatenação dos valores das dimensões de série)
        const seriesValues = seriesKeys.map(key => toDisplayValue(row[key]));
        const seriesKey = seriesValues.join(' | ');

        // Para cada medida, acumular o valor
        for (const measure of measureItems) {
            const value = toNumericValue(row[measure.key]);
            if (value == null) continue;

            const aggByCategory = measuresAgg.get(measure.title)!;
            if (!aggByCategory.has(categoryKey)) {
                aggByCategory.set(categoryKey, new Map());
            }
            const aggBySeries = aggByCategory.get(categoryKey)!;
            const current = aggBySeries.get(seriesKey) ?? 0;
            aggBySeries.set(seriesKey, current + value);
        }
    }

    // 5. Coletar todas as categorias (labels do eixo X)
    const allCategories = new Set<string>();
    for (const aggByCategory of measuresAgg.values()) {
        for (const cat of aggByCategory.keys()) {
            allCategories.add(cat);
        }
    }
    const labels = Array.from(allCategories);

    // 6. Construir datasets: para cada medida, para cada série, gerar um dataset
    const datasets: Dataset[] = [];
    for (const [measureTitle, aggByCategory] of measuresAgg.entries()) {
        // Obter todas as séries que aparecem nesta medida
        const allSeries = new Set<string>();
        for (const seriesMap of aggByCategory.values()) {
            for (const series of seriesMap.keys()) {
                allSeries.add(series);
            }
        }
        const seriesList = Array.from(allSeries).sort();

        // Criar um dataset por série
        for (const seriesKey of seriesList) {
            const data = labels.map(label => {
                const seriesMap = aggByCategory.get(label);
                return seriesMap ? (seriesMap.get(seriesKey) ?? 0) : 0;
            });
            datasets.push({
                label: formatMeasureSeriesLabel(measureTitle, seriesKey),
                data,
            });
        }
    }

    return { labels, datasets };
}
