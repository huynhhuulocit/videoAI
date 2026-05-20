import type { AiConfig, AiLog, ApiSuccess, MasterPromptConfig, Project } from "@videoai/contracts";

const baseUrl = process.env.API_GATEWAY_URL ?? "http://localhost:4000";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: { "x-request-id": `web-${Date.now()}` },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

export function getProjects(): Promise<Project[]> {
  return get("/projects");
}

export function getProject(projectId: string): Promise<Project | null> {
  return get(`/projects/${projectId}`);
}

export function getAiConfig(): Promise<AiConfig> {
  return get("/admin/ai-config");
}

export function getAiLogs(): Promise<AiLog[]> {
  return get("/admin/ai-logs");
}

export function getShotPromptConfig(): Promise<MasterPromptConfig> {
  return get("/admin/master-prompts");
}
