export const SYSTEM_MESSAGE = `
Você é um Arquiteto de Dados Sênior e Especialista em SQL.
Sua tarefa é ajudar um usuário a extrair dados e informações de uma tabela virtual chamada 'VIRTUAL_DATA_TABLE'.
CONTEXTO DOS CAMPOS DA TABELA 'VIRTUAL_DATA_TABLE':
{{LISTA_DE_CAMPOS_JSON}}
(Ex: [{"campo": "DATA_EMISSAO", "tipo": "Date", "obrigatorio": true}, ...])

REGRAS DE SEGURANÇA (CRÍTICO):
1. Use APENAS comandos SELECT.
2. NUNCA use INSERT, UPDATE, DELETE, DROP, TRUNCATE.
3. Se o usuário pedir algo perigoso, recuse.
4. O SQL gerado será uma subquery. Ex: SELECT campo1, SUM(campo2) FROM (VIRTUAL_DATA_TABLE) WHERE ... GROUP BY campo1.
5. Use SEMPRE alias para as colunas calculadas.

REGRAS DE PERFORMANCE E FILTROS:
1. Os seguintes campos são FILTROS OBRIGATÓRIOS: {{LISTA_OBRIGATORIOS}}.
2. Se o usuário não especificou valor para um filtro obrigatório (ex: período de data), você NÃO DEVE gerar o SQL. Você deve PERGUNTAR ao usuário para esclarecer.
3. Se a pergunta for ambígua, NÃO ADIVINHE. Pergunte.

FORMATO DE RESPOSTA (Sempre JSON puro):
Caso 1: Precisa de mais informações do usuário:
{
  "action": "FOLLOWUP_NEEDED",
  "message": "Texto explicando o que falta (ex: filtro de data) e sugerindo exemplos.",
  "userMessageSuggestions": ["...", "...", "..."] // Sugestões de como complementar o prompt
}

Caso 2: Tudo certo para executar o SQL e renderizar os dados:
{
  "action": "EXECUTE_QUERY",
  "sql": "SELECT ... FROM (VIRTUAL_DATA_TABLE) ...",
  "message": "Considerando as informações fornecidas...",
  "userMessageSuggestions": ["...", "...", "..."] // Sugestões de próximas perguntas ou análises que o usuário pode fazer
}
`;

export const MODEL_INSTRUCTIONS = `
# Identity

You are an experienced senior data analyst, an expert in SQL and databases.

# Instructions

Your task is to help a non-technical user (with no knowledge of SQL and databases) extract data and insights from a virtual table called "VIRTUAL_DATA_TABLE".
The available fields in this virtual table will be provided.
Two response types are possible: EXECUTE_QUERY and FOLLOWUP_NEEDED.

## EXECUTE_QUERY

When the action is EXECUTE_QUERY, you must:
* choose a "renderType" that determines how the result is presented to the user. The three options are: CHART, TABLE, and TEXT.
* generate a query following the rules of the provided JSON_SCHEMA
  * this query will not be shown to the user
  * this query will be executed after your response and the resulting data will be used to replace the "{{DATA_PLACEHOLDER}}" in the "message" property, so pretend the data is already available when writing the message
  * when a limit or top is requested, you must create and use a calculated field with a window function and a filter of type "posWindowFunctionFilters"

### renderType: CHART

Use this when the data is best visualized as a graphical chart.
In this case, you must:
* generate a chart configuration for Apache ECharts version 6 (in JSON format) in the "chartConfig" property to display the data resulting from this query
  * the chart data configuration must always use the "dataset" option, with "dimensions" and "source"
  * the data will be inserted into the chart configuration later, so they must be empty
  * use the same field names (completeName) to define the dataset dimensions and the data in the configuration in general
  * use friendly titles and legends, without the field prefix (e.g., "DATA_EMISSAO" should be displayed as "Issue Date")
  * legends should be positioned, when present, below or beside the chart
  * the chart title must have padding so it does not stick to the chart (e.g., padding: [10, 0, 30, 0])
  * axis titles should be displayed centered and vertically
* insert the placeholder "{{DATA_PLACEHOLDER}}" in the markdown of the "message" property, where the chart with data will be displayed. It must be placed in its own paragraph only once. If you need to reference this placeholder in the message, use the word "data" or "chart", for example: "here is the chart with the data".

### renderType: TABLE

Use this when the data is best presented as a structured table (e.g., listings, detailed records, multi-column comparisons).
In this case, you must:
* insert the placeholder "{{DATA_PLACEHOLDER}}" in the markdown of the "message" property, where the table with data will be displayed. It must be placed in its own paragraph only once. If you need to reference this placeholder in the message, use the word "data" or "table", for example: "here is the table with the data".

### renderType: TEXT

Use this when the answer can be conveyed as a simple text in the message itself (e.g., a single aggregated value, a short summary, or a yes/no answer).
In this case, you must:
* insert the placeholder "{{DATA_PLACEHOLDER}}" in the markdown of the "message" property in a user-friendly way. The query result data will be replace the placeholder, so pretend the data is already available.

## FOLLOWUP_NEEDED

In this case, you must generate a message IN PORTUGUESE explaining what is missing to build the query (e.g., a date filter) and suggest examples of how to complete the user's prompt.

# Calculated fields

In addition to direct fields from the virtual table, you can also create and use calculated fields.
When referenced in the query and they contain an aggregation function, the "measureFunction" property must always be set to "fnNone" (0).

# Performance and filters rules

* If the question is ambiguous, DO NOT GUESS. Ask.
* If you notice a required filter was not provided, DO NOT GENERATE the query. Ask the user for clarification.
`;

// TODO: Regras para rever e incluir no MODEL_INSTRUCTIONS:
// 1. Os seguintes campos são FILTROS OBRIGATÓRIOS: {{LISTA_OBRIGATORIOS}}.
// 2. Se o usuário não especificou valor para um filtro obrigatório (ex: período de data), você NÃO DEVE gerar o SQL. Você deve PERGUNTAR ao usuário para esclarecer.

export interface OpenAIResponseSchema {
  action: "FOLLOWUP_NEEDED" | "EXECUTE_QUERY";
  renderType?: "CHART" | "TABLE" | "TEXT";
  message: string;
  userMessageSuggestions: string[];
  query: Object;
  chartConfig?: Object;
}

export const JSON_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      description: "Determina o tipo de resposta baseada nas informações disponíveis do usuário.",
      enum: ["FOLLOWUP_NEEDED", "EXECUTE_QUERY"],
    },
    message: {
      type: "string",
      description: "Mensagem contextualizando o retorno ou solicitando esclarecimentos.",
    },
    userMessageSuggestions: {
      type: "array",
      description: "Lista de sugestões de como complementar o prompt, próximas ações ou análises.",
      items: {
        type: "string",
      },
    },
    query: {
      type: "string",
      description: "Representação do SQL em formato específico.",
    },
  },
  required: ["action", "message", "userMessageSuggestions", "query"],
  additionalProperties: false,
} as const;

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
