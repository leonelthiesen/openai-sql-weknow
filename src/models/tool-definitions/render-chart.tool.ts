import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRenderChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "render_chart_config",
    description: description(
      "You are an Apache ECharts expert. The user will provide a data table and a visualization request. Your task is to generate ONLY a valid JSON object with the ECharts configuration (option).",
      "",
      "MANDATORY rules:",
      "- Create EXACTLY the number of series specified in the developer message, in the indicated order",
      "- DO NOT define 'id' in series or axis objects - IDs are managed automatically",
      "- Available data must be used, but it will be replaced by real data later",
      "- Return ONLY the JSON string, with no markdown, no backticks, and no explanations",
      "- Include tooltip and legend when appropriate",
      "- Use modern and visually pleasing colors",
      "- Adapt the chart type to the user's request",
      "- If the user does not specify the type, choose the most appropriate one",
      "- All chart text must be in the user's language",
      "- Ensure the JSON is valid and parseable",
    ),
    parameters: {
      type: "object",
      properties: {
        chartConfig: {
          type: "string",
          description: "JSON string representing the full chart configuration",
          additionalProperties: false,
        },
      },
      required: ["chartConfig"],
      additionalProperties: false,
    },
    strict: true,
  };
}