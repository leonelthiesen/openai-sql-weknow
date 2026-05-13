import type { PivotGridColumn, PivotGridCellValue, PivotGridRow } from "../types/pivot-grid-response.types";

// ── Constants ────────────────────────────────────────────────────────────────

export const SECTION = { DIMENSION: 17, SERIES: 16, MEASURE: 15 } as const;

const TEMPORAL_RX = [
    /year/i, /month/i, /date/i, /time/i, /day/i, /quarter/i,   /week/i,     /semester/i,              /hour/i, /minute/i, /second/i,
    /ano/i,  /mês/i,   /data/i, /hora/i, /dia/i, /trimestre/i, /semana/i,   /semestre/i, /bimestre/i,          /minuto/i, /segundo/i
];

// ── Types ────────────────────────────────────────────────────────────────────

export type DatasetSource = (string | number | boolean | null)[][];

export interface ClassifiedColumn {
    col: PivotGridColumn;
    index: number;
    label: string;
}

export interface EChartsDatasetResult {
    dataset: { source: DatasetSource };
    tableSource: DatasetSource;
    layout: "kpi" | "simple" | "pivot";
    axisDim?: ClassifiedColumn;
    seriesDim?: ClassifiedColumn;
    measures: ClassifiedColumn[];
    seriesValues?: string[];
    compoundAxisDims?: ClassifiedColumn[];
}

export interface ToEChartsDatasetOptions {
    axisDim?: string;
    chartType?: string;
}

interface ClassifyResult {
    categoryDims: ClassifiedColumn[];
    seriesDims: ClassifiedColumn[];
    measures: ClassifiedColumn[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTemporal(col: PivotGridColumn): boolean {
    return TEMPORAL_RX.some(rx => rx.test(col.completeName ?? ""));
}

function classifyColumn(col: PivotGridColumn, index: number): ClassifiedColumn {
    return {
        col,
        index,
        label: col.header?.caption || col.completeName || `col${index}`,
    };
}

export function classify(cols: PivotGridColumn[]): ClassifyResult {
    const categoryDims: ClassifiedColumn[] = [];
    const seriesDims: ClassifiedColumn[] = [];
    const measures: ClassifiedColumn[] = [];

    for (let i = 0; i < cols.length; i++) {
        const col = cols[i]!;
        if (col.visible === false || !col.completeName) continue;

        const cc = classifyColumn(col, i);
        switch (col.section) {
            case SECTION.DIMENSION: categoryDims.push(cc); break;
            case SECTION.SERIES:    seriesDims.push(cc);   break;
            case SECTION.MEASURE:   measures.push(cc);     break;
        }
    }

    return { categoryDims, seriesDims, measures };
}

function cardinalityOf(cc: ClassifiedColumn, rows: PivotGridRow[]): number {
    const set = new Set<PivotGridCellValue>();
    for (const row of rows) {
        set.add(row[cc.index] ?? null);
    }
    return set.size;
}

export function pickPivotAxes(
    dims: ClassifiedColumn[],
    rows: PivotGridRow[],
    hint?: { axisDim?: string },
): { axis: ClassifiedColumn; series: ClassifiedColumn; extras: ClassifiedColumn[] } {
    if (dims.length < 2) {
        throw new Error("pickPivotAxes requires at least 2 dimensions");
    }

    let axis: ClassifiedColumn | undefined;
    let series: ClassifiedColumn | undefined;

    // 1. Explicit hint
    if (hint?.axisDim) {
        axis = dims.find(d => d.col.completeName === hint.axisDim);
    }

    // 2. Temporal heuristic
    if (!axis) {
        const temporal = dims.find(d => isTemporal(d.col));
        if (temporal) {
            axis = temporal;
        }
    }

    // 3. Cardinality: highest → axis, lowest → series
    if (!axis) {
        const sorted = [...dims].sort((a, b) => cardinalityOf(b, rows) - cardinalityOf(a, rows));
        axis = sorted[0]!;
    }

    // Pick the other dim as series; remaining are extras
    const remaining = dims.filter(d => d !== axis);
    if (remaining.length === 0) {
        throw new Error("pickPivotAxes: could not determine series dimension");
    }

    // Among remaining, prefer the one with lower cardinality as the series legend
    const sortedRemaining = [...remaining].sort((a, b) => cardinalityOf(a, rows) - cardinalityOf(b, rows));
    series = sortedRemaining[0]!;
    const extras = sortedRemaining.slice(1);

    return { axis: axis!, series, extras };
}

// ── Cell value formatting ────────────────────────────────────────────────────

function cellToString(val: PivotGridCellValue): string {
    if (val === null || val === undefined || val === "") return "(vazio)";
    return String(val);
}

// ── Strategy: KPI (0 dims + N measures) ──────────────────────────────────────

function buildKpi(measures: ClassifiedColumn[], rows: PivotGridRow[]): EChartsDatasetResult {
    const headers = measures.map(m => m.label);
    const values = measures.map(m => rows[0]?.[m.index] ?? 0);
    const source: DatasetSource = [headers, values];
    return {
        dataset: { source },
        tableSource: source,
        layout: "kpi",
        measures,
    };
}

// ── Strategy: Simple (1 dim + N measures) ────────────────────────────────────

function buildSimple(
    dim: ClassifiedColumn,
    measures: ClassifiedColumn[],
    rows: PivotGridRow[],
): EChartsDatasetResult {
    const headers: (string | number | boolean | null)[] = [dim.label, ...measures.map(m => m.label)];
    const source: DatasetSource = [headers];

    for (const row of rows) {
        source.push([row[dim.index] ?? null, ...measures.map(m => row[m.index] ?? 0)]);
    }

    return {
        dataset: { source },
        tableSource: source,
        layout: "simple",
        axisDim: dim,
        measures,
    };
}

// ── Strategy: Pivot (2+ dims + N measures) ───────────────────────────────────

function buildPivot(
    axisDim: ClassifiedColumn,
    seriesDim: ClassifiedColumn,
    extraDims: ClassifiedColumn[],
    measures: ClassifiedColumn[],
    rows: PivotGridRow[],
): EChartsDatasetResult {
    const isCompound = extraDims.length > 0;

    // Axis key for grouping: compound → stringified, single → raw value preserved
    const axisStringKey = (row: PivotGridRow): string => {
        const parts = [row[axisDim.index] ?? null];
        for (const d of extraDims) parts.push(row[d.index] ?? null);
        return parts.map(v => cellToString(v)).join(" / ");
    };

    const axisRawValue = (row: PivotGridRow): PivotGridCellValue =>
        isCompound ? axisStringKey(row) : (row[axisDim.index] ?? null);

    const seriesKeyOf = (row: PivotGridRow): string => cellToString(row[seriesDim.index] ?? null);

    // Collect unique keys in insertion order
    const axisKeys: string[] = [];
    const axisRawValues: PivotGridCellValue[] = [];
    const seriesValuesArr: string[] = [];
    const axisSeen = new Set<string>();
    const seriesSeen = new Set<string>();
    const cell = new Map<string, PivotGridCellValue>();

    const singleMeasure = measures.length === 1;

    for (const row of rows) {
        const aKey = axisStringKey(row);
        const aRaw = axisRawValue(row);
        const s = seriesKeyOf(row);

        if (!axisSeen.has(aKey)) {
            axisSeen.add(aKey);
            axisKeys.push(aKey);
            axisRawValues.push(aRaw);
        }
        if (!seriesSeen.has(s)) { seriesSeen.add(s); seriesValuesArr.push(s); }

        if (singleMeasure) {
            cell.set(`${aKey}|${s}`, row[measures[0]!.index] ?? 0);
        } else {
            for (const m of measures) {
                const colKey = `${s} · ${m.label}`;
                cell.set(`${aKey}|${colKey}`, row[m.index] ?? 0);
            }
        }
    }

    // Build pivoted column names
    let pivotedCols: string[];
    if (singleMeasure) {
        pivotedCols = seriesValuesArr;
    } else {
        pivotedCols = [];
        for (const s of seriesValuesArr) {
            for (const m of measures) {
                pivotedCols.push(`${s} · ${m.label}`);
            }
        }
    }

    // Build source
    const headers: (string | number | boolean | null)[] = [axisDim.label, ...pivotedCols];
    const source: DatasetSource = [headers];

    for (let i = 0; i < axisKeys.length; i++) {
        const aKey = axisKeys[i]!;
        const row: (string | number | boolean | null)[] = [axisRawValues[i]!];
        for (const col of pivotedCols) {
            row.push(cell.get(`${aKey}|${col}`) ?? 0);
        }
        source.push(row);
    }

    // Long-format table: each dimension and measure in its own column, one row per original record
    const tableHeaders: (string | number | boolean | null)[] = [
        axisDim.label,
        ...extraDims.map(d => d.label),
        seriesDim.label,
        ...measures.map(m => m.label),
    ];
    const tableSource: DatasetSource = [tableHeaders];
    for (const row of rows) {
        tableSource.push([
            row[axisDim.index] ?? null,
            ...extraDims.map(d => row[d.index] ?? null),
            row[seriesDim.index] ?? null,
            ...measures.map(m => row[m.index] ?? 0),
        ]);
    }

    return {
        dataset: { source },
        tableSource,
        layout: "pivot",
        axisDim,
        seriesDim,
        measures,
        seriesValues: pivotedCols,
        compoundAxisDims: isCompound ? [axisDim, ...extraDims] : undefined,
    };
}

// ── Main entry point ─────────────────────────────────────────────────────────

export function toEChartsDataset(
    cols: PivotGridColumn[],
    rows: PivotGridRow[],
    options?: ToEChartsDatasetOptions,
): EChartsDatasetResult {
    const { categoryDims, seriesDims, measures } = classify(cols);

    // Merge series dims (section 16) into the dimension pool for pivot treatment
    const allDims = [...categoryDims, ...seriesDims];

    // ── KPI: no dimensions ───────────────────────────────────────────────────
    if (allDims.length === 0) {
        return buildKpi(measures, rows);
    }

    // ── Simple: 1 dimension + N measures ─────────────────────────────────────
    if (allDims.length === 1) {
        return buildSimple(allDims[0]!, measures, rows);
    }

    // ── Pivot: 2+ dimensions ─────────────────────────────────────────────────
    const { axis, series, extras } = pickPivotAxes(allDims, rows, {
        axisDim: options?.axisDim,
    });

    return buildPivot(axis, series, extras, measures, rows);
}
