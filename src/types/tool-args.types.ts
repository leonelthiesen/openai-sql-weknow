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

export type TextValuePrimitive = string | number | boolean;

export interface TextValueObject {
    label?: string;
    value: TextValuePrimitive | null;
    unit?: string;
}

export type TextValueItem = TextValuePrimitive | TextValueObject;

export interface ExtractTextValuesArgs {
    toolName: "extract_text_values";
    values: TextValueItem[];
}

export interface RequestFieldValuesArgs {
    toolName: "request_field_values";
    fieldCompleteName: string;
    reason: string;
}

export type ParsedToolArgs =
    | ExtractDataArgs
    | AskFollowupArgs
    | ExtractTextValuesArgs
    | RequestFieldValuesArgs;
