import { faker } from "@faker-js/faker";

/**
 * Generates fake tabular data (max 10 rows) in the same format returned by
 * transformExecuteResult: { dimensions: string[], source: (string | number | null)[][] }
 */
export function generateFakeData(query: any): { dimensions: string[]; source: (string | number | null)[][] } {
  const columns: Array<{ completeName: string; measureFunction: number }> =
    query?.columns ?? [];

  const dimensions = columns.map((col) => col.completeName);

  const source = Array.from({ length: 10 }, () => {
    return columns.map((col): string | number | null => {
      const name = (col.completeName ?? "").toLowerCase();
      const isNumericAggregation = col.measureFunction !== 0;

      if (isNumericAggregation) {
        return faker.number.float({ min: 100, max: 100_000, fractionDigits: 2 });
      } else if (/data|date|dt_|_dt/.test(name)) {
        return faker.date.recent({ days: 365 }).toISOString().split("T")[0]!;
      } else if (/valor|value|preco|price|total|qtd|qty|amount|custo|cost/.test(name)) {
        return faker.number.float({ min: 10, max: 10_000, fractionDigits: 2 });
      } else if (/id$|_id/.test(name)) {
        return faker.number.int({ min: 1, max: 9999 });
      } else {
        return faker.company.name();
      }
    });
  });

  return { dimensions, source };
}
