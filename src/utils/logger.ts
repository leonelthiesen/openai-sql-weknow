function timestamp(): string {
    return new Date().toISOString();
}

function formatMeta(meta?: Record<string, unknown>): string {
    if (!meta) return "";
    return " " + JSON.stringify(meta);
}

export const logger = {
    tool(toolName: string, meta?: Record<string, unknown>) {
        console.log(`[${timestamp()}] [tool:${toolName}] start${formatMeta(meta)}`);
    },

    toolResult(toolName: string, meta?: Record<string, unknown>) {
        const level = meta?.success === false ? "error" : "log";
        console[level](`[${timestamp()}] [tool:${toolName}] result${formatMeta(meta)}`);
    },

    info(context: string, message: string, meta?: Record<string, unknown>) {
        console.log(`[${timestamp()}] [${context}] ${message}${formatMeta(meta)}`);
    },

    warn(context: string, message: string, meta?: Record<string, unknown>) {
        console.warn(`[${timestamp()}] [${context}] ${message}${formatMeta(meta)}`);
    },

    error(context: string, message: string, meta?: Record<string, unknown>) {
        console.error(`[${timestamp()}] [${context}] ${message}${formatMeta(meta)}`);
    },
};
