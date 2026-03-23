import type { LLMQuery } from "../models/llm-structured-output.models";
import type { SimplifiedChartDefinition } from "../models/llm-structured-output.models";

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

export interface DefineChartArgs {
    toolName: "define_chart";
    chartDefinition: SimplifiedChartDefinition;
}

export type ParsedToolArgs = ExtractDataArgs | AskFollowupArgs | DefineChartArgs;
