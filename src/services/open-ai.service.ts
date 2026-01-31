import OpenAI from "openai";
import { JSON_RESPONSE_SCHEMA, MODEL_INSTRUCTIONS } from "../constants";
import { EasyInputMessage } from "openai/resources/responses/responses";

const OpenAiModels = {
  gpt4: "gpt-4",
  gpt35Turbo: "gpt-3.5-turbo",
  gpt5Mini: "gpt-5-mini-2025-08-07",
} as const;

export async function createModelResponse(
  input: EasyInputMessage[]
) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const modelResponse = await openai.responses.create({
    model: OpenAiModels.gpt5Mini,
    instructions: MODEL_INSTRUCTIONS,
    input: input,
    text: {
      format: {
        type: "json_schema",
        name: "execution_response",
        strict: true,
        schema: JSON_RESPONSE_SCHEMA,
      },
      verbosity: "medium",
    },
    reasoning: {
      effort: "minimal",
    },
    include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
  });

  return modelResponse;
}
