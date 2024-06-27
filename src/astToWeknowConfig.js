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

const AstSortTypeToWeknow = {
    'ASC': WeknowSortType.Asc,
    'DESC': WeknowSortType.Desc,
};

let astColumnIndexToCalculatedField = {};

export function createWeknowGridConfigFromSql (metadataId, sql) {
    let sqlParser = new Parser();
    const ast = sqlParser.astify(sql);
    return {
        ast,
        weknowGridConfig: createWeknowGridConfigFromAst(metadataId, ast)
    };
}

function createWeknowGridConfigFromAst (metadataId, sqlAst) {
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
    statement.columns.forEach((column, index) => {
        let title = column.as || column.expr.column;
        let weknowColumnConfig = processAstExprToWeknow(weknowGridConfig, column.expr, title, index);

        weknowGridConfig.data.columns.push(weknowColumnConfig);
    });

    weknowGridConfig.data.sort = [];
    statement.orderby && statement.orderby.forEach((orderBy) => {
        if (orderBy.expr.type === 'column_ref') {
            let columnIndex = statement.columns.findIndex((column) => column.as === orderBy.expr.column);
            if (columnIndex > -1)  {
                let column = statement.columns[columnIndex];
                if (astColumnIndexToCalculatedField[columnIndex]) {
                    orderBy.expr.column = astColumnIndexToCalculatedField[columnIndex];
                } else {
                    orderBy.expr.column = column.expr.column;
                    orderBy.as = column.expr.column;
                }
            }
        }

        let weknowColumnConfig = processAstExprToWeknow(weknowGridConfig, orderBy.expr, orderBy.as);

        weknowColumnConfig.direction = AstSortTypeToWeknow[orderBy.type];

        weknowGridConfig.data.sort.push(weknowColumnConfig);
    });

    weknowGridConfig.data.whereFilters = {
        filters: []
    }

    if (statement.where && Array.isArray(statement.where)) {
        // statement.where.forEach((where) => {
        //     weknowGridConfig.data.sort.push(weknowColumnConfig);
        // });
    } else if (statement.where) {
        if (statement.where.type === 'binary_expr') {
            let weknowWhereConfig = processAstWhereToWeknow(statement.where);
            weknowGridConfig.data.whereFilters.filters.push(weknowWhereConfig);
        }
    }

    return weknowGridConfig;
}

function astOperatorToWeknow (astOperator) {
    return AstOperatorToWeknow[astOperator];
}

function astNegationToWeknow (astOperator) {
    if (astOperator === 'NOT LIKE') {
        return true;
    }
    return false;
}

function processAstWhereToWeknow (where) {
    let weknowItem = {
        completeName: where.column
    };

    if (where.type === 'binary_expr') {
        weknowItem.completeName = where.left.column;
        weknowItem.operator = astOperatorToWeknow(where.operator);
        weknowItem.not = astNegationToWeknow(where.operator);

        weknowItem.values = {
            mode: 1,
            fidexValues: [where.right.value]
        }
    }
    return weknowItem;
}

function processAstExprToWeknow (weknowGridConfig, expr, title, statementColumnIndex) {
    let measureFunction;
    let shouldCreateCalculatedField = false;

    let weknowItem = {
        completeName: expr.column
    };

    // Se for uma função de agregação e existir apenas uma coluna referenciada...
    if (expr.type === 'aggr_func' && expr.args.expr.type === 'column_ref') {
        let sqlAgg = expr.name;
        measureFunction = AstAggFunctionToWeknow[sqlAgg];
        if (measureFunction) {
            weknowItem.completeName = expr.args.expr.column;
            weknowItem.title = title || expr.args.expr.column;
        } else {
            shouldCreateCalculatedField = true;
        }
    } else if (expr.type !== 'column_ref') {
        shouldCreateCalculatedField = true;
    } else if (expr.type === 'column_ref' && title) {
        weknowItem.title = title;
    }

    if (shouldCreateCalculatedField) {
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
    }

    return weknowItem;
}

function createCalculatedField (astExpr, title, name) {
    function convertColumnRefs (object) {
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
