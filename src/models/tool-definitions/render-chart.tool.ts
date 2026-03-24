import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRenderChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "render_chart_config",
    description: description(
      "Você é um especialista em Apache ECharts. O usuário vai fornecer uma tabela de dados e uma solicitação de visualização. Sua tarefa é gerar SOMENTE um objeto JSON válido com a configuração ECharts (option). ",
      "",
      "Regras OBRIGATÓRIAS:",
      "- REGRA MAIS IMPORTANTE: Todo objeto em 'series' DEVE ter 'id' com o completeName da coluna measure correspondente. Todo eixo (xAxis/yAxis) que usa 'data' DEVE ter 'id' com o completeName da coluna category correspondente. Sem isso, os dados reais NÃO serão exibidos. Exemplos: series: { \"id\": \"vendas.total\", \"name\": \"Total\", \"type\": \"bar\", \"data\": [...] }, xAxis: { \"id\": \"vendas.empresa\", \"type\": \"category\", \"data\": [...] }",
      "- Retorne APENAS a string JSON, sem markdown, sem backticks, sem explicações",
      "- Use os dados da amostra para construir a estrutura (eles serão substituídos pelos reais depois)",
      "- Use os dados fornecidos diretamente na configuração (inline nos series.data, xAxis.data, etc)",
      "- Inclua tooltip, legend quando apropriado",
      "- Use cores modernas e agradáveis",
      "- Adapte o tipo de gráfico ao pedido do usuário",
      "- Se o usuário não especificar o tipo, escolha o mais adequado",
      "- Todos os textos do gráfico devem estar no idioma do usuário",
      "- Garanta que o JSON seja válido e parseável",


      // "Render an Apache ECharts chart configuration to visualize query result data.",
      // "Call this tool only after execute_query has returned data in the conversation context.",
      // "Use the provided result columns and values to build a coherent and readable chart.",
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