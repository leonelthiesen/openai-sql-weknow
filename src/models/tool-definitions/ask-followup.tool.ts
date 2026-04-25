import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getAskFollowupToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "ask_followup",
    description: description(
      "Ask the user for clarification when the user request is ambiguous or missing required details.",
      "Use this tool when required filters, date ranges, grouping level, or metric intent are missing.",
      "Call this instead of guessing or silently assuming defaults that change query meaning.",
      "Ask one focused clarification at a time and provide actionable suggestion options.",
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message in PORTUGUESE explaining exactly which information is missing.",
            "Provide short examples the user can copy or adapt.",
            "Keep suggestions only in userMessageSuggestions aligned with the message and focused on unblocking execution.",
            "Use Markdown.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List of concrete follow-up user suggestions in PORTUGUESE that unblock execution.",
            "Keep suggestions short, specific, and directly actionable.",
          ),
          items: { type: "string" },
        },
      },
      required: ["message", "userMessageSuggestions"],
      additionalProperties: false,
    },
    strict: true,
  };
}
