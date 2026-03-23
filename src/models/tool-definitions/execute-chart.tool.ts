import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getExecuteChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "execute_chart",
    description: description(
      "Execute a data query ONLY when the request is sufficiently specified.",
      "Call this tool only if you can identify dimensions/measures, required filters, and aggregation intent without guessing.",
      "If any required detail is missing or ambiguous, call ask_followup instead.",
      "The query will be executed by the system and the result will be rendered to the user.",
    ),
    parameters: {
    },
    strict: false,
  };
}
