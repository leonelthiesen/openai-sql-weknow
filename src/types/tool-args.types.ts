import type { LLMQuery } from "../models/llm-structured-output.models";

// ── Discriminated union for parsed tool arguments ────────────────────────────

export interface ExtractDataArgs {
    toolName: "extract_data";
    message: string;
    userMessageSuggestions: string[];
    renderType: "CHART" | "TABLE" | "TEXT";
    query: LLMQuery;
}

export interface AskFollowupArgs {
    toolName: "ask_followup";
    message: string;
    userMessageSuggestions: string[];
}

export interface RenderChartArgs {
    toolName: "render_chart_config";
    chartConfig: object;
}

export type ParsedToolArgs = ExtractDataArgs | AskFollowupArgs | RenderChartArgs;
