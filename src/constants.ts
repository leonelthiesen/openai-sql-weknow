export const MODEL_INSTRUCTIONS = `
# Identity

You are a resilient and experienced senior data analyst, an expert in SQL and databases.

# Instructions

Your task is to help a non-technical user (with no knowledge of SQL and databases) extract data and generate views from a virtual table called "VIRTUAL_DATA_TABLE".
The available fields of "VIRTUAL_DATA_TABLE" will be provided.
Use simple language in suggestions and explanations, avoiding technical terms and table names.
Always explain in a way that a non-technical user can understand.

## Tool choice policy

- Use **extract_data** ONLY when the request has enough information to build a valid query without guessing.
- Use **ask_followup** whenever required details are missing or ambiguous (for example: date range, required filters, grouping level, metric definition, or comparison scope).
- Never guess missing required filters.

## Query planning policy

- Respect user intent first (metric + dimensions + filters + granularity).
- Use WHERE filters for row-level filtering before aggregation.
- Use HAVING filters for post-aggregation filtering.
- If a calculated field has aggregation, reference it with aggregateFunction = NONE.

## Render policy

- Prefer CHART if the resulting query allows it.
- Use TEXT only for scalar/single-value answers.
- Use TABLE only when user asks for a table view or a list and when it clearly improves interpretation.
- For TEXT, after extract_data succeeds, produce the final user-facing message directly from the schema and sample data provided in context.

## Failure and retry policy

If a tool call fails, analyze the error message.
Your immediate next action must be to **retry the call at least once**, optionally adjusting input parameters based on the error details, before generating any final answer.
`;

// TODO: Regras para rever e incluir no MODEL_INSTRUCTIONS:
// 1. Os seguintes campos são FILTROS OBRIGATÓRIOS: {{LISTA_OBRIGATORIOS}}.
// 2. Se o usuário não especificou valor para um filtro obrigatório (ex: período de data), você NÃO DEVE gerar o SQL. Você deve PERGUNTAR ao usuário para esclarecer.

export interface ExtractDataResponse {
  action: "EXTRACT_DATA";
  renderType: "CHART" | "TABLE" | "TEXT";
  message: string;
  userMessageSuggestions: string[];
  query: object;
  chartConfig?: object;
  conversationNameSuggestion?: string;
  pivotCsv?: string;
}

export interface MetadataField {
  completeName: string;
  fieldType: string;
}

export interface AskFollowupResponse {
  action: "FOLLOWUP_NEEDED";
  message: string;
  userMessageSuggestions: string[];
  conversationNameSuggestion?: string;
  pivotCsv?: string;
}

export type OpenAIResponseSchema = ExtractDataResponse | AskFollowupResponse;

export const TEST_SQL = `SELECT
                            company_name,
                            SUM(product_unit_price * sale_item_quantity) AS total_vendas
                        FROM
                            data
                        WHERE
                            uf2_uf NOT LIKE 'SC'
                        HAVING
                            SUM(total_vendas) > 10000
                        ORDER BY
                            total_vendas DESC;`;

export enum ObjectTypes {
  Table = 3,
  Chart = 5,
}

export enum ObjectGridTypes {
  Monodimensional = 1,
  Multidimensional = -1,
}

export interface GridColumn {
  header?: {
    visible: boolean;
  };
  sizeMode?: number;
  [key: string]: any;
}

export interface GridConfig {
  version: string;
  type: ObjectTypes;
  viewAllowed: boolean;
  title: {
    text: string;
  };
  data: {
    metadataId: number;
    immediately: boolean;
    autoScroll: {
      mode: number;
    };
    defaultColumn: {
      header: {
        visible: boolean;
      };
      sizeMode: number;
    };
    customLabelViews: {
      enabled: boolean;
    };
    gridBaseType: ObjectGridTypes;
    columns: GridColumn[];
    style: Record<string, any>;
  };
  style: Record<string, any>;
}

export interface ChartColorItem {
  color: string;
  text: string;
}

export interface ChartSerie {
  percentualFormatOptions: {
    format: number;
    suffix: string;
    decimals: number;
  };
  color: {
    mode: number;
    list: ChartColorItem[];
    listColorEachPoint: boolean;
  };
  values: {
    visible: number;
    text: string;
    showFrame: boolean;
    showSymbol: boolean;
    inside: boolean;
    orientation: number;
  };
  lineBorderSize: number;
  stackGroup: number;
  axisHIndex: number;
  axisVIndex: number;
  spline: boolean;
  hintText: string;
  legendText: string;
  centralText: string;
}

export interface ChartAxis {
  visible?: boolean;
  increment: number;
  incrementValue: number;
  showLines?: boolean;
}

export interface ChartConfig {
  version: string;
  type: ObjectTypes;
  viewAllowed: boolean;
  title: {
    text: string;
  };
  data: {
    metadataId: number;
    immediately: boolean;
    autoLink: {
      disableAutoLink: boolean;
    };
    values: any[];
    labels: any[];
    axis: {
      left: ChartAxis;
      top: ChartAxis;
      right: ChartAxis;
      bottom: ChartAxis;
    };
    defaultSerie: ChartSerie;
  };
  style: Record<string, any>;
}

export const baseGridConfig: GridConfig = {
  version: "4.4.0",
  type: ObjectTypes.Table,
  viewAllowed: true,
  title: {
    text: "Título",
  },
  data: {
    metadataId: -1,
    immediately: true,
    autoScroll: {
      mode: 0,
    },
    defaultColumn: {
      header: {
        visible: true,
      },
      sizeMode: 2,
    },
    customLabelViews: {
      enabled: false,
    },
    gridBaseType: ObjectGridTypes.Monodimensional,
    columns: [],
    style: {},
  },
  style: {},
};

export const baseChartConfig: ChartConfig = {
  version: "4.4.0",
  type: ObjectTypes.Chart,
  viewAllowed: true,
  title: {
    text: "Título",
  },
  data: {
    metadataId: -1,
    immediately: true,
    autoLink: {
      disableAutoLink: false,
    },
    values: [],
    labels: [],
    axis: {
      left: {
        increment: 2,
        incrementValue: 4,
        showLines: true,
      },
      top: {
        increment: 2,
        incrementValue: 4,
      },
      right: {
        increment: 2,
        incrementValue: 4,
        showLines: true,
      },
      bottom: {
        visible: true,
        increment: 2,
        incrementValue: 4,
      },
    },
    defaultSerie: {
      percentualFormatOptions: {
        format: 1,
        suffix: "%",
        decimals: 2,
      },
      color: {
        mode: 2,
        list: [
          {
            color: "~chartpoints:0",
            text: "",
          },
          {
            color: "~chartpoints:1",
            text: "",
          },
          {
            color: "~chartpoints:2",
            text: "",
          },
        ],
        listColorEachPoint: false,
      },
      values: {
        visible: 1,
        text: "%$value%",
        showFrame: true,
        showSymbol: false,
        inside: false,
        orientation: 0,
      },
      lineBorderSize: 1,
      stackGroup: 0,
      axisHIndex: 0,
      axisVIndex: 0,
      spline: false,
      hintText: "%$serieTitleValues%: %$value%%$labelExt%",
      legendText: "",
      centralText: "",
    },
  },
  style: {},
};
