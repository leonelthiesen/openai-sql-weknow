import type { PivotGridColumn } from "../types/pivot-grid-response.types";

// ── dataType → human-readable type ──────────────────────────────────────────

const DATA_TYPE_LABELS: Record<number, string> = {
    0: "unknown",
    1: "string",
    2: "smallint",
    3: "integer",
    4: "word",
    5: "boolean",
    6: "float",
    7: "currency",
    8: "bcd",
    10: "date",
    11: "time",
    12: "datetime",
    29: "largeint",
};

function dataTypeLabel(dataType: number): string {
    return DATA_TYPE_LABELS[dataType] ?? "string";
}

// ── section → role ──────────────────────────────────────────────────────────

function sectionRole(section: number): string {
    switch (section) {
        case 15:
            return "measure (aggregated)";
        case 16:
            return "series dimension";
        case 17:
            return "category dimension";
        default:
            return "field";
    }
}

// ── Build schema description for LLM prompt ─────────────────────────────────

export function buildChartSchemaDescription(cols: PivotGridColumn[]): string {
    const lines: string[] = ["Fields:"];

    for (const col of cols) {
        if (!col.completeName || col.visible === false) continue;
        const name = col.completeName;
        const label = col.header?.caption ?? name;
        const type = dataTypeLabel(col.dataType);
        const role = sectionRole(col.section);

        lines.push(`- ${name} (type: ${type}, label: "${label}", role: ${role})`);
    }

    return lines.join("\n");
}
