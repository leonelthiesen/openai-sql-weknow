import type OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { callOpenAI } from "./openai-call";
import type { OpenAiItem } from "./chat.service";

export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Casts response output items to input items. The OpenAI SDK types
 * response output and input items differently, but the API accepts
 * output items as input when replaying a conversation.
 */
export function toInputItems(output: unknown[]): ResponseInputItem[] {
    return output as unknown as ResponseInputItem[];
}

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
        ...toInputItems(currentResponseOutput),
        {
            type: "function_call_output",
            call_id: failedCall.call_id,
            output: errorOutput,
        } as ResponseInputItem,
    ];

    const { response, functionCalls } = await callOpenAI(retryInput, tools);

    for (const item of response.output.filter((item) => item.type === "reasoning")) {
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
