import { expect, test } from 'vitest'
import astToWeknowService from './ast-to-weknow.service.js'
import { ObjectTypes } from '../constants.js';

test('create grid config from sql 1 for metadataId 8 to equal ... ', () => {
    let sql = `
            SELECT
                company_name,
                employee_id AS melhor_vendedor_id,
                employee_person_id AS melhor_vendedor_person_id,
                SUM(valorTotalItem) AS total_vendas
            FROM
                data
            WHERE
                uf2_uf NOT LIKE 'SC'
            ORDER BY
                total_vendas DESC;`;
    let fieldList = ['company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf', 'uf2_longitude', 'person_1_name', 'valorTotalItem'];
    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(8, ObjectTypes.Table, fieldList, sql);
    expect(weknowConfig).toEqual({
        version: "4.4.0",
        type: 3,
        viewAllowed: true,
        title: {
            text: "Título"
        },
        data: {
            metadataId: 8,
            immediately: true,
            autoScroll: {
                mode: 0
            },
            customLabelViews: {
                enabled: false
            },
            defaultColumn: {
                header: {
                    visible: true,
                },
                sizeMode: 2
            },
            gridBaseType: 1,
            columns: [
                {
                    completeName: "company_name",
                    title: "company_name"
                },
                {
                    completeName: "employee_id",
                    title: "melhor_vendedor_id"
                },
                {
                    completeName: "employee_person_id",
                    title: "melhor_vendedor_person_id"
                },
                {
                    completeName: "valorTotalItem",
                    title: "total_vendas",
                    measureFunction: 3
                }
            ],
            style: {},
            sort: [
                {
                    completeName: "valorTotalItem",
                    direction: 1,
                    measureFunction: 3
                }
            ],
            whereFilters: {
                filters: [
                    {
                        completeName: "uf2_uf",
                        not: true,
                        operator: 0,
                        values: {
                            mode: 1,
                            fidexValues: [
                                "SC"
                            ]
                        }
                    }
                ]
            }
        },
        style: {}
    });
});

test('create grid config from sql 2 for metadataId 8 to equal ... ', () => {
    let sql = `
            SELECT
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
    let fieldList = ['company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf', 'uf2_longitude', 'person_1_name'];

    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(8, ObjectTypes.Table, fieldList, sql);
    expect(weknowConfig).toEqual({
        version: "4.4.0",
        type: 3,
        viewAllowed: true,
        title: {
            text: "Título"
        },
        data: {
            metadataId: 8,
            immediately: true,
            autoScroll: {
                mode: 0
            },
            customLabelViews: {
                enabled: false
            },
            defaultColumn: {
                header: {
                    visible: true,
                },
                sizeMode: 2
            },
            gridBaseType: 1,
            columns: [
                {
                    completeName: "company_name",
                    title: "company_name"
                },
                {
                    completeName: "calculatedField1",
                    title: "total_vendas"
                }
            ],
            style: {},
            calculatedFields: [
                {
                    completeName: "calculatedField1",
                    dataType: 1,
                    fieldTipe: 1,
                    formula: "SUM(%product_unit_price% * %sale_item_quantity%)",
                    hasAggregateFunction: true,
                    title: "total_vendas",
                    type: 2
                }
            ],
            sort: [
                {
                    completeName: "calculatedField1",
                    direction: 1
                }
            ],
            whereFilters: {
                filters: [
                    {
                        completeName: "uf2_uf",
                        not: true,
                        operator: 0,
                        values: {
                            mode: 1,
                            fidexValues: [
                                "SC"
                            ]
                        }
                    }
                ]
            },
            havingFilters: {
                filters: [
                    {
                        completeName: "calculatedField1",
                        operator: 3,
                        not: false,
                        values: {
                            mode: 1,
                            fidexValues: [
                                10000
                            ]
                        }
                    }
                ]
            }
        },
        style: {}
    });
});


test('create grid config from sql 3 with * for metadataId 8 to equal ... ', () => {
    let sql = `SELECT * FROM data WHERE uf2_uf NOT LIKE 'SC'`;
    let fieldList = ['company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf'];
    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(8, ObjectTypes.Table, fieldList, sql);
    expect(weknowConfig).toEqual({
        version: "4.4.0",
        type: 3,
        viewAllowed: true,
        title: {
            text: "Título"
        },
        data: {
            metadataId: 8,
            immediately: true,
            autoScroll: {
                mode: 0
            },
            customLabelViews: {
                enabled: false
            },
            defaultColumn: {
                header: {
                    visible: true,
                },
                sizeMode: 2
            },
            gridBaseType: 1,
            columns: [
                {
                    completeName: "company_name",
                    title: "company_name"
                },
                {
                    completeName: "product_unit_price",
                    title: "product_unit_price"
                },
                {
                    completeName: "sale_item_quantity",
                    title: "sale_item_quantity"
                },
                {
                    completeName: "uf2_uf",
                    title: "uf2_uf"
                }
            ],
            style: {},
            whereFilters: {
                filters: [
                    {
                        completeName: "uf2_uf",
                        not: true,
                        operator: 0,
                        values: {
                            mode: 1,
                            fidexValues: [
                                "SC"
                            ]
                        }
                    }
                ]
            }
        },
        style: {}
    });
});


test('create chart config from sql 4 for metadataId 139 to equal ... ', () => {
    let sql = 'SELECT cd_produto, COUNT(cd_venda) AS total_vendas FROM data GROUP BY cd_produto ORDER BY total_vendas';
    let fieldList = [
        "ds_teste",
        "sn_informatica",
        "email_vendedor",
        "trimestre_venda",
        "tipo_produto",
        "mes_numero",
        "ds_categoria",
        "cd_categoria",
        "vl_unitario",
        "ds_produto",
        "cd_produto",
        "nm_cliente",
        "cd_cliente",
        "nm_vendedor",
        "cd_vendedor",
        "cd_empresa",
        "vl_total_venda",
        "qt_venda",
        "cd_item_venda",
        "cd_venda",
        "dt_venda",
        "dt_venda_yearMonth",
        "dt_venda_day",
        "dt_venda_month",
        "dt_venda_year",
        "anomes_venda"
    ];
    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(139, ObjectTypes.Chart, fieldList, sql);
    expect(weknowConfig).toEqual({
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
                            completeName: "cd_venda",
                            title: "total_vendas",
                            measureFunction: 1
                        }
                    ],
                    title: "total_vendas"
                }
            ],
            labels: [
                {
                    items: [
                        {
                            completeName: "cd_produto",
                            title: "cd_produto"
                        }
                    ],
                    title: "cd_produto"
                }
            ],
            sort: [{
                completeName: "cd_venda",
                direction: 0,
                measureFunction: 1
            }],
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
    });
});

test('create chart config from sql 5 for metadataId 139 to equal ... ', () => {
    let sql = 'SELECT ds_produto, COUNT(*) AS total_vendas FROM data GROUP BY ds_produto';
    let fieldList = [
        "ds_teste",
        "sn_informatica",
        "email_vendedor",
        "trimestre_venda",
        "tipo_produto",
        "mes_numero",
        "ds_categoria",
        "cd_categoria",
        "vl_unitario",
        "ds_produto",
        "cd_produto",
        "nm_cliente",
        "cd_cliente",
        "nm_vendedor",
        "cd_vendedor",
        "cd_empresa",
        "vl_total_venda",
        "qt_venda",
        "cd_item_venda",
        "cd_venda",
        "dt_venda",
        "dt_venda_yearMonth",
        "dt_venda_day",
        "dt_venda_month",
        "dt_venda_year",
        "anomes_venda"
    ];
    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(139, ObjectTypes.Chart, fieldList, sql);
    expect(weknowConfig).toEqual({
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
                            completeName: "calculatedField1",
                            title: "total_vendas",
                        }
                    ],
                    title: "total_vendas"
                }
            ],
            labels: [
                {
                    items: [
                        {
                            completeName: "ds_produto",
                            title: "ds_produto"
                        }
                    ],
                    title: "ds_produto"
                }
            ],
            calculatedFields: [
                {
                    completeName: "calculatedField1",
                    dataType: 1,
                    fieldTipe: 1,
                    formula: "COUNT(*)",
                    hasAggregateFunction: true,
                    title: "total_vendas",
                    type: 2
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
    });
});

test('create chart config from sql 6 with limit for metadataId 8 to equal ... ', () => {
    let sql = 'SELECT cd_produto, COUNT(cd_venda) AS total_vendas FROM data GROUP BY cd_produto ORDER BY total_vendas LIMIT 10;';
    let fieldList = [ "cd_produto", "cd_venda", "dt_venda", "dt_venda_yearMonth" ];
    let { weknowConfig } = astToWeknowService.createWeknowConfigFromSql(139, ObjectTypes.Chart, fieldList, sql);
    expect(weknowConfig).toEqual({
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
                            completeName: "cd_venda",
                            title: "total_vendas",
                            measureFunction: 1
                        }
                    ],
                    title: "total_vendas"
                }
            ],
            labels: [
                {
                    items: [
                        {
                            completeName: "cd_produto",
                            title: "cd_produto"
                        }
                    ],
                    title: "cd_produto"
                }
            ],
            sort: [{
                completeName: "cd_venda",
                direction: 0,
                measureFunction: 1
            }],
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
            labelLimit: { count: 10, showAdditional: true, additionalText: "Outros" },
            groups: []
        },
        style: {}
    });
});

test('astOperatorToWeknow LIKE', () => {
    expect(astToWeknowService.astOperatorToWeknow('LIKE')).toBe(astToWeknowService.ValidWeknowOperators.Contains);
});

test('astOperatorToWeknow <=', () => {
    expect(astToWeknowService.astOperatorToWeknow('<=')).toBe(astToWeknowService.ValidWeknowOperators.LessThanOrEqual);
});

test('should column_ref create calc field', () => {
    expect(astToWeknowService.shouldExprCreatesCalculatedField({ type: "column_ref", table: null, column: "company_name" })).toBe(false);
});

test('should complex agg_func create calc field', () => {
    expect(astToWeknowService.shouldExprCreatesCalculatedField({
        type: "aggr_func", name: "SUM",
        args: {
            expr: {
                type: "binary_expr", operator: "*",
                left: {
                    type: "column_ref", table: null, column: "%product_unit_price%"
                },
                right: {
                    type: "column_ref", table: null, column: "%sale_item_quantity%"
                }
            }
        }, over: null
    })).toBe(true);
});

test('should simples binary_expr create calc field', () => {
    expect(astToWeknowService.shouldExprCreatesCalculatedField({
        type: "binary_expr", operator: "NOT LIKE",
        left: {
            type: "column_ref", table: null, column: "uf2_uf"
        },
        right: {
            type: "single_quote_string", value: "SC"
        }
    })).toBe(false);
});

test('should binary_expr with aggr_func create calc field', () => {
    expect(astToWeknowService.shouldExprCreatesCalculatedField({
        type: "binary_expr", operator: ">",
        left: {
            type: "aggr_func", name: "SUM",
            args: {
                expr: {
                    type: "column_ref", table: null, column: "total_vendas"
                }
            },
            over: null
        },
        right: {
            type: "number", value: 10000
        }
    })).toBe(false);
});

test('should count(*) agg_func create calc field', () => {
    expect(astToWeknowService.shouldExprCreatesCalculatedField({
        type: 'aggr_func',
        name: 'COUNT',
        args: { expr: { type: 'star', value: '*' } },
        over: null
      })).toBe(true);
});
