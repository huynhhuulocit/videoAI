import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@videoai/database";
import {
  ContentModeSchema,
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  FlowTypeSchema,
  JobStatusSchema,
  MasterPromptStatusSchema,
  MasterPromptTypeSchema,
  ProviderSchema,
  TemplateAttributeSchema,
  TemplateSelectionSchema,
  UserRoleSchema,
  UserStatusSchema,
  VideoShotSchema,
  VideoShotAttributeSchema,
  type AiConfig,
  type AiLog,
  type AiLogDetail,
  type ApiError,
  type FlowType,
  type Job,
  type MasterPrompt,
  type MasterPromptConfig,
  type MasterPromptType,
  type MediaAsset,
  type Project,
  type Provider,
  type ProviderKeySource,
  type ProviderKeyStatus,
  type UserProfile,
  type VideoShotPlan,
  type VideoTemplate
} from "@videoai/contracts";

type DbUser = Awaited<ReturnType<typeof prisma.userProfile.findFirstOrThrow>>;
type DbProject = Awaited<ReturnType<typeof prisma.projectRecord.findFirstOrThrow>>;
type DbConfig = Awaited<ReturnType<typeof prisma.aiSiteConfig.findFirstOrThrow>>;
type DbJob = Awaited<ReturnType<typeof prisma.jobStatusRecord.findFirstOrThrow>>;
type DbMediaAsset = Awaited<ReturnType<typeof prisma.mediaAsset.findFirstOrThrow>>;
type DbVideoTemplate = Awaited<ReturnType<typeof prisma.videoTemplateRecord.findFirstOrThrow>>;
type DbVideoShotPlan = Awaited<ReturnType<typeof prisma.videoShotPlanRecord.findFirstOrThrow>>;
type DbMasterPrompt = Awaited<ReturnType<typeof prisma.masterPrompt.findFirstOrThrow>>;
type DbAiLog = Awaited<ReturnType<typeof prisma.aiRequestLog.findFirstOrThrow>> & {
  responses?: Array<{
    responsePayload: unknown;
    errorCode: string | null;
    errorMessage: string | null;
    latencyMs: number | null;
  }>;
};

export const defaultUserId = "user_001";
export const defaultAdminId = "admin_001";

const encryptedKeyPrefix = "enc:v1";
const masterPromptTypes = ["scenario", "shots", "scripts"] as const satisfies readonly MasterPromptType[];

function normalizeProvider(provider: string): Provider {
  return ProviderSchema.parse(provider);
}

export function getProviderEnvName(provider: string) {
  const normalizedProvider = normalizeProvider(provider);
  if (normalizedProvider === "chatgpt" || normalizedProvider === "openai") {
    return "OPENAI_API_KEY";
  }
  if (normalizedProvider === "gemini" || normalizedProvider === "google") {
    return "GEMINI_API_KEY";
  }
  return `${normalizedProvider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}

function getProviderEncryptionKey() {
  const seed = process.env.AI_CONFIG_ENCRYPTION_KEY?.trim() || "videoai-local-development-provider-key";
  return createHash("sha256").update(seed).digest();
}

function encryptProviderKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getProviderEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    encryptedKeyPrefix,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64")
  ].join(":");
}

function decryptProviderKey(encryptedKey: string | null | undefined) {
  if (!encryptedKey?.startsWith(`${encryptedKeyPrefix}:`)) {
    return null;
  }

  const [, , ivBase64, tagBase64, ciphertextBase64] = encryptedKey.split(":");
  if (!ivBase64 || !tagBase64 || !ciphertextBase64) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getProviderEncryptionKey(),
      Buffer.from(ivBase64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function optional<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

function defaultMasterPromptContent(type: MasterPromptType) {
  if (type === "scenario") {
    return DEFAULT_TEMPLATE_SELECTION_PROMPT;
  }
  if (type === "shots") {
    return DEFAULT_SHOT_GENERATION_PROMPT;
  }
  return DEFAULT_SCRIPT_GENERATION_PROMPT;
}

function defaultMasterPromptName(type: MasterPromptType) {
  if (type === "scenario") {
    return "Built-in Scenario master prompt";
  }
  if (type === "shots") {
    return "Built-in Shots master prompt";
  }
  return "Built-in Story Content master prompt";
}

function builtInMasterPrompt(type: MasterPromptType): MasterPrompt {
  const now = new Date(0).toISOString();
  return {
    id: `built_in_${type}`,
    type,
    name: defaultMasterPromptName(type),
    content: defaultMasterPromptContent(type),
    isDefault: true,
    status: "active",
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now
  };
}

export function mapUser(row: DbUser): UserProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    role: UserRoleSchema.parse(row.role),
    status: UserStatusSchema.parse(row.status)
  };
}

export function mapProject(row: DbProject): Project {
  const project: Project = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    flowType: row.flowType === "script" ? "script" : "product",
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  if (row.description) {
    project.description = row.description;
  }
  if (row.templateSelection) {
    project.templateSelection = TemplateSelectionSchema.parse(row.templateSelection);
  }

  return project;
}

export function mapMediaAsset(row: DbMediaAsset): MediaAsset {
  const asset: MediaAsset = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    projectId: row.projectId,
    mediaType: row.mediaType === "video" ? "video" : "image",
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    sizeBytes: row.sizeBytes,
    status:
      row.status === "uploaded" || row.status === "rejected" || row.status === "deleted"
        ? row.status
        : "validated",
    previewUrl: `/api/v1/projects/${row.projectId}/media/${row.id}/content`,
    createdAt: row.createdAt.toISOString()
  };

  if (row.validationError) {
    asset.validationError = row.validationError;
  }

  return asset;
}

export function mapVideoTemplate(row: DbVideoTemplate): VideoTemplate {
  const template: VideoTemplate = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    attributes: TemplateAttributeSchema.array().parse(row.attributes),
    isDefault: row.isDefault,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };

  if (row.description) {
    template.description = row.description;
  }
  if (row.idea) {
    template.idea = row.idea;
  }

  return template;
}

export function mapVideoShotPlan(row: DbVideoShotPlan): VideoShotPlan {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId,
    projectId: row.projectId,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    sourceText: row.sourceText,
    durationSeconds: row.durationSeconds,
    attributes: VideoShotAttributeSchema.array().parse(row.attributes),
    shots: VideoShotSchema.array().parse(row.shots),
    isDefault: row.isDefault,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function mapMasterPrompt(row: DbMasterPrompt): MasterPrompt {
  return {
    id: row.id,
    type: MasterPromptTypeSchema.parse(row.type),
    name: row.name,
    content: row.content,
    isDefault: row.isDefault,
    status: MasterPromptStatusSchema.parse(row.status),
    isBuiltIn: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getCurrentUser(demoRole?: string) {
  const username = demoRole === "admin" ? "admin" : "user";
  const user = await prisma.userProfile.findUniqueOrThrow({ where: { username } });
  return mapUser(user);
}

export function mapAiConfig(
  row: DbConfig,
  promptKeyStatus: ProviderKeyStatus,
  videoKeyStatus: ProviderKeyStatus,
  masterPrompts?: {
    scenarioPrompt?: string;
    shotsPrompt?: string;
    scriptsPrompt?: string;
  }
): AiConfig {
  return {
    contentMode: ContentModeSchema.parse(row.contentMode),
    promptProvider: normalizeProvider(row.promptProvider),
    promptModel: row.promptModel,
    shotGenerationPrompt: masterPrompts?.shotsPrompt ?? row.shotGenerationPrompt,
    scriptGenerationPrompt: masterPrompts?.scriptsPrompt,
    templateSelectionPrompt: masterPrompts?.scenarioPrompt ?? row.templateSelectionPrompt,
    promptKeyStatus,
    videoProvider: normalizeProvider(row.videoProvider),
    videoModel: row.videoModel,
    videoKeyStatus,
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function getDefaultMasterPrompt(type: MasterPromptType, legacyPrompt?: string | null) {
  const defaultPrompt = await prisma.masterPrompt.findFirst({
    where: {
      type,
      status: "active",
      isDefault: true
    },
    orderBy: { updatedAt: "desc" }
  });
  if (defaultPrompt) {
    return mapMasterPrompt(defaultPrompt);
  }

  const firstPrompt = await prisma.masterPrompt.findFirst({
    where: {
      type,
      status: "active"
    },
    orderBy: { updatedAt: "desc" }
  });
  if (firstPrompt) {
    return mapMasterPrompt(firstPrompt);
  }

  const legacyContent = legacyPrompt?.trim();
  if (legacyContent) {
    return {
      ...builtInMasterPrompt(type),
      id: `legacy_${type}`,
      name: `Legacy ${type} master prompt`,
      content: legacyContent,
      isBuiltIn: true
    };
  }

  return builtInMasterPrompt(type);
}

export async function getDefaultMasterPromptContent(type: MasterPromptType, legacyPrompt?: string | null) {
  return (await getDefaultMasterPrompt(type, legacyPrompt)).content;
}

export async function getMasterPromptConfig(): Promise<MasterPromptConfig> {
  const rows = await prisma.masterPrompt.findMany({
    where: { status: "active" },
    orderBy: [
      { type: "asc" },
      { isDefault: "desc" },
      { updatedAt: "desc" }
    ]
  });
  const prompts = rows.map(mapMasterPrompt);
  const now = new Date().toISOString();

  return {
    groups: await Promise.all(
      masterPromptTypes.map(async (type) => {
        const typePrompts = prompts.filter((prompt) => prompt.type === type);
        const defaultPrompt =
          typePrompts.find((prompt) => prompt.isDefault) ??
          typePrompts[0] ??
          (await getDefaultMasterPrompt(type));
        return {
          type,
          prompts: typePrompts.length > 0 ? typePrompts : [defaultPrompt],
          defaultPrompt
        };
      })
    ),
    updatedAt: rows[0]?.updatedAt.toISOString() ?? now
  };
}

export async function createMasterPrompt(input: {
  type: MasterPromptType;
  name: string;
  content: string;
}) {
  const type = MasterPromptTypeSchema.parse(input.type);
  return prisma.$transaction(async (tx) => {
    const activeCount = await tx.masterPrompt.count({
      where: { type, status: "active" }
    });
    const shouldBeDefault = activeCount === 0;
    const prompt = await tx.masterPrompt.create({
      data: {
        type,
        name: input.name.trim(),
        content: input.content.trim(),
        status: "active",
        isDefault: shouldBeDefault,
        createdByAdminId: defaultAdminId
      }
    });
    return mapMasterPrompt(prompt);
  });
}

export async function updateMasterPrompt(id: string, input: { name?: string; content?: string }) {
  const existing = await prisma.masterPrompt.findFirstOrThrow({
    where: { id, status: "active" }
  });
  const prompt = await prisma.masterPrompt.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content.trim() } : {})
    }
  });
  return mapMasterPrompt(prompt);
}

export async function archiveMasterPrompt(id: string) {
  const existing = await prisma.masterPrompt.findFirstOrThrow({
    where: { id, status: "active" }
  });
  if (existing.isDefault) {
    return {
      archived: false,
      reason: "DEFAULT_PROMPT_DELETE_BLOCKED" as const,
      prompt: mapMasterPrompt(existing)
    };
  }
  const prompt = await prisma.masterPrompt.update({
    where: { id: existing.id },
    data: { status: "archived" }
  });
  return {
    archived: true,
    prompt: mapMasterPrompt(prompt)
  };
}

export async function setDefaultMasterPrompt(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.masterPrompt.findFirstOrThrow({
      where: { id, status: "active" }
    });
    await tx.masterPrompt.updateMany({
      where: {
        type: existing.type,
        status: "active"
      },
      data: { isDefault: false }
    });
    const prompt = await tx.masterPrompt.update({
      where: { id: existing.id },
      data: { isDefault: true }
    });
    return mapMasterPrompt(prompt);
  });
}

export async function getStoredProviderKey(provider: string) {
  const normalizedProvider = normalizeProvider(provider);
  const providerKey = await prisma.aiProviderKey.findUnique({
    where: { provider: normalizedProvider }
  });
  if (providerKey?.keyStatus !== "configured") {
    return null;
  }
  return decryptProviderKey(providerKey.encryptedKey)?.trim() || null;
}

export async function resolveProviderApiKey(provider: string, overrideKey?: string) {
  const normalizedProvider = normalizeProvider(provider);
  const envName = getProviderEnvName(normalizedProvider);
  const trimmedOverrideKey = overrideKey?.trim();
  if (trimmedOverrideKey) {
    return {
      apiKey: trimmedOverrideKey,
      source: "input" as ProviderKeySource,
      envName
    };
  }

  const storedApiKey = await getStoredProviderKey(normalizedProvider);
  if (storedApiKey) {
    return {
      apiKey: storedApiKey,
      source: "stored" as ProviderKeySource,
      envName
    };
  }

  const envApiKey = process.env[envName]?.trim();
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      source: "env" as ProviderKeySource,
      envName
    };
  }

  return {
    apiKey: null,
    source: "missing" as ProviderKeySource,
    envName
  };
}

export async function getProviderKeyStatus(provider: string): Promise<ProviderKeyStatus> {
  const resolved = await resolveProviderApiKey(provider);
  if (resolved.source === "stored") {
    return "configured";
  }
  if (resolved.source === "env") {
    return "env";
  }
  return "missing";
}

export async function getActiveAiConfig(): Promise<AiConfig> {
  const config = await prisma.aiSiteConfig.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" }
  });
  const [
    promptKeyStatus,
    videoKeyStatus,
    scenarioPrompt,
    shotsPrompt,
    scriptsPrompt
  ] = await Promise.all([
    getProviderKeyStatus(config.promptProvider),
    getProviderKeyStatus(config.videoProvider),
    getDefaultMasterPromptContent("scenario", config.templateSelectionPrompt),
    getDefaultMasterPromptContent("shots", config.shotGenerationPrompt),
    getDefaultMasterPromptContent("scripts")
  ]);
  return mapAiConfig(config, promptKeyStatus, videoKeyStatus, {
    scenarioPrompt,
    shotsPrompt,
    scriptsPrompt
  });
}

export async function replaceActiveAiConfig(input: {
  contentMode: "script" | "video";
  promptProvider: Provider;
  promptModel: string;
  videoProvider: Provider;
  videoModel: string;
}) {
  const promptProvider = normalizeProvider(input.promptProvider);
  const videoProvider = normalizeProvider(input.videoProvider);
  const activeConfig = await prisma.aiSiteConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" }
  });
  await prisma.$transaction([
    prisma.aiSiteConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    }),
    prisma.aiSiteConfig.create({
      data: {
        contentMode: input.contentMode,
        promptProvider,
        promptModel: input.promptModel,
        shotGenerationPrompt: activeConfig?.shotGenerationPrompt ?? null,
        shotComposerPrompt: activeConfig?.shotComposerPrompt ?? null,
        templateSelectionPrompt: activeConfig?.templateSelectionPrompt ?? null,
        videoProvider,
        videoModel: input.videoModel,
        isActive: true,
        createdByAdminId: defaultAdminId
      }
    })
  ]);
  return getActiveAiConfig();
}

export async function markProviderKeyConfigured(provider: string, apiKey: string) {
  const normalizedProvider = normalizeProvider(provider);
  const encryptedKey = encryptProviderKey(apiKey.trim());
  await prisma.aiProviderKey.upsert({
    where: { provider: normalizedProvider },
    update: {
      encryptedKey,
      keyStatus: "configured",
      rotatedAt: new Date(),
      createdByAdminId: defaultAdminId
    },
    create: {
      provider: normalizedProvider,
      encryptedKey,
      keyStatus: "configured",
      rotatedAt: new Date(),
      createdByAdminId: defaultAdminId
    }
  });
  return {
    provider: normalizedProvider,
    keyStatus: await getProviderKeyStatus(normalizedProvider)
  };
}

export function mapJob(row: DbJob): Job {
  return {
    jobId: row.jobId,
    type: row.type as Job["type"],
    status: JobStatusSchema.parse(row.status),
    progress: row.progress,
    result: row.result ?? null,
    error: row.error ? (row.error as ApiError) : null
  };
}

export function mapAiLog(row: DbAiLog): AiLog {
  const log: AiLog = {
    requestId: row.requestId,
    timestamp: row.createdAt.toISOString(),
    actorUserId: row.actorUserId,
    actorRole: UserRoleSchema.parse(row.actorRole),
    projectId: optional(row.projectId),
    flowType: FlowTypeSchema.parse(row.flowType),
    provider: ProviderSchema.parse(row.provider),
    model: row.model,
    status: row.status === "failed" ? "failed" : row.status === "success" ? "success" : "pending"
  };

  const latencyMs = row.responses?.[0]?.latencyMs;
  if (latencyMs !== null && latencyMs !== undefined) {
    log.latencyMs = latencyMs;
  }

  return log;
}

export function mapAiLogDetail(row: DbAiLog): AiLogDetail {
  const base = mapAiLog(row);
  const response = row.responses?.[0];
  const detail: AiLogDetail = {
    ...base,
    requestPayload: asRecord(row.requestPayload)
  };

  if (response?.responsePayload) {
    detail.responsePayload = asRecord(response.responsePayload);
  }
  if (response?.errorCode) {
    detail.errorCode = response.errorCode;
  }
  if (response?.errorMessage) {
    detail.errorMessage = response.errorMessage;
  }

  return detail;
}

export function toFlowType(type: Job["type"]): FlowType {
  if (type === "product_analysis") {
    return "product_url";
  }
  if (type === "video_generation") {
    return "video_generation";
  }
  if (type === "media_analysis") {
    return "media_analysis";
  }
  if (type === "script_generation") {
    return "script_generation";
  }
  if (type === "shot_generation") {
    return "shot_generation";
  }
  if (type === "template_selection") {
    return "template_selection";
  }
  return "script_prompt";
}
