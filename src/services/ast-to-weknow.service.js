import { ObjectTypes, baseChartConfig, baseGridConfig } from '../constants.js';
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Parser } = require('node-sql-parser');

const WeknowAggFunctions = {
    None: 0,
    Count: 1,
    DistinctCount: 2,
    Sum: 3,
    Max: 4,
    Min: 5,
    Average: 6,
    List: 7,
    DistinctList: 8,
    DistinctSum: 9,
    DistinctAverage: 10,
}

const ValidWeknowOperators = {
    Contains: 0,
    Equals: 1,
    GreatherThan: 3,
    GreatherThanOrEqual: 4,
    LessThan: 5,
    LessThanOrEqual: 6,
    IsNull: 11
}

const AstOperatorToWeknow = {
    'LIKE': ValidWeknowOperators.Contains,
    'NOT LIKE': ValidWeknowOperators.Contains,
    '=': ValidWeknowOperators.Equals,
    '>': ValidWeknowOperators.GreatherThan,
    '>=': ValidWeknowOperators.GreatherThanOrEqual,
    '<': ValidWeknowOperators.LessThan,
    '<=': ValidWeknowOperators.LessThanOrEqual,
    'IS NULL': ValidWeknowOperators.IsNull,
}

const WeknowSortType = {
    Asc: 0,
    Desc: 1,
}

const AstAggFunctionToWeknow = {
    'COUNT': WeknowAggFunctions.Count,
    'SUM': WeknowAggFunctions.Sum,
    'MAX': WeknowAggFunctions.Max,
    'MIN': WeknowAggFunctions.Min,
    'AVG': WeknowAggFunctions.Average,
};

const AstDistinctAggFunctionToWeknow = {
    'COUNT': WeknowAggFunctions.DistinctCount,
    'SUM': WeknowAggFunctions.DistinctSum,
    'MAX': WeknowAggFunctions.Max,
    'MIN': WeknowAggFunctions.Min,
    'AVG': WeknowAggFunctions.DistinctAverage,
};

const AstSortTypeToWeknow = {
    'ASC': WeknowSortType.Asc,
    'DESC': WeknowSortType.Desc,
};

let astColumnIndexToCalculatedField = {};

function createWeknowConfigFromSql(metadataId, type, fieldsList, sql) {
    let sqlParser = new Parser();
    const ast = sqlParser.astify(sql);
    return {
        ast,
        weknowConfig: createWeknowConfigFromAst(metadataId, type, fieldsList, ast)
    };
}

function createWeknowConfigFromAst(metadataId, type, fieldsList, sqlAst) {
    astColumnIndexToCalculatedField = {};
    let statement = sqlAst[0];
    if (!Array.isArray(sqlAst)) {
        statement = sqlAst;
    }

    if (statement.type !== 'select' || !statement.columns || statement.columns.length === 0) {
        return null;
    }

    let weknowConfig;
    if (type === ObjectTypes.Chart) {
        weknowConfig = structuredClone(baseChartConfig);
        weknowConfig.data.labels = [];
    } else {
        weknowConfig = structuredClone(baseGridConfig);
        weknowConfig.data.columns = [];
    }

    weknowConfig.data.metadataId = +metadataId;

    let statementDistinct = statement.distinct;

    // Verifica se existe alguma coluna que é igual a "*", neste caso ajusta o ast para pegar todas as colunas da tabela
    let allColumnsIndex = statement.columns.findIndex((column) => column.expr.column === '*');
    if (allColumnsIndex > -1) {
        statement.columns.splice(allColumnsIndex, 1);

        fieldsList.forEach((completeName) => {
            statement.columns.push({
                expr: {
                    type: "column_ref",
                    table: null,
                    column: completeName
                },
                as: completeName
            });
        });
    }

    let valueItemTemp = { items: [] };
    statement.columns.forEach((column, index) => {
        let title = column.as || column.expr.column;

        let weknowItemConfig = processAstExprToWeknow(weknowConfig, statement, column.expr, title, index, statementDistinct);
        if (type === ObjectTypes.Chart) {
            if (column.expr.type === 'aggr_func') {
                valueItemTemp.items.push(weknowItemConfig);
            } else {
                weknowConfig.data.labels.push({
                    items: [weknowItemConfig],
                    title: weknowItemConfig.title
                });
            }
        } else {
            weknowConfig.data.columns.push(weknowItemConfig);
        }
    });

    if (valueItemTemp.items.length > 0) {
        weknowConfig.data.values = [{
            items: valueItemTemp.items,
            title: valueItemTemp.items.map((item) => item.title).join(', ')
        }];
    }

    let columnRefs;
    if (type === ObjectTypes.Chart) {
        columnRefs = (weknowConfig.data.values || []).concat(weknowConfig.data.labels || []).map((item) => {
            return {
                completeName: item.items[0].completeName,
                measureFunction: item.items[0].measureFunction,
                title: item.title
            }
        });
    } else {
        columnRefs = weknowConfig.data.columns;
    }

    if (statement.orderby) {
        weknowConfig.data.sort = [];
        statement.orderby.forEach((orderBy) => {
            let weknowItemConfig = processAstExprToWeknow(weknowConfig, statement, orderBy.expr, '');

            weknowItemConfig.direction = AstSortTypeToWeknow[orderBy.type || 'ASC'];

            weknowConfig.data.sort.push(weknowItemConfig);
        });
        fixCompleteNameRefs(columnRefs, weknowConfig.data.sort);
    }

    weknowConfig.data.groups = [];
    if (statement.groupby) {
        statement.groupby.forEach((groupby) => {
            let weknowItemConfig = processAstExprToWeknow(weknowConfig, statement, groupby, '');

            // Se já estiver em values ou labels (columnRefs), não adiciona novamente
            let columnIndex = columnRefs.findIndex((column) => column.completeName === weknowItemConfig.completeName);
            if (columnIndex > -1) {
                return;
            }

            if (type === ObjectTypes.Chart) {
                weknowConfig.data.groups.push(weknowItemConfig);
            } else {
                weknowConfig.data.columns.push(weknowItemConfig);
            }
        });
        fixCompleteNameRefs(columnRefs, weknowConfig.data.groups);
    }

    if (statement.where) {
        weknowConfig.data.whereFilters = {
            filters: []
        }
        if (Array.isArray(statement.where)) {
            // statement.where.forEach((where) => {
            //     weknowGridConfig.data.sort.push(weknowColumnConfig);
            // });
        } else {
            let weknowWhereConfig = processAstExprToWeknow(weknowConfig, statement, statement.where, '');
            weknowConfig.data.whereFilters.filters.push(weknowWhereConfig);
        }
        fixCompleteNameRefs(columnRefs, weknowConfig.data.whereFilters.filters);
    }

    if (statement.having) {
        weknowConfig.data.havingFilters = {
            filters: []
        };
        if (Array.isArray(statement.having)) {
            // statement.having.forEach((having) => {
            //     weknowGridConfig.data.sort.push(weknowColumnConfig);
            // });
        } else {
            let weknowHavingConfig = processAstExprToWeknow(weknowConfig, statement, statement.having, '');
            weknowConfig.data.havingFilters.filters.push(weknowHavingConfig);
        }
        fixCompleteNameRefs(columnRefs, weknowConfig.data.havingFilters.filters);
    }

    if (statement.limit && statement.limit.value[0]) {
        let limit = statement.limit.value[0];
        if (limit.type === 'number') {
            weknowConfig.data.labelLimit = {
                count: limit.value,
                showAdditional: true,
                additionalText: "Outros"
            };
        }
    } else {
        // TODO: limitar a quantidade de registros para o tipo de objeto grid
    }

    if (weknowConfig.data.groups?.length === 0) {
        delete weknowConfig.data.groups;
    }

    if (weknowConfig.data.labels?.length === 0) {
        delete weknowConfig.data.labels;
    }

    return weknowConfig;
}

function astOperatorToWeknow(astOperator) {
    return AstOperatorToWeknow[astOperator];
}

function astNegationToWeknow(astOperator) {
    if (astOperator === 'NOT LIKE') {
        return true;
    }
    return false;
}

function fixCompleteNameRefs (columns, weknowItems) {
    weknowItems.forEach((weknowItem) => {
        if (weknowItem.completeName) {
            let columnIndex = columns.findIndex((column) => column.title === weknowItem.completeName);
            if (columnIndex > -1) {
                let column = columns[columnIndex];
                weknowItem.completeName = column.completeName;
                weknowItem.measureFunction = column.measureFunction;
            }
        }
    });
}

function shouldExprCreatesCalculatedField (expr, statementDistinct) {
    if (expr.type === 'column_ref') {
        return false;
    } else if (expr.type === 'aggr_func' && expr.args.expr.type === 'column_ref') {
        let sqlAgg = expr.name;
        let measureFunction = getWeknowAggFunction(sqlAgg, statementDistinct || expr.args.distinct);
        if (measureFunction) {
            return false;
        }
    } else if (expr.type === 'binary_expr') {
        return shouldExprCreatesCalculatedField(expr.left, statementDistinct) || shouldExprCreatesCalculatedField(expr.right, statementDistinct);
    } else if (expr.type === "number") {
        return false;
    } else if (expr.type === "single_quote_string") {
        return false;
    }
    return true;
}

function gridConfigAllowChartRender (gridConfig) {
    let calculatedFields = gridConfig.data.calculatedFields || [];

    if (gridConfig && gridConfig.data) {
        let allMeasureColumns = gridConfig.data.columns.every((column, index) => {
            let calculatedFieldName = astColumnIndexToCalculatedField[index];
            let calculatedFieldHasAggregation = false;
            if (calculatedFieldName) {
                let calculatedField = calculatedFields.find((field) => field.completeName === calculatedFieldName);
                calculatedFieldHasAggregation = calculatedField.hasAggregateFunction;
            }
            return column.measureFunction > 0 || calculatedFieldHasAggregation;
        });

        if (allMeasureColumns) {
            return false;
        }

        return gridConfig.data.columns.some((column, index) => {
            let calculatedFieldName = astColumnIndexToCalculatedField[index];
            let calculatedFieldHasAggregation = false;
            if (calculatedFieldName) {
                let calculatedField = calculatedFields.find((field) => field.completeName === calculatedFieldName);
                calculatedFieldHasAggregation = calculatedField.hasAggregateFunction;
            }
            return column.measureFunction > 0 || calculatedFieldHasAggregation;
        });
    }
    return false;
}

function processAstExprToWeknow(weknowGridConfig, statement, expr, title, statementColumnIndex, statementDistinct) {
    let weknowItem = {
        completeName: expr.column
    };

    if (shouldExprCreatesCalculatedField(expr, statementDistinct)) {
        if (!weknowGridConfig.data.calculatedFields) {
            weknowGridConfig.data.calculatedFields = [];
        }

        let calculatedFieldsCount = weknowGridConfig.data.calculatedFields.length + 1;
        let calculatedFieldName = `calculatedField${calculatedFieldsCount}`;
        let calculatedField = createCalculatedField(expr, title, calculatedFieldName);

        astColumnIndexToCalculatedField[statementColumnIndex] = calculatedFieldName;

        weknowItem.completeName = calculatedField.completeName;
        weknowItem.title = title || calculatedField.completeName;

        weknowGridConfig.data.calculatedFields.push(calculatedField);
    } else if (expr.type === 'aggr_func' && expr.args.expr.type === 'column_ref') { // Se for uma função de agregação e existir apenas uma coluna referenciada...
        let sqlAgg = expr.name;
        let measureFunction = getWeknowAggFunction(sqlAgg, statementDistinct || expr.args.distinct);
        if (measureFunction) {
            weknowItem.completeName = expr.args.expr.column;
            weknowItem.title = title || expr.args.expr.column;
            weknowItem.measureFunction = measureFunction;
        }
    } else if (expr.type === 'column_ref' && title) {
        weknowItem.title = title;
    } else if (expr.type === 'binary_expr') {
        if (expr.left.type === 'aggr_func') {
            weknowItem.completeName = expr.left.args.expr.column;
        } else {
            weknowItem.completeName = expr.left.column;
        }

        weknowItem.operator = astOperatorToWeknow(expr.operator);
        weknowItem.not = astNegationToWeknow(expr.operator);
        weknowItem.values = {
            mode: 1,
            fidexValues: [expr.right.value]
        };
    }

    return weknowItem;
}

function createCalculatedField(astExpr, title, name) {
    function convertColumnRefs(object) {
        if (object.type === 'column_ref') {
            object.column = `%${object.column}%`;
        }
        for (let key in object) {
            if (typeof object[key] === 'object' && object[key] !== null) {
                convertColumnRefs(object[key]);
            }
        }
    }

    convertColumnRefs(astExpr);

    const DataTypes = {
        X: 1
    };

    const FieldTypes = {
        X: 1
    };

    const CalculatedFieldTypes = {
        X: 2
    };

    let sqlParser = new Parser();
    let columnSqlText = sqlParser.exprToSQL(astExpr).replace(/`/g, '');

    if (title === undefined) {
        title = name;
    }

    const hasAggregateFunction = astExprHasAggregationFunction(astExpr);

    let calculatedField = {
        completeName: name,
        dataType: DataTypes.X,
        fieldTipe: FieldTypes.X,
        formula: columnSqlText,
        hasAggregateFunction,
        title: title,
        type: CalculatedFieldTypes.X
    };
    return calculatedField;
}

function astExprHasAggregationFunction (astExpr) {
    if (astExpr.type === 'aggr_func') {
        return true;
    } else if (astExpr.type === 'binary_expr') {
        return astExprHasAggregationFunction(astExpr.left) || astExprHasAggregationFunction(astExpr.right);
    }
    return false;

}

function getWeknowAggFunction (sqlAgg, distinct) {
    if (distinct) {
        return AstDistinctAggFunctionToWeknow[sqlAgg];
    }
    return AstAggFunctionToWeknow[sqlAgg];
}

export default {
    createWeknowConfigFromSql,
    ValidWeknowOperators,
    astOperatorToWeknow,
    shouldExprCreatesCalculatedField,
    processAstExprToWeknow,
    gridConfigAllowChartRender
};
