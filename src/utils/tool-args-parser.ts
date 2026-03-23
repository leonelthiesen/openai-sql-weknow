import type { ParsedToolArgs, ExtractDataArgs, AskFollowupArgs, DefineChartArgs } from "../types/tool-args.types";

export class ToolValidationError extends Error {
    constructor(
        public readonly toolName: string,
        message: string
    ) {
        super(`[${toolName}] ${message}`);
        this.name = "ToolValidationError";
    }
}

export function parseToolArgs(name: string, rawArguments: string): ParsedToolArgs {
    let parsed: any;
    try {
        parsed = JSON.parse(rawArguments);
    } catch {
        throw new ToolValidationError(name, `Invalid JSON in tool arguments: ${rawArguments.slice(0, 200)}`);
    }

    switch (name) {
        case "extract_data":
            return parseExtractDataArgs(parsed);
        case "ask_followup":
            return parseAskFollowupArgs(parsed);
        case "define_chart":
            return parseDefineChartArgs(parsed);
        default:
            throw new ToolValidationError(name, `Unknown tool: ${name}`);
    }
}

function parseExtractDataArgs(parsed: any): ExtractDataArgs {
    if (!parsed.message || typeof parsed.message !== "string") {
        throw new ToolValidationError("extract_data", "Missing or invalid 'message'");
    }
    if (!parsed.renderType || !["CHART", "TABLE", "TEXT"].includes(parsed.renderType)) {
        throw new ToolValidationError("extract_data", `Invalid renderType: ${parsed.renderType}`);
    }
    if (!parsed.query || typeof parsed.query !== "object") {
        throw new ToolValidationError("extract_data", "Missing 'query' object");
    }
    if (!Array.isArray(parsed.query.measures) || parsed.query.measures.length === 0) {
        throw new ToolValidationError("extract_data", "query.measures must be a non-empty array");
    }

    return {
        toolName: "extract_data",
        message: parsed.message,
        userMessageSuggestions: parsed.userMessageSuggestions ?? [],
        renderType: parsed.renderType,
        query: parsed.query,
    };
}

function parseAskFollowupArgs(parsed: any): AskFollowupArgs {
    if (!parsed.message || typeof parsed.message !== "string") {
        throw new ToolValidationError("ask_followup", "Missing or invalid 'message'");
    }

    return {
        toolName: "ask_followup",
        message: parsed.message,
        userMessageSuggestions: parsed.userMessageSuggestions ?? [],
    };
}

function parseDefineChartArgs(parsed: any): DefineChartArgs {
    if (!parsed.chartType || typeof parsed.chartType !== "string") {
        throw new ToolValidationError("define_chart", "Missing or invalid 'chartType'");
    }
    if (!parsed.categoryField || typeof parsed.categoryField !== "string") {
        throw new ToolValidationError("define_chart", "Missing or invalid 'categoryField'");
    }
    if (!Array.isArray(parsed.series) || parsed.series.length === 0) {
        throw new ToolValidationError("define_chart", "series must be a non-empty array");
    }

    return {
        toolName: "define_chart",
        chartDefinition: parsed,
    };
}
