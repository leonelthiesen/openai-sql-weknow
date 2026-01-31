import { expect, test } from "vitest";
import { createTableSql } from "./sql-create-statement.service";
import type { MetadataField } from "./sql-create-statement.service";

const metadataFields: MetadataField[] = [
  {
    isField: true,
    completeName: "ds_teste",
    title: "ds_teste",
    fieldType: 24,
    type: 1,
    typeEx: 1,
    canAutoLoad: false,
    formatOptions: {
      showEllipsis: false,
    },
    isAggregated: false,
    isWindowFunction: false,
    isMeasure: false,
    hasParentField: false,
    isHierarchy: false,
    hasPrivacyRules: false,
    parentField: null,
  } as any,
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
      trueText: "SIM",
    },
    isAggregated: false,
    isWindowFunction: false,
    isMeasure: true,
    hasParentField: false,
    isHierarchy: false,
    hasPrivacyRules: false,
    parentField: null,
  } as any,
  {
    isField: true,
    completeName: "email_vendedor",
    title: "E-mail Vendedor",
    fieldType: 24,
    type: 1,
    typeEx: 1,
    canAutoLoad: false,
    formatOptions: {
      showEllipsis: false,
    },
    isAggregated: false,
    isWindowFunction: false,
    isMeasure: false,
    hasParentField: false,
    isHierarchy: false,
    hasPrivacyRules: false,
    parentField: null,
  } as any,
];

test("createTableSql should generate CREATE TABLE statement", () => {
  const result = createTableSql(metadataFields);
  expect(result).toContain("CREATE TABLE data (");
  expect(result).toContain("ds_teste");
  expect(result).toContain("sn_informatica");
  expect(result).toContain("email_vendedor");
});

// Add other test cases here as needed
