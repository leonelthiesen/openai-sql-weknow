// Mock data for demonstration purposes
let conversations = [
    {
        id: 1,
        metadataId: 139,
        name: 'Vendas por empresa',
        systemMessage: `You are a tool to generate SQL compatible with SQLite. Return only the SQL. There is only a table called "data" and FROM statement should get only from this table.
JOINs are not allowed.
SQL operators between fields like "*", "-", "+", "/", etc. are not allowed.
The SQL should use only the following fields of table "data":
ds_teste
sn_informatica
email_vendedor
trimestre_venda
tipo_produto
mes_numero
ds_categoria
cd_categoria
vl_unitario
ds_produto
cd_produto
nm_cliente
cd_cliente
nm_vendedor
cd_vendedor
cd_empresa
vl_total_venda
qt_venda
cd_item_venda
cd_venda
dt_venda
dt_venda_yearMonth
dt_venda_day
dt_venda_month
dt_venda_year
anomes_venda`,
        metadataFields: [
            {
                isField: true,
                completeName: "ds_teste",
                title: "ds_teste",
                fieldType: 24,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "sn_informatica",
                title: "SN Informática",
                fieldType: 25,
                type: 1,
                typeEx: 4,
                canAutoLoad: false,
                formatOptions: {
                    suffix: "",
                    falseText: "NÃO",
                    null: "",
                    prefix: "",
                    format: 8,
                    trueText: "SIM"
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "email_vendedor",
                title: "E-mail Vendedor",
                fieldType: 24,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "trimestre_venda",
                title: "Trimeste Venda",
                fieldType: 24,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "tipo_produto",
                title: "Tipo de Produto",
                fieldType: 24,
                type: 1,
                typeEx: 8,
                canAutoLoad: false,
                formatOptions: {
                    suffix: "",
                    null: "",
                    prefix: "",
                    format: 6,
                    options: [
                        {
                            value: "I",
                            text: "INFORMÁTICA"
                        },
                        {
                            value: "N",
                            text: "NUTRIÇÃO"
                        },
                        {
                            value: "O",
                            text: "OUTROS"
                        }
                    ]
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "mes_numero",
                title: "Mês Venda (número)",
                fieldType: 24,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "ds_categoria",
                title: "Categoria",
                fieldType: 39,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_categoria",
                title: "CD Categoria",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "vl_unitario",
                title: "Valor Unitário",
                fieldType: 6,
                type: 1,
                typeEx: 3,
                canAutoLoad: false,
                formatOptions: {
                    decimalSeparator: ",",
                    suffix: "",
                    signalVisibility: 0,
                    scaleTextAsDecimalSeparator: false,
                    null: "",
                    forceDecimals: false,
                    prefix: "",
                    format: 1,
                    maxWidth: 0,
                    decimals: 2,
                    showThousandSeparator: true,
                    thousandSeparator: "."
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "ds_produto",
                title: "Produto",
                fieldType: 39,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_produto",
                title: "CD Produto",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "nm_cliente",
                title: "Cliente",
                fieldType: 39,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_cliente",
                title: "CD Cliente",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "nm_vendedor",
                title: "Vendedor",
                fieldType: 39,
                type: 1,
                typeEx: 1,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_vendedor",
                title: "CD Vendedor",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_empresa",
                title: "CD Empresa",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "vl_total_venda",
                title: "Valor Total Venda",
                fieldType: 6,
                type: 1,
                typeEx: 3,
                canAutoLoad: false,
                formatOptions: {
                    decimalSeparator: "",
                    suffix: "",
                    signalVisibility: 0,
                    scaleTextAsDecimalSeparator: false,
                    null: "",
                    forceDecimals: true,
                    prefix: "R$ ",
                    format: 1,
                    maxWidth: 0,
                    decimals: 2,
                    showThousandSeparator: true,
                    thousandSeparator: ""
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "qt_venda",
                title: "Qt Venda",
                fieldType: 6,
                type: 1,
                typeEx: 3,
                canAutoLoad: false,
                formatOptions: {
                    decimalSeparator: "",
                    suffix: "",
                    scaleTextAsDecimalSeparator: false,
                    null: "",
                    forceDecimals: false,
                    prefix: "",
                    format: 1,
                    maxWidth: 0,
                    decimals: 12,
                    showThousandSeparator: true,
                    thousandSeparator: ""
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_item_venda",
                title: "CD Item Venda",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "cd_venda",
                title: "CD Venda",
                fieldType: 14,
                type: 1,
                typeEx: 2,
                canAutoLoad: false,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    thousandSeparator: ".",
                    decimalSeparator: ",",
                    decimals: 0
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: true,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "dt_venda",
                title: "Dt Venda",
                fieldType: 11,
                type: 1,
                typeEx: 6,
                canAutoLoad: false,
                formatOptions: {
                    suffix: "",
                    null: "",
                    prefix: "",
                    format: 3,
                    mask: ""
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            },
            {
                isField: true,
                completeName: "dt_venda_yearMonth",
                title: "Dt Venda.Mês/ano",
                fieldType: 3,
                type: 33,
                typeEx: 39,
                canAutoLoad: false,
                formatOptions: {
                    format: 5
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: true,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: "dt_venda"
            },
            {
                isField: true,
                completeName: "dt_venda_day",
                title: "Dt Venda.Dia",
                fieldType: 3,
                type: 9,
                typeEx: 15,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: true,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: "dt_venda"
            },
            {
                isField: true,
                completeName: "dt_venda_month",
                title: "Dt Venda.Mês",
                fieldType: 3,
                type: 5,
                typeEx: 11,
                canAutoLoad: false,
                formatOptions: {
                    format: 6,
                    options: [
                        {
                            value: "1",
                            text: "janeiro"
                        },
                        {
                            value: "2",
                            text: "fevereiro"
                        },
                        {
                            value: "3",
                            text: "março"
                        },
                        {
                            value: "4",
                            text: "abril"
                        },
                        {
                            value: "5",
                            text: "maio"
                        },
                        {
                            value: "6",
                            text: "junho"
                        },
                        {
                            value: "7",
                            text: "julho"
                        },
                        {
                            value: "8",
                            text: "agosto"
                        },
                        {
                            value: "9",
                            text: "setembro"
                        },
                        {
                            value: "10",
                            text: "outubro"
                        },
                        {
                            value: "11",
                            text: "novembro"
                        },
                        {
                            value: "12",
                            text: "dezembro"
                        }
                    ]
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: true,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: "dt_venda"
            },
            {
                isField: true,
                completeName: "dt_venda_year",
                title: "Dt Venda.Ano",
                fieldType: 3,
                type: 4,
                typeEx: 10,
                canAutoLoad: false,
                formatOptions: {
                    showEllipsis: false
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: true,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: "dt_venda"
            },
            {
                isField: true,
                completeName: "anomes_venda",
                title: "AnoMês Venda",
                fieldType: 24,
                type: 1,
                typeEx: 39,
                canAutoLoad: false,
                formatOptions: {
                    suffix: "",
                    null: "",
                    prefix: "",
                    format: 5,
                    mask: ""
                },
                isAggregated: false,
                isWindowFunction: false,
                isMeasure: false,
                hasParentField: false,
                isHierarchy: false,
                hasPrivacyRules: false,
                parentField: null
            }
        ]
    },
];

let messages = [{
    id: 1,
    conversationId: 1,
    sender: 'user',
    text: 'contagem de vendas por empresa em ordem'
}, {
    id: 2,
    conversationId: 1,
    sender: 'bot',
    text: `SELECT company_name, COUNT(*) AS total_vendas FROM data GROUP BY company_name ORDER BY total_vendas DESC;`,
    chartConfig: {
        version: "4.4.0",
        type: 5,
        viewAllowed: true,
        title: {
            text: "Título"
        },
        data: {
            metadataId: 139,
            immediately: true,
            autoLink: {
                disableAutoLink: false
            },
            values: [
                {
                    items: [
                        {
                            completeName: "qt_venda",
                            title: "total_vendas",
                            measureFunction: 3
                        }
                    ],
                    title: "total_vendas"
                }
            ],
            labels: [
                {
                    items: [
                        {
                            completeName: "cd_empresa",
                            title: "cd_empresa"
                        }
                    ],
                    title: "cd_empresa"
                }
            ],
            axis: {
                left: {
                    increment: 2,
                    incrementValue: 4,
                    showLines: true
                },
                top: {
                    increment: 2,
                    incrementValue: 4
                },
                right: {
                    increment: 2,
                    incrementValue: 4,
                    showLines: true
                },
                bottom: {
                    visible: true,
                    increment: 2,
                    incrementValue: 4
                }
            },
            defaultSerie: {
                percentualFormatOptions: {
                    format: 1,
                    suffix: "%",
                    decimals: 2
                },
                color: {
                    mode: 2,
                    list: [
                        {
                            color: "~chartpoints:0",
                            text: ""
                        },
                        {
                            color: "~chartpoints:1",
                            text: ""
                        },
                        {
                            color: "~chartpoints:2",
                            text: ""
                        }
                    ],
                    listColorEachPoint: false
                },
                values: {
                    visible: 1,
                    text: "%$value%",
                    showFrame: true,
                    showSymbol: false,
                    inside: false,
                    orientation: 0
                },
                lineBorderSize: 1,
                stackGroup: 0,
                axisHIndex: 0,
                axisVIndex: 0,
                spline: false,
                hintText: "%$serieTitleValues%: %$value%%$labelExt%",
                legendText: "",
                centralText: ""
            },
            groups: []
        },
        style: {}
    },
    chartData: '',
    gridConfig: '',
    gridData: '',
}];

async function getConversations() {
    return conversations;
}

async function getConversationById(id) {
    return conversations.find(c => c.id === parseInt(id));
}

async function createConversation({ metadataId, name, systemMessage, metadataFields }) {
    const newConversation = {
        id: conversations.length + 1,
        metadataId,
        name,
        systemMessage,
        metadataFields
    };
    conversations.push(newConversation);

    return newConversation;
}

function createMessage({ conversationId, sender, text, chartConfig, chartData, gridConfig, gridData }) {
    const newMessage = {
        id: messages.length + 1,
        conversationId: parseInt(conversationId),
        sender,
        text,
        chartConfig,
        chartData,
        gridConfig,
        gridData,
    };
    messages.push(newMessage);
    return newMessage;
}

function updateMessage({ messageId, chartData, gridData }) {
    const message = messages.find(m => m.id === parseInt(messageId));
    if (!message) {
        return 'Message not found';
    }

    if (chartData) {
        message.chartData = chartData;
    }

    if (gridData) {
        message.gridData = gridData;
    }

    return message;
}

function getMessagesByConversationId(conversationId) {
    return messages.filter(m => m.conversationId === parseInt(conversationId));
}

export default {
    getConversations,
    getConversationById,
    createConversation,
    createMessage,
    updateMessage,
    getMessagesByConversationId
};
