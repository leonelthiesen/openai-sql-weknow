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
  "action": "EXECUTE_SQL",
  "sql": "SELECT ... FROM (VIRTUAL_DATA_TABLE) ...",
  "message": "Considerando as informações fornecidas...",
  "userMessageSuggestions": ["...", "...", "..."] // Sugestões de próximas perguntas ou análises que o usuário pode fazer
}
`;

export const MODEL_INSTRUCTIONS = `
Você é um Arquiteto de Dados Sênior e Especialista em SQL.
Sua tarefa é ajudar um usuário a extrair dados e informações de uma tabela virtual chamada 'VIRTUAL_DATA_TABLE'.
Os campos disponíveis na tabela virtual sempre serão informados no seguinte formato JSON:
[{"field": "DATA_EMISSAO", "type": "Date", "title": "Data de Emissão", "description": "Descrição do campo", "needFilter": true}, ...]

A mensagem de retorno (propriedade "message") deve estar SEMPRE em markdown.
Se a propriedade "action" for igual a EXECUTE_SQL, você deve inserir no markdown o texto "[DATA_PLACEHOLDER]", onde serão exibidos os dados.

REGRAS DE SEGURANÇA (CRÍTICO):
1. Use APENAS comandos SELECT.
2. NUNCA use INSERT, UPDATE, DELETE, DROP, TRUNCATE.
3. Se o usuário pedir algo perigoso, recuse.
4. O SQL gerado será uma subquery. Ex: SELECT campo1, SUM(campo2) FROM (VIRTUAL_DATA_TABLE) WHERE ... GROUP BY campo1.
5. Use SEMPRE alias para as colunas calculadas.

REGRAS DE PERFORMANCE E FILTROS:
1. Se a pergunta for ambígua, NÃO ADIVINHE. Pergunte.
2. Se perceber que um filtro obrigatório não foi fornecido, NÃO GERE o SQL. Pergunte ao usuário para esclarecer.
`;

// TODO: Regras para rever e incluir no MODEL_INSTRUCTIONS:
// 1. Os seguintes campos são FILTROS OBRIGATÓRIOS: {{LISTA_OBRIGATORIOS}}.
// 2. Se o usuário não especificou valor para um filtro obrigatório (ex: período de data), você NÃO DEVE gerar o SQL. Você deve PERGUNTAR ao usuário para esclarecer.

export interface OpenAIResponseSchema {
  action: "FOLLOWUP_NEEDED" | "EXECUTE_SQL";
  message: string;
  userMessageSuggestions: string[];
  sql: string;
}

export const JSON_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      description: "Determina o tipo de resposta baseada nas informações disponíveis do usuário.",
      enum: ["FOLLOWUP_NEEDED", "EXECUTE_SQL"],
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
    sql: {
      type: "string",
      description: "Query SQL pronta para execução (obrigatória apenas se action=EXECUTE_SQL).",
    },
  },
  required: ["action", "message", "userMessageSuggestions", "sql"],
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
