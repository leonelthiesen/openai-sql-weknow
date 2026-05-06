import type OpenAI from "openai";
import { description } from "./description-helper";

type FunctionTool = OpenAI.Responses.FunctionTool;

export function getExtractDataToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "extract_data",
    description: description(
      "You are a helpful assistant. Your task is to extract the user's data analysis intent and translate it into a structured query definition that can be executed against a virtual table.",
      "Use this tool when the user is asking for data or insights from the data, even if they don't explicitly ask for a chart or table. Your job is to understand the user's underlying data needs and provide a structured query definition that can fulfill those needs.",
      "The virtual table fields are defined in the conversation context.",
      "You will receive as a result, an schema of the columns with a obfuscated data limited to 10 records, to help you understand the data types and values. Use this information to better infer the user's intent.",
      "The result will be rendered as a chart (with option to view in a data table), a data table, or a user friendly message depending on renderType.",
      "When a filter on a string/categorical field is needed, always use request_field_values first to get the exact values and build precise filters. Never guess values for string/categorical fields.",
      "If any other required detail is missing or ambiguous, call ask_followup instead.",
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
            "Keep suggestions only in userMessageSuggestions aligned with the message.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List, in PORTUGUESE, of suggested next requests the user can send to the LLM to continue the conversation.",
          ),
          items: { type: "string" },
        },
        renderType: {
          type: "string",
          description: description(
            "Determines how the query result data should be rendered.",
            "Choose using this policy: ",
            "- 'CHART' when is the clearest way to present the data or when user explicitly asks for a chart/graph;",
            "- 'TABLE' when row-level detail, listing, or comparisons across many records are needed;",
            "- 'TEXT' when the result is a single scalar summary (for example, one KPI value).",
            "If unclear, default to 'TABLE'."
          ),
          enum: ["CHART", "TABLE", "TEXT"],
        },
        query: {
          type: "object",
          description: description(
            // "Query definitions: calculated fields, series dimensions, category dimensions, measures, sorting, pre-aggregation filters (WHERE), and post-aggregation filters (HAVING).",
            "This query will not be displayed directly to the user.",
            "The result data will be rendered (as chart, data table or text) separately right after your message.",
            "In general, do not repeat the same field in both seriesDimensions and categoryDimensions.",
            "Always use sorting, either by category using 'categorySort' or by series using 'seriesSort'.",
          ),
          properties: {
            calculatedFields: {
              type: "array",
              description: description(
                "List of calculated fields (ANSI SQL expressions) that can be defined and used in seriesDimensions, categoryDimensions, measures, sorting, filters, and havingFilters.",
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
                  dataType: {
                    type: "string",
                    description: "Data type expected by the execution of the SQL expression (from the formula property).",
                    enum: ["String", "Number", "Date", "Time", "DateTime"],
                  },
                  formula: {
                    type: "string",
                    description: description(
                      "ANSI SQL expression that can contain aggregation functions (SUM, COUNT, AVG, etc.).",
                      "Provided fields can be referenced in formula, always by the 'completeName' between '%', for example: ",
                      "- field name: userName, reference '%userName%'",
                      "- field name: id, reference '%id%'",
                      "Only use provided fields directly in the formula; do not reference another calculated field here.",
                    ),
                  },
                  hasAggregateFunction: {
                    type: "boolean",
                    description: "Set to true if the formula contains an aggregation function (SUM, COUNT, AVG, MIN, MAX, etc.).",
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
                required: ["completeName", "aggregateFunction"],
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
                required: ["completeName", "aggregateFunction"],
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
            filters: { $ref: "#/$defs/TWhereFiltersRoot" },
            havingFilters: { $ref: "#/$defs/THavingFiltersRoot" },
            // recsMax: {
            //   type: "number",
            //   description: description(
            //     "Maximum number of records to return.",
            //     "Use this when the user requests a limit/top N.",
            //     "When recsMax is used, also provide categorySort so the top/limit is deterministic.",
            //   )
            // },
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
            "SQL aggregation functions.",
            "Use NONE when referencing a calculated field with hasAggregateFunction=true.",
          ),
          enum: ["NONE", "COUNT", "COUNT_DISTINCT", "SUM", "MAX", "MIN", "AVG", "LIST", "LIST_DISTINCT", "SUM_DISTINCT", "AVG_DISTINCT"]
        },
        TSortDirection: {
          type: "string",
          description: "Enum for sort direction.",
          enum: ["ASC", "DESC"],
        },
        TBooleanOperator: {
          type: "string",
          description: "SQL boolean operators",
          enum: ["AND", "OR"],
        },
        TComparisonOperator: {
          type: "string",
          description: "SQL comparison operators in text form.",
          enum: ["LIKE", "=", "!=", ">", ">=", "<", "<=", "IN", "BETWEEN", "IS_NULL", "STARTS_WITH", "ENDS_WITH"],
        },
        TWhereFiltersRoot: {
          type: "object",
          description: description(
            "Root WHERE filter group.",
            "At the root level, use only join + filters.",
          ),
          properties: {
            filters: {
              type: "array",
              items: { $ref: "#/$defs/TWhereFilters" },
              description: "Root list of WHERE filter nodes",
            },
            join: { $ref: "#/$defs/TBooleanOperator" },
          },
          required: ["join", "filters"],
          additionalProperties: false,
        },
        TWhereFilters: {
          type: "object",
          description: description(
            "Definitions for WHERE filters (pre-aggregation), recursively nestable for complex conditions.",
            "Use WHERE for row-level filtering before any aggregation.",
          ),
          oneOf: [
            {
              type: "object",
              description: "Nested WHERE group node",
              properties: {
                filters: {
                  type: "array",
                  items: { $ref: "#/$defs/TWhereFilters" },
                  description: "Recursive list for nested filters",
                },
                join: { $ref: "#/$defs/TBooleanOperator" },
              },
              required: ["join", "filters"],
              additionalProperties: false,
            },
            {
              type: "object",
              description: "WHERE condition node",
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
                "join",
                "operator",
                "values",
              ],
              additionalProperties: false,
            },
          ],
        },
        THavingFiltersRoot: {
          type: "object",
          description: description(
            "Root HAVING filter group.",
            "At the root level, use only join + filters.",
          ),
          properties: {
            filters: {
              type: "array",
              items: { $ref: "#/$defs/THavingFilters" },
              description: "Root list of HAVING filter nodes",
            },
            join: { $ref: "#/$defs/TBooleanOperator" },
          },
          required: ["join", "filters"],
          additionalProperties: false,
        },
        THavingFilters: {
          type: "object",
          description: description(
            "Definitions for HAVING filters (post-aggregation), recursively nestable for complex conditions.",
            "Use HAVING when filtering aggregated values (SUM, COUNT, AVG, etc.).",
          ),
          oneOf: [
            {
              type: "object",
              description: "Nested HAVING group node",
              properties: {
                filters: {
                  type: "array",
                  items: { $ref: "#/$defs/THavingFilters" },
                  description: "Recursive list for nested filters",
                },
                join: { $ref: "#/$defs/TBooleanOperator" },
              },
              required: ["join", "filters"],
              additionalProperties: false,
            },
            {
              type: "object",
              description: "HAVING condition node",
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
                "join",
                "aggregateFunction",
                "operator",
                "values",
              ],
              additionalProperties: false,
            },
          ],
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
