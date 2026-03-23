import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getDefineChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "define_chart",
    description: description(
      "Define the chart visualization configuration.",
      "Call this tool ONLY when extract_data was called with renderType 'CHART'.",
      "The categoryField must reference one of the categoryDimensions completeName values from extract_data.",
      "Each series.field must reference one of the measures completeName values from extract_data.",
      "All text shown to user should be in PORTUGUESE.",
    ),
    parameters: {
      type: "object",
      properties: {
        chartType: {
          type: "string",
          enum: ["bar", "line", "area", "pie"],
          description: "Main chart type.",
        },
        categoryField: {
          type: "string",
          description: description(
            "The completeName of the categoryDimension to use as the category axis (X axis) or pie labels.",
            "Must match a completeName from categoryDimensions.",
          ),
        },
        title: {
          type: "string",
          description: "Chart title in PORTUGUESE.",
        },
        legend: {
          type: "object",
          properties: {
            position: {
              type: "string",
              enum: ["bottom", "right", "top", "left", "none"],
            },
          },
          required: ["position"],
          additionalProperties: false,
        },
        tooltip: {
          type: "object",
          properties: {
            formatterFunction: {
              type: "string",
              description: "ECharts tooltip formatter in function format only, e.g. function (params) { return params[0].name; }",
            },
          },
          additionalProperties: false,
        },
        series: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                description: description(
                  "The completeName of the measure to plot as the Y value for this series.",
                  "Must match a completeName from measures.",
                ),
              },
              name: {
                type: "string",
                description: "Series display name in PORTUGUESE.",
              },
              seriesType: {
                type: "string",
                enum: ["bar", "line", "area"],
                description: "Per-series override type.",
              },
              yAxisIndex: {
                type: "number",
                description: "Axis index used by this series (0, 1, ...).",
              },
              stackGroup: {
                type: "number",
                description: "Optional stack group id.",
              },
              color: {
                type: "string",
              },
              showLabels: {
                type: "boolean",
              },
              labelFormatterFunction: {
                type: "string",
                description: "ECharts label formatter in function format only, e.g. function (params) { return params.value; }",
              },
            },
            required: ["field", "name"],
            additionalProperties: false,
          },
        },
        axes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: {
                type: "number",
              },
              name: {
                type: "string",
              },
              position: {
                type: "string",
                enum: ["left", "right"],
              },
              format: {
                type: "string",
                enum: ["number", "currency", "percent"],
              },
              formatterFunction: {
                type: "string",
                description: "ECharts axis label formatter in function format only, e.g. function (value) { return value + '%'; }",
              },
              currencySymbol: {
                type: "string",
              },
              decimals: {
                type: "number",
              },
              min: {
                type: "number",
              },
              max: {
                type: "number",
              },
            },
            required: ["index"],
            additionalProperties: false,
          },
        },
      },
      required: ["chartType", "categoryField", "series"],
      additionalProperties: false,
    },
    strict: false,
  };
}
