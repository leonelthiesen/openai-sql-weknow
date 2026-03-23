import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { ToolExecutionResult } from "../../types/tool-result.types";
import type { ExecutionData } from "../chat.service";
import { transformLLMToComponentExecuteInput } from "../../utils/llm-to-weknow-component-execute";
import * as weknowService from "../weknow.service";
import { logger } from "../../utils/logger";

/**
 * Transforma o resultado da API pivot table em ExecutionData.
 * Formato da resposta:
 * - cols[]: { completeName, section } onde section 15=medida, 16=série, 17=categoria
 * - rows[]: { d1, d2, d3, ... } valores posicionais por coluna
 */
function transformExecuteResult(data: any): ExecutionData {
    let dimensions: string[] = [];
    let source: (string | number | null)[][] = [];
    if (data && data.cols && data.rows) {
        dimensions = data.cols.map((col: any) => col.completeName || col.header?.caption || "unknown");
        source = data.rows.map((row: any) =>
            data.cols.map((_: any, i: number) => row[`d${i + 1}`] ?? null)
        );
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

export async function handleExtractData(
    args: ExtractDataArgs,
    metadataId: number
): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    const structuredOutput = {
        action: "EXTRACT_DATA" as const,
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
        const executeResult = await weknowService.executePivotGridComponent(JSON.stringify(executeInput));
        const executionData = transformExecuteResult(executeResult);

        logger.toolResult("extract_data", {
            success: true,
            durationMs: Date.now() - startTime,
            rowCount: executionData.source.length,
        });

        return { success: true, data: executionData };
    } catch (error: any) {
        console.error("Error in handleExtractData:", JSON.stringify(error));
        const errorMessage = error?.message || error?.toString?.() || JSON.stringify(error);

        logger.toolResult("extract_data", {
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
