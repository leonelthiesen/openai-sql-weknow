import { baseGridConfig } from './constants.js';
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

export const ValidWeknowOperators = {
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

const AstSortTypeToWeknow = {
    'ASC': WeknowSortType.Asc,
    'DESC': WeknowSortType.Desc,
};

let astColumnIndexToCalculatedField = {};

export function createWeknowGridConfigFromSql(metadataId, fieldsList, sql) {
    let sqlParser = new Parser();
    const ast = sqlParser.astify(sql);
    return {
        ast,
        weknowGridConfig: createWeknowGridConfigFromAst(metadataId, fieldsList, ast)
    };
}

function createWeknowGridConfigFromAst(metadataId, fieldsList, sqlAst) {
    let statement = sqlAst[0];
    if (!Array.isArray(sqlAst)) {
        statement = sqlAst;
    }

    if (statement.type !== 'select' || !statement.columns || statement.columns.length === 0) {
        return null;
    }

    let weknowGridConfig = structuredClone(baseGridConfig);
    weknowGridConfig.data.metadataId = metadataId;

    weknowGridConfig.data.columns = [];

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

    statement.columns.forEach((column, index) => {
        let title = column.as || column.expr.column;

        let weknowColumnConfig = processAstExprToWeknow(weknowGridConfig, statement, column.expr, title, index);
        weknowGridConfig.data.columns.push(weknowColumnConfig);
    });

    if (statement.orderby) {
        weknowGridConfig.data.sort = [];
        statement.orderby.forEach((orderBy) => {
            let weknowColumnConfig = processAstExprToWeknow(weknowGridConfig, statement, orderBy.expr, orderBy.as);

            weknowColumnConfig.direction = AstSortTypeToWeknow[orderBy.type];

            weknowGridConfig.data.sort.push(weknowColumnConfig);
        });
        fixCompleteNameRefs(weknowGridConfig.data.columns, weknowGridConfig.data.sort);
    }

    if (statement.where) {
        weknowGridConfig.data.whereFilters = {
            filters: []
        }
        if (Array.isArray(statement.where)) {
            // statement.where.forEach((where) => {
            //     weknowGridConfig.data.sort.push(weknowColumnConfig);
            // });
        } else {
            let weknowWhereConfig = processAstExprToWeknow(weknowGridConfig, statement, statement.where, '');
            weknowGridConfig.data.whereFilters.filters.push(weknowWhereConfig);
        }
        fixCompleteNameRefs(weknowGridConfig.data.columns, weknowGridConfig.data.whereFilters.filters);
    }

    if (statement.having) {
        weknowGridConfig.data.havingFilters = {
            filters: []
        };
        if (Array.isArray(statement.having)) {
            // statement.having.forEach((having) => {
            //     weknowGridConfig.data.sort.push(weknowColumnConfig);
            // });
        } else {
            let weknowHavingConfig = processAstExprToWeknow(weknowGridConfig, statement, statement.having, '');
            weknowGridConfig.data.havingFilters.filters.push(weknowHavingConfig);
        }
        fixCompleteNameRefs(weknowGridConfig.data.columns, weknowGridConfig.data.havingFilters.filters);
    }

    return weknowGridConfig;
}

export function astOperatorToWeknow(astOperator) {
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
            }
        }
    });
}

export function shouldExprCreatesCalculatedField (expr) {
    if (expr.type === 'column_ref') {
        return false;
    } else if (expr.type === 'aggr_func' && expr.args.expr.type === 'column_ref') {
        let sqlAgg = expr.name;
        let measureFunction = AstAggFunctionToWeknow[sqlAgg];
        if (measureFunction) {
            return false;
        }
    } else if (expr.type === 'binary_expr') {
        return shouldExprCreatesCalculatedField(expr.left) || shouldExprCreatesCalculatedField(expr.right);
    } else if (expr.type === "number") {
        return false;
    } else if (expr.type === "single_quote_string") {
        return false;
    }
    return true;
}

export function processAstExprToWeknow(weknowGridConfig, statement, expr, title, statementColumnIndex) {
    let measureFunction;

    let weknowItem = {
        completeName: expr.column
    };

    if (shouldExprCreatesCalculatedField(expr)) {
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
        measureFunction = AstAggFunctionToWeknow[sqlAgg];
        if (measureFunction) {
            weknowItem.completeName = expr.args.expr.column;
            weknowItem.title = title || expr.args.expr.column;
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

    let calculatedField = {
        completeName: name,
        dataType: DataTypes.X,
        fieldTipe: FieldTypes.X,
        formula: columnSqlText,
        hasAggregateFunction: true, // TODO: pegar do ast?
        isAggregated: true, // TODO: pegar do ast?
        isMeasure: true, //TODO: pegar do ast?
        title: title,
        type: CalculatedFieldTypes.X
    };
    return calculatedField;
}
