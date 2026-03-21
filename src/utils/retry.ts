import type { ToolExecutionError } from "../types/tool-result.types";

export interface RetryConfig {
    maxAttempts: number;
    shouldRetry: (error: ToolExecutionError["error"]) => boolean;
}

/**
 * Executes `fn` up to `config.maxAttempts` times.
 * On failure, calls `onRetry` (if provided) before the next attempt.
 * Returns the first successful result or the last error.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig,
    onRetry?: (error: ToolExecutionError["error"], attempt: number) => Promise<void>
): Promise<T> {
    let lastError: ToolExecutionError["error"] | undefined;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (thrown: unknown) {
            const error = toToolError(thrown);
            lastError = error;

            if (attempt >= config.maxAttempts || !config.shouldRetry(error)) {
                throw thrown;
            }

            if (onRetry) {
                await onRetry(error, attempt);
            }
        }
    }

    // Unreachable, but TypeScript needs it
    throw lastError;
}

function toToolError(thrown: unknown): ToolExecutionError["error"] {
    if (
        typeof thrown === "object" &&
        thrown !== null &&
        "message" in thrown &&
        "retriable" in thrown
    ) {
        return thrown as ToolExecutionError["error"];
    }

    const message = thrown instanceof Error
        ? thrown.message
        : typeof thrown === "string"
            ? thrown
            : JSON.stringify(thrown);

    return { message, retriable: true, raw: thrown };
}
