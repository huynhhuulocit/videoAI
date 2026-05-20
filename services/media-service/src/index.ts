export const serviceBoundary = {
  name: "media-service",
  owns: ["media metadata", "file validation", "storage provider access", "media deletion"],
  doesNotOwn: ["AI interpretation of media"]
} as const;
