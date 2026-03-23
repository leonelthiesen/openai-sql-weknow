import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getDefineOutputFormatToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "define_output_format",
    description: description(
      "Define the output format for the final answer to the user.",
      "Use this tool at the beginning of the conversation when the user has a specific format requirement for the answer (for example, a JSON structure, a specific chart type, or a particular textual layout).",
      "If the user does not have specific format requirements, do not call this tool and provide the answer in a clear and readable format using Markdown.",
    ),
    parameters: {
        renderType: {
          type: "string",
          description: description(
            "Determines the type of the output format the user wants.",
            "Choose using this policy: CHART when the user explicitly asks for a chart/graph or when visual comparison is the clearest answer;",
            "TABLE when row-level detail, listing, or comparisons across many records are needed;",
            "TEXT ONLY when the result is a single scalar summary (for example, one KPI value).",
            "If unclear, default to TABLE."
          ),
          enum: ["CHART", "TABLE", "TEXT"],
        },
    },
    strict: false,
  };
}
