import type { AdapterConfig } from "./types";

export const adapters: Record<string, AdapterConfig> = {
  "google-flow-veo": {
    provider: "google-flow-veo",
    targetUrl:
      "https://labs.google/fx/tools/flow/project/5a83ae13-0d06-48fb-a993-b092c7395df4",
    allowedOrigins: [
      "https://labs.google",
      "https://flow.google",
      "https://aitestkitchen.withgoogle.com",
    ],
    generateButtonSelector: "button[aria-label='Generate']",
    loginRequiredSelector: "a[href*='accounts.google.com']",
  },
};

export function getAdapter(provider: string) {
  return adapters[provider];
}
