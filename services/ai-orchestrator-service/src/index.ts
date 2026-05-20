export const serviceBoundary = {
  name: "ai-orchestrator-service",
  owns: ["prompt generation workflow", "product analysis workflow", "media analysis workflow", "AI job creation"],
  doesNotOwn: ["provider key storage", "raw uploaded files", "final video artifacts"]
} as const;
