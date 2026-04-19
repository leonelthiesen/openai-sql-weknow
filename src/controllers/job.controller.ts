import type { Request, Response } from "express";
import { jobStore } from "../pipeline/job-store";
import type { PipelineEvent } from "../pipeline/pipeline-events";

// ── SSE: stream job events ───────────────────────────────────────────────────

export const getJobEvents = (req: Request<{ jobId: string }>, res: Response): void => {
    const authenticatedUserId = req.authenticatedUserId;
    if (!authenticatedUserId) {
        res.status(401).json({ message: "Usuário não autenticado." });
        return;
    }

    const { jobId } = req.params;
    const job = jobStore.getJob(jobId);

    if (!job) {
        res.status(404).json({ message: "Job não encontrado." });
        return;
    }

    if (job.userId !== authenticatedUserId) {
        res.status(403).json({ message: "Você não possui permissão para acessar este job." });
        return;
    }

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send a comment to establish the connection
    res.write(":ok\n\n");

    // Replay past events
    for (const event of job.events) {
        writeSSE(res, event);
    }

    // If the job is already finished, close immediately after replay
    if (job.status === "COMPLETED" || job.status === "FAILED") {
        res.end();
        return;
    }

    // Subscribe to future events
    const unsubscribe = jobStore.subscribeToEvents(jobId, (event: PipelineEvent) => {
        writeSSE(res, event);

        // Close the stream when the job finishes
        if (event.type === "completed" || event.type === "failed") {
            res.end();
        }
    });

    // Cleanup on client disconnect
    req.on("close", () => {
        unsubscribe?.();
    });
};

// ── Polling: get job status ──────────────────────────────────────────────────

export const getJobStatus = (req: Request<{ jobId: string }>, res: Response) => {
    const authenticatedUserId = req.authenticatedUserId;
    if (!authenticatedUserId) {
        return res.status(401).json({ message: "Usuário não autenticado." });
    }

    const { jobId } = req.params;
    const job = jobStore.getJob(jobId);

    if (!job) {
        return res.status(404).json({ message: "Job não encontrado." });
    }

    if (job.userId !== authenticatedUserId) {
        return res.status(403).json({ message: "Você não possui permissão para acessar este job." });
    }

    const response: Record<string, unknown> = {
        jobId: job.id,
        status: job.status,
        conversationId: job.conversationId,
        createdAt: job.createdAt,
    };

    if (job.status === "COMPLETED" && job.result) {
        response.result = {
            structuredOutput: job.result.structuredOutput,
            executionData: job.result.executionData,
            errorResponse: job.result.errorResponse,
            userMessageId: job.result.userMessageId,
            assistantMessageId: job.result.assistantMessageId,
        };
    }

    if (job.status === "FAILED") {
        response.error = job.error;
        if (job.result) {
            response.result = {
                structuredOutput: job.result.structuredOutput,
                executionData: job.result.executionData,
                errorResponse: job.result.errorResponse,
                userMessageId: job.result.userMessageId,
                assistantMessageId: job.result.assistantMessageId,
            };
        }
    }

    return res.json(response);
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function writeSSE(res: Response, event: PipelineEvent): void {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event.payload)}\n\n`);
}
