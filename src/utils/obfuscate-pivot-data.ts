import { faker } from "@faker-js/faker";
import { TFieldType } from "../models/TFieldType";
import type {
    PivotGridResponse,
    PivotGridColumn,
    PivotGridRow,
} from "../types/pivot-grid-response.types";

type ColumnType = "text" | "number" | "date" | "id";

const DATE_TYPES = new Set<number>([
    TFieldType.ftDate,
    TFieldType.ftTime,
    TFieldType.ftDateTime,
    TFieldType.ftTimeStamp,
    TFieldType.ftOraTimeStamp,
]);

const NUMERIC_TYPES = new Set<number>([
    TFieldType.ftSmallint,
    TFieldType.ftInteger,
    TFieldType.ftWord,
    TFieldType.ftFloat,
    TFieldType.ftCurrency,
    TFieldType.ftBCD,
    TFieldType.ftLargeint,
    TFieldType.ftFMTBcd,
    TFieldType.ftLongWord,
    TFieldType.ftShortint,
    TFieldType.ftByte,
    TFieldType.ftExtended,
    TFieldType.ftSingle,
]);

const MEASURE_SECTION = 15;

export function classifyColumn(col: PivotGridColumn): ColumnType {
    if (col.section === MEASURE_SECTION) return "number";
    if (DATE_TYPES.has(col.dataType)) return "date";
    if (NUMERIC_TYPES.has(col.dataType)) return "number";
    if (/id$|_id|^id_/i.test(col.completeName)) return "id";
    return "text";
}

function sectionLabel(section: number): string {
    switch (section) {
        case 15: return "measure";
        case 16: return "series";
        case 17: return "category";
        default: return "unknown";
    }
}

/**
 * Deterministic data obfuscator using substitution technique.
 * Same input value always maps to same output within one instance.
 */
export class DataObfuscator {
    private cache = new Map<string, string>();
    private columnFactors = new Map<number, number>();
    private columnDateOffsets = new Map<number, number>();

    constructor(seed?: number) {
        faker.seed(seed ?? 42);
    }

    obfuscate(value: string, colIndex: number, type: ColumnType): string {
        if (value === "" || value == null) return "";

        const cacheKey = `${type}:${colIndex}:${value}`;
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) return cached;

        let result: string;
        switch (type) {
            case "text":
                result = this.obfuscateText(value);
                break;
            case "number":
                result = this.obfuscateNumber(value, colIndex);
                break;
            case "date":
                result = this.obfuscateDate(value, colIndex);
                break;
            case "id":
                result = this.obfuscateId(value);
                break;
        }

        this.cache.set(cacheKey, result);
        return result;
    }

    private obfuscateText(value: string): string {
        // Alternate between person names and company names based on value length
        if (value.length % 2 === 0) {
            return faker.person.fullName();
        }
        return faker.company.name();
    }

    private obfuscateNumber(value: string, colIndex: number): string {
        const num = parseFloat(value.replace(/[^\d.,-]/g, "").replace(",", "."));
        if (isNaN(num)) return value;

        if (!this.columnFactors.has(colIndex)) {
            this.columnFactors.set(colIndex, 0.5 + faker.number.float({ max: 1 }));
        }
        const factor = this.columnFactors.get(colIndex)!;
        const result = num * factor;

        // Preserve decimal places from original
        const decMatch = value.match(/[.,](\d+)$/);
        const decimals = decMatch ? decMatch[1]!.length : 0;
        return result.toFixed(decimals);
    }

    private obfuscateDate(value: string, colIndex: number): string {
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;

        if (!this.columnDateOffsets.has(colIndex)) {
            const sign = faker.datatype.boolean() ? 1 : -1;
            this.columnDateOffsets.set(
                colIndex,
                sign * faker.number.int({ min: 30, max: 180 })
            );
        }
        const offsetDays = this.columnDateOffsets.get(colIndex)!;
        date.setDate(date.getDate() + offsetDays);

        // Return in same format as input (detect if time is included)
        if (/T|\s\d{2}:/.test(value)) {
            return date.toISOString().replace("T", " ").slice(0, 19);
        }
        return date.toISOString().slice(0, 10);
    }

    private obfuscateId(_value: string): string {
        return String(faker.number.int({ min: 1000, max: 9999 }));
    }
}

function buildSchemaDescription(
    cols: PivotGridColumn[]
): string {
    const lines: string[] = [
        "## Schema",
        "| # | CompleteName | Caption | Type | Section |",
        "|---|--------------|---------|------|---------|",
    ];

    for (let i = 0; i < cols.length; i++) {
        const col = cols[i]!;

        if (!col.visible) {
            continue;
        }

        const type = classifyColumn(col);
        const section = sectionLabel(col.section);
        lines.push(`| ${i} | ${col.completeName || col.header.caption} | ${col.header.caption} | ${type} | ${section} |`);
    }

    // if (metaValues.length > 0) {
    //     const metaStr = metaValues
    //         .map((m) => `${m.completeName ?? m.linkName} (${m.title})`)
    //         .join(", ");
    //     lines.push("", `Meta values: ${metaStr}`);
    // }

    return lines.join("\n");
}

function csvEscape(value: string): string {
    if (/[",\n\r]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function buildObfuscatedCsv(
    rows: PivotGridRow[],
    cols: PivotGridColumn[],
    obfuscator: DataObfuscator,
    maxRows = 10
): string {
    const columnTypes = cols.map(classifyColumn);
    const header = cols.map((c) => csvEscape(c.header.caption)).join(",");

    const dataRows = rows.slice(0, maxRows).map((row) => {
        return cols
            .map((_, i) => {
                let dataIndex = i + 1; // Data fields are d1, d2, ...
                const rawValue = row[`d${dataIndex}` as `d${number}`] ?? "";
                const obfuscated = obfuscator.obfuscate(rawValue, dataIndex, columnTypes[dataIndex]!);
                return csvEscape(obfuscated);
            })
            .join(",");
    });

    return [header, ...dataRows].join("\n");
}

export function buildDataSummary(data: PivotGridResponse): string {
    const obfuscator = new DataObfuscator();

    const parts: string[] = [
        "Query executed successfully.",
        "",
        buildSchemaDescription(data.cols),
    ];

    if (data.rows.length > 0) {
        parts.push(
            "",
            "## Sample Data CSV (first 10 rows, obfuscated)",
            buildObfuscatedCsv(data.rows, data.cols, obfuscator),
        );
    }

    parts.push("", `Total rows: ${data.rows.length}`);

    return parts.join("\n");
}
