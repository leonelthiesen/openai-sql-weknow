import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineContext } from "./pipeline-context";
import type { Job } from "./job-store";
import { logger } from "../utils/logger";

const LOG_DIR = "logs/pipelines";

export async function writePipelineLog(ctx: PipelineContext, job: Job): Promise<void> {
    try {
        await mkdir(LOG_DIR, { recursive: true });
        const payload = {
            jobId: job.id,
            conversationId: job.conversationId,
            status: job.status,
            createdAt: job.createdAt.toISOString(),
            completedAt: job.completedAt?.toISOString() ?? null,
            llmCalls: ctx.llmCalls,
        };
        const filePath = join(LOG_DIR, `${job.id}.json`);
        await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    } catch (err) {
        logger.warn("pipeline_log", "Failed to write pipeline log", { error: String(err) });
    }
}
