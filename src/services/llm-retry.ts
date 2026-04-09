import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { callOpenAI } from "./openai-call.js";
import type { OpenAiItem } from "./chat.service.js";

export const MAX_RETRY_ATTEMPTS = 3;

/**
 * Sends an error back to the LLM as a function_call_output and requests a
 * corrected call. Pushes all resulting items (error output, reasoning, new
 * function_call) into openAiItems.
 *
 * Returns { call, responseOutput } with the new call, or null if the LLM
 * returns no function_call.
 */
export async function requestCorrectedCall(params: {
    failedCall: OpenAI.Responses.ResponseFunctionToolCall;
    errorOutput: string;
    currentResponseOutput: unknown[];
    baseInput: ResponseInputItem[];
    tools: OpenAI.Responses.Tool[];
    openAiItems: OpenAiItem[];
}): Promise<{
    call: OpenAI.Responses.ResponseFunctionToolCall;
    responseOutput: unknown[];
} | null> {
    const { failedCall, errorOutput, currentResponseOutput, baseInput, tools, openAiItems } = params;

    openAiItems.push({
        type: "function_call_output",
        callId: failedCall.call_id,
        output: errorOutput,
    });

    const retryInput: ResponseInputItem[] = [
        ...baseInput,
        ...(currentResponseOutput as unknown as ResponseInputItem[]),
        {
            type: "function_call_output",
            call_id: failedCall.call_id,
            output: errorOutput,
        } as ResponseInputItem,
    ];

    const { response, functionCalls, reasoningItems } = await callOpenAI(retryInput, tools);

    for (const item of reasoningItems) {
        openAiItems.push({ type: "reasoning", reasoningItem: item });
    }

    if (functionCalls.length === 0) {
        return null;
    }

    const newCall = functionCalls[0]!;
    openAiItems.push({
        type: "function_call",
        callId: newCall.call_id,
        name: newCall.name,
        arguments: newCall.arguments,
    });

    return { call: newCall, responseOutput: response.output };
}
