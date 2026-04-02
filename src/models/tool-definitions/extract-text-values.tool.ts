import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getExtractTextValuesToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "extract_text_values",
    description: description(
      "Extract the numeric/textual values that must be used to compose the final user-facing TEXT answer.",
      "Use this tool after extract_data succeeds and data summary/CSV context is available.",
      "Return one or more values as a list.",
      "Values can be primitive or structured objects with label/value/unit.",
      "Do not write the final user message here; only provide values.",
    ),
    parameters: {
      type: "object",
      properties: {
        values: {
          type: "array",
          description: description(
            "List of values that should feed the final message.",
            "Prefer structured entries when labels/units help interpretation.",
          ),
          items: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              {
                type: "object",
                properties: {
                  label: { type: "string" },
                  value: {
                    anyOf: [
                      { type: "string" },
                      { type: "number" },
                      { type: "boolean" },
                      { type: "null" },
                    ],
                  },
                  unit: { type: "string" },
                },
                required: ["value"],
                additionalProperties: false,
              },
            ],
          },
          minItems: 1,
        },
      },
      required: ["values"],
      additionalProperties: false,
    },
    strict: true,
  };
}