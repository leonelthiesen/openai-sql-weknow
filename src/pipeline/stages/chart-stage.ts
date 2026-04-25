import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../../services/chat.service";
import type { PivotGridResponse } from "../../types/pivot-grid-response.types";
import type { StageResult } from "./table-stage";
import { executeExtractDataWithRetry } from "./extract-data-shared";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";
import { handleGenerateChartConfig } from "../../services/tool-handlers/generate-chart-config.handler";
import { handleGenerateChartHtml } from "../../services/tool-handlers/generate-chart-html.handler";
import { buildChartSchemaDescription } from "../../utils/build-chart-schema-description";
import { jobStore } from "../job-store";
import { logger } from "../../utils/logger";

export interface ChartStageParams {
    jobId: string;
    parsedCall: OpenAI.Responses.ResponseFunctionToolCall;
    parsedArgs: ExtractDataArgs;
    responseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    metadataId: number;
    openAiItems: OpenAiItem[];
    parseOptions?: { availableFieldNames?: string[] };
}

const FALLBACK_SUGGESTIONS = [
    "Reformule a pergunta com mais clareza",
    "Detalhe melhor quais dados voce precisa",
    "Tente uma consulta mais simples e direta",
];

function buildFallbackResult(
    message: string,
    suggestions: string[],
    callId: string,
    openAiItems: OpenAiItem[],
    extras?: { executionData?: PivotGridResponse; errorResponse?: string | Object }
): StageResult {
    openAiItems.push({
        type: "function_call",
        callId,
        name: "ask_followup",
        arguments: JSON.stringify({ toolName: "ask_followup", message, userMessageSuggestions: suggestions }),
    });
    const result = handleAskFollowup(
        { toolName: "ask_followup", message, userMessageSuggestions: suggestions },
        callId
    );
    openAiItems.push(...result.openAiItems);
    return {
        structuredOutput: result.structuredOutput,
        openAiItems,
        executionData: extras?.executionData,
        errorResponse: extras?.errorResponse,
    };
}

// ── Transform PivotGridResponse to window.CHART_DATA format ──────────────────

interface ChartDataMeta {
    fields: Array<{ name: string; type: string; label: string }>;
    rowCount: number;
    truncated: boolean;
}

function dataTypeToString(dataType: number): string {
    if ([2, 3, 4, 6, 7, 8, 29].includes(dataType)) return "number";
    if ([10, 12].includes(dataType)) return "date";
    if ([11].includes(dataType)) return "time";
    if ([5].includes(dataType)) return "boolean";
    return "string";
}

function transformToChartData(
    executionData: PivotGridResponse
): { rows: Record<string, unknown>[]; meta: ChartDataMeta } {
    const cols = executionData.cols;

    const meta: ChartDataMeta = {
        fields: cols.map((col) => ({
            name: col.completeName,
            type: dataTypeToString(col.dataType),
            label: col.header?.caption ?? col.completeName,
        })),
        rowCount: executionData.rows.length,
        truncated: false,
    };

    const rows = executionData.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < cols.length; i++) {
            const col = cols[i]!;
            const key = `d${i + 1}` as `d${number}`;
            obj[col.completeName] = row[key];
        }
        return obj;
    });

    return { rows, meta };
}

// ── Chart stage ──────────────────────────────────────────────────────────────

function injectChartDataIntoHtml(
    html: string,
    chartData: { rows: Record<string, unknown>[]; meta: ChartDataMeta }
): string {
    const dataScript = `<script>
window.CHART_DATA = ${JSON.stringify(chartData)};
</script>`;

    // Insert the script right after <body> tag, or at the beginning if no <body>
    const bodyMatch = html.match(/<body[^>]*>/i);
    if (bodyMatch) {
        const insertPos = bodyMatch.index! + bodyMatch[0].length;
        return html.slice(0, insertPos) + dataScript + html.slice(insertPos);
    }

    // Fallback: insert at the beginning of the document
    return dataScript + html;
}

// ── Chart stage ──────────────────────────────────────────────────────────────

export async function runChartStage(params: ChartStageParams): Promise<StageResult> {
    const {
        jobId, parsedCall, parsedArgs, responseOutput, baseInput,
        tools, metadataId, openAiItems, parseOptions,
    } = params;

    // ── 1. Execute query with retry ──────────────────────────────────────────
    const retryResult = await executeExtractDataWithRetry({
        initialCall: parsedCall,
        initialArgs: parsedArgs,
        initialResponseOutput: responseOutput,
        baseInput,
        tools,
        metadataId,
        openAiItems,
        parseOptions,
        onAttemptStart: (attempt) => {
            jobStore.emitEvent(jobId, {
                type: "query_executing",
                payload: { jobId, attempt },
            });
        },
        onDataReceived: (rowCount) => {
            jobStore.emitEvent(jobId, {
                type: "data_extracted",
                payload: { jobId, rowCount },
            });
        },
    });

    if (retryResult.earlyReturn) {
        return retryResult.earlyReturn;
    }

    const { executionData, finalArgs, finalCall, finalResponseOutput } = retryResult;
    const { errorResponse } = retryResult;

    if (!executionData) {
        return buildFallbackResult(
            "Nao consegui executar a consulta apos varias tentativas. Pode reformular sua pergunta?",
            FALLBACK_SUGGESTIONS,
            `${finalCall.call_id}-chart-exhausted`,
            openAiItems,
            { errorResponse }
        );
    }

    // ── Build data output for openAiItems ────────────────────────────────────
    const extractDataFunctionCallOutput: OpenAiItem = {
        type: "function_call_output",
        callId: finalCall.call_id,
        output: JSON.stringify(executionData),
    };
    openAiItems.push(extractDataFunctionCallOutput);

    // ── 2. Generate chart config (LLM step 1) ───────────────────────────────
    jobStore.emitEvent(jobId, {
        type: "chart_config_generating",
        payload: { jobId },
    });

    const schema = buildChartSchemaDescription(executionData.cols);

    const configResult = await handleGenerateChartConfig({
        schema,
        baseInput,
        lastResponseOutput: finalResponseOutput,
        extractDataCallOutput: extractDataFunctionCallOutput,
    });
    openAiItems.push(...configResult.openAiItems);

    if (!configResult.success || !configResult.config) {
        logger.error("chart_stage", "Chart config generation failed", {
            reason: configResult.failureReason,
        });
        return buildFallbackResult(
            "Nao consegui gerar a configuração do gráfico. Pode reformular sua pergunta com mais detalhes sobre a visualização desejada?",
            [
                "Quero um gráfico de barras com vendas por mês",
                "Mostre como tabela em vez de gráfico",
                "Especifique o tipo de gráfico que deseja",
            ],
            `${finalCall.call_id}-chart-config-failed`,
            openAiItems,
            { executionData, errorResponse }
        );
    }

    // ── 3. Generate chart HTML (LLM step 2) ──────────────────────────────────
    jobStore.emitEvent(jobId, {
        type: "chart_html_generating",
        payload: { jobId },
    });

    const htmlResult = await handleGenerateChartHtml({
        config: configResult.config,
        baseInput,
        lastResponseOutput: finalResponseOutput,
        extractDataCallOutput: extractDataFunctionCallOutput,
    });
    openAiItems.push(...htmlResult.openAiItems);

    if (!htmlResult.success || !htmlResult.html) {
        logger.error("chart_stage", "Chart HTML generation failed", {
            reason: htmlResult.failureReason,
        });
        // Partial success: return data as TABLE fallback since config worked but HTML failed
        return {
            structuredOutput: {
                action: "EXTRACT_DATA",
                message: finalArgs.message + " (Nao foi possivel gerar o grafico, exibindo como tabela)",
                userMessageSuggestions: finalArgs.userMessageSuggestions,
                renderType: "TABLE",
                query: finalArgs.query,
            },
            openAiItems,
            executionData,
            errorResponse,
        };
    }

    // ── 4. Inject CHART_DATA into HTML ───────────────────────────────────────
    const chartData = transformToChartData(executionData);
    const htmlWithData = injectChartDataIntoHtml(htmlResult.html, chartData);

    // ── Success ──────────────────────────────────────────────────────────────
    return {
        structuredOutput: {
            action: "EXTRACT_DATA",
            message: finalArgs.message,
            userMessageSuggestions: finalArgs.userMessageSuggestions,
            renderType: finalArgs.renderType,
            query: finalArgs.query,
        },
        openAiItems,
        executionData,
        errorResponse,
        chartHtml: htmlWithData,
    };
}
