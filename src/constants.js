export const SYSTEM_MESSAGE = `You are a tool to generate SQL compatible with SQLite. Return only the SQL. There is only a table called "data" and FROM statement should get only from this table.
JOINs are not allowed.
SQL operators between fields like "*", "-", "+", "/", etc. are not allowed.
The SQL should use only the following fields of table "data":
`;

export const TEST_SQL = `SELECT
                            company_name,
                            employee_id AS melhor_vendedor_id,
                            employee_person_id AS melhor_vendedor_person_id,
                            SUM(product_unit_price * sale_item_quantity) AS total_vendas
                        FROM
                            data
                        WHERE
                            uf2_uf NOT LIKE 'SC'
                        ORDER BY
                            total_vendas DESC;`;

export const ObjectTypes = {
    Table: 3,
    Chart: 5,
}

export const ObjectGridTypes = {
    Monodimensional: 1,
    Multidimensional: -1,
}

export const baseGridConfig = {
    // version: "5.0.0",
    type: ObjectTypes.Table,
    viewAllowed: true,
    title: {
        text: "Título"
    },
    data: {
        metadataId: -1,
        immediately: true,
        // interval: 60,
        autoScroll: {
            mode: 0
        },
        // defaultColumn
        // selection
        // showRowCount
        customLabelViews: {
            enabled: false
        },
        gridBaseType: ObjectGridTypes.Monodimensional,
        columns: [{
            completeName: "product_name",
            title: "product_name",
        }],
        style: {}
    },
    style: {}
};


export const baseChartConfig = {
    // version: "5.0.0",
    type: ObjectTypes.Table,
    viewAllowed: true,
    title: {
        text: "Título"
    },
    data: {
        metadataId: 25,
        immediately: true,
        interval: 60,
        autoLink: {
            disableAutoLink: false
        },
        values: [{
            title: "CD Venda",
            items: [{
                completeName: "cd_venda",
                title: "CD Venda",
                measureFunction: 1,
                type: 0,
                formatOptions: {
                    format: 1,
                    showThousandSeparator: true,
                    decimals: 0
                }
            }]
        }],
        labels: [{
            title: "Categoria",
            items: [{
                completeName: "ds_categoria",
                title: "Categoria"
            }]
        }],
        sort: [{
            completeName: "sale_item_id",
            measureFunction: 1,
            direction: 1
        }],
        groups: [{
            completeName: "sale_item_packed",
            title: "sale_item_packed"
        }],
        whereFilters: {
            filters: [{
                completeName: "company_name",
                operator: 9,
                values: {
                    mode: 1,
                    fixedValues: ["Einstein", "Xenon", "Plutonium", "Titanium", "Chromium", "Berkelium", "Vanadium", "Einsteinium", "Anycomp", "Alumen", "Fluorum", "Oxygenium", "Rubidium"]
                }
            }],
            join: 0
        },
        havingFilters: {
            filters: [{
                completeName: "sale_item_id",
                measureFunction: 1,
                operator: 3,
                values: {
                    mode: 1,
                    fixedValues: [8]
                }
            }],
            join: 0
        },
        legend: {
            position: 2,
            showSymbol: true,
            showFrame: true,
            style: 1,
            itemText: "%$label%",
            selectionMode: 2
        },
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
        selection: {
            color: "~selectionBackground",
            allowMultiple: true
        },
        labelLimit: {
            count: -1
        },
        serieLimit: {
            count: -1
        },
        calculateLabelsOnBackwardAndForward: true,
        toPairDataAxis: true,
        defaultSerie: {
            percentualFormatOptions: {
                format: 1,
                suffix: "%",
                decimals: 2
            },
            color: {
                mode: 2,
                list: [{
                    color: "~chartpoints:0",
                    text: ""
                }, {
                    color: "~chartpoints:1",
                    text: ""
                }, {
                    color: "~chartpoints:2",
                    text: ""
                }],
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
        autoTitle: {
            enabled: false,
            views: [["Título"]]
        }
    },
    style: {}
};
