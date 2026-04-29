import type { PivotGridColumn, PivotGridRow, PivotGridCellValue } from "../types/pivot-grid-response.types";

export interface PivotMetadata {
    wasPivoted: boolean;
    seriesDimensionNames: string[];
    measureNames: string[];
    pivotedColumnNames: string[];
}

export interface PivotResult {
    cols: PivotGridColumn[];
    rows: PivotGridRow[];
    pivotMetadata: PivotMetadata;
}

interface IndexedCol {
    col: PivotGridColumn;
    origIdx: number;
}

function buildSeriesKey(row: PivotGridRow, seriesCols: IndexedCol[]): string {
    return seriesCols
        .map(({ origIdx }) => {
            const val = row[origIdx];
            return val === null || val === undefined || val === ""
                ? "(vazio)"
                : String(val);
        })
        .join(" / ");
}

function buildPivotedColumnName(
    seriesKey: string,
    measureCol: PivotGridColumn,
    measureCount: number,
): string {
    return measureCount === 1
        ? seriesKey
        : `${seriesKey} - ${measureCol.header.caption}`;
}

function createPivotedColumn(
    name: string,
    sourceCol: PivotGridColumn,
): PivotGridColumn {
    return {
        completeName: name,
        dataType: sourceCol.dataType,
        section: 15,
        header: { caption: name },
        expanded: sourceCol.expanded,
        wordWrap: sourceCol.wordWrap,
        visible: sourceCol.visible,
        dataVisibility: sourceCol.dataVisibility,
        formatOptions: sourceCol.formatOptions
            ? { ...sourceCol.formatOptions }
            : undefined,
    };
}

export function pivotSeriesColumns(
    cols: PivotGridColumn[],
    rows: PivotGridRow[],
): PivotResult {
    // 1. Classify columns by section
    const categoryCols: IndexedCol[] = [];
    const seriesCols: IndexedCol[] = [];
    const measureCols: IndexedCol[] = [];

    for (let i = 0; i < cols.length; i++) {
        const entry: IndexedCol = { col: cols[i]!, origIdx: i };
        switch (cols[i]!.section) {
            case 17: categoryCols.push(entry); break;
            case 16: seriesCols.push(entry); break;
            case 15: measureCols.push(entry); break;
        }
    }

    // 2. Early exit if no series dimensions
    if (seriesCols.length === 0) {
        return {
            cols,
            rows,
            pivotMetadata: {
                wasPivoted: false,
                seriesDimensionNames: [],
                measureNames: [],
                pivotedColumnNames: [],
            },
        };
    }

    // 3. Collect unique series keys in insertion order
    const uniqueSeriesKeys: string[] = [];
    const seriesKeySet = new Set<string>();

    for (const row of rows) {
        const key = buildSeriesKey(row, seriesCols);
        if (!seriesKeySet.has(key)) {
            seriesKeySet.add(key);
            uniqueSeriesKeys.push(key);
        }
    }

    // 4. Build new column definitions
    const newCols: PivotGridColumn[] = categoryCols.map(({ col }) => col);

    // Map: seriesKey -> array of column positions (one per measure)
    const pivotedColOffset = new Map<string, number[]>();
    let pos = categoryCols.length;

    for (const seriesKey of uniqueSeriesKeys) {
        const offsets: number[] = [];
        for (const { col: measureCol } of measureCols) {
            const name = buildPivotedColumnName(seriesKey, measureCol, measureCols.length);
            newCols.push(createPivotedColumn(name, measureCol));
            offsets.push(pos);
            pos++;
        }
        pivotedColOffset.set(seriesKey, offsets);
    }

    const totalCols = newCols.length;

    // 5. Group rows by category values and pivot
    const groupedRows = new Map<string, PivotGridCellValue[]>();

    for (const row of rows) {
        // Build category key
        const categoryValues: PivotGridCellValue[] = categoryCols.map(({ origIdx }) => row[origIdx] ?? null);
        const categoryKey = categoryValues.map(v => String(v)).join("\x00");

        // Get or create the row for this category
        let newRow = groupedRows.get(categoryKey);
        if (!newRow) {
            newRow = new Array<PivotGridCellValue>(totalCols).fill(null);
            for (let i = 0; i < categoryValues.length; i++) {
                newRow[i] = categoryValues[i]!;
            }
            groupedRows.set(categoryKey, newRow);
        }

        // Write measure values into the pivoted positions
        const seriesKey = buildSeriesKey(row, seriesCols);
        const offsets = pivotedColOffset.get(seriesKey);
        if (offsets) {
            for (let m = 0; m < measureCols.length; m++) {
                newRow[offsets[m]!] = row[measureCols[m]!.origIdx] ?? null;
            }
        }
    }

    // 6. Return result
    return {
        cols: newCols,
        rows: [...groupedRows.values()],
        pivotMetadata: {
            wasPivoted: true,
            seriesDimensionNames: seriesCols.map(({ col }) => col.completeName),
            measureNames: measureCols.map(({ col }) => col.completeName),
            pivotedColumnNames: newCols.slice(categoryCols.length).map(c => c.completeName),
        },
    };
}
