export const SYSTEM_MESSAGE = `You are a tool to generate SQL compatible with SQLite. Return only the SQL. There is only one table called "data" and FROM statement should get only from this table.
JOIN, WITH and UNION clauses are not allowed.
The SQL should use only the following fields of table "data":
`;

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

export const ObjectTypes = {
    Table: 3,
    Chart: 5,
}

export const ObjectGridTypes = {
    Monodimensional: 1,
    Multidimensional: -1,
}

export const baseGridConfig = {
    version: "4.4.0",
    type: ObjectTypes.Table,
    viewAllowed: true,
    title: {
        text: "Título"
    },
    data: {
        metadataId: -1,
        immediately: true,
        autoScroll: {
            mode: 0
        },
        defaultColumn: {
            header: {
                visible: true,
            },
            sizeMode: 2
        },
        // selection
        // showRowCount
        customLabelViews: {
            enabled: false
        },
        gridBaseType: ObjectGridTypes.Monodimensional,
        columns: [],
        style: {}
    },
    style: {}
};

export const baseChartConfig = {
    version: "4.4.0",
    type: ObjectTypes.Chart,
    viewAllowed: true,
    title: {
        text: "Título"
    },
    data: {
        metadataId: -1,
        immediately: true,
        autoLink: {
            disableAutoLink: false
        },
        values: [],
        labels: [],
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
    },
    style: {}
};
