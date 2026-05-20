export const workerBoundary = {
  name: "worker-video",
  queues: ["video.generation"],
  responsibilities: ["execute video provider calls", "store generated artifacts", "update video job status"]
} as const;
