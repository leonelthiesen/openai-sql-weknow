import type {
    ParsedToolArgs,
    ExtractDataArgs,
    AskFollowupArgs,
    ExtractTextValuesArgs,
    RequestFieldValuesArgs,
} from "../types/tool-args.types";
import {
    detectDateFieldKind,
    detectCalculatedFieldKind,
    expectedFormatLabel,
    isValidIsoForKind,
    type DateFieldKind,
} from "./date-format";

export interface FieldDescriptor {
    completeName: string;
    fieldType: string | number;
}

export interface ParseToolArgsOptions {
    availableFieldNames?: string[];
    metadataFields?: FieldDescriptor[];
}

const VALID_COMPARISON_OPERATORS = new Set([
    "LIKE",
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "IN",
    "BETWEEN",
    "IS_NULL",
    "STARTS_WITH",
    "ENDS_WITH",
]);

export class ToolValidationError extends Error {
    constructor(
        public readonly toolName: string,
        message: string
    ) {
        super(`[${toolName}] ${message}`);
        this.name = "ToolValidationError";
    }
}

export function parseToolArgs(name: string, rawArguments: string, options: ParseToolArgsOptions = {}): ParsedToolArgs {
    let parsed: any;
    try {
        parsed = JSON.parse(rawArguments);
    } catch {
        throw new ToolValidationError(name, `Invalid JSON in tool arguments: ${rawArguments.slice(0, 200)}`);
    }

    switch (name) {
        case "extract_data":
            return parseExtractDataArgs(parsed, options.availableFieldNames, options.metadataFields);
        case "ask_followup":
            return parseAskFollowupArgs(parsed);
        case "extract_text_values":
            return parseExtractTextValuesArgs(parsed);
        case "request_field_values":
            return parseRequestFieldValuesArgs(parsed);
        default:
            throw new ToolValidationError(name, `Unknown tool: ${name}`);
    }
}

function parseExtractDataArgs(
    parsed: any,
    availableFieldNames: string[] = [],
    metadataFields: FieldDescriptor[] = []
): ExtractDataArgs {
    if (!parsed.message || typeof parsed.message !== "string") {
        throw new ToolValidationError("extract_data", "Missing or invalid 'message'");
    }
    if (!parsed.renderType || !["CHART", "TABLE", "TEXT"].includes(parsed.renderType)) {
        throw new ToolValidationError("extract_data", `Invalid renderType: ${parsed.renderType}`);
    }
    if (!parsed.query || typeof parsed.query !== "object") {
        throw new ToolValidationError("extract_data", "Missing 'query' object");
    }
    if (!Array.isArray(parsed.query.measures) || parsed.query.measures.length === 0) {
        throw new ToolValidationError("extract_data", "query.measures must be a non-empty array");
    }

    validateRootFilterGroup(parsed.query.filters, "query.filters");
    validateRootFilterGroup(parsed.query.havingFilters, "query.havingFilters");
    validateComparisonOperators(parsed.query.filters, "query.filters");
    validateComparisonOperators(parsed.query.havingFilters, "query.havingFilters");
    validateCalculatedFields(parsed.query.calculatedFields, availableFieldNames);

    const dateKindMap = buildDateKindMap(metadataFields, parsed.query.calculatedFields);
    validateFilterDateValues(parsed.query.filters, dateKindMap, "query.filters");
    validateFilterDateValues(parsed.query.havingFilters, dateKindMap, "query.havingFilters");

    return {
        toolName: "extract_data",
        message: parsed.message,
        userMessageSuggestions: parsed.userMessageSuggestions ?? [],
        renderType: parsed.renderType,
        query: parsed.query,
    };
}

function buildDateKindMap(
    metadataFields: FieldDescriptor[],
    calculatedFields: unknown
): Map<string, DateFieldKind> {
    const map = new Map<string, DateFieldKind>();
    for (const field of metadataFields) {
        const kind = detectDateFieldKind(field.fieldType);
        if (kind && field.completeName) {
            map.set(field.completeName, kind);
        }
    }
    if (Array.isArray(calculatedFields)) {
        for (const cf of calculatedFields) {
            if (!cf || typeof cf !== "object") continue;
            const c = cf as { completeName?: unknown; dataType?: unknown };
            if (typeof c.completeName !== "string") continue;
            const kind = detectCalculatedFieldKind(c.dataType);
            if (kind) map.set(c.completeName, kind);
        }
    }
    return map;
}

function validateFilterDateValues(
    filterNode: any,
    dateKindMap: Map<string, DateFieldKind>,
    path: string
): void {
    if (!filterNode || typeof filterNode !== "object") return;

    if (typeof filterNode.completeName === "string") {
        const kind = dateKindMap.get(filterNode.completeName);
        if (kind && filterNode.operator !== "IS_NULL" && Array.isArray(filterNode.values)) {
            filterNode.values.forEach((value: unknown, index: number) => {
                if (value === null || value === undefined) return;
                if (!isValidIsoForKind(value, kind)) {
                    throw new ToolValidationError(
                        "extract_data",
                        `${path}.values[${index}] must be ISO 8601 '${expectedFormatLabel(kind)}' (no timezone) for ${kind} field '${filterNode.completeName}'; got ${JSON.stringify(value)}`
                    );
                }
            });
        }
    }

    if (Array.isArray(filterNode.filters)) {
        filterNode.filters.forEach((child: any, index: number) =>
            validateFilterDateValues(child, dateKindMap, `${path}.filters[${index}]`)
        );
    }
}

function validateCalculatedFields(calculatedFields: unknown, availableFieldNames: string[]): void {
    if (calculatedFields === undefined) {
        return;
    }

    if (!Array.isArray(calculatedFields)) {
        throw new ToolValidationError("extract_data", "query.calculatedFields must be an array");
    }

    calculatedFields.forEach((field, index) => {
        if (!field || typeof field !== "object") {
            throw new ToolValidationError("extract_data", `query.calculatedFields[${index}] must be an object`);
        }

        const formula = (field as { formula?: unknown }).formula;
        if (typeof formula !== "string" || !formula.trim()) {
            throw new ToolValidationError("extract_data", `query.calculatedFields[${index}].formula must be a non-empty string`);
        }

        validateCalculatedFieldFormula(formula, index, availableFieldNames);
    });
}

function validateCalculatedFieldFormula(formula: string, index: number, availableFieldNames: string[]): void {
    const trimmed = formula.trim();

    if (/[;]|--|\/\*|\*\//.test(trimmed)) {
        throw new ToolValidationError(
            "extract_data",
            `query.calculatedFields[${index}].formula must be a SQL expression (no comments or statement separators)`
        );
    }

    const forbiddenExpressionKeywords = /\b(SELECT|FROM|WHERE|GROUP|ORDER|HAVING|UNION|JOIN|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b/i;
    if (forbiddenExpressionKeywords.test(trimmed)) {
        throw new ToolValidationError(
            "extract_data",
            `query.calculatedFields[${index}].formula must be a single SQL expression, not a full SQL statement`
        );
    }

    ensureBalancedFormulaDelimiters(trimmed, index);

    const referencedFields = extractPercentWrappedFieldReferences(trimmed, index);

    if (availableFieldNames.length > 0) {
        const offeredFieldSet = new Set(availableFieldNames);

        referencedFields.forEach((fieldName) => {
            if (!offeredFieldSet.has(fieldName)) {
                throw new ToolValidationError(
                    "extract_data",
                    `query.calculatedFields[${index}].formula references unknown field '%${fieldName}%'`
                );
            }
        });

        const expressionWithoutRefs = removeQuotedStrings(trimmed).replace(/%[^%]+%/g, " ");
        for (const fieldName of offeredFieldSet) {
            const rawFieldRegex = new RegExp(`(^|[^A-Za-z0-9_.])${escapeRegex(fieldName)}([^A-Za-z0-9_.]|$)`, "i");
            if (rawFieldRegex.test(expressionWithoutRefs)) {
                throw new ToolValidationError(
                    "extract_data",
                    `query.calculatedFields[${index}].formula must reference field '${fieldName}' as '%${fieldName}%'`
                );
            }
        }
    }
}

function ensureBalancedFormulaDelimiters(formula: string, index: number): void {
    let parenthesisDepth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < formula.length; i++) {
        const char = formula[i];
        const next = formula[i + 1];

        if (char === "'" && !inDoubleQuote) {
            if (inSingleQuote && next === "'") {
                i += 1;
                continue;
            }
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (inSingleQuote || inDoubleQuote) {
            continue;
        }

        if (char === "(") {
            parenthesisDepth += 1;
        } else if (char === ")") {
            parenthesisDepth -= 1;
            if (parenthesisDepth < 0) {
                throw new ToolValidationError(
                    "extract_data",
                    `query.calculatedFields[${index}].formula contains unbalanced parentheses`
                );
            }
        }
    }

    if (inSingleQuote || inDoubleQuote) {
        throw new ToolValidationError(
            "extract_data",
            `query.calculatedFields[${index}].formula contains unbalanced quotes`
        );
    }

    if (parenthesisDepth !== 0) {
        throw new ToolValidationError(
            "extract_data",
            `query.calculatedFields[${index}].formula contains unbalanced parentheses`
        );
    }
}

function extractPercentWrappedFieldReferences(formula: string, index: number): string[] {
    const references: string[] = [];
    const referenceRegex = /%([^%]+)%/g;
    let match = referenceRegex.exec(formula);

    while (match) {
        const referencedField = match[1]?.trim();
        if (!referencedField) {
            throw new ToolValidationError(
                "extract_data",
                `query.calculatedFields[${index}].formula contains an empty field reference between '%'`
            );
        }

        references.push(referencedField);
        match = referenceRegex.exec(formula);
    }

    const remainingPercent = removeQuotedStrings(formula).replace(/%[^%]+%/g, "");
    if (remainingPercent.includes("%")) {
        throw new ToolValidationError(
            "extract_data",
            `query.calculatedFields[${index}].formula has invalid field reference. Use '%completeName%'`
        );
    }

    return references;
}

function removeQuotedStrings(value: string): string {
    return value
        .replace(/'([^']|'')*'/g, " ")
        .replace(/"([^"]|"")*"/g, " ");
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateRootFilterGroup(filterNode: any, path: string): void {
    if (filterNode === undefined) {
        return;
    }

    if (!filterNode || typeof filterNode !== "object") {
        throw new ToolValidationError("extract_data", `${path} must be an object with only 'join' and 'filters'`);
    }

    const allowedKeys = new Set(["join", "filters"]);
    const invalidRootKeys = Object.keys(filterNode).filter((key) => !allowedKeys.has(key));

    if (invalidRootKeys.length > 0) {
        throw new ToolValidationError(
            "extract_data",
            `${path} at root must contain only 'join' and 'filters'`
        );
    }

    if (!("join" in filterNode)) {
        throw new ToolValidationError("extract_data", `${path}.join is required at root`);
    }

    if (!Array.isArray(filterNode.filters)) {
        throw new ToolValidationError("extract_data", `${path}.filters must be an array at root`);
    }
}

function validateComparisonOperators(filterNode: any, path: string): void {
    if (!filterNode || typeof filterNode !== "object") {
        return;
    }

    if ("operator" in filterNode) {
        if (typeof filterNode.operator !== "string" || !VALID_COMPARISON_OPERATORS.has(filterNode.operator)) {
            throw new ToolValidationError(
                "extract_data",
                `${path}.operator must be one of: ${Array.from(VALID_COMPARISON_OPERATORS).join(", ")}`
            );
        }
    }

    if (Array.isArray(filterNode.filters)) {
        filterNode.filters.forEach((child: any, index: number) =>
            validateComparisonOperators(child, `${path}.filters[${index}]`)
        );
    }
}

function parseAskFollowupArgs(parsed: any): AskFollowupArgs {
    if (!parsed.message || typeof parsed.message !== "string") {
        throw new ToolValidationError("ask_followup", "Missing or invalid 'message'");
    }

    return {
        toolName: "ask_followup",
        message: parsed.message,
        userMessageSuggestions: parsed.userMessageSuggestions ?? [],
    };
}

function parseExtractTextValuesArgs(parsed: any): ExtractTextValuesArgs {
    if (!Array.isArray(parsed.values) || parsed.values.length === 0) {
        throw new ToolValidationError("extract_text_values", "Missing or invalid 'values' array");
    }

    return {
        toolName: "extract_text_values",
        values: parsed.values,
    };
}

function parseRequestFieldValuesArgs(parsed: any): RequestFieldValuesArgs {
    if (!parsed.fieldCompleteName || typeof parsed.fieldCompleteName !== "string") {
        throw new ToolValidationError("request_field_values", "Missing or invalid 'fieldCompleteName'");
    }
    if (!parsed.reason || typeof parsed.reason !== "string") {
        throw new ToolValidationError("request_field_values", "Missing or invalid 'reason'");
    }
    return {
        toolName: "request_field_values",
        fieldCompleteName: parsed.fieldCompleteName,
        reason: parsed.reason,
    };
}
