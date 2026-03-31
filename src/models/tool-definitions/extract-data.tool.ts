import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getExtractDataToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "extract_data",
    description: description(
      "Extract and render data when the request is sufficiently specified.",
      "The result is rendered as a chart with spreadsheet, a standalone spreadsheet, or a text summary depending on renderType.",
      "Call this tool only if you can identify dimensions, measures, required filters, and aggregation intent without guessing.",
      "If any required detail is missing or ambiguous, call ask_followup instead.",
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message contextualizing the response in PORTUGUESE.",
            "Use Markdown.",
            "The data will be rendered separately right after this message.",
            "Keep suggestions in userMessageSuggestions aligned with the message.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List of suggestions for follow-up prompts, next actions, or analyses in PORTUGUESE.",
          ),
          items: { type: "string" },
        },
        renderType: {
          type: "string",
          description: description(
            "Determines how the query result data should be rendered.",
            "Choose using this policy: CHART when the user explicitly asks for a chart/graph or when visual comparison is the clearest answer;",
            "TABLE when row-level detail, listing, or comparisons across many records are needed;",
            "TEXT ONLY when the result is a single scalar summary (for example, one KPI value).",
            "If unclear, default to TABLE."
          ),
          enum: ["CHART", "TABLE", "TEXT"],
        },
        query: {
          type: "object",
          description: description(
            "Query definitions: calculated fields, series dimensions, category dimensions, measures, sorting, pre-aggregation filters (WHERE), and post-aggregation filters (HAVING).",
            "This query will not be shown to the user.",
            "The data will be rendered separately right after your message.",
            "When using recsMax for top/limit behavior, include a deterministic categorySort to avoid unstable results."
          ),
          properties: {
            calculatedFields: {
              type: "array",
              description: description(
                "List of calculated fields (ANSI SQL expressions) that can be defined and used in",
                "seriesDimensions, categoryDimensions, measures, sorting, filters, and havingFilters.",
                "A calculated field is effective only when referenced by its 'completeName' in those properties.",
                "Use calculated fields when direct fields from the virtual table are not sufficient.",
                "If a referenced calculated field has hasAggregateFunction=true, always set the reference aggregateFunction to NONE.",
                "Set hasAggregateFunction explicitly to avoid misinterpretation."
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Create a unique name always starting with 'cf_' and using only",
                      "lowercase letters and '_'.",
                    ),
                  },
                  dataType: { $ref: "#/$defs/TCalculatedFieldType" },
                  formula: {
                    type: "string",
                    description: description(
                      "ANSI SQL expression that can contain aggregation functions (SUM, COUNT, AVG, etc.).",
                      "Provided fields can be referenced by the 'completeName' between '%', for example: '%$completeName%'.",
                      "Only use provided fields directly in the formula; do not reference another calculated field here.",
                    ),
                  },
                  hasAggregateFunction: {
                    type: "boolean",
                    description: description(
                      "Set to true if the formula contains an aggregation function",
                      "(SUM, COUNT, AVG, MIN, MAX, etc.).",
                    ),
                  },
                  title: {
                    type: "string",
                    description: "Friendly title in PORTUGUESE for display",
                  },
                },
                required: [
                  "completeName",
                  "dataType",
                  "formula",
                  "hasAggregateFunction",
                ],
                additionalProperties: false,
              },
            },
            seriesDimensions: {
              type: "array",
              description: description(
                "Dimensions that create separate series in charts or column headers in pivot tables.",
                "In a CHART, each unique value in these fields generates a separate series (e.g., one bar group or one line per value).",
                "In a TABLE, these become column-level groupings (pivot columns).",
                "Optional — omit when no cross-tabulation or multi-series breakdown is needed.",
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use only the 'completeName' from the provided fields or 'completeName' of calculated fields.",
                    ),
                  },
                  title: {
                    type: "string",
                    description: "Friendly title in PORTUGUESE for display purposes.",
                  },
                },
                required: ["completeName", "title"],
                additionalProperties: false,
              },
            },
            seriesSort: {
              type: "array",
              description: description(
                "Sorting applied to seriesDimensions.",
                "Use when the user requests a specific order for the series/columns.",
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: "completeName of a seriesDimension or measure field.",
                  },
                  direction: { $ref: "#/$defs/TSortDirection" },
                  aggregateFunction: { $ref: "#/$defs/TAggregateFunction" },
                },
                required: ["completeName", "direction", "aggregateFunction"],
                additionalProperties: false,
              },
            },
            categoryDimensions: {
              type: "array",
              minItems: 1,
              description: description(
                "Dimensions that define the categories (labels) on the X axis in charts or row headers in pivot tables.",
                "In a CHART, these values appear as tick labels along the category axis.",
                "In a TABLE, these become row-level groupings.",
                "At least one categoryDimension or seriesDimension should be provided alongside measures.",
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use only the 'completeName' from the provided fields or 'completeName' of calculated fields.",
                    ),
                  },
                  title: {
                    type: "string",
                    description: "Friendly title in PORTUGUESE for display purposes.",
                  },
                },
                required: ["completeName", "title"],
                additionalProperties: false,
              },
            },
            categorySort: {
              type: "array",
              description: description(
                "Sorting applied to categoryDimensions.",
                "Use when the user requests a specific order for categories/rows, or for top-N with deterministic results.",
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: "completeName of a categoryDimension or measure field.",
                  },
                  direction: { $ref: "#/$defs/TSortDirection" },
                  aggregateFunction: { $ref: "#/$defs/TAggregateFunction" },
                },
                required: ["completeName", "direction", "aggregateFunction"],
                additionalProperties: false,
              },
            },
            measures: {
              type: "array",
              minItems: 1,
              description: description(
                "Numeric values to aggregate and display.",
                "In a CHART, each measure becomes a plotted series (bar, line, area). When combined with seriesDimensions, total series = unique seriesDimension values x number of measures.",
                "In a TABLE, measures become the aggregated value cells in the pivot.",
                "In TEXT mode, typically a single measure produces a scalar KPI value.",
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use only the 'completeName' from the provided fields or 'completeName' of calculated fields.",
                    ),
                  },
                  aggregateFunction: {
                     description: "When referencing a calculated field with hasAggregateFunction=true, set aggregateFunction to NONE.",
                    $ref: "#/$defs/TAggregateFunction"
                  },
                  title: {
                    type: "string",
                    description: "Friendly title in PORTUGUESE for display purposes.",
                  },
                },
                required: ["completeName", "aggregateFunction", "title"],
                additionalProperties: false,
              },
            },
            filters: { $ref: "#/$defs/TWhereFilters" },
            havingFilters: { $ref: "#/$defs/THavingFilters" },
            recsMax: {
              type: "number",
              description: description(
                "Maximum number of records to return.",
                "Use this when the user requests a limit/top N.",
                "When recsMax is used, also provide categorySort so the top/limit is deterministic.",
              )
            },
          },
          required: ["measures"],
          additionalProperties: false,
        },
      },
      required: ["message", "userMessageSuggestions", "renderType", "query"],
      additionalProperties: false,
      $defs: {
        TAggregateFunction: {
          type: "string",
          description: description(
            "Enum for SQL-like aggregation functions.",
            "Use NONE when referencing a calculated field with hasAggregateFunction=true.",
          ),
          enum: ["NONE", "COUNT", "COUNT_DISTINCT", "SUM", "MAX", "MIN", "AVG", "LIST", "LIST_DISTINCT", "SUM_DISTINCT", "AVG_DISTINCT"],
          oneOf: [
            { const: "NONE", title: "NONE", description: "No aggregation function" },
            { const: "COUNT", title: "COUNT", description: "Count function" },
            { const: "COUNT_DISTINCT", title: "COUNT_DISTINCT", description: "Distinct count function" },
            { const: "SUM", title: "SUM", description: "Sum function" },
            { const: "MAX", title: "MAX", description: "Max function" },
            { const: "MIN", title: "MIN", description: "Min function" },
            { const: "AVG", title: "AVG", description: "Average function" },
            { const: "LIST", title: "LIST", description: "List function" },
            { const: "LIST_DISTINCT", title: "LIST_DISTINCT", description: "Distinct list function" },
            { const: "SUM_DISTINCT", title: "SUM_DISTINCT", description: "Distinct sum function" },
            { const: "AVG_DISTINCT", title: "AVG_DISTINCT", description: "Distinct average function" },
          ],
        },
        TSortDirection: {
          type: "number",
          description: "Enum for sort direction",
          enum: [0, 1, 2],
          oneOf: [
            { const: 0, title: "sdAsc", description: "Ascending order" },
            { const: 1, title: "sdDesc", description: "Descending order" },
            { const: 2, title: "sdNone", description: "No sorting" },
          ],
        },
        TBooleanOperator: {
          type: "number",
          description: "Enum for boolean operators",
          enum: [0, 1],
          oneOf: [
            { const: 0, title: "boAnd", description: "AND boolean operator" },
            { const: 1, title: "boOr", description: "OR boolean operator" },
          ],
        },
        TComparisonOperator: {
          type: "number",
          description: "Enum for comparison operators",
          enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          oneOf: [
            { const: 0, title: "coLike", description: "LIKE operator" },
            { const: 1, title: "coEqual", description: "Equals operator (=)" },
            { const: 2, title: "coDifferent", description: "Not equals operator (!=)" },
            { const: 3, title: "coBiggerThan", description: "Greater than operator (>)" },
            { const: 4, title: "coBiggerOrEqualThan", description: "Greater than or equal operator (>=)" },
            { const: 5, title: "coLowerThan", description: "Less than operator (<)" },
            { const: 6, title: "coLowerOrEqualThan", description: "Less than or equal operator (<=)" },
            { const: 7, title: "coStartsWith", description: "Starts with operator" },
            { const: 8, title: "coEndsWith", description: "Ends with operator" },
            { const: 9, title: "coIn", description: "IN operator" },
            { const: 10, title: "coBetween", description: "BETWEEN operator" },
            { const: 11, title: "coIsNull", description: "IS NULL operator" },
          ],
        },
        TCalculatedFieldType: {
          type: "number",
          description: "Enum for calculated field data types",
          enum: [1, 3, 6, 9, 10, 11],
          oneOf: [
            { const: 1, title: "ftString", description: "String" },
            { const: 3, title: "ftInteger", description: "Integer" },
            { const: 6, title: "ftFloat", description: "Float" },
            { const: 9, title: "ftDate", description: "Date" },
            { const: 10, title: "ftTime", description: "Time" },
            { const: 11, title: "ftDateTime", description: "DateTime" },
          ],
        },
        TWhereFilters: {
          type: "object",
          description: description(
            "Definitions for WHERE filters (pre-aggregation), recursively nestable for complex conditions.",
            "Use WHERE for row-level filtering before any aggregation.",
          ),
          properties: {
            completeName: {
              type: "string",
              description: description(
                "Use the 'completeName' from the provided fields or calculated fields.",
                "If this references a calculated field with hasAggregateFunction=true, move the condition to havingFilters instead of filters.",
              ),
            },
            filters: {
              type: "array",
              items: { $ref: "#/$defs/TWhereFilters" },
              description: "Recursive list for nested filters",
            },
            join: { $ref: "#/$defs/TBooleanOperator" },
            not: {
              type: "boolean",
              description: description(
                "Indicates whether the filter condition should be negated",
              ),
            },
            operator: { $ref: "#/$defs/TComparisonOperator" },
            values: { $ref: "#/$defs/TValues" },
          },
          required: [
            "completeName",
            "filters",
            "join",
            "not",
            "operator",
            "values",
          ],
          additionalProperties: false,
        },
        THavingFilters: {
          type: "object",
          description: description(
            "Definitions for HAVING filters (post-aggregation), recursively nestable for complex conditions.",
            "Use HAVING when filtering aggregated values (SUM, COUNT, AVG, etc.).",
          ),
          properties: {
            completeName: {
              type: "string",
              description: description(
                "Use the 'completeName' from the provided fields or calculated fields.",
                "For calculated fields with hasAggregateFunction=true, set aggregateFunction to NONE.",
              ),
            },
            filters: {
              type: "array",
              items: { $ref: "#/$defs/THavingFilters" },
              description: "Recursive list for nested filters",
            },
            join: { $ref: "#/$defs/TBooleanOperator" },
            aggregateFunction: { $ref: "#/$defs/TAggregateFunction" },
            not: {
              type: "boolean",
              description: description(
                "Indicates whether the filter condition should be negated",
              ),
            },
            operator: { $ref: "#/$defs/TComparisonOperator" },
            values: { $ref: "#/$defs/TValues" },
          },
          required: [
            "completeName",
            "filters",
            "join",
            "aggregateFunction",
            "not",
            "operator",
            "values",
          ],
          additionalProperties: false,
        },
        TValues: {
          type: "array",
          description: description(
            "List of values used by the selected operator.",
            "Use [] only when the operator semantics do not require explicit values.",
          ),
          items: {
            anyOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
      },
    },
    strict: false,
  };
}
