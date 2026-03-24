import OpenAI from "openai";
import { MODEL_INSTRUCTIONS } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// const MODEL = "gpt-5-mini-2025-08-07";
const MODEL = "gpt-5.1-codex-mini";

const SHARED_OPTIONS = {
    model: MODEL,
    reasoning: { effort: "low" as const },
    include: ["reasoning.encrypted_content"] as OpenAI.Responses.ResponseIncludable[],
};

export interface OpenAICallResult {
    response: OpenAI.Responses.Response;
    functionCalls: OpenAI.Responses.ResponseFunctionToolCall[];
    reasoningItems: OpenAI.Responses.ResponseOutputItem[];
}

export async function callOpenAI(
    input: ResponseInputItem[],
    tools: OpenAI.Responses.Tool[],
    toolChoice: "required" | "auto" = "required"
): Promise<OpenAICallResult> {
    const response = await openai.responses.create({
        ...SHARED_OPTIONS,
        instructions: MODEL_INSTRUCTIONS,
        input,
        tools,
        tool_choice: toolChoice,
    });

    const functionCalls = extractFunctionCalls(response);
    const reasoningItems = response.output.filter((item) => item.type === "reasoning");

    return { response, functionCalls, reasoningItems };
}

export function extractFunctionCalls(
    response: OpenAI.Responses.Response
): OpenAI.Responses.ResponseFunctionToolCall[] {
    return response.output.filter(
        (item): item is OpenAI.Responses.ResponseFunctionToolCall =>
            item.type === "function_call"
    );
}
