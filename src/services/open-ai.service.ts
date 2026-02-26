import OpenAI from "openai";
import { MODEL_INSTRUCTIONS } from "../constants";
import { EasyInputMessage } from "openai/resources/responses/responses";
import JSON_RESPONSE_SCHEMA from "../../data/llm-structured-output-json-schema.json";

const OpenAiModels = {
  gpt4: "gpt-4",
  gpt41Nano: "gpt-4.1-nano-2025-04-14",
  gpt35Turbo: "gpt-3.5-turbo",
  gpt5Nano: "gpt-5-nano-2025-08-07",
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
        strict: false, // Não pode ser strict por causa da propriedade chartConfig que é bastante complexa
        schema: JSON_RESPONSE_SCHEMA,
      },
      verbosity: "medium",
    },
    // temperature: 0.2,
    reasoning: {
      effort: "minimal",
    },
    include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
  });

  return modelResponse;
}
