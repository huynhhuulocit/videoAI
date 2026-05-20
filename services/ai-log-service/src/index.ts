export const serviceBoundary = {
  name: "ai-log-service",
  owns: ["AI request logs", "AI response logs", "admin log query APIs", "log redaction policy"],
  invariant: "Secrets and raw binary media are never logged."
} as const;
