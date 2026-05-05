import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRequestFieldValuesToolDefinition(): FunctionTool {
    return {
        type: "function",
        name: "request_field_values",
        description: description(
            "Solicita os valores distintos existentes em um campo categórico/texto antes de construir um filtro.",
            "Use SOMENTE quando: (1) o campo é do tipo string/categórico, (2) você não tem certeza do valor exato armazenado, (3) o usuário não forneceu um valor literal exato.",
            "NÃO use para campos numéricos, de data/hora ou booleanos.",
            "O usuário será solicitado a aprovar ou negar. Se aprovado, você receberá até 100 valores distintos, o total de distintos e um flag truncated.",
            "Se negado ou timeout, você receberá userDenied:true — prossiga inferindo o valor a partir do contexto (ex: LIKE/STARTS_WITH).",
        ),
        parameters: {
            type: "object",
            properties: {
                fieldCompleteName: {
                    type: "string",
                    description: "O completeName do campo cujos valores distintos são necessários. Deve corresponder exatamente a um dos completeNames disponíveis.",
                },
                reason: {
                    type: "string",
                    description: "Breve explicação em PORTUGUÊS de por que os valores são necessários. Ex: 'Para filtrar corretamente a cidade, preciso saber os valores exatos disponíveis.'",
                },
            },
            required: ["fieldCompleteName", "reason"],
            additionalProperties: false,
        },
        strict: true,
    };
}
