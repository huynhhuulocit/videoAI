import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { prisma, type Prisma } from "@videoai/database";
import {
  ContentModeSchema,
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SINGLE_SHOT_MASTER_PROMPT,
  DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
  AiHandoffStatusSchema,
  AttributeCatalogAttributeSchema,
  AttributeCatalogTypeSchema,
  FlowTypeSchema,
  JobStatusSchema,
  MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
  MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
  MasterPromptAttributeConfigSchema,
  MasterPromptAttributeSelectionSchema,
  MasterPromptAttributeSchema,
  MasterPromptStatusSchema,
  MasterPromptTypeSchema,
  ProviderSchema,
  TemplateAttributeSchema,
  TemplateSelectionSchema,
  ProjectAttributeSelectionsSchema,
  ProjectTemplateSchema,
  ProjectTemplateSnapshotSchema,
  UserRoleSchema,
  UserStatusSchema,
  VideoShotSchema,
  VideoShotAttributeSchema,
  UserProjectTemplateSchema,
  type AiConfig,
  type AiHandoff,
  type AttributeCatalog,
  type AttributeCatalogAttribute,
  type AttributeCatalogType,
  type AiLog,
  type AiLogDetail,
  type ApiError,
  type FlowType,
  type Job,
  type MasterPrompt,
  type MasterPromptAttribute,
  type MasterPromptAttributeConfig,
  type MasterPromptAttributeSelection,
  type MasterPromptConfig,
  type MasterPromptType,
  type MediaAsset,
  type Project,
  type ProjectTemplate,
  type Provider,
  type ProviderKeySource,
  type ProviderKeyStatus,
  type UserProfile,
  type UserProjectTemplate,
  type VideoShotPlan,
  type VideoTemplate,
} from "@videoai/contracts";

type DbUser = Awaited<ReturnType<typeof prisma.userProfile.findFirstOrThrow>>;
type DbProject = Awaited<
  ReturnType<typeof prisma.projectRecord.findFirstOrThrow>
>;
type DbProjectTemplate = Awaited<
  ReturnType<typeof prisma.projectTemplate.findFirstOrThrow>
>;
type DbUserProjectTemplate = Awaited<
  ReturnType<typeof prisma.userProjectTemplate.findFirstOrThrow>
>;
type DbConfig = Awaited<
  ReturnType<typeof prisma.aiSiteConfig.findFirstOrThrow>
>;
type DbJob = Awaited<
  ReturnType<typeof prisma.jobStatusRecord.findFirstOrThrow>
>;
type DbMediaAsset = Awaited<
  ReturnType<typeof prisma.mediaAsset.findFirstOrThrow>
>;
type DbVideoTemplate = Awaited<
  ReturnType<typeof prisma.videoTemplateRecord.findFirstOrThrow>
>;
type DbStoryAttributeCatalog = Awaited<
  ReturnType<typeof prisma.storyAttributeCatalog.findFirstOrThrow>
>;
type DbScenarioAttributeCatalog = Awaited<
  ReturnType<typeof prisma.scenarioAttributeCatalog.findFirstOrThrow>
>;
type DbShotAttributeCatalog = Awaited<
  ReturnType<typeof prisma.shotAttributeCatalog.findFirstOrThrow>
>;
type DbVideoShotPlan = Awaited<
  ReturnType<typeof prisma.videoShotPlanRecord.findFirstOrThrow>
>;
type DbAiHandoff = Awaited<
  ReturnType<typeof prisma.aiHandoffRecord.findFirstOrThrow>
>;
type DbMasterPrompt = Awaited<
  ReturnType<typeof prisma.masterPrompt.findFirstOrThrow>
>;
type DbMasterPromptAttributeConfig = Awaited<
  ReturnType<typeof prisma.masterPromptAttributeConfig.findFirstOrThrow>
>;
type DbAiLog = Awaited<
  ReturnType<typeof prisma.aiRequestLog.findFirstOrThrow>
> & {
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
const masterPromptTypes = [
  "scenario",
  "shots",
  "scripts",
  "shot",
] as const satisfies readonly MasterPromptType[];

function normalizeProvider(provider: string): Provider {
  return ProviderSchema.parse(provider);
}

const defaultAiHandoffProvider = normalizeProvider(
  process.env.AI_HANDOFF_PROVIDER?.trim() || "google-flow-veo",
);
const defaultAiHandoffTargetUrl =
  process.env.AI_HANDOFF_TARGET_URL?.trim() || null;

function normalizeOptionalUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return new URL(trimmed).toString();
}

function getProviderEncryptionKey() {
  const seed = process.env.AI_CONFIG_ENCRYPTION_KEY?.trim();
  if (!seed) {
    throw new Error(
      "AI_CONFIG_ENCRYPTION_KEY is required to store or read provider API keys.",
    );
  }
  return createHash("sha256").update(seed).digest();
}

function encryptProviderKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getProviderEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    encryptedKeyPrefix,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
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
      Buffer.from(ivBase64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextBase64, "base64")),
      decipher.final(),
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
  if (type === "shot") {
    return DEFAULT_SINGLE_SHOT_MASTER_PROMPT;
  }
  return DEFAULT_SCRIPT_GENERATION_PROMPT;
}

function defaultMasterPromptOutputFormat(type: MasterPromptType) {
  if (type === "scenario") {
    return DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT;
  }
  if (type === "shots") {
    return DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT;
  }
  if (type === "shot") {
    return DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT;
  }
  return DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT;
}

function defaultMasterPromptName(type: MasterPromptType) {
  if (type === "scenario") {
    return "Built-in Scenario master prompt";
  }
  if (type === "shots") {
    return "Built-in Shots master prompt";
  }
  if (type === "shot") {
    return "Built-in Shot master prompt";
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
    outputFormat: defaultMasterPromptOutputFormat(type),
    attributeSelection: { attributes: [] },
    workflowAttributeSelection: { attributes: [] },
    isDefault: true,
    status: "active",
    isBuiltIn: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function mapUser(row: DbUser): UserProfile {
  return {
    id: row.id,
    displayName: row.displayName,
    role: UserRoleSchema.parse(row.role),
    status: UserStatusSchema.parse(row.status),
  };
}

export function mapProject(row: DbProject): Project {
  const project: Project = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    name: row.name,
    flowType: row.flowType === "script" ? "script" : "product",
    projectTemplateId: row.projectTemplateId,
    userProjectTemplateId: row.userProjectTemplateId,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.description) {
    project.description = row.description;
  }
  if (row.templateSelection) {
    project.templateSelection = TemplateSelectionSchema.parse(
      row.templateSelection,
    );
  }
  if (row.scenarioResult !== null) {
    project.scenarioResult = row.scenarioResult;
  }
  if (row.attributeSelections) {
    project.attributeSelections = ProjectAttributeSelectionsSchema.parse(
      row.attributeSelections,
    );
  }
  if (row.projectTemplateSnapshot) {
    project.projectTemplateSnapshot = ProjectTemplateSnapshotSchema.parse(
      row.projectTemplateSnapshot,
    );
  }

  return project;
}

export function mapProjectTemplate(row: DbProjectTemplate): ProjectTemplate {
  return ProjectTemplateSchema.parse({
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    finalStep: row.finalStep,
    steps: row.steps,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function mapUserProjectTemplate(
  row: DbUserProjectTemplate,
): UserProjectTemplate {
  return UserProjectTemplateSchema.parse({
    id: row.id,
    ownerUserId: row.ownerUserId,
    adminTemplateId: row.adminTemplateId,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    finalStep: row.finalStep,
    steps: row.steps,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
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
      row.status === "uploaded" ||
      row.status === "rejected" ||
      row.status === "deleted"
        ? row.status
        : "validated",
    previewUrl: `/api/v1/projects/${row.projectId}/media/${row.id}/content`,
    createdAt: row.createdAt.toISOString(),
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
    updatedAt: row.updatedAt.toISOString(),
  };

  if (row.description) {
    template.description = row.description;
  }
  if (row.idea) {
    template.idea = row.idea;
  }

  return template;
}

type DbAttributeCatalog =
  | DbStoryAttributeCatalog
  | DbScenarioAttributeCatalog
  | DbShotAttributeCatalog;

function normalizeCatalogId(value: string | undefined, fallback: string) {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function getUniqueCatalogId(baseId: string, usedIds: Set<string>) {
  let candidate = baseId;
  let index = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeAttributeCatalogAttributes(
  attributes: AttributeCatalogAttribute[],
): AttributeCatalogAttribute[] {
  const usedAttributeIds = new Set<string>();
  return attributes.map((attribute, attributeIndex) => {
    const attributeBaseId = normalizeCatalogId(
      attribute.id || attribute.name,
      `attribute-${attributeIndex + 1}`,
    );
    const attributeId = getUniqueCatalogId(attributeBaseId, usedAttributeIds);
    const usedOptionIds = new Set<string>();
    return {
      ...attribute,
      id: attributeId,
      name: attribute.name.trim(),
      ...(attribute.description !== undefined
        ? { description: attribute.description.trim() }
        : {}),
      options: attribute.options.map((option, optionIndex) => {
        const optionBaseId = normalizeCatalogId(
          option.id || option.name,
          `${attributeId}-option-${optionIndex + 1}`,
        );
        return {
          ...option,
          id: getUniqueCatalogId(optionBaseId, usedOptionIds),
          name: option.name.trim(),
          ...(option.description !== undefined
            ? { description: option.description.trim() }
            : {}),
        };
      }),
    };
  });
}

export function mapAttributeCatalog(
  type: AttributeCatalogType,
  row: DbAttributeCatalog,
): AttributeCatalog {
  return {
    id: row.id,
    type,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    attributes: normalizeAttributeCatalogAttributes(
      AttributeCatalogAttributeSchema.array().parse(row.attributes),
    ),
    isDefault: row.isDefault,
    status: row.status === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function enforceSingleDefaultAttributeCatalog(
  typeInput: AttributeCatalogType,
) {
  const type = AttributeCatalogTypeSchema.parse(typeInput);
  if (type === "story") {
    const defaults = await prisma.storyAttributeCatalog.findMany({
      where: { status: "active", isDefault: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const duplicateIds = defaults.slice(1).map((row) => row.id);
    if (duplicateIds.length > 0) {
      await prisma.storyAttributeCatalog.updateMany({
        where: { id: { in: duplicateIds }, status: "active", isDefault: true },
        data: { isDefault: false },
      });
    }
    return;
  }
  if (type === "scenario") {
    const defaults = await prisma.scenarioAttributeCatalog.findMany({
      where: { status: "active", isDefault: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    const duplicateIds = defaults.slice(1).map((row) => row.id);
    if (duplicateIds.length > 0) {
      await prisma.scenarioAttributeCatalog.updateMany({
        where: { id: { in: duplicateIds }, status: "active", isDefault: true },
        data: { isDefault: false },
      });
    }
    return;
  }
  const defaults = await prisma.shotAttributeCatalog.findMany({
    where: { type, status: "active", isDefault: true },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  const duplicateIds = defaults.slice(1).map((row) => row.id);
  if (duplicateIds.length > 0) {
    await prisma.shotAttributeCatalog.updateMany({
      where: { id: { in: duplicateIds }, type, status: "active", isDefault: true },
      data: { isDefault: false },
    });
  }
}

export async function getDefaultAttributeCatalog(
  typeInput: AttributeCatalogType,
) {
  const type = AttributeCatalogTypeSchema.parse(typeInput);
  await enforceSingleDefaultAttributeCatalog(type);
  if (type === "story") {
    const row = await prisma.storyAttributeCatalog.findFirst({
      where: { status: "active", isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
    return row ? mapAttributeCatalog(type, row) : null;
  }
  if (type === "scenario") {
    const row = await prisma.scenarioAttributeCatalog.findFirst({
      where: { status: "active", isDefault: true },
      orderBy: { updatedAt: "desc" },
    });
    return row ? mapAttributeCatalog(type, row) : null;
  }
  const row = await prisma.shotAttributeCatalog.findFirst({
    where: { type, status: "active", isDefault: true },
    orderBy: { updatedAt: "desc" },
  });
  return row ? mapAttributeCatalog(type, row) : null;
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
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapAiHandoff(row: DbAiHandoff): AiHandoff {
  return {
    id: row.id,
    projectId: row.projectId,
    shotId: row.shotId,
    provider: normalizeProvider(row.provider),
    targetUrl: row.targetUrl,
    promptText: row.promptText,
    status: AiHandoffStatusSchema.parse(row.status),
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapMasterPrompt(row: DbMasterPrompt): MasterPrompt {
  return {
    id: row.id,
    type: MasterPromptTypeSchema.parse(row.type),
    name: row.name,
    content: row.content,
    outputFormat: row.outputFormat ?? "",
    attributeSelection: MasterPromptAttributeSelectionSchema.parse(
      row.attributeSelection ?? { attributes: [] },
    ),
    workflowAttributeSelection: MasterPromptAttributeSelectionSchema.parse(
      row.workflowAttributeSelection ?? { attributes: [] },
    ),
    isDefault: row.isDefault,
    status: MasterPromptStatusSchema.parse(row.status),
    isBuiltIn: false,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMasterPromptAttributeConfig(
  row: DbMasterPromptAttributeConfig | null,
): MasterPromptAttributeConfig {
  if (!row) {
    return MasterPromptAttributeConfigSchema.parse({
      id: null,
      attributes: [],
      updatedAt: null,
    });
  }
  return MasterPromptAttributeConfigSchema.parse({
    id: row.id,
    attributes: MasterPromptAttributeSchema.array().parse(row.attributes),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function getCurrentUser(demoRole?: string) {
  const username = demoRole === "admin" ? "admin" : "user";
  const user = await prisma.userProfile.findUniqueOrThrow({
    where: { username },
  });
  return mapUser(user);
}

export function mapAiConfig(
  row: DbConfig,
  promptKeyStatus: ProviderKeyStatus,
  videoKeyStatus: ProviderKeyStatus,
  masterPrompts: {
    scenarioPrompt: string;
    scenarioOutputFormat: string;
    shotsPrompt: string;
    shotsOutputFormat: string;
    scriptsPrompt: string;
    scriptsOutputFormat: string;
  },
): AiConfig {
  return {
    contentMode: ContentModeSchema.parse(row.contentMode),
    showUserMasterPrompts: row.showUserMasterPrompts,
    aiSelectAttributeText: row.aiSelectAttributeText ?? "",
    userSelectAttributeText: row.userSelectAttributeText ?? "",
    aiHandoffProvider: normalizeProvider(row.aiHandoffProvider),
    aiHandoffTargetUrl: normalizeOptionalUrl(row.aiHandoffTargetUrl),
    aiHandoffPromptSelector: row.aiHandoffPromptSelector?.trim() || null,
    promptProvider: normalizeProvider(row.promptProvider),
    promptModel: row.promptModel,
    shotGenerationPrompt: masterPrompts.shotsPrompt,
    shotGenerationOutputFormat: masterPrompts.shotsOutputFormat,
    scriptGenerationPrompt: masterPrompts.scriptsPrompt,
    scriptGenerationOutputFormat: masterPrompts.scriptsOutputFormat,
    templateSelectionPrompt: masterPrompts.scenarioPrompt,
    templateSelectionOutputFormat: masterPrompts.scenarioOutputFormat,
    promptKeyStatus,
    videoProvider: normalizeProvider(row.videoProvider),
    videoModel: row.videoModel,
    videoKeyStatus,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getDefaultMasterPrompt(
  type: MasterPromptType,
  legacyPrompt?: string | null,
) {
  const defaultPrompt = await prisma.masterPrompt.findFirst({
    where: {
      type,
      status: "active",
      isDefault: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (defaultPrompt) {
    return mapMasterPrompt(defaultPrompt);
  }

  const firstPrompt = await prisma.masterPrompt.findFirst({
    where: {
      type,
      status: "active",
    },
    orderBy: { updatedAt: "desc" },
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
      outputFormat: "",
      isBuiltIn: true,
    };
  }

  return builtInMasterPrompt(type);
}

function requiredMasterPromptLabel(type: MasterPromptType) {
  if (type === "scripts") {
    return "Story Content";
  }
  if (type === "scenario") {
    return "Scenario";
  }
  if (type === "shots") {
    return "Shots";
  }
  return "Shot";
}

export async function getRequiredDefaultMasterPrompt(type: MasterPromptType) {
  const prompt = await prisma.masterPrompt.findFirst({
    where: {
      type,
      status: "active",
      isDefault: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!prompt) {
    throw new Error(
      `Active default ${requiredMasterPromptLabel(type)} master prompt is required.`,
    );
  }
  return mapMasterPrompt(prompt);
}

export async function getDefaultMasterPromptContent(
  type: MasterPromptType,
  legacyPrompt?: string | null,
) {
  const prompt = await getDefaultMasterPrompt(type, legacyPrompt);
  return renderMasterPromptText(prompt);
}

export async function getMasterPromptAttributeConfig(): Promise<MasterPromptAttributeConfig> {
  const row = await prisma.masterPromptAttributeConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return mapMasterPromptAttributeConfig(row);
}

export async function replaceMasterPromptAttributeConfig(input: {
  attributes: MasterPromptAttribute[];
}) {
  const attributes = MasterPromptAttributeSchema.array()
    .min(1)
    .parse(input.attributes);
  const existing = await prisma.masterPromptAttributeConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  const row = existing
    ? await prisma.masterPromptAttributeConfig.update({
        where: { id: existing.id },
        data: {
          attributes: attributes as unknown as Prisma.InputJsonValue,
          createdByAdminId: defaultAdminId,
        },
      })
    : await prisma.masterPromptAttributeConfig.create({
        data: {
          attributes: attributes as unknown as Prisma.InputJsonValue,
          createdByAdminId: defaultAdminId,
        },
      });
  return mapMasterPromptAttributeConfig(row);
}

function normalizeSelectionForAttributes(
  selection: MasterPromptAttributeSelection,
  attributes: Array<{ id: string; options: Array<{ id: string }> }>,
): MasterPromptAttributeSelection {
  const attributesById = new Map(attributes.map((attribute) => [attribute.id, attribute]));
  return {
    attributes: selection.attributes.flatMap((selectedAttribute) => {
      const attribute = attributesById.get(selectedAttribute.attributeId);
      if (!attribute) {
        return [];
      }
      const optionIds = new Set(attribute.options.map((option) => option.id));
      const selectedOptionIds = [...new Set(selectedAttribute.optionIds)].filter((optionId) =>
        optionIds.has(optionId),
      );
      return selectedOptionIds.length > 0
        ? [{ attributeId: selectedAttribute.attributeId, optionIds: selectedOptionIds }]
        : [];
    }),
  };
}

function selectedMasterPromptAttributeText(
  configAttributes: MasterPromptAttribute[],
  selection: MasterPromptAttributeSelection,
) {
  const normalizedSelection = normalizeSelectionForAttributes(
    selection,
    configAttributes,
  );
  const selectedLines = normalizedSelection.attributes.flatMap((selectedAttribute) => {
    const attribute = configAttributes.find(
      (candidate) => candidate.id === selectedAttribute.attributeId,
    );
    if (!attribute) {
      throw new Error(
        `Master Prompt Attribute "${selectedAttribute.attributeId}" is not configured.`,
      );
    }
    const selectedOptions = selectedAttribute.optionIds.map((optionId) => {
      const option = attribute.options.find(
        (candidate) => candidate.id === optionId,
      );
      if (!option) {
        throw new Error(
          `Master Prompt Attribute option "${optionId}" is not configured.`,
        );
      }
      return option.description
        ? `${option.name} (${option.description})`
        : option.name;
    });
    return selectedOptions.length > 0
      ? [`${attribute.name}: ${selectedOptions.join(", ")}`]
      : [];
  });

  if (selectedLines.length === 0) {
    throw new Error(
      "Master Prompt Attribute selection is required for {masterPromptAttributes}.",
    );
  }

  return selectedLines.join("\n");
}

function masterPromptWorkflowCatalogType(
  type: MasterPromptType,
): AttributeCatalogType {
  return type === "scripts" ? "story" : type;
}

function selectedWorkflowAttributeText(
  catalog: AttributeCatalog,
  selection: MasterPromptAttributeSelection,
) {
  const normalizedSelection = normalizeSelectionForAttributes(
    selection,
    catalog.attributes,
  );
  const selectedLines = normalizedSelection.attributes.flatMap((selectedAttribute) => {
    const attribute = catalog.attributes.find(
      (candidate) => candidate.id === selectedAttribute.attributeId,
    );
    if (!attribute) {
      throw new Error(
        `${catalog.name} Attribute "${selectedAttribute.attributeId}" is not configured.`,
      );
    }
    const selectedOptions = selectedAttribute.optionIds.map((optionId) => {
      const option = attribute.options.find(
        (candidate) => candidate.id === optionId,
      );
      if (!option) {
        throw new Error(
          `${catalog.name} Attribute option "${optionId}" is not configured.`,
        );
      }
      return option.name;
    });
    return selectedOptions.length > 0
      ? [`${attribute.name}: ${selectedOptions.join(", ")}`]
      : [];
  });

  if (selectedLines.length === 0) {
    throw new Error(`${catalog.name} Attribute selection is empty.`);
  }

  return selectedLines.join("\n");
}

export async function validateMasterPromptWorkflowAttributeSelection(
  typeInput: MasterPromptType,
  rawSelection?: MasterPromptAttributeSelection | null,
) {
  const selection = MasterPromptAttributeSelectionSchema.parse(
    rawSelection ?? { attributes: [] },
  );
  const rawHasSelectedOptions = selection.attributes.some(
    (attribute) => attribute.optionIds.length > 0,
  );
  if (!rawHasSelectedOptions) {
    return selection;
  }

  const catalogType = masterPromptWorkflowCatalogType(typeInput);
  const catalog = await getDefaultAttributeCatalog(catalogType);
  if (!catalog) {
    throw new Error(
      `${catalogType} Attribute catalog is required before selecting workflow attributes on this master prompt.`,
    );
  }
  const normalizedSelection = normalizeSelectionForAttributes(
    selection,
    catalog.attributes,
  );
  const hasSelectedOptions = normalizedSelection.attributes.some(
    (attribute) => attribute.optionIds.length > 0,
  );
  if (!hasSelectedOptions) {
    return normalizedSelection;
  }
  selectedWorkflowAttributeText(catalog, normalizedSelection);
  return normalizedSelection;
}

export async function renderMasterPromptAttributes(
  content: string,
  rawSelection?: MasterPromptAttributeSelection | null,
) {
  if (!content.includes(MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER)) {
    return content;
  }

  const config = await getMasterPromptAttributeConfig();
  if (config.attributes.length === 0) {
    throw new Error(
      "Master Prompt Config is required before using {masterPromptAttributes}.",
    );
  }
  const selection = MasterPromptAttributeSelectionSchema.parse(
    rawSelection ?? { attributes: [] },
  );
  const renderedAttributes = selectedMasterPromptAttributeText(
    config.attributes,
    selection,
  );
  return content.replaceAll(
    MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
    renderedAttributes,
  );
}

export function renderMasterPromptOutputFormat(
  content: string,
  outputFormat: string | null | undefined,
) {
  if (!content.includes(MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER)) {
    return content;
  }

  const trimmedOutputFormat = outputFormat?.trim();
  if (!trimmedOutputFormat) {
    throw new Error("Output Format is required before using {outputFormat}.");
  }

  return content.replaceAll(
    MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
    trimmedOutputFormat,
  );
}

export async function renderMasterPromptText(prompt: MasterPrompt) {
  const withMasterPromptAttributes = await renderMasterPromptAttributes(
    prompt.content,
    prompt.attributeSelection,
  );
  return renderMasterPromptOutputFormat(
    withMasterPromptAttributes,
    prompt.outputFormat,
  );
}

export async function validateMasterPromptAttributeSelection(
  content: string,
  rawSelection?: MasterPromptAttributeSelection | null,
) {
  const selection = MasterPromptAttributeSelectionSchema.parse(
    rawSelection ?? { attributes: [] },
  );
  const rawHasSelectedOptions = selection.attributes.some(
    (attribute) => attribute.optionIds.length > 0,
  );
  if (!rawHasSelectedOptions) {
    return selection;
  }
  const config = await getMasterPromptAttributeConfig();
  const normalizedSelection = normalizeSelectionForAttributes(
    selection,
    config.attributes,
  );
  const hasSelectedOptions = normalizedSelection.attributes.some(
    (attribute) => attribute.optionIds.length > 0,
  );
  if (!content.includes(MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER)) {
    if (!hasSelectedOptions) {
      return normalizedSelection;
    }
    selectedMasterPromptAttributeText(config.attributes, normalizedSelection);
    return normalizedSelection;
  }
  await renderMasterPromptAttributes(content, normalizedSelection);
  return normalizedSelection;
}

export function validateMasterPromptOutputFormat(
  content: string,
  outputFormat: string | null | undefined,
) {
  renderMasterPromptOutputFormat(content, outputFormat);
}

export function assertNoMasterPromptAttributePlaceholder(
  value: string | null | undefined,
) {
  if (value?.includes(MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER)) {
    throw new Error(
      "{masterPromptAttributes} is admin-only and cannot be used in temporary user prompt overrides.",
    );
  }
}

export async function getMasterPromptConfig(): Promise<MasterPromptConfig> {
  const rows = await prisma.masterPrompt.findMany({
    where: { status: "active" },
    orderBy: [{ type: "asc" }, { isDefault: "desc" }, { updatedAt: "desc" }],
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
          defaultPrompt,
        };
      }),
    ),
    updatedAt: rows[0]?.updatedAt.toISOString() ?? now,
  };
}

export async function createMasterPrompt(input: {
  type: MasterPromptType;
  name: string;
  content: string;
  outputFormat?: string;
  attributeSelection?: MasterPromptAttributeSelection;
  workflowAttributeSelection?: MasterPromptAttributeSelection;
}) {
  const type = MasterPromptTypeSchema.parse(input.type);
  const content = input.content.trim();
  const outputFormat = input.outputFormat?.trim() ?? "";
  const attributeSelection = await validateMasterPromptAttributeSelection(
    content,
    input.attributeSelection,
  );
  const workflowAttributeSelection =
    await validateMasterPromptWorkflowAttributeSelection(
      type,
      input.workflowAttributeSelection,
    );
  validateMasterPromptOutputFormat(content, outputFormat);
  return prisma.$transaction(async (tx) => {
    const activeCount = await tx.masterPrompt.count({
      where: { type, status: "active" },
    });
    const shouldBeDefault = activeCount === 0;
    const prompt = await tx.masterPrompt.create({
      data: {
        type,
        name: input.name.trim(),
        content,
        outputFormat,
        attributeSelection:
          attributeSelection as unknown as Prisma.InputJsonValue,
        workflowAttributeSelection:
          workflowAttributeSelection as unknown as Prisma.InputJsonValue,
        status: "active",
        isDefault: shouldBeDefault,
        createdByAdminId: defaultAdminId,
      },
    });
    return mapMasterPrompt(prompt);
  });
}

export async function updateMasterPrompt(
  id: string,
  input: {
    name?: string;
    content?: string;
    outputFormat?: string;
    attributeSelection?: MasterPromptAttributeSelection;
    workflowAttributeSelection?: MasterPromptAttributeSelection;
  },
) {
  const existing = await prisma.masterPrompt.findFirstOrThrow({
    where: { id, status: "active" },
  });
  const type = MasterPromptTypeSchema.parse(existing.type);
  const nextContent = input.content?.trim() ?? existing.content;
  const nextOutputFormat =
    input.outputFormat?.trim() ?? existing.outputFormat ?? "";
  const nextSelection = input.attributeSelection
    ? await validateMasterPromptAttributeSelection(
        nextContent,
        input.attributeSelection,
      )
    : await validateMasterPromptAttributeSelection(
        nextContent,
        MasterPromptAttributeSelectionSchema.parse(
          existing.attributeSelection ?? { attributes: [] },
        ),
      );
  const nextWorkflowSelection = input.workflowAttributeSelection
    ? await validateMasterPromptWorkflowAttributeSelection(
        type,
        input.workflowAttributeSelection,
      )
    : await validateMasterPromptWorkflowAttributeSelection(
        type,
        MasterPromptAttributeSelectionSchema.parse(
          existing.workflowAttributeSelection ?? { attributes: [] },
        ),
      );
  validateMasterPromptOutputFormat(nextContent, nextOutputFormat);
  const prompt = await prisma.masterPrompt.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.content !== undefined ? { content: input.content.trim() } : {}),
      ...(input.outputFormat !== undefined
        ? { outputFormat: input.outputFormat.trim() }
        : {}),
      attributeSelection: nextSelection as unknown as Prisma.InputJsonValue,
      workflowAttributeSelection:
        nextWorkflowSelection as unknown as Prisma.InputJsonValue,
    },
  });
  return mapMasterPrompt(prompt);
}

export async function archiveMasterPrompt(id: string) {
  const existing = await prisma.masterPrompt.findFirstOrThrow({
    where: { id, status: "active" },
  });
  if (existing.isDefault) {
    return {
      archived: false,
      reason: "DEFAULT_PROMPT_DELETE_BLOCKED" as const,
      prompt: mapMasterPrompt(existing),
    };
  }
  const prompt = await prisma.masterPrompt.update({
    where: { id: existing.id },
    data: { status: "archived" },
  });
  return {
    archived: true,
    prompt: mapMasterPrompt(prompt),
  };
}

export async function setDefaultMasterPrompt(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.masterPrompt.findFirstOrThrow({
      where: { id, status: "active" },
    });
    await tx.masterPrompt.updateMany({
      where: {
        type: existing.type,
        status: "active",
      },
      data: { isDefault: false },
    });
    const prompt = await tx.masterPrompt.update({
      where: { id: existing.id },
      data: { isDefault: true },
    });
    return mapMasterPrompt(prompt);
  });
}

export async function getStoredProviderKey(provider: string) {
  const normalizedProvider = normalizeProvider(provider);
  const providerKey = await prisma.aiProviderKey.findUnique({
    where: { provider: normalizedProvider },
  });
  if (providerKey?.keyStatus !== "configured") {
    return null;
  }
  return decryptProviderKey(providerKey.encryptedKey)?.trim() || null;
}

export async function resolveProviderApiKey(
  provider: string,
  overrideKey?: string,
) {
  const normalizedProvider = normalizeProvider(provider);
  const trimmedOverrideKey = overrideKey?.trim();
  if (trimmedOverrideKey) {
    return {
      apiKey: trimmedOverrideKey,
      source: "input" as ProviderKeySource,
    };
  }

  const storedApiKey = await getStoredProviderKey(normalizedProvider);
  if (storedApiKey) {
    return {
      apiKey: storedApiKey,
      source: "stored" as ProviderKeySource,
    };
  }

  return {
    apiKey: null,
    source: "missing" as ProviderKeySource,
  };
}

export async function getProviderKeyStatus(
  provider: string,
): Promise<ProviderKeyStatus> {
  const resolved = await resolveProviderApiKey(provider);
  if (resolved.source === "stored") {
    return "configured";
  }
  return "missing";
}

export async function getActiveAiConfig(): Promise<AiConfig> {
  const config = await prisma.aiSiteConfig.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  const [
    promptKeyStatus,
    videoKeyStatus,
    scenarioPrompt,
    shotsPrompt,
    scriptsPrompt,
  ] = await Promise.all([
    getProviderKeyStatus(config.promptProvider),
    getProviderKeyStatus(config.videoProvider),
    getRequiredDefaultMasterPrompt("scenario"),
    getRequiredDefaultMasterPrompt("shots"),
    getRequiredDefaultMasterPrompt("scripts"),
  ]);
  const [scenarioPromptContent, shotsPromptContent, scriptsPromptContent] =
    await Promise.all([
      renderMasterPromptText(scenarioPrompt),
      renderMasterPromptText(shotsPrompt),
      renderMasterPromptText(scriptsPrompt),
    ]);
  return mapAiConfig(config, promptKeyStatus, videoKeyStatus, {
    scenarioPrompt: scenarioPromptContent,
    scenarioOutputFormat: scenarioPrompt.outputFormat,
    shotsPrompt: shotsPromptContent,
    shotsOutputFormat: shotsPrompt.outputFormat,
    scriptsPrompt: scriptsPromptContent,
    scriptsOutputFormat: scriptsPrompt.outputFormat,
  });
}

export async function replaceActiveAiConfig(input: {
  contentMode: "script" | "video";
  showUserMasterPrompts?: boolean | undefined;
  aiSelectAttributeText?: string | undefined;
  userSelectAttributeText?: string | undefined;
  aiHandoffProvider?: Provider | undefined;
  aiHandoffTargetUrl?: string | null | undefined;
  aiHandoffPromptSelector?: string | null | undefined;
  promptProvider: Provider;
  promptModel: string;
  videoProvider: Provider;
  videoModel: string;
}) {
  const promptProvider = normalizeProvider(input.promptProvider);
  const videoProvider = normalizeProvider(input.videoProvider);
  const activeConfig = await prisma.aiSiteConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  const nextAiHandoffProvider = normalizeProvider(
    input.aiHandoffProvider ??
      activeConfig?.aiHandoffProvider ??
      defaultAiHandoffProvider,
  );
  const nextAiHandoffTargetUrl =
    input.aiHandoffTargetUrl !== undefined
      ? normalizeOptionalUrl(input.aiHandoffTargetUrl)
      : activeConfig
        ? normalizeOptionalUrl(activeConfig.aiHandoffTargetUrl)
        : normalizeOptionalUrl(defaultAiHandoffTargetUrl);
  const nextAiHandoffPromptSelector =
    input.aiHandoffPromptSelector !== undefined
      ? input.aiHandoffPromptSelector?.trim() || null
      : activeConfig?.aiHandoffPromptSelector?.trim() || null;
  await prisma.$transaction([
    prisma.aiSiteConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.aiSiteConfig.create({
      data: {
        contentMode: input.contentMode,
        showUserMasterPrompts:
          input.showUserMasterPrompts ??
          activeConfig?.showUserMasterPrompts ??
          false,
        aiSelectAttributeText:
          input.aiSelectAttributeText !== undefined
            ? input.aiSelectAttributeText
            : activeConfig?.aiSelectAttributeText ?? "",
        userSelectAttributeText:
          input.userSelectAttributeText !== undefined
            ? input.userSelectAttributeText
            : activeConfig?.userSelectAttributeText ?? "",
        aiHandoffProvider: nextAiHandoffProvider,
        aiHandoffTargetUrl: nextAiHandoffTargetUrl,
        aiHandoffPromptSelector: nextAiHandoffPromptSelector,
        promptProvider,
        promptModel: input.promptModel,
        shotGenerationPrompt: activeConfig?.shotGenerationPrompt ?? null,
        shotComposerPrompt: activeConfig?.shotComposerPrompt ?? null,
        templateSelectionPrompt: activeConfig?.templateSelectionPrompt ?? null,
        videoProvider,
        videoModel: input.videoModel,
        isActive: true,
        createdByAdminId: defaultAdminId,
      },
    }),
  ]);
  return getActiveAiConfig();
}

export async function markProviderKeyConfigured(
  provider: string,
  apiKey: string,
) {
  const normalizedProvider = normalizeProvider(provider);
  const encryptedKey = encryptProviderKey(apiKey.trim());
  await prisma.aiProviderKey.upsert({
    where: { provider: normalizedProvider },
    update: {
      encryptedKey,
      keyStatus: "configured",
      rotatedAt: new Date(),
      createdByAdminId: defaultAdminId,
    },
    create: {
      provider: normalizedProvider,
      encryptedKey,
      keyStatus: "configured",
      rotatedAt: new Date(),
      createdByAdminId: defaultAdminId,
    },
  });
  return {
    provider: normalizedProvider,
    keyStatus: await getProviderKeyStatus(normalizedProvider),
  };
}

export function mapJob(row: DbJob): Job {
  return {
    jobId: row.jobId,
    type: row.type as Job["type"],
    status: JobStatusSchema.parse(row.status),
    progress: row.progress,
    result: row.result ?? null,
    error: row.error ? (row.error as ApiError) : null,
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
    status:
      row.status === "failed"
        ? "failed"
        : row.status === "success"
          ? "success"
          : "pending",
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
    requestPayload: asRecord(row.requestPayload),
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
