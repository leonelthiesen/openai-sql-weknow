import type { ParsedToolArgs, ExecuteQueryArgs, AskFollowupArgs, RenderChartArgs } from "../types/tool-args.types";

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
        case "execute_query":
            return parseExecuteQueryArgs(parsed);
        case "ask_followup":
            return parseAskFollowupArgs(parsed);
        case "render_chart_config":
            return parseRenderChartArgs(parsed);
        default:
            throw new ToolValidationError(name, `Unknown tool: ${name}`);
    }
}

function parseExecuteQueryArgs(parsed: any): ExecuteQueryArgs {
    if (!parsed.message || typeof parsed.message !== "string") {
        throw new ToolValidationError("execute_query", "Missing or invalid 'message'");
    }
    if (!parsed.renderType || !["CHART", "TABLE", "TEXT"].includes(parsed.renderType)) {
        throw new ToolValidationError("execute_query", `Invalid renderType: ${parsed.renderType}`);
    }
    if (!parsed.query || typeof parsed.query !== "object") {
        throw new ToolValidationError("execute_query", "Missing 'query' object");
    }
    if (!Array.isArray(parsed.query.columns) || parsed.query.columns.length === 0) {
        throw new ToolValidationError("execute_query", "query.columns must be a non-empty array");
    }

    return {
        toolName: "execute_query",
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

function parseRenderChartArgs(parsed: any): RenderChartArgs {
    if (!parsed.chartConfig || typeof parsed.chartConfig !== "object") {
        throw new ToolValidationError("render_chart_config", "Missing or invalid 'chartConfig'");
    }

    return {
        toolName: "render_chart_config",
        chartConfig: parsed.chartConfig,
    };
}
