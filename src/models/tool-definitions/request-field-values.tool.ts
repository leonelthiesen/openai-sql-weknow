import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRequestFieldValuesToolDefinition(): FunctionTool {
    return {
        type: "function",
        name: "request_field_values",
        description: description(
            "Use when user request an output that requires filtering on one or more string/categorical fields.",
            "This allows you to know the exact values in the database and build precise filters, improving accuracy and avoiding mistakes due to guessing.",
            "Use BEFORE extract_data call when needing to build a filter.",
            "Use ONLY when the field is of type string/categorical",
            "Do NOT use for numeric, date/time, or boolean fields.",
            "The user will be asked to approve or deny. If approved, you will receive up to 100 distinct values, the total distinct count, and a truncated flag.",
            "If denied or timeout, you will receive userDenied:true — proceed by inferring the value from context (e.g., LIKE/STARTS_WITH).",
        ),
        parameters: {
            type: "object",
            properties: {
                fieldCompleteName: {
                    type: "string",
                    description: "The completeName of the field whose distinct values are needed. Must exactly match one of the available completeNames.",
                },
                reason: {
                    type: "string",
                    description: "Brief explanation of why the values are needed. E.g.: 'To correctly filter the city, I need to know the exact available values.'",
                },
            },
            required: ["fieldCompleteName", "reason"],
            additionalProperties: false,
        },
        strict: true,
    };
}
