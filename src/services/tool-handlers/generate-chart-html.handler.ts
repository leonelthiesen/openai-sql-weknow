import type { ResponseInputItem } from "openai/resources/responses/responses";
import { logger } from "../../utils/logger";
import { extractResponseText } from "../../utils/extract-response-text";
import { validateChartHtml } from "../../utils/validate-chart-html";
import type { OpenAiItem } from "../chat.service";
import { callOpenAIForMessage } from "../openai-call";
import { toInputItems } from "../llm-retry";
import type { ChartConfig } from "../../models/chart-config.schema";

const MAX_CHART_HTML_ATTEMPTS = 3;

export interface GenerateChartHtmlResult {
    success: boolean;
    html?: string;
    openAiItems: OpenAiItem[];
    failureReason?: string;
}

function buildChartHtmlPrompt(config: ChartConfig): string {
    return `You are a data visualization (Apache ECharts specialist) code generator.
You will receive a chart configuration JSON and must generate a self-contained HTML file that renders the chart using Apache ECharts.

## Input

You will receive:
1. \`config\`: the chart configuration JSON (defined below)
2. The data will be available at runtime via \`window.CHART_DATA\` (defined below).

## Config format

{
  "chart_type": "bar" | "line" | "area" | "pie" | "donut" |
                "scatter" | "bubble" | "heatmap" | "histogram",
  "title": "string",
  "encodings": {
    "x":     { "field": "...", "type": "quantitative|nominal|ordinal|temporal", "label": "..." },
    "y":     { "field": "...", "type": "quantitative|nominal|ordinal|temporal", "label": "..." },
    "color": { "field": "...", "type": "...", "label": "..." },
    "size":  { "field": "...", "type": "quantitative", "label": "..." },
    "theta": { "field": "...", "type": "quantitative", "label": "..." },
    "label": { "field": "...", "type": "...", "label": "..." }
  }
}

## Data contract (window.CHART_DATA)

The data will always follow this structure:
{
  rows: object[],
  meta: {
    fields: { name: string, type: string, label: string }[],
    rowCount: number,
    truncated: boolean
  }
}

Always read data as: const { rows, meta } = window.CHART_DATA;
Never assume the data is a plain array.
Use meta.fields to find the label of a field when building axis names or tooltips.
If meta.truncated is true, add a footnote: "Exibindo primeiros N registros"

## Rules

### General
- Import ECharts from: https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js
- Create a <div id="chart"> that fills the full viewport (width: 100%, height: 100vh)
- Initialize ECharts on that div
- Read data exclusively from \`window.CHART_DATA\`
- If \`window.CHART_DATA\` is undefined or empty, display a centered message: "Sem dados disponíveis"
- Always include a tooltip and, when relevant, a legend
- Do not create a title

### Encoding → ECharts mapping per chart type

**bar / area / line**
- x ← encodings.x.field (categories or time axis)
- y ← encodings.y.field (value axis)
- If encodings.color exists: split into multiple series, one per unique value of color.field
- area: set areaStyle: {} on the series
- line with temporal x: use ECharts time axis (type: 'time')
- ordinal/nominal x: use type: 'category'

**pie / donut**
- Each slice: value ← encodings.theta.field, name ← encodings.color.field
- donut: set radius: ['40%', '70%']
- pie: set radius: '65%'

**scatter**
- x ← encodings.x.field
- y ← encodings.y.field
- If encodings.color: split into series by color.field
- symbolSize: 10

**bubble**
- Same as scatter, plus:
- symbolSize ← scale encodings.size.field linearly between 10 and 60
  based on min/max of that field across all data

**heatmap**
- x ← encodings.x.field (nominal)
- y ← encodings.y.field (nominal)
- value ← encodings.color.field (quantitative)
- Use visualMap component to map value to color gradient
- Use ECharts heatmap series

**histogram**
- x ← encodings.x.field (quantitative)
- Compute bins in JavaScript (aim for ~15 bins using Sturges or fixed count)
- Display as bar chart with no gap between bars (barCategoryGap: '0%')

### Style
- Background: transparent
- Font: Inter, sans-serif

## Output format

Return ONLY the complete HTML. No explanation, no markdown fences, no comments outside the code.
The HTML must be fully functional when opened in a browser or embedded in an iframe,
with window.CHART_DATA injected by the parent before the script runs.

## Input for this request

Config: ${JSON.stringify(config)}`;
}

function stripMarkdownFences(text: string): string {
    return text.replace(/^```(?:html)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

export async function handleGenerateChartHtml(params: {
    config: ChartConfig;
    baseInput: ResponseInputItem[];
    lastResponseOutput: unknown[];
    extractDataCallOutput: OpenAiItem;
}): Promise<GenerateChartHtmlResult> {
    const { config, baseInput, lastResponseOutput, extractDataCallOutput } = params;
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    if (!extractDataCallOutput.callId || typeof extractDataCallOutput.output !== "string") {
        return {
            success: false,
            openAiItems,
            failureReason: "Missing extract_data output context for chart HTML generation.",
        };
    }

    let lastErrors: string[] | undefined;

    for (let attempt = 1; attempt <= MAX_CHART_HTML_ATTEMPTS; attempt++) {
        const promptLines = [buildChartHtmlPrompt(config)];
        if (lastErrors?.length) {
            promptLines.push(
                "",
                "Your previous HTML output had the following issues:",
                ...lastErrors.map((e) => `- ${e}`),
                "",
                "Fix all issues and regenerate the complete HTML."
            );
        }

        const developerMessage = promptLines.join("\n");
        openAiItems.push({
            type: "message",
            role: "developer",
            content: developerMessage,
        });

        const finalInput: ResponseInputItem[] = [
            ...baseInput,
            ...toInputItems(lastResponseOutput),
            {
                type: extractDataCallOutput.type,
                call_id: extractDataCallOutput.callId,
                output: extractDataCallOutput.output,
            } as ResponseInputItem,
            {
                role: "developer",
                content: developerMessage,
            } as ResponseInputItem,
        ];

        try {
            const response = await callOpenAIForMessage(finalInput);
            const responseText = extractResponseText(response);

            if (!responseText) {
                lastErrors = ["No HTML returned by model."];
                logger.warn("chart_html", `Attempt ${attempt}/${MAX_CHART_HTML_ATTEMPTS}: no response text`);
                continue;
            }

            const html = stripMarkdownFences(responseText);

            const validation = validateChartHtml(html);
            if (!validation.valid) {
                lastErrors = validation.errors;
                logger.warn("chart_html", `Attempt ${attempt}/${MAX_CHART_HTML_ATTEMPTS}: validation failed`, {
                    errors: validation.errors,
                });
                continue;
            }

            openAiItems.push({
                type: "message",
                role: "assistant",
                content: html,
            });

            logger.toolResult("chart_html", {
                success: true,
                attempt,
                durationMs: Date.now() - startTime,
            });

            return {
                success: true,
                html,
                openAiItems,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            lastErrors = [errorMsg];
            logger.error("chart_html", `Attempt ${attempt}/${MAX_CHART_HTML_ATTEMPTS}: LLM call failed`, {
                error: errorMsg,
            });
        }
    }

    logger.error("chart_html", "All attempts exhausted", { lastErrors });

    return {
        success: false,
        openAiItems,
        failureReason: lastErrors?.join("; ") ?? "Failed to generate chart HTML after all attempts.",
    };
}
