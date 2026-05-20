export const workerBoundary = {
  name: "worker-ai",
  queues: ["media.analysis", "ai.prompt", "ai.productAnalysis", "ai.log"],
  responsibilities: ["execute AI provider calls", "record request/response logs", "handle retries"]
} as const;
