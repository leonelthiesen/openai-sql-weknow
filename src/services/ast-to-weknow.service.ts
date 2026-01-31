import { ObjectTypes, baseChartConfig, baseGridConfig, GridConfig, ChartConfig } from "../constants";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Parser } = require("node-sql-parser");

export enum WeknowAggFunctions {
  None = 0,
  Count = 1,
  DistinctCount = 2,
  Sum = 3,
  Max = 4,
  Min = 5,
  Average = 6,
  List = 7,
  DistinctList = 8,
  DistinctSum = 9,
  DistinctAverage = 10,
}

export enum ValidWeknowOperators {
  Contains = 0,
  Equals = 1,
  GreatherThan = 3,
  GreatherThanOrEqual = 4,
  LessThan = 5,
  LessThanOrEqual = 6,
  IsNull = 11,
}

const AstOperatorToWeknow: Record<string, ValidWeknowOperators> = {
  LIKE: ValidWeknowOperators.Contains,
  "NOT LIKE": ValidWeknowOperators.Contains,
  "=": ValidWeknowOperators.Equals,
  ">": ValidWeknowOperators.GreatherThan,
  ">=": ValidWeknowOperators.GreatherThanOrEqual,
  "<": ValidWeknowOperators.LessThan,
  "<=": ValidWeknowOperators.LessThanOrEqual,
  "IS NULL": ValidWeknowOperators.IsNull,
};

enum WeknowSortType {
  Asc = 0,
  Desc = 1,
}

const AstAggFunctionToWeknow: Record<string, WeknowAggFunctions> = {
  COUNT: WeknowAggFunctions.Count,
  SUM: WeknowAggFunctions.Sum,
  MAX: WeknowAggFunctions.Max,
  MIN: WeknowAggFunctions.Min,
  AVG: WeknowAggFunctions.Average,
};

const AstDistinctAggFunctionToWeknow: Record<string, WeknowAggFunctions> = {
  COUNT: WeknowAggFunctions.DistinctCount,
  SUM: WeknowAggFunctions.DistinctSum,
  MAX: WeknowAggFunctions.Max,
  MIN: WeknowAggFunctions.Min,
  AVG: WeknowAggFunctions.DistinctAverage,
};

const AstSortTypeToWeknow: Record<string, WeknowSortType> = {
  ASC: WeknowSortType.Asc,
  DESC: WeknowSortType.Desc,
};

interface AstExpr {
  type: string;
  column?: string;
  name?: string;
  operator?: string;
  left?: AstExpr;
  right?: AstExpr;
  args?: {
    expr: AstExpr;
    distinct?: string;
  };
  value?: any;
  [key: string]: any;
}

interface AstColumn {
  expr: AstExpr;
  as?: string;
}

interface AstStatement {
  type: string;
  columns: AstColumn[];
  distinct?: string;
  from?: any[];
  where?: AstExpr;
  groupby?: AstExpr[];
  having?: AstExpr | AstExpr[];
  orderby?: Array<{
    expr: AstExpr;
    type: string;
  }>;
  limit?: {
    value: Array<{ type: string; value: number }>;
  };
}

interface WeknowItem {
  completeName?: string;
  title?: string;
  measureFunction?: WeknowAggFunctions;
  operator?: ValidWeknowOperators;
  not?: boolean;
  values?: {
    mode: number;
    fidexValues: any[];
  };
  [key: string]: any;
}

interface CalculatedField {
  completeName: string;
  dataType: number;
  fieldTipe: number;
  formula: string;
  hasAggregateFunction: boolean;
  title: string;
  type: number;
}

interface ColumnRef {
  completeName: string;
  measureFunction?: WeknowAggFunctions;
  title?: string;
}

let astColumnIndexToCalculatedField: Record<number, string> = {};

export function createWeknowConfigFromSql(
  metadataId: number,
  type: ObjectTypes,
  fieldsList: string[],
  sql: string
): { ast: AstStatement | AstStatement[]; weknowConfig: GridConfig | ChartConfig | null } {
  const sqlParser = new Parser();
  const ast = sqlParser.astify(sql);
  return {
    ast,
    weknowConfig: createWeknowConfigFromAst(metadataId, type, fieldsList, ast),
  };
}

function createWeknowConfigFromAst(
  metadataId: number,
  type: ObjectTypes,
  fieldsList: string[],
  sqlAst: AstStatement | AstStatement[]
): GridConfig | ChartConfig | null {
  astColumnIndexToCalculatedField = {};
  let statement: AstStatement = sqlAst as AstStatement;
  if (Array.isArray(sqlAst)) {
    statement = sqlAst[0] as AstStatement;
  }

  if (statement.type !== "select" || !statement.columns || statement.columns.length === 0) {
    return null;
  }

  let weknowConfig: GridConfig | ChartConfig;
  if (type === ObjectTypes.Chart) {
    weknowConfig = structuredClone(baseChartConfig) as ChartConfig;
    (weknowConfig as ChartConfig).data.labels = [];
  } else {
    weknowConfig = structuredClone(baseGridConfig) as GridConfig;
    (weknowConfig as GridConfig).data.columns = [];
  }

  weknowConfig.data.metadataId = +metadataId;

  const statementDistinct = statement.distinct;

  // Verifica se existe alguma coluna que é igual a "*", neste caso ajusta o ast para pegar todas as colunas da tabela
  const allColumnsIndex = statement.columns.findIndex(
    (column) => column.expr.column === "*"
  );
  if (allColumnsIndex > -1) {
    statement.columns.splice(allColumnsIndex, 1);

    fieldsList.forEach((completeName) => {
      statement.columns.push({
        expr: {
          type: "column_ref",
          table: null,
          column: completeName,
        },
        as: completeName,
      });
    });
  }

  const valueItemTemp: { items: WeknowItem[] } = { items: [] };
  statement.columns.forEach((column, index) => {
    const title = column.as || column.expr.column;

    const weknowItemConfig = processAstExprToWeknow(
      weknowConfig,
      statement,
      column.expr,
      title!,
      index,
      statementDistinct
    );
    if (type === ObjectTypes.Chart) {
      const chartConfig = weknowConfig as ChartConfig;
      if (column.expr.type === "aggr_func") {
        valueItemTemp.items.push(weknowItemConfig);
      } else {
        chartConfig.data.labels.push({
          items: [weknowItemConfig],
          title: weknowItemConfig.title!,
        });
      }
    } else {
      (weknowConfig as GridConfig).data.columns.push(weknowItemConfig);
    }
  });

  if (valueItemTemp.items.length > 0) {
    (weknowConfig as ChartConfig).data.values = [
      {
        items: valueItemTemp.items,
        title: valueItemTemp.items.map((item) => item.title).join(", "),
      },
    ];
  }

  let columnRefs: ColumnRef[];
  if (type === ObjectTypes.Chart) {
    const chartConfig = weknowConfig as ChartConfig;
    columnRefs = (chartConfig.data.values || [])
      .concat(chartConfig.data.labels || [])
      .map((item: any) => {
        return {
          completeName: item.items[0].completeName,
          measureFunction: item.items[0].measureFunction,
          title: item.title,
        };
      });
  } else {
    columnRefs = (weknowConfig as GridConfig).data.columns.map((item: any) => {
      return {
        completeName: item.completeName,
        measureFunction: item.measureFunction,
        title: item.title,
      };
    });
  }

  if (statement.groupby) {
    (weknowConfig as any).data.groups = [];
    statement.groupby.forEach((groupby) => {
      const weknowColumnConfig = processAstExprToWeknow(
        weknowConfig,
        statement,
        groupby,
        "",
        -1,
        statementDistinct
      );
      (weknowConfig as any).data.groups.push(weknowColumnConfig);
    });
    fixCompleteNameRefs(columnRefs, (weknowConfig as any).data.groups);
  }

  if (statement.orderby) {
    (weknowConfig as any).data.sort = [];
    statement.orderby.forEach((orderby) => {
      const weknowColumnConfig = processAstExprToWeknow(
        weknowConfig,
        statement,
        orderby.expr,
        "",
        -1,
        statementDistinct
      );
      weknowColumnConfig.type = AstSortTypeToWeknow[orderby.type];
      (weknowConfig as any).data.sort.push(weknowColumnConfig);
    });
    fixCompleteNameRefs(columnRefs, (weknowConfig as any).data.sort);
  }

  if (statement.where) {
    (weknowConfig as any).data.whereFilters = {
      filters: [],
    };
    if (Array.isArray(statement.where)) {
      // statement.where.forEach((where) => {
      //     weknowGridConfig.data.sort.push(weknowColumnConfig);
      // });
    } else {
      const weknowWhereConfig = processAstExprToWeknow(
        weknowConfig,
        statement,
        statement.where,
        "",
        -1,
        statementDistinct
      );
      (weknowConfig as any).data.whereFilters.filters.push(weknowWhereConfig);
    }
    fixCompleteNameRefs(columnRefs, (weknowConfig as any).data.whereFilters.filters);
  }

  if (statement.having) {
    (weknowConfig as any).data.havingFilters = {
      filters: [],
    };
    if (Array.isArray(statement.having)) {
      // statement.having.forEach((having) => {
      //     weknowGridConfig.data.sort.push(weknowColumnConfig);
      // });
    } else {
      const weknowHavingConfig = processAstExprToWeknow(
        weknowConfig,
        statement,
        statement.having,
        "",
        -1,
        statementDistinct
      );
      (weknowConfig as any).data.havingFilters.filters.push(weknowHavingConfig);
    }
    fixCompleteNameRefs(columnRefs, (weknowConfig as any).data.havingFilters.filters);
  }

  if (statement.limit && statement.limit.value[0]) {
    const limit = statement.limit.value[0];
    if (limit.type === "number") {
      (weknowConfig as any).data.labelLimit = {
        count: limit.value,
        showAdditional: true,
        additionalText: "Outros",
      };
    }
  } else {
    // TODO: limitar a quantidade de registros para o tipo de objeto grid
  }

  if ((weknowConfig as any).data.groups?.length === 0) {
    delete (weknowConfig as any).data.groups;
  }

  if ((weknowConfig as ChartConfig).data.labels?.length === 0) {
    (weknowConfig as ChartConfig).data.labels = undefined as any;
  }

  return weknowConfig;
}

export function astOperatorToWeknow(astOperator: string): ValidWeknowOperators {
  return AstOperatorToWeknow[astOperator] || ValidWeknowOperators.Equals;
}

function astNegationToWeknow(astOperator: string): boolean {
  if (astOperator === "NOT LIKE") {
    return true;
  }
  return false;
}

function fixCompleteNameRefs(columns: ColumnRef[], weknowItems: WeknowItem[]): void {
  weknowItems.forEach((weknowItem) => {
    if (weknowItem.completeName) {
      const columnIndex = columns.findIndex(
        (column) => column.title === weknowItem.completeName
      );
      if (columnIndex > -1) {
        const column = columns[columnIndex];
        if (column) {
          weknowItem.completeName = column.completeName;
          weknowItem.measureFunction = column.measureFunction;
        }
      }
    }
  });
}

export function shouldExprCreatesCalculatedField(expr: AstExpr, statementDistinct?: string): boolean {
  if (expr.type === "column_ref") {
    return false;
  } else if (expr.type === "aggr_func" && expr.args?.expr.type === "column_ref") {
    const sqlAgg = expr.name!;
    const measureFunction = getWeknowAggFunction(
      sqlAgg,
      statementDistinct || expr.args.distinct
    );
    if (measureFunction) {
      return false;
    }
  } else if (expr.type === "binary_expr") {
    return (
      shouldExprCreatesCalculatedField(expr.left!, statementDistinct) ||
      shouldExprCreatesCalculatedField(expr.right!, statementDistinct)
    );
  } else if (expr.type === "number") {
    return false;
  } else if (expr.type === "single_quote_string") {
    return false;
  }
  return true;
}

export function gridConfigAllowChartRender(gridConfig: GridConfig): boolean {
  const calculatedFields = (gridConfig.data as any).calculatedFields || [];

  if (gridConfig && gridConfig.data) {
    const allMeasureColumns = gridConfig.data.columns.every((column: any, index: number) => {
      const calculatedFieldName = astColumnIndexToCalculatedField[index];
      let calculatedFieldHasAggregation = false;
      if (calculatedFieldName) {
        const calculatedField = calculatedFields.find(
          (field: CalculatedField) => field.completeName === calculatedFieldName
        );
        calculatedFieldHasAggregation = calculatedField?.hasAggregateFunction || false;
      }
      return column.measureFunction > 0 || calculatedFieldHasAggregation;
    });

    if (allMeasureColumns) {
      return false;
    }

    return gridConfig.data.columns.some((column: any, index: number) => {
      const calculatedFieldName = astColumnIndexToCalculatedField[index];
      let calculatedFieldHasAggregation = false;
      if (calculatedFieldName) {
        const calculatedField = calculatedFields.find(
          (field: CalculatedField) => field.completeName === calculatedFieldName
        );
        calculatedFieldHasAggregation = calculatedField?.hasAggregateFunction || false;
      }
      return column.measureFunction > 0 || calculatedFieldHasAggregation;
    });
  }
  return false;
}

export function processAstExprToWeknow(
  weknowGridConfig: GridConfig | ChartConfig,
  _statement: AstStatement,
  expr: AstExpr,
  title: string,
  statementColumnIndex?: number,
  statementDistinct?: string
): WeknowItem {
  const weknowItem: WeknowItem = {
    completeName: expr.column,
  };

  if (shouldExprCreatesCalculatedField(expr, statementDistinct)) {
    if (!(weknowGridConfig.data as any).calculatedFields) {
      (weknowGridConfig.data as any).calculatedFields = [];
    }

    const calculatedFieldsCount = (weknowGridConfig.data as any).calculatedFields.length + 1;
    const calculatedFieldName = `calculatedField${calculatedFieldsCount}`;
    const calculatedField = createCalculatedField(expr, title, calculatedFieldName);

    if (statementColumnIndex !== undefined && statementColumnIndex >= 0) {
      astColumnIndexToCalculatedField[statementColumnIndex] = calculatedFieldName;
    }

    weknowItem.completeName = calculatedField.completeName;
    weknowItem.title = title || calculatedField.completeName;

    (weknowGridConfig.data as any).calculatedFields.push(calculatedField);
  } else if (expr.type === "aggr_func" && expr.args?.expr.type === "column_ref") {
    // Se for uma função de agregação e existir apenas uma coluna referenciada...
    const sqlAgg = expr.name!;
    const measureFunction = getWeknowAggFunction(
      sqlAgg,
      statementDistinct || expr.args.distinct
    );
    if (measureFunction) {
      weknowItem.completeName = expr.args.expr.column;
      weknowItem.title = title || expr.args.expr.column;
      weknowItem.measureFunction = measureFunction;
    }
  } else if (expr.type === "column_ref" && title) {
    weknowItem.title = title;
  } else if (expr.type === "binary_expr") {
    if (expr.left?.type === "aggr_func") {
      weknowItem.completeName = expr.left.args?.expr.column;
    } else {
      weknowItem.completeName = expr.left?.column;
    }

    weknowItem.operator = astOperatorToWeknow(expr.operator!);
    weknowItem.not = astNegationToWeknow(expr.operator!);
    weknowItem.values = {
      mode: 1,
      fidexValues: [expr.right?.value],
    };
  }

  return weknowItem;
}

function createCalculatedField(astExpr: AstExpr, title: string, name: string): CalculatedField {
  function convertColumnRefs(object: any): void {
    if (object.type === "column_ref") {
      object.column = `%${object.column}%`;
    }
    for (const key in object) {
      if (typeof object[key] === "object" && object[key] !== null) {
        convertColumnRefs(object[key]);
      }
    }
  }

  convertColumnRefs(astExpr);

  const DataTypes = {
    X: 1,
  };

  const FieldTypes = {
    X: 1,
  };

  const CalculatedFieldTypes = {
    X: 2,
  };

  const sqlParser = new Parser();
  const columnSqlText = sqlParser.exprToSQL(astExpr).replace(/`/g, "");

  if (title === undefined) {
    title = name;
  }

  const hasAggregateFunction = astExprHasAggregationFunction(astExpr);

  const calculatedField: CalculatedField = {
    completeName: name,
    dataType: DataTypes.X,
    fieldTipe: FieldTypes.X,
    formula: columnSqlText,
    hasAggregateFunction,
    title: title,
    type: CalculatedFieldTypes.X,
  };
  return calculatedField;
}

function astExprHasAggregationFunction(astExpr: AstExpr): boolean {
  if (astExpr.type === "aggr_func") {
    return true;
  } else if (astExpr.type === "binary_expr") {
    return (
      astExprHasAggregationFunction(astExpr.left!) ||
      astExprHasAggregationFunction(astExpr.right!)
    );
  }
  return false;
}

function getWeknowAggFunction(sqlAgg: string, distinct?: string): WeknowAggFunctions | undefined {
  if (distinct) {
    return AstDistinctAggFunctionToWeknow[sqlAgg];
  }
  return AstAggFunctionToWeknow[sqlAgg];
}
