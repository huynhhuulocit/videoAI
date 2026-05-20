export const serviceBoundary = {
  name: "ai-config-service",
  owns: ["site-wide AI config", "provider/model defaults", "encrypted provider keys", "config audit log"],
  invariant: "Provider keys are never returned as plain text."
} as const;
