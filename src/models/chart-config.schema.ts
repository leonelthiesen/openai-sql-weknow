import { z } from "zod/v4";

const EncodingSchema = z.object({
    field: z.string(),
    type: z.enum(["quantitative", "nominal", "ordinal", "temporal"]),
    label: z.string(),
});

export const ChartConfigSchema = z.object({
    chart_type: z.enum([
        "bar",
        "line",
        "area",
        "pie",
        "donut",
        "scatter",
        "bubble",
        "heatmap",
        "histogram",
    ]),
    title: z.string(),
    encodings: z.object({
        x: EncodingSchema.optional().nullable(),
        y: EncodingSchema.optional().nullable(),
        color: EncodingSchema.optional().nullable(),
        size: EncodingSchema.optional().nullable(),
        theta: EncodingSchema.optional().nullable(),
        label: EncodingSchema.optional().nullable(),
    }),
});

export type ChartConfig = z.infer<typeof ChartConfigSchema>;

export function validateChartConfig(raw: unknown): {
    valid: true;
    data: ChartConfig;
} | {
    valid: false;
    error: string;
} {
    const result = ChartConfigSchema.safeParse(raw);
    if (!result.success) {
        return { valid: false, error: result.error.message };
    }
    return { valid: true, data: result.data };
}
