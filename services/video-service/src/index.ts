export const serviceBoundary = {
  name: "video-service",
  owns: ["video generation records", "video status", "video artifact metadata", "video job creation"]
} as const;
