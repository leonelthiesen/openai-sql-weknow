import type { ResponseInputItem } from "openai/resources/responses/responses";
import type { OpenAiItem } from "./chat.service";
import type { OpenAIResponseSchema } from "../constants";
import { callOpenAIForMessage } from "./openai-call";
import { logger } from "../utils/logger";
import { extractResponseText } from "../utils/extract-response-text";
import { PivotGridResponse } from "../types/pivot-grid-response.types";

export interface ToolCallResult {
    structuredOutput: OpenAIResponseSchema;
    openAiItems: OpenAiItem[];
    executionData?: PivotGridResponse;
    errorResponse?: string | Object;
}

// ── Conversation name suggestion ─────────────────────────────────────────────

function sanitizeConversationName(text: string): string {
    return text
        .replace(/[\r\n\t]+/g, " ")
        .replace(/^['"\s]+|['"\s]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
        .slice(0, 60);
}

export async function generateConversationNameSuggestion(
    userTextMessage: string
): Promise<string | undefined> {
    try {
        const prompt = [
            "Sugira um nome curto para a conversa em portugues (pt-BR).",
            "Regras:",
            "- Retorne somente o nome, sem aspas e sem pontuacao final.",
            "- Maximo de 6 palavras.",
            "- Seja especifico ao assunto principal da pergunta do usuario.",
            `Pergunta do usuario: ${userTextMessage}`,
        ].join("\n");

        const response = await callOpenAIForMessage([
            {
                role: "developer",
                content: prompt,
            } as ResponseInputItem,
        ]);

        const rawSuggestion = extractResponseText(response);
        if (!rawSuggestion) return undefined;

        const suggestion = sanitizeConversationName(rawSuggestion);
        return suggestion || undefined;
    } catch (error) {
        logger.warn("conversation_name", "Failed to generate conversation name suggestion", {
            error: String(error),
        });
        return undefined;
    }
}
