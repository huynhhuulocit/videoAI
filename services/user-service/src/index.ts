export const serviceBoundary = {
  name: "user-service",
  owns: ["application user profiles", "roles", "user status"],
  doesNotOwn: ["Auth.js sessions", "project records", "AI provider secrets"]
} as const;
