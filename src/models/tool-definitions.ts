import type OpenAI from "openai";

type FunctionTool = OpenAI.Responses.FunctionTool;

function description(...lines: string[]): string {
  return lines.join(" ");
}

export function getExecuteQueryToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "execute_query",
    description: description(
      "Execute a data query when enough information is available from the user.",
      "The query will be executed by the system and results rendered to the user.",
      "Always call this tool when you have sufficient information to build the query.",
      // "When a limit or top is requested, you must create and use a calculated field with a window function and a filter of type 'posWindowFunctionFilters'."
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message contextualizing the response IN PORTUGUESE.",
            "Use Markdown.",
            "The query result data will be rendered separately right after this message.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List of suggestions for follow-up prompts, next actions,",
            "or analyses IN PORTUGUESE.",
          ),
          items: { type: "string" },
        },
        renderType: {
          type: "string",
          description: description(
            "Determines how the query result data should be rendered.",
            "Use CHART for graphical visualizations, TABLE for tabular data display,",
            "or TEXT when the answer can be conveyed as a simple text message (e.g., a single value or summary).",
            "Consider user requests."
          ),
          enum: ["CHART", "TABLE", "TEXT"],
        },
        query: {
          type: "object",
          description: description(
            "Query definitions: columns, sorting, calculated fields, filters, and post-aggregation (having) filters.",
            "This query will not be shown to the user.",
            "The query result data/visualization will be shown to the user separately right after your message."
          ),
          properties: {
            columns: {
              type: "array",
              description: "List of column definitions.",
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use the 'completeName' from the provided fields or calculated fields.",
                    ),
                  },
                  measureFunction: { $ref: "#/$defs/TMeasureFunction" },
                  title: {
                    type: "string",
                    description: "Friendly column title for display purposes.",
                  },
                },
                required: ["completeName", "measureFunction", "title"],
                additionalProperties: false,
              },
            },
            sort: {
              type: "array",
              description: "List of sorting definitions.",
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use the 'completeName' from the provided fields or calculated fields.",
                    ),
                  },
                  direction: {
                    type: "number",
                    description: "Enum for sort direction",
                    enum: [0, 1, 2],
                    oneOf: [
                      { const: 0, title: "sdAsc", description: "Ascending" },
                      { const: 1, title: "sdDesc", description: "Descending" },
                      {
                        const: 2,
                        title: "sdNone",
                        description: "No sort direction",
                      },
                    ],
                  },
                  measureFunction: { $ref: "#/$defs/TMeasureFunction" },
                },
                required: ["completeName", "direction", "measureFunction"],
                additionalProperties: false,
              },
            },
            calculatedFields: {
              type: "array",
              description: description(
                "List of calculated fields (ANSI SQL expressions) that can be defined and used in",
                "columns, sorting, filters, and post-aggregation (having) filters,",
                "where they must be referenced by the calculated field's 'completeName'.",
                "This can be used when direct fields from the virtual table is not sufficient.",
                "When a calculated field with 'hasAggregateFunction' equal to true is referenced, the 'measureFunction' property of the reference must always be set to 0 (fnNone)."
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
                      "ANSI SQL expression that can contain aggregation functions",
                      "(SUM, COUNT, AVG, etc.) and analytic functions",
                      "(RANK, ROW_NUMBER, etc.). Provided fields can be referenced",
                      "by the 'completeName' between '%', for example:",
                      "'%$completeName%'.",
                    ),
                  },
                  hasAggregateFunction: {
                    type: "boolean",
                    description: description(
                      "True if the formula contains an aggregation function",
                      "(SUM, COUNT, AVG, etc.)",
                    ),
                  },
                  hasAnalyticFunction: {
                    type: "boolean",
                    description: description(
                      "True if the formula contains a window function such as",
                      "RANK, ROW_NUMBER, etc.",
                    ),
                  },
                  title: {
                    type: "string",
                    description: "Friendly title for display",
                  },
                },
                required: ["completeName", "formula"],
              },
            },
            filters: { $ref: "#/$defs/TWhereFilters" },
            havingFilters: { $ref: "#/$defs/THavingFilters" },
            recsMax: {
              type: "number",
              description: description(
                "Maximum number of records to return.",
                "Use this to limit the number of records when the user requests a 'limit' or 'top' in their prompt.",
                // "When this is used, you must create and use a calculated field with a window function and a filter of type 'posWindowFunctionFilters' to ensure correct results.",
              )
            },
            // posWindowFunctionFilters: {
            //   $ref: "#/$defs/TPosWindowFunctionFilter",
            // },
          },
          required: ["columns"],
          additionalProperties: false,
        },
      },
      required: ["message", "userMessageSuggestions", "renderType", "query"],
      additionalProperties: false,
      $defs: {
        TMeasureFunction: {
          type: "number",
          description: description(
            "Enum for measures and aggregation functions; use fnNone when",
            "referencing a calculated field with aggregation.",
          ),
          enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          oneOf: [
            { const: 0, title: "fnNone", description: "No aggregation function" },
            { const: 1, title: "fnCount", description: "Count function" },
            { const: 2, title: "fnDistinctCount", description: "Distinct count function" },
            { const: 3, title: "fnSum", description: "Sum function" },
            { const: 4, title: "fnMax", description: "Max function" },
            { const: 5, title: "fnMin", description: "Min function" },
            { const: 6, title: "fnAverage", description: "Average function" },
            { const: 7, title: "fnList", description: "List function" },
            { const: 8, title: "fnDistinctList", description: "Distinct list function" },
            { const: 9, title: "fnDistinctSum", description: "Distinct sum function" },
            { const: 10, title: "fnDistinctAverage", description: "Distinct average function" },
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
            "Definitions for WHERE filters, which can be nested recursively",
            "to represent complex conditions.",
          ),
          properties: {
            completeName: {
              type: "string",
              description: description(
                "Use the 'completeName' from the provided fields or",
                "calculated fields.",
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
            "Definitions for HAVING filters, which can be nested recursively",
            "to represent complex post-aggregation conditions.",
          ),
          properties: {
            completeName: {
              type: "string",
              description: description(
                "Use the 'completeName' from the provided fields or",
                "calculated fields.",
              ),
            },
            filters: {
              type: "array",
              items: { $ref: "#/$defs/THavingFilters" },
              description: "Recursive list for nested filters",
            },
            join: { $ref: "#/$defs/TBooleanOperator" },
            measureFunction: { $ref: "#/$defs/TMeasureFunction" },
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
            "measureFunction",
            "not",
            "operator",
            "values",
          ],
          additionalProperties: false,
        },
        // TPosWindowFunctionFilter: {
        //   type: "object",
        //   description: description(
        //     "Definitions for filters that use window functions.",
        //   ),
        //   properties: {
        //     completeName: {
        //       type: "string",
        //       description: description(
        //         "Use the 'completeName' from the provided fields or",
        //         "calculated fields.",
        //       ),
        //     },
        //     filters: {
        //       type: "array",
        //       items: { $ref: "#/$defs/TPosWindowFunctionFilter" },
        //       description: "Recursive list for nested filters",
        //     },
        //     join: { $ref: "#/$defs/TBooleanOperator" },
        //     measureFunction: { $ref: "#/$defs/TMeasureFunction" },
        //     not: {
        //       type: "boolean",
        //       description: description(
        //         "Indicates whether the filter condition should be negated",
        //       ),
        //     },
        //     operator: { $ref: "#/$defs/TComparisonOperator" },
        //     values: { $ref: "#/$defs/TValues" },
        //   },
        //   required: [
        //     "completeName",
        //     "filters",
        //     "join",
        //     "measureFunction",
        //     "not",
        //     "operator",
        //     "values",
        //   ],
        //   additionalProperties: false,
        // },
        TValues: {
          type: "array",
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

export function getRenderChartToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "render_chart_config",
    description: description(
      "Render an Apache ECharts chart to visualize the query result data.",
      "The query result data will be provided in the conversation so you can inspect column names and value ranges to build an appropriate chart.",
    ),
    parameters: {
      type: "object",
      properties: {
        chartConfig: {
          type: "object",
          description: description(
            "Apache ECharts configuration object.",
            "Must use the 'dataset' option with 'dimensions' and 'source'.",
            "Use friendly Portuguese titles/legends (e.g., 'DATA_EMISSAO' → 'Data de Emissão').",
            "Position legends below or beside the chart.",
            "Chart title must have padding so it does not stick to the chart (e.g., padding: [10, 0, 30, 0]).",
            "Axis titles should be centered and vertical where applicable.",
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

export function getAskFollowupToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "ask_followup",
    description: description(
      "Ask the user for clarification or additional information when the",
      "request is ambiguous or missing required details",
      "(e.g., date range, specific fields, filters).",
      "If you notice a required filter was not provided, use this tool to ask the user for clarification.",
      "Call this instead of guessing.",
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message explaining what information is missing and suggesting",
            "examples IN PORTUGUESE.",
            "Use Markdown.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List of suggestions on how to complete or refine the prompt",
            "IN PORTUGUESE.",
          ),
          items: { type: "string" },
        },
      },
      required: ["message", "userMessageSuggestions"],
      additionalProperties: false,
    },
    strict: true,
  };
}
