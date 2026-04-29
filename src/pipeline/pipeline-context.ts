import { AsyncLocalStorage } from "node:async_hooks";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type OpenAI from "openai";

export interface LlmCallLog {
    index: number;
    callType: "callOpenAI" | "callOpenAIForMessage" | "callOpenAIForStructuredMessage";
    startedAt: string;
    completedAt: string;
    durationMs: number;
    input: ResponseInputItem[];
    response?: OpenAI.Responses.Response;
    error?: string;
}

export interface PipelineContext {
    jobId: string;
    conversationId: string;
    llmCalls: LlmCallLog[];
}

export const pipelineStorage = new AsyncLocalStorage<PipelineContext>();
