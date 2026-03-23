import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getRenderChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "render_chart_config",
    description: description(
      "Render an Apache ECharts chart configuration to visualize query result data.",
      "Call this tool only after execute_query has returned data in the conversation context.",
      "Use the provided result columns and values to build a coherent and readable chart.",
    ),
    parameters: {
      type: "object",
      properties: {
        chartConfig: {
          type: "object",
          description: description(
            "Apache ECharts configuration object.",
            "Must include 'dataset' with 'dimensions' and 'source' mapped from the query result.",
            "Use friendly Portuguese titles/legends (e.g., 'DATA_EMISSAO' → 'Data de Emissão').",
            "Position legends below or beside the chart.",
            "Chart title must have padding so it does not stick to the chart (e.g., padding: [10, 0, 30, 0]).",
            "Axis titles should be centered and vertical where applicable.",
            "Prefer readable defaults over excessive styling.",
          ),
          properties: {
            title: {
              type: "object",
              additionalProperties: true
            },
            dataset: {
              type: "object",
              additionalProperties: true
            },
            xAxis: {
              type: "object",
              additionalProperties: true
            },
            yAxis: {
              type: "object",
              additionalProperties: true
            },
            series: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true
              }
            },
            legend: {
              type: "object",
              additionalProperties: true
            },
            tooltip: {
              type: "object",
              additionalProperties: true
            },
            grid: {
              type: "object",
              additionalProperties: true
            },
          },
          required: ["dataset", "series"],
          additionalProperties: true,
        },
      },
      required: ["chartConfig"],
      additionalProperties: false,
    },
    strict: false,
  };
}