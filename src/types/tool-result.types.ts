import type { ExecutionData } from "../services/chat.service";

export interface ToolExecutionSuccess {
    success: true;
    data: ExecutionData;
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
