import type { ExtractDataArgs } from "../../types/tool-args.types";
import type { ToolExecutionResult } from "../../types/tool-result.types";
import { transformLLMToComponentExecuteInput } from "../../utils/llm-to-weknow-component-execute";
import * as weknowService from "../weknow.service";
import { logger } from "../../utils/logger";


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
        const response = await weknowService.executePivotGridComponent(JSON.stringify(executeInput));

        logger.toolResult("extract_data", {
            success: true,
            durationMs: Date.now() - startTime,
            rowCount: response.rows ? response.rows.length : 0,
        });

        return { success: true, data: response };
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
