import type { OpenAIResponseSchema } from "../constants";
import type { OpenAiItem } from "../services/chat.service";
import type { PivotGridResponse } from "../types/pivot-grid-response.types";
import type { EChartsDatasetResult } from "../utils/to-echarts-dataset";

// ── Job status ───────────────────────────────────────────────────────────────

export type JobStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

// ── SSE event types ──────────────────────────────────────────────────────────

export type PipelineEventType =
    | "job_created"
    | "llm_call_started"
    | "tool_selected"
    | "query_executing"
    | "data_extracted"
    | "text_finalizing"
    | "chart_config_generating"
    | "chart_option_generating"
    | "completed"
    | "failed";

// ── Event payloads ───────────────────────────────────────────────────────────

export interface JobCreatedPayload {
    jobId: string;
    conversationId: string;
}

export interface LlmCallStartedPayload {
    jobId: string;
}

export interface ToolSelectedPayload {
    jobId: string;
    tool: string;
    renderType?: "CHART" | "TABLE" | "TEXT";
}

export interface QueryExecutingPayload {
    jobId: string;
    attempt: number;
}

export interface DataExtractedPayload {
    jobId: string;
    rowCount: number;
}

export interface TextFinalizingPayload {
    jobId: string;
}

export interface ChartConfigGeneratingPayload {
    jobId: string;
}

export interface ChartOptionGeneratingPayload {
    jobId: string;
}

export interface CompletedPayload {
    jobId: string;
    result: JobResult;
}

export interface FailedPayload {
    jobId: string;
    error: string;
}

export type PipelineEventPayload =
    | JobCreatedPayload
    | LlmCallStartedPayload
    | ToolSelectedPayload
    | QueryExecutingPayload
    | DataExtractedPayload
    | TextFinalizingPayload
    | ChartConfigGeneratingPayload
    | ChartOptionGeneratingPayload
    | CompletedPayload
    | FailedPayload;

// ── Pipeline event (typed discriminated union) ───────────────────────────────

export type PipelineEvent =
    | { type: "job_created"; payload: JobCreatedPayload }
    | { type: "llm_call_started"; payload: LlmCallStartedPayload }
    | { type: "tool_selected"; payload: ToolSelectedPayload }
    | { type: "query_executing"; payload: QueryExecutingPayload }
    | { type: "data_extracted"; payload: DataExtractedPayload }
    | { type: "text_finalizing"; payload: TextFinalizingPayload }
    | { type: "chart_config_generating"; payload: ChartConfigGeneratingPayload }
    | { type: "chart_option_generating"; payload: ChartOptionGeneratingPayload }
    | { type: "completed"; payload: CompletedPayload }
    | { type: "failed"; payload: FailedPayload };

// ── Job result (final output) ────────────────────────────────────────────────

export interface JobResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: PivotGridResponse;
    datasetResult?: EChartsDatasetResult;
    errorResponse?: string | Object;
    chartEchartsOption?: Record<string, unknown>;
    chartVegaLiteSpec?: Record<string, unknown>;
    userMessageId: string;
    assistantMessageId: string;
}
