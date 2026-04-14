import type { ResponseInputItem } from "openai/resources/responses/responses";
import { logger } from "../../utils/logger";
import { extractResponseText } from "../../utils/extract-response-text";
import type { OpenAiItem } from "../chat.service";
import { callOpenAIForMessage } from "../openai-call";
import { toInputItems } from "../llm-retry";

export interface FinalizeTextMessageResult {
    success: boolean;
    finalMessage?: string;
    openAiItems: OpenAiItem[];
    failureReason?: string;
}

function buildFinalTextDeveloperMessage(): string {
    return [
        "A ferramenta extract_data ja foi executada com sucesso.",
        "Escreva a mensagem final para o usuario em portugues (pt-BR).",
        "Use linguagem simples para usuarios nao tecnicos.",
        "Baseie-se somente no schema de colunas e no CSV de amostra recebido no output da tool.",
        "O CSV de amostra contem os 10 primeiros registros sem ofuscacao.",
        "Se houver poucos itens relevantes, voce pode listar objetivamente.",
        "Se houver muitos itens, sintetize os principais insights.",
        "Nao invente valores.",
        "Se nao houver dados suficientes para responder com seguranca, diga isso de forma objetiva.",
    ].join("\n");
}

export async function handleFinalizeTextMessage(
    baseInput: ResponseInputItem[],
    lastResponseOutput: unknown[],
    extractDataCallOutput: OpenAiItem
): Promise<FinalizeTextMessageResult> {
    const startTime = Date.now();
    const openAiItems: OpenAiItem[] = [];

    if (!extractDataCallOutput.callId || typeof extractDataCallOutput.output !== "string") {
        return {
            success: false,
            openAiItems,
            failureReason: "Missing extract_data output context for TEXT finalization.",
        };
    }

    const finalMessageDeveloperMessage = buildFinalTextDeveloperMessage();
    openAiItems.push({
        type: "message",
        role: "developer",
        content: finalMessageDeveloperMessage,
    });

    const finalInput: ResponseInputItem[] = [
        ...baseInput,
        ...toInputItems(lastResponseOutput),
        {
            type: extractDataCallOutput.type,
            call_id: extractDataCallOutput.callId,
            output: extractDataCallOutput.output,
        } as ResponseInputItem,
        {
            role: "developer",
            content: finalMessageDeveloperMessage,
        } as ResponseInputItem,
    ];

    const finalResponse = await callOpenAIForMessage(finalInput);
    const finalMessage = extractResponseText(finalResponse);

    if (!finalMessage) {
        logger.warn("text_final_message", "No assistant text found in final OpenAI response");
        return {
            success: false,
            openAiItems,
            failureReason: "No final message returned by model.",
        };
    }

    openAiItems.push({
        type: "message",
        role: "assistant",
        content: finalMessage,
    });

    logger.toolResult("text_final_message", {
        success: true,
        durationMs: Date.now() - startTime,
    });

    return {
        success: true,
        finalMessage,
        openAiItems,
    };
}
