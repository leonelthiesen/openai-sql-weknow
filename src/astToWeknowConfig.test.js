import { expect, test } from 'vitest'
import { createWeknowGridConfigFromSql } from './astToWeknowConfig.js'

test('create grid config from sql for metadataId 8 to equal ... ', () => {
    let sql = `
            SELECT
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
    let { weknowConfig } = createWeknowGridConfigFromSql(8, sql);
    expect(weknowConfig).toEqual({
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
            }
        },
        style: {}
    });
})