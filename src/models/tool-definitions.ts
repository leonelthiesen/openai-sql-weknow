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
      "Execute a data query ONLY when the request is sufficiently specified.",
      "Call this tool only if you can identify dimensions/measures, required filters, and aggregation intent without guessing.",
      "If any required detail is missing or ambiguous, call ask_followup instead.",
      "The query will be executed by the system and the result will be rendered to the user.",
      // "When a limit or top is requested, you must create and use a calculated field with a window function and a filter of type 'posWindowFunctionFilters'."
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message contextualizing the response in PORTUGUESE.",
            "Use Markdown.",
            "The query result data will be rendered separately right after this message.",
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
            "Query definitions: columns, sorting, calculated fields, pre-aggregation filters (WHERE), and post-aggregation filters (HAVING).",
            "This query will not be shown to the user.",
            "The query result data/visualization will be shown to the user separately right after your message.",
            "When using recsMax for top/limit behavior, include a deterministic sort to avoid unstable results."
          ),
          properties: {
            columns: {
              type: "array",
              minItems: 1,
              description: "List of output column definitions. Include all fields needed to answer the request.",
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use only the 'completeName' from the provided fields or 'completeName' of calculated fields.",
                    ),
                  },
                  measureFunction: {
                     description: "When referencing a calculated field with hasAggregateFunction=true, set measureFunction to 0 (fnNone).",
                    $ref: "#/$defs/TMeasureFunction"
                  },
                  title: {
                    type: "string",
                    description: "Friendly column title in PORTUGUESE for display purposes.",
                  },
                },
                required: ["completeName", "measureFunction", "title"],
                additionalProperties: false,
              },
            },
            sort: {
              type: "array",
              description: description(
                "List of sorting definitions.",
                "Use sort whenever the user asks for top/limit/ranking or when deterministic ordering matters."
              ),
              items: {
                type: "object",
                properties: {
                  completeName: {
                    type: "string",
                    description: description(
                      "Use the 'completeName' from the provided fields or calculated fields.",
                      "When referencing a calculated field with hasAggregateFunction=true, set measureFunction to 0 (fnNone)."
                    ),
                  },
                  direction: {
                    type: "number",
                    description: "Enum for sort direction",
                    enum: [0, 1],
                    oneOf: [
                      { const: 0, title: "sdAsc", description: "Ascending" },
                      { const: 1, title: "sdDesc", description: "Descending" }
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
                "columns, sorting, filters, and post-aggregation (having) filters.",
                "A calculated field is effective only when referenced by its 'completeName' in columns, sort, filters, or havingFilters.",
                "Use calculated fields when direct fields from the virtual table are not sufficient.",
                "If a referenced calculated field has hasAggregateFunction=true, always set the reference measureFunction to 0 (fnNone).",
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
                  // hasAnalyticFunction: {
                  //   type: "boolean",
                  //   description: description(
                  //     "Set to true if the formula contains a window function such as",
                  //     "RANK, DENSE_RANK, ROW_NUMBER, etc.",
                  //   ),
                  // },
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
                  // "hasAnalyticFunction",
                ],
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
                "When recsMax is used, also provide sort criteria so the top/limit is deterministic.",
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
            "Enum for measure/aggregation functions.",
            "Use fnNone (0) when referencing a calculated field with hasAggregateFunction=true.",
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
                "For calculated fields with hasAggregateFunction=true, set measureFunction to 0 (fnNone).",
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

// export function getRenderChartToolDefinition(): FunctionTool {
//   return {
//     type: "function",
//     name: "render_chart_config",
//     description: description(
//       "Generate a simplified chart definition to visualize query result data.",
//       "Call this tool only after execute_query has returned data in the conversation context.",
//       "Do not generate Apache ECharts config directly; the backend converts your definition to ECharts.",
//       "Support one or more series and explicit axis binding for multi-scale charts.",
//       "When providing formatter fields, always use JavaScript function syntax: function (...) { ... }.",
//     ),
//     parameters: {
//       type: "object",
//       properties: {
//         chartDefinition: {
//           type: "object",
//           description: description(
//             "Simplified chart definition for backend transformation.",
//             "Use field names exactly as they appear in query result dimensions.",
//             "All texts should be in PORTUGUESE.",
//           ),
//           properties: {
//             chartType: {
//               type: "string",
//               enum: ["bar", "line", "area", "pie"],
//               description: "Main chart type.",
//             },
//             categoryField: {
//               type: "string",
//               description: "Dimension field used as category axis or pie labels.",
//             },
//             title: {
//               type: "string",
//               description: "Chart title in PORTUGUESE.",
//             },
//             legend: {
//               type: "object",
//               properties: {
//                 position: {
//                   type: "string",
//                   enum: ["bottom", "right", "top", "left", "none"],
//                 },
//               },
//               required: ["position"],
//               additionalProperties: false,
//             },
//             tooltip: {
//               type: "object",
//               properties: {
//                 formatterFunction: {
//                   type: "string",
//                   description: "ECharts tooltip formatter in function format only, e.g. function (params) { return params[0].name; }",
//                 },
//               },
//               additionalProperties: false,
//             },
//             series: {
//               type: "array",
//               minItems: 1,
//               items: {
//                 type: "object",
//                 properties: {
//                   field: {
//                     type: "string",
//                     description: "Numeric field to plot as a series.",
//                   },
//                   name: {
//                     type: "string",
//                     description: "Series display name in PORTUGUESE.",
//                   },
//                   seriesType: {
//                     type: "string",
//                     enum: ["bar", "line", "area"],
//                     description: "Per-series override type.",
//                   },
//                   yAxisIndex: {
//                     type: "number",
//                     description: "Axis index used by this series (0, 1, ...).",
//                   },
//                   stackGroup: {
//                     type: "number",
//                     description: "Optional stack group id.",
//                   },
//                   color: {
//                     type: "string",
//                   },
//                   smooth: {
//                     type: "boolean",
//                   },
//                   showLabels: {
//                     type: "boolean",
//                   },
//                   labelFormatterFunction: {
//                     type: "string",
//                     description: "ECharts label formatter in function format only, e.g. function (params) { return params.value; }",
//                   },
//                 },
//                 required: ["field", "name"],
//                 additionalProperties: false,
//               },
//             },
//             axes: {
//               type: "array",
//               items: {
//                 type: "object",
//                 properties: {
//                   index: {
//                     type: "number",
//                   },
//                   name: {
//                     type: "string",
//                   },
//                   position: {
//                     type: "string",
//                     enum: ["left", "right"],
//                   },
//                   format: {
//                     type: "string",
//                     enum: ["number", "currency", "percent"],
//                   },
//                   formatterFunction: {
//                     type: "string",
//                     description: "ECharts axis label formatter in function format only, e.g. function (value) { return value + '%'; }",
//                   },
//                   currencySymbol: {
//                     type: "string",
//                   },
//                   decimals: {
//                     type: "number",
//                   },
//                   min: {
//                     type: "number",
//                   },
//                   max: {
//                     type: "number",
//                   },
//                 },
//                 required: ["index"],
//                 additionalProperties: false,
//               },
//             },
//           },
//           required: ["chartType", "categoryField", "series"],
//           additionalProperties: false,
//         },
//       },
//       required: ["chartDefinition"],
//       additionalProperties: false,
//     },
//     strict: false,
//   };
// }

export function getAskFollowupToolDefinition(): FunctionTool {
  return {
    type: "function",
    name: "ask_followup",
    description: description(
      "Ask the user for clarification when the request is ambiguous or missing required details.",
      "Use this tool when required filters, date ranges, grouping level, or metric intent are missing.",
      "Call this instead of guessing or silently assuming defaults that change query meaning.",
      "Ask one focused clarification at a time and provide actionable suggestion options.",
    ),
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: description(
            "Message in PORTUGUESE explaining exactly which information is missing.",
            "Provide short examples the user can copy or adapt.",
            "Keep suggestions in userMessageSuggestions aligned with the message and focused on unblocking execution.",
            "Use Markdown.",
          ),
        },
        userMessageSuggestions: {
          type: "array",
          description: description(
            "List of concrete follow-up suggestions in PORTUGUESE that unblock execution.",
            "Keep suggestions short, specific, and directly actionable.",
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
