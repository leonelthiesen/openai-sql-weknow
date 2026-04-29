import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { OpenAiItem } from "../../services/chat.service";
import type { PivotGridResponse } from "../../types/pivot-grid-response.types";
import type { StageResult } from "./table-stage";
import { executeExtractDataWithRetry, MAX_RETRY_ATTEMPTS } from "./extract-data-shared";
import { handleAskFollowup } from "../../services/tool-handlers/ask-followup.handler";
import { handleGenerateChartConfig, type GenerateChartConfigResult } from "../../services/tool-handlers/generate-chart-config.handler";
import { buildChartSchemaDescription } from "../../utils/build-chart-schema-description";
import { toEChartsDataset } from "../../utils/to-echarts-dataset";
import { buildEchartsOption } from "../../utils/build-echarts-option";
import { buildVegaLiteSpec } from "../../utils/build-vega-lite-spec";
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

function getInvalidConfigFields(config: { encodings: Record<string, { field: string } | null | undefined> }, validNames: Set<string>): string[] {
    return Object.values(config.encodings)
        .filter((enc): enc is NonNullable<typeof enc> => enc != null)
        .map((enc) => enc.field)
        .filter((f) => !validNames.has(f));
}

export async function runChartStage(params: ChartStageParams): Promise<StageResult> {
    const {
        jobId, parsedCall, parsedArgs, responseOutput, baseInput,
        tools, metadataId, openAiItems, parseOptions,
    } = params;

    // ── 1. Execute query with retry (skip pivot — toEChartsDataset handles it) ─
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

    const shareData = false;
    let outputMessage = `Query executed successfully. The result has ${executionData.rows.length} rows and ${executionData.cols.length} columns.`;
    if (shareData) {
        outputMessage += " Here are the first 5 rows of data: " + JSON.stringify(executionData.rows.slice(0, 5));
    }

    // ── Build data output for openAiItems ────────────────────────────────────
    const extractDataFunctionCallOutput: OpenAiItem = {
        type: "function_call_output",
        callId: finalCall.call_id,
        output: outputMessage,
    };
    openAiItems.push(extractDataFunctionCallOutput);

    // ── 2. Generate chart config (LLM step) — validate fields, retry on bad fields ─
    jobStore.emitEvent(jobId, {
        type: "chart_config_generating",
        payload: { jobId },
    });

    const schema = buildChartSchemaDescription(executionData.cols);
    const validFieldNames = new Set(
        executionData.cols
            .filter(col => col.visible !== false && !!col.completeName)
            .map(col => col.completeName),
    );

    let configResult: GenerateChartConfigResult | undefined;
    let retryHint: string | undefined;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        const result = await handleGenerateChartConfig({
            schema,
            baseInput,
            lastResponseOutput: finalResponseOutput,
            extractDataCallOutput: extractDataFunctionCallOutput,
            retryHint,
        });
        openAiItems.push(...result.openAiItems);
        configResult = result;

        if (!result.success || !result.config) break;

        const invalid = getInvalidConfigFields(result.config, validFieldNames);
        if (invalid.length === 0) break;

        logger.warn("chart_stage", `Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}: chart config has invalid fields`, {
            invalidFields: invalid,
            validFields: [...validFieldNames],
        });

        if (attempt >= MAX_RETRY_ATTEMPTS) break;

        retryHint =
            `CORRECTION: The previous config used fields that do not exist in the data: ${invalid.join(", ")}. ` +
            `Valid fields are: ${[...validFieldNames].join(", ")}. Use only these field names exactly as written.`;
    }

    if (!configResult?.success || !configResult.config) {
        logger.error("chart_stage", "Chart config generation failed", {
            reason: configResult?.failureReason,
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

    const invalidAfterRetry = getInvalidConfigFields(configResult.config, validFieldNames);
    if (invalidAfterRetry.length > 0) {
        logger.error("chart_stage", "Chart config still has invalid fields after all retries", {
            invalidFields: invalidAfterRetry,
        });
        return buildFallbackResult(
            "A configuração do gráfico referencia campos que não existem nos dados. Pode reformular sua pergunta com mais detalhes sobre a visualização desejada?",
            [
                "Quero um gráfico de barras com vendas por mês",
                "Mostre como tabela em vez de gráfico",
                "Especifique o tipo de gráfico que deseja",
            ],
            `${finalCall.call_id}-chart-config-invalid-fields`,
            openAiItems,
            { executionData, errorResponse }
        );
    }

    // ── 3. Transform data into ECharts dataset (deterministic) ───────────────
    const datasetResult = toEChartsDataset(executionData.cols, executionData.rows, {
        axisDim: configResult.config.encodings.x?.field,
        chartType: configResult.config.chart_type,
    });

    // ── 4. Build ECharts option (deterministic) ──────────────────────────────
    const echartsOption = buildEchartsOption(datasetResult, configResult.config);

    // ── 5. Build Vega-Lite spec ──────────────────────────────────────────────
    const vegaLiteSpec = buildVegaLiteSpec(configResult.config, datasetResult);

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
        datasetResult,
        errorResponse,
        chartEchartsOption: echartsOption,
        chartVegaLiteSpec: vegaLiteSpec,
    };
}
