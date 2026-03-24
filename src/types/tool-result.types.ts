import { PivotGridResponse } from "./pivot-grid-response.types";

export interface ToolExecutionSuccess {
    success: true;
    data: PivotGridResponse;
}

export interface ToolExecutionError {
    success: false;
    error: {
        message: string;
        retriable: boolean;
        raw?: unknown;
    };
}

export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionError;
