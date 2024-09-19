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
    let fieldList = [ 'company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf', 'uf2_longitude', 'person_1_name', 'valorTotalItem'];
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
    let fieldList = [ 'company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf', 'uf2_longitude', 'person_1_name'];

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
                    isAggregated: true,
                    isMeasure: true,
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
    let fieldList = [ 'company_name', 'product_unit_price', 'sale_item_quantity', 'uf2_uf'];
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
