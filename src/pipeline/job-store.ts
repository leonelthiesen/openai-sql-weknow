import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type {
    JobStatus,
    PipelineEvent,
    PipelineEventType,
    JobResult,
} from "./pipeline-events";
import { logger } from "../utils/logger";

// ── Job definition ───────────────────────────────────────────────────────────

export interface Job {
    id: string;
    status: JobStatus;
    conversationId: string;
    userId: string;
    metadataId: number;
    input: ResponseInputItem[];
    options?: { availableFieldNames?: string[] };
    userMessageId?: string;
    result?: JobResult;
    error?: string;
    events: PipelineEvent[];
    createdAt: Date;
    completedAt?: Date;
}

// ── Typed event emitter ──────────────────────────────────────────────────────

const PIPELINE_EVENT = "pipeline_event";

class JobEmitter extends EventEmitter {
    emitPipelineEvent(event: PipelineEvent): void {
        this.emit(PIPELINE_EVENT, event);
    }

    onPipelineEvent(listener: (event: PipelineEvent) => void): void {
        this.on(PIPELINE_EVENT, listener);
    }

    offPipelineEvent(listener: (event: PipelineEvent) => void): void {
        this.off(PIPELINE_EVENT, listener);
    }
}

// ── Job store ────────────────────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutes after completion

class JobStore {
    private jobs = new Map<string, Job>();
    private emitters = new Map<string, JobEmitter>();
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor() {
        this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref();
    }

    createJob(params: {
        conversationId: string;
        userId: string;
        metadataId: number;
        input: ResponseInputItem[];
        options?: { availableFieldNames?: string[] };
    }): Job {
        const id = randomUUID();
        const job: Job = {
            id,
            status: "PENDING",
            conversationId: params.conversationId,
            userId: params.userId,
            metadataId: params.metadataId,
            input: params.input,
            options: params.options,
            events: [],
            createdAt: new Date(),
        };

        this.jobs.set(id, job);
        this.emitters.set(id, new JobEmitter());

        return job;
    }

    getJob(jobId: string): Job | undefined {
        return this.jobs.get(jobId);
    }

    emitEvent(jobId: string, event: PipelineEvent): void {
        const job = this.jobs.get(jobId);
        if (!job) return;

        job.events.push(event);

        const statusMap: Partial<Record<PipelineEventType, JobStatus>> = {
            llm_call_started: "PROCESSING",
            completed: "COMPLETED",
            failed: "FAILED",
        };

        const newStatus = statusMap[event.type];
        if (newStatus) {
            job.status = newStatus;
            if (newStatus === "COMPLETED" || newStatus === "FAILED") {
                job.completedAt = new Date();
            }
        }

        if (event.type === "completed") {
            job.result = event.payload.result;
        }

        if (event.type === "failed") {
            job.error = event.payload.error;
        }

        const emitter = this.emitters.get(jobId);
        emitter?.emitPipelineEvent(event);
    }

    subscribeToEvents(
        jobId: string,
        listener: (event: PipelineEvent) => void
    ): (() => void) | undefined {
        const emitter = this.emitters.get(jobId);
        if (!emitter) return undefined;

        emitter.onPipelineEvent(listener);

        return () => {
            emitter.offPipelineEvent(listener);
        };
    }

    private cleanup(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [jobId, job] of this.jobs) {
            if (!job.completedAt) continue;
            if (now - job.completedAt.getTime() > JOB_TTL_MS) {
                this.jobs.delete(jobId);
                const emitter = this.emitters.get(jobId);
                emitter?.removeAllListeners();
                this.emitters.delete(jobId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info("job_store", `Cleaned up ${cleaned} expired job(s)`);
        }
    }
}

// ── Singleton export ─────────────────────────────────────────────────────────

export const jobStore = new JobStore();
