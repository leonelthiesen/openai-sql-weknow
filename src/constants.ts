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
  conversationNameSuggestion?: string;
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
}

export interface TextResponse {
  action: "TEXT_RESPONSE";
  message: string;
  userMessageSuggestions: string[];
  conversationNameSuggestion?: string;
}

export type OpenAIResponseSchema = ExtractDataResponse | AskFollowupResponse | TextResponse;

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
