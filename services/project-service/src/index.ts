export const serviceBoundary = {
  name: "project-service",
  owns: ["project records", "project ownership", "project access checks"],
  invariant: "Each project belongs to exactly one user."
} as const;
