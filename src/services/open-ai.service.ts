import OpenAI from "openai";
import { MODEL_INSTRUCTIONS, type OpenAIResponseSchema } from "../constants";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import TOOL_DEFINITIONS from "../../data/llm-tool-definitions.json";

const OpenAiModels = {
  gpt4: "gpt-4",
  gpt41Nano: "gpt-4.1-nano-2025-04-14",
  gpt35Turbo: "gpt-3.5-turbo",
  gpt5Nano: "gpt-5-nano-2025-08-07",
  gpt5Mini: "gpt-5-mini-2025-08-07",
} as const;

export interface ToolCallResult {
  structuredOutput: OpenAIResponseSchema;
  toolCallId: string;
  toolCallName: string;
  toolCallArguments: string;
}

export async function createModelResponse(
  input: ResponseInputItem[]
): Promise<ToolCallResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const modelResponse = await openai.responses.create({
    model: OpenAiModels.gpt5Mini,
    instructions: MODEL_INSTRUCTIONS,
    input: input,
    tools: TOOL_DEFINITIONS as OpenAI.Responses.Tool[],
    tool_choice: "required",
    reasoning: {
      effort: "minimal",
    },
    include: ["reasoning.encrypted_content"],
  });

  console.log("LLM Response:", JSON.stringify(modelResponse.output, null, 2));

  return parseToolCallResponse(modelResponse);
}

function parseToolCallResponse(modelResponse: OpenAI.Responses.Response): ToolCallResult {
  const functionCall = modelResponse.output.find(
    (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call"
  );

  if (!functionCall) {
    throw new Error("Model did not return a function call.");
  }

  const args = JSON.parse(functionCall.arguments);

  let structuredOutput: OpenAIResponseSchema;

  if (functionCall.name === "execute_query") {
    structuredOutput = {
      action: "EXECUTE_QUERY",
      message: args.message,
      userMessageSuggestions: args.userMessageSuggestions,
      renderType: args.renderType,
      query: args.query,
      chartConfig: args.chartConfig,
    };
  } else {
    structuredOutput = {
      action: "FOLLOWUP_NEEDED",
      message: args.message,
      userMessageSuggestions: args.userMessageSuggestions,
    };
  }

  return {
    structuredOutput,
    toolCallId: functionCall.call_id,
    toolCallName: functionCall.name,
    toolCallArguments: functionCall.arguments,
  };
}
