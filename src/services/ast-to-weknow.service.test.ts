import { expect, test } from "vitest";
import { createWeknowConfigFromSql } from "./ast-to-weknow.service";
import { ObjectTypes } from "../constants";

test("create grid config from sql 1 for metadataId 8 to equal ... ", () => {
  const sql = `
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
  const fieldList = [
    "company_name",
    "product_unit_price",
    "sale_item_quantity",
    "uf2_uf",
    "uf2_longitude",
    "person_1_name",
    "valorTotalItem",
  ];
  const { weknowConfig } = createWeknowConfigFromSql(
    8,
    ObjectTypes.Table,
    fieldList,
    sql
  );
  expect(weknowConfig).toEqual({
    version: "4.4.0",
    type: 3,
    viewAllowed: true,
    title: {
      text: "Título",
    },
    data: {
      metadataId: 8,
      immediately: true,
      autoScroll: {
        mode: 0,
      },
      customLabelViews: {
        enabled: false,
      },
      defaultColumn: {
        header: {
          visible: true,
        },
        sizeMode: 2,
      },
      gridBaseType: 1,
      columns: [
        {
          completeName: "company_name",
          title: "company_name",
        },
        {
          completeName: "employee_id",
          title: "melhor_vendedor_id",
        },
        {
          completeName: "employee_person_id",
          title: "melhor_vendedor_person_id",
        },
        {
          completeName: "valorTotalItem",
          title: "total_vendas",
          measureFunction: 3,
        },
      ],
      whereFilters: {
        filters: [
          {
            completeName: "uf2_uf",
            operator: 0,
            not: true,
            values: {
              mode: 1,
              fidexValues: ["SC"],
            },
          },
        ],
      },
      sort: [
        {
          completeName: "valorTotalItem",
          measureFunction: 3,
          type: 1,
        },
      ],
      style: {},
    },
    style: {},
  });
});

// Add other test cases here as needed
