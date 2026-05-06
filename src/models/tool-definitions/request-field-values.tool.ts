import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRequestFieldValuesToolDefinition(): FunctionTool {
    return {
        type: "function",
        name: "request_field_values",
        description: description(
            "Returns the distinct values of a field whose fieldType is 'string'.",
            "MANDATORY before extract_data whenever the user's request implies a WHERE filter on a field with fieldType='string' — including implicit filters (e.g., 'internações' implies filtering atendimento_tipo).",
            "Filtering a string field with a guessed value silently returns wrong data; always call this tool first.",
            "Use ONLY for fields with fieldType='string'. Do NOT use for number, date, datetime, or boolean fields.",
            "Do NOT call again for a field whose values were already returned earlier in this conversation.",
            "On approval you receive { fieldCompleteName, values, totalDistinct, truncated } — use '=' or 'IN' with these exact values.",
            "On denial you receive { userDenied: true } — use LIKE/STARTS_WITH with the literal term the user typed; do NOT invent values the user never mentioned.",
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
