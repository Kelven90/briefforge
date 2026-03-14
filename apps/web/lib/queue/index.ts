import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { IndexingJobPayload } from "@briefforge/core";

export const INDEXING_QUEUE_NAME = "indexing-jobs";

declare global {
  // eslint-disable-next-line no-var
  var __briefforgeIndexingQueue: Queue<IndexingJobPayload> | undefined;
}

/** Lazy queue so next build does not connect to Redis during static generation. */
function getQueue(): Queue<IndexingJobPayload> {
  if (global.__briefforgeIndexingQueue) return global.__briefforgeIndexingQueue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not set");
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<IndexingJobPayload>(INDEXING_QUEUE_NAME, {
    connection: connection as any
  }) as Queue<IndexingJobPayload>;
  if (process.env.NODE_ENV !== "production") global.__briefforgeIndexingQueue = queue;
  return queue;
}

export async function enqueueIndexingJob(payload: IndexingJobPayload) {
  const queue = getQueue();
  await queue.add(payload.jobType, payload, {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    }
  });
}

