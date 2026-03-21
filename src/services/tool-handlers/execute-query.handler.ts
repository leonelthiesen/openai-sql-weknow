import type { ExecuteQueryArgs } from "../../types/tool-args.types";
import type { ToolExecutionResult } from "../../types/tool-result.types";
import type { ExecutionData } from "../chat.service";
import { transformLLMToComponentExecuteInput } from "../../utils/llm-to-weknow-component-execute";
import * as weknowService from "../weknow.service";
import { logger } from "../../utils/logger";

function transformExecuteResult(data: any): ExecutionData {
    let dimensions: string[] = [];
    let source: (string | number | null)[][] = [];
    if (data && data.cols && data.rows) {
        dimensions = data.cols.map((col: any) => col.completeName);
        source = data.rows.map((row: any) => row.cells.map((cell: any) => cell.value));
    }
    return { dimensions, source };
}

/** Non-retriable errors (auth failures, invalid metadata, etc.) */
const NON_RETRIABLE_PATTERNS = [
    /unauthorized/i,
    /forbidden/i,
    /authentication/i,
    /invalid.*token/i,
    /metadata.*not found/i,
];

function isRetriable(errorMessage: string): boolean {
    return !NON_RETRIABLE_PATTERNS.some((pattern) => pattern.test(errorMessage));
}

export async function handleExecuteQuery(
    args: ExecuteQueryArgs,
    metadataId: number
): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const structuredOutput = {
        action: "EXECUTE_QUERY" as const,
        message: args.message,
        renderType: args.renderType,
        query: args.query,
        userMessageSuggestions: args.userMessageSuggestions,
    };

    const executeInput = transformLLMToComponentExecuteInput(structuredOutput, metadataId);
    if (!executeInput) {
        return {
            success: false,
            error: {
                message: "Failed to transform LLM output to execute input",
                retriable: false,
            },
        };
    }

    try {
        const accessToken = await weknowService.getAccessToken();
        executeInput.accessToken = accessToken;
        const executeResult = await weknowService.executeComponent(JSON.stringify(executeInput));
        const executionData = transformExecuteResult(executeResult);

        logger.toolResult("execute_query", {
            success: true,
            durationMs: Date.now() - startTime,
            rowCount: executionData.source.length,
        });

        return { success: true, data: executionData };
    } catch (error: any) {
        const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error);

        logger.toolResult("execute_query", {
            success: false,
            durationMs: Date.now() - startTime,
            error: errorMessage,
        });

        return {
            success: false,
            error: {
                message: errorMessage,
                retriable: isRetriable(errorMessage),
                raw: error,
            },
        };
    }
}
