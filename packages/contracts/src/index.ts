import { z } from "zod";

export const UserRoleSchema = z.enum(["user", "admin"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["active", "disabled"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const ContentModeSchema = z.enum(["script", "video"]);
export type ContentMode = z.infer<typeof ContentModeSchema>;

export const ProviderSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .transform((provider) => provider.toLowerCase());
export type Provider = z.infer<typeof ProviderSchema>;

export const OptionalUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2000)
  .nullable();

export const ProviderKeyStatusSchema = z.enum(["missing", "configured", "env"]);
export type ProviderKeyStatus = z.infer<typeof ProviderKeyStatusSchema>;

export const ProviderKeySourceSchema = z.enum([
  "input",
  "stored",
  "env",
  "missing",
]);
export type ProviderKeySource = z.infer<typeof ProviderKeySourceSchema>;

export const JobStatusSchema = z.enum([
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const FlowTypeSchema = z.enum([
  "script_prompt",
  "product_url",
  "media_analysis",
  "script_generation",
  "video_generation",
  "template_generation",
  "attribute_generation",
  "template_selection",
  "shot_generation",
]);
export type FlowType = z.infer<typeof FlowTypeSchema>;

export const AiHandoffStatusSchema = z.enum([
  "created",
  "sent_to_extension",
  "target_opened",
  "prompt_filled",
  "generate_clicked",
  "failed",
  "completed_manually",
]);
export type AiHandoffStatus = z.infer<typeof AiHandoffStatusSchema>;

export const MasterPromptTypeSchema = z.enum([
  "scenario",
  "shots",
  "scripts",
  "shot",
]);
export type MasterPromptType = z.infer<typeof MasterPromptTypeSchema>;

export const AttributeCatalogTypeSchema = z.enum([
  "story",
  "scenario",
  "shots",
  "shot",
]);
export type AttributeCatalogType = z.infer<typeof AttributeCatalogTypeSchema>;

export type PromptPlaceholderDefinition = {
  token: string;
  description: string;
};

export const MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER = "{masterPromptAttributes}";
export const MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER = "{outputFormat}";

export const MASTER_PROMPT_PLACEHOLDERS: Record<
  MasterPromptType,
  PromptPlaceholderDefinition[]
> = {
  scripts: [
    {
      token: "{storyContent}",
      description: "The user's source idea, notes, or draft story content.",
    },
    {
      token: "{storyAttributes}",
      description: "The selected Story attributes/options in compact form.",
    },
    {
      token: MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
      description:
        "The output format instructions saved on this master prompt.",
    },
  ],
  scenario: [
    {
      token: "{story}",
      description: "Story Content or script text that should be analyzed.",
    },
    {
      token: "{attributes}",
      description:
        "The Scenario attribute and option catalog for AI selection.",
    },
    {
      token: "{scenarioAttributes}",
      description:
        "The active Scenario attribute catalog and selected options.",
    },
    {
      token: MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
      description:
        "The output format instructions saved on this master prompt.",
    },
  ],
  shots: [
    {
      token: "{story}",
      description: "Story Content used as the source for shot generation.",
    },
    {
      token: "{attributes}",
      description: "Selected Scenario or shot-plan attributes in compact form.",
    },
    {
      token: "{scenarioAttributes}",
      description: "Selected Scenario attributes/options in compact form.",
    },
    {
      token: "{shotsAttributes}",
      description: "Selected Shots attributes/options in compact form.",
    },
    {
      token: MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
      description:
        "The output format instructions saved on this master prompt.",
    },
  ],
  shot: [
    {
      token: "{storyContent}",
      description: "Story Content used as context for this single shot.",
    },
    {
      token: "{shotTitle}",
      description: "The title of the current shot.",
    },
    {
      token: "{shotDescription}",
      description: "The editable description of the current shot.",
    },
    {
      token: "{shotDialogue}",
      description:
        "Dialogue, voiceover, or narration saved on the current shot.",
    },
    {
      token: "{shotDuration}",
      description: "Duration of the current shot.",
    },
    {
      token: "{shotGeneratedAttributes}",
      description:
        "Attributes generated with the Step 3 shot JSON for this shot.",
    },
    {
      token: "{shotAttributes}",
      description:
        "Admin-defined Shot attributes selected for this individual shot.",
    },
    {
      token: "{referenceMedia}",
      description: "Reference media metadata attached to this shot.",
    },
    {
      token: MASTER_PROMPT_OUTPUT_FORMAT_PLACEHOLDER,
      description:
        "The output format instructions saved on this master prompt.",
    },
  ],
};

export const ADMIN_MASTER_PROMPT_PLACEHOLDERS: Record<
  MasterPromptType,
  PromptPlaceholderDefinition[]
> = {
  scripts: [
    ...MASTER_PROMPT_PLACEHOLDERS.scripts,
    {
      token: MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
      description:
        "Admin-only Master Prompt Attribute options selected for this master prompt.",
    },
  ],
  scenario: [
    ...MASTER_PROMPT_PLACEHOLDERS.scenario,
    {
      token: MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
      description:
        "Admin-only Master Prompt Attribute options selected for this master prompt.",
    },
  ],
  shots: [
    ...MASTER_PROMPT_PLACEHOLDERS.shots,
    {
      token: MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
      description:
        "Admin-only Master Prompt Attribute options selected for this master prompt.",
    },
  ],
  shot: [
    ...MASTER_PROMPT_PLACEHOLDERS.shot,
    {
      token: MASTER_PROMPT_ATTRIBUTES_PLACEHOLDER,
      description:
        "Admin-only Master Prompt Attribute options selected for this master prompt.",
    },
  ],
};

export const MasterPromptStatusSchema = z.enum(["active", "archived"]);
export type MasterPromptStatus = z.infer<typeof MasterPromptStatusSchema>;

export const ProjectFlowSchema = z.enum(["script", "product"]);
export type ProjectFlow = z.infer<typeof ProjectFlowSchema>;

export const ApiMetaSchema = z.object({
  requestId: z.string().optional(),
});
export type ApiMeta = z.infer<typeof ApiMetaSchema>;

export const ApiErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "PROJECT_NOT_FOUND",
  "MEDIA_NOT_FOUND",
  "MEDIA_INVALID_TYPE",
  "MEDIA_SIZE_EXCEEDED",
  "MEDIA_DURATION_EXCEEDED",
  "AI_CONFIG_MISSING",
  "AI_PROVIDER_FAILED",
  "AI_RATE_LIMITED",
  "VIDEO_PROVIDER_FAILED",
  "JOB_NOT_FOUND",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ApiErrorCodeSchema,
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: UserRoleSchema,
  status: UserStatusSchema,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  flowType: ProjectFlowSchema,
  templateSelection: z
    .lazy(() => TemplateSelectionSchema)
    .nullable()
    .optional(),
  attributeSelections: z
    .lazy(() => ProjectAttributeSelectionsSchema)
    .optional(),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  flowType: ProjectFlowSchema,
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const MediaAssetSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  projectId: z.string(),
  mediaType: z.enum(["image", "video"]),
  mimeType: z.string(),
  originalFilename: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(["uploaded", "validated", "rejected", "deleted"]),
  previewUrl: z.string().optional(),
  validationError: z.string().optional(),
  createdAt: z.string(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const TemplateOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  value: z.string().min(1),
  description: z.string().optional(),
});
export type TemplateOption = z.infer<typeof TemplateOptionSchema>;

export const TemplateAttributeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(TemplateOptionSchema).default([]),
});
export type TemplateAttribute = z.infer<typeof TemplateAttributeSchema>;

export const AttributeCatalogOptionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});
export type AttributeCatalogOption = z.infer<
  typeof AttributeCatalogOptionSchema
>;

export const AttributeCatalogAttributeSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  required: z.boolean().default(false),
  options: z.array(AttributeCatalogOptionSchema).default([]),
});
export type AttributeCatalogAttribute = z.infer<
  typeof AttributeCatalogAttributeSchema
>;

export const MasterPromptAttributeOptionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});
export type MasterPromptAttributeOption = z.infer<
  typeof MasterPromptAttributeOptionSchema
>;

export const MasterPromptAttributeSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  options: z.array(MasterPromptAttributeOptionSchema).min(1),
});
export type MasterPromptAttribute = z.infer<typeof MasterPromptAttributeSchema>;

export const MasterPromptAttributeSelectionItemSchema = z.object({
  attributeId: z.string().trim().min(1),
  optionIds: z.array(z.string().trim().min(1)).default([]),
});
export type MasterPromptAttributeSelectionItem = z.infer<
  typeof MasterPromptAttributeSelectionItemSchema
>;

export const MasterPromptAttributeSelectionSchema = z.object({
  attributes: z.array(MasterPromptAttributeSelectionItemSchema).default([]),
});
export type MasterPromptAttributeSelection = z.infer<
  typeof MasterPromptAttributeSelectionSchema
>;

export const MasterPromptAttributeConfigSchema = z.object({
  id: z.string().nullable(),
  attributes: z.array(MasterPromptAttributeSchema),
  updatedAt: z.string().nullable(),
});
export type MasterPromptAttributeConfig = z.infer<
  typeof MasterPromptAttributeConfigSchema
>;

export const UpdateMasterPromptAttributeConfigRequestSchema = z.object({
  attributes: z.array(MasterPromptAttributeSchema).min(1),
});
export type UpdateMasterPromptAttributeConfigRequest = z.infer<
  typeof UpdateMasterPromptAttributeConfigRequestSchema
>;

export const AttributeCatalogSchema = z.object({
  id: z.string(),
  type: AttributeCatalogTypeSchema,
  name: z.string(),
  description: z.string().optional(),
  attributes: z.array(AttributeCatalogAttributeSchema),
  isDefault: z.boolean().default(false),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AttributeCatalog = z.infer<typeof AttributeCatalogSchema>;

export const AttributeCatalogConfigSchema = z.object({
  type: AttributeCatalogTypeSchema,
  catalogs: z.array(AttributeCatalogSchema),
  defaultCatalog: AttributeCatalogSchema.nullable(),
  updatedAt: z.string(),
});
export type AttributeCatalogConfig = z.infer<
  typeof AttributeCatalogConfigSchema
>;

export const CreateAttributeCatalogRequestSchema = z.object({
  type: AttributeCatalogTypeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  attributes: z.array(AttributeCatalogAttributeSchema).min(1),
});
export type CreateAttributeCatalogRequest = z.infer<
  typeof CreateAttributeCatalogRequestSchema
>;

export const UpdateAttributeCatalogRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  attributes: z.array(AttributeCatalogAttributeSchema).min(1).optional(),
});
export type UpdateAttributeCatalogRequest = z.infer<
  typeof UpdateAttributeCatalogRequestSchema
>;

export const AttributeGenerationPromptSchema = z.object({
  type: AttributeCatalogTypeSchema,
  content: z.string(),
  updatedAt: z.string().nullable(),
});
export type AttributeGenerationPrompt = z.infer<
  typeof AttributeGenerationPromptSchema
>;

export const UpdateAttributeGenerationPromptRequestSchema = z.object({
  content: z.string().trim().min(1).max(20000),
});
export type UpdateAttributeGenerationPromptRequest = z.infer<
  typeof UpdateAttributeGenerationPromptRequestSchema
>;

export const GenerateAttributeCatalogRequestSchema = z.object({
  inputText: z.string().trim().min(1).max(12000),
  prompt: z.string().trim().min(1).max(20000).optional(),
});
export type GenerateAttributeCatalogRequest = z.infer<
  typeof GenerateAttributeCatalogRequestSchema
>;

export const AttributeSelectionOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type AttributeSelectionOption = z.infer<
  typeof AttributeSelectionOptionSchema
>;

export const AttributeSelectionAttributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean().default(false),
  options: z.array(AttributeSelectionOptionSchema),
});
export type AttributeSelectionAttribute = z.infer<
  typeof AttributeSelectionAttributeSchema
>;

export const AttributeSelectionSchema = z.object({
  catalogId: z.string(),
  catalogName: z.string(),
  type: AttributeCatalogTypeSchema,
  attributes: z.array(AttributeSelectionAttributeSchema),
});
export type AttributeSelection = z.infer<typeof AttributeSelectionSchema>;

export const ProjectAttributeSelectionsSchema = z.object({
  story: AttributeSelectionSchema.nullable().optional(),
  scenario: AttributeSelectionSchema.nullable().optional(),
  shots: AttributeSelectionSchema.nullable().optional(),
});
export type ProjectAttributeSelections = z.infer<
  typeof ProjectAttributeSelectionsSchema
>;

export const VideoTemplateSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  idea: z.string().optional(),
  attributes: z.array(TemplateAttributeSchema),
  isDefault: z.boolean().default(false),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VideoTemplate = z.infer<typeof VideoTemplateSchema>;

export const TemplateSelectionAttributeSchema = z.object({
  id: z.string(),
  name: z.string(),
  options: z.array(TemplateOptionSchema),
});
export type TemplateSelectionAttribute = z.infer<
  typeof TemplateSelectionAttributeSchema
>;

export const TemplateSelectionSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  attributes: z.array(TemplateSelectionAttributeSchema),
});
export type TemplateSelection = z.infer<typeof TemplateSelectionSchema>;

export const AnalyzeTemplateSelectionRequestSchema = z.object({
  inputText: z.string().min(1).max(12000),
  templateId: z.string().min(1).optional(),
  catalogId: z.string().min(1).optional(),
  masterPrompt: z.string().trim().min(1).max(12000).optional(),
  saveAsTemplate: z.boolean().optional().default(false),
  templateName: z.string().trim().min(1).max(120).optional(),
  templateDescription: z.string().trim().max(500).optional(),
});
export type AnalyzeTemplateSelectionRequest = z.infer<
  typeof AnalyzeTemplateSelectionRequestSchema
>;

export const TemplateSelectionAnalysisResultSchema = z.object({
  projectId: z.string(),
  templateSelection: TemplateSelectionSchema,
  compactSelection: z.string(),
  rawRequest: z.unknown(),
  rawResponse: z.unknown(),
  provider: ProviderSchema,
  model: z.string(),
});
export type TemplateSelectionAnalysisResult = z.infer<
  typeof TemplateSelectionAnalysisResultSchema
>;

export const SaveProjectTemplateSelectionRequestSchema = z.object({
  templateSelection: TemplateSelectionSchema.nullable(),
});
export type SaveProjectTemplateSelectionRequest = z.infer<
  typeof SaveProjectTemplateSelectionRequestSchema
>;

export const SaveProjectAttributeSelectionsRequestSchema = z.object({
  attributeSelections: ProjectAttributeSelectionsSchema,
});
export type SaveProjectAttributeSelectionsRequest = z.infer<
  typeof SaveProjectAttributeSelectionsRequestSchema
>;

export const SaveProjectStoryContentRequestSchema = z.object({
  storyContent: z.string().trim().min(1).max(12000),
});
export type SaveProjectStoryContentRequest = z.infer<
  typeof SaveProjectStoryContentRequestSchema
>;

export const VideoShotAttributeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  value: z.string().min(1),
});
export type VideoShotAttribute = z.infer<typeof VideoShotAttributeSchema>;

export const VideoShotSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  durationSeconds: z.number().int().min(1).max(8),
  attributes: z.array(VideoShotAttributeSchema).default([]),
  attributeSelection: AttributeSelectionSchema.nullable().optional(),
  mediaIds: z.array(z.string()).default([]),
});
export type VideoShot = z.infer<typeof VideoShotSchema>;

export const VideoShotPlanSchema = z.object({
  id: z.string(),
  ownerUserId: z.string(),
  projectId: z.string().nullable().optional(),
  name: z.string(),
  description: z.string().optional(),
  sourceText: z.string(),
  durationSeconds: z.number().int().min(1).max(8),
  attributes: z.array(VideoShotAttributeSchema).default([]),
  shots: z.array(VideoShotSchema),
  isDefault: z.boolean().default(false),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VideoShotPlan = z.infer<typeof VideoShotPlanSchema>;

export const ShotSelectionSchema = z.object({
  shotPlanId: z.string(),
  shotPlanName: z.string(),
  attributes: z.array(VideoShotAttributeSchema).default([]),
  shots: z.array(VideoShotSchema),
});
export type ShotSelection = z.infer<typeof ShotSelectionSchema>;

export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  idea: z.string().max(1000).optional(),
  attributes: z.array(TemplateAttributeSchema).min(1),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema =
  CreateTemplateRequestSchema.partial().extend({
    attributes: z.array(TemplateAttributeSchema).min(1).optional(),
  });
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;

export const GenerateTemplateRequestSchema = z.object({
  idea: z.string().min(1).max(1000),
  masterPrompt: z.string().trim().min(1).max(12000).optional(),
});
export type GenerateTemplateRequest = z.infer<
  typeof GenerateTemplateRequestSchema
>;

export const GenerateTemplateResultSchema = VideoTemplateSchema.extend({
  rawRequest: z.unknown(),
  rawResponse: z.unknown(),
  provider: ProviderSchema,
  model: z.string(),
});
export type GenerateTemplateResult = z.infer<
  typeof GenerateTemplateResultSchema
>;

export const GenerateShotsRequestSchema = z.object({
  sourceText: z.string().min(1).max(12000),
  attributes: z.array(VideoShotAttributeSchema).default([]),
  scenarioAttributes: z.array(VideoShotAttributeSchema).default([]),
  shotsAttributes: z.array(VideoShotAttributeSchema).default([]),
  masterPrompt: z.string().trim().min(1).max(20000).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
});
export type GenerateShotsRequest = z.infer<typeof GenerateShotsRequestSchema>;

export const GenerateShotsJobResultSchema = z.object({
  shotPlan: VideoShotPlanSchema,
  rawRequest: z.unknown(),
  rawResponse: z.unknown(),
  provider: ProviderSchema,
  model: z.string(),
});
export type GenerateShotsJobResult = z.infer<
  typeof GenerateShotsJobResultSchema
>;

export const CreateShotPlanRequestSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sourceText: z.string().min(1).max(12000),
  durationSeconds: z.number().int().min(1).max(8),
  attributes: z.array(VideoShotAttributeSchema).default([]),
  shots: z.array(VideoShotSchema).min(1),
});
export type CreateShotPlanRequest = z.infer<typeof CreateShotPlanRequestSchema>;

export const UpdateShotPlanRequestSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  durationSeconds: z.number().int().min(1).max(8).optional(),
  attributes: z.array(VideoShotAttributeSchema).optional(),
  shots: z.array(VideoShotSchema).min(1).optional(),
});
export type UpdateShotPlanRequest = z.infer<typeof UpdateShotPlanRequestSchema>;

export const GeneratePromptRequestSchema = z.object({
  inputText: z.string().min(1),
  mediaIds: z.array(z.string()).default([]),
  masterPrompt: z.string().trim().min(1).max(20000).optional(),
  templateSelection: TemplateSelectionSchema.optional(),
  attributeSelections: ProjectAttributeSelectionsSchema.optional(),
  shotSelection: ShotSelectionSchema.optional(),
});
export type GeneratePromptRequest = z.infer<typeof GeneratePromptRequestSchema>;

export const AnalyzeProductRequestSchema = z.object({
  productUrl: z.string().url(),
  mediaIds: z.array(z.string()).default([]),
  templateSelection: TemplateSelectionSchema.optional(),
});
export type AnalyzeProductRequest = z.infer<typeof AnalyzeProductRequestSchema>;

export const CreateScriptRequestSchema = z.object({
  promptId: z.string().optional(),
  finalPrompt: z.string().min(1),
});
export type CreateScriptRequest = z.infer<typeof CreateScriptRequestSchema>;

export const CreateVideoRequestSchema = z.object({
  promptId: z.string().optional(),
  scriptId: z.string().optional(),
  finalPrompt: z.string().min(1),
  mediaIds: z.array(z.string()).default([]),
});
export type CreateVideoRequest = z.infer<typeof CreateVideoRequestSchema>;

export const AiHandoffSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  shotId: z.string(),
  provider: ProviderSchema,
  targetUrl: z.string().url(),
  promptText: z.string().min(1),
  status: AiHandoffStatusSchema,
  errorMessage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AiHandoff = z.infer<typeof AiHandoffSchema>;

export const CreateAiHandoffRequestSchema = z.object({
  shotId: z.string().trim().min(1).max(160),
  provider: ProviderSchema,
  targetUrl: z.string().trim().url().max(2000),
  promptText: z.string().trim().min(1).max(50000),
});
export type CreateAiHandoffRequest = z.infer<
  typeof CreateAiHandoffRequestSchema
>;

export const UpdateAiHandoffRequestSchema = z.object({
  status: AiHandoffStatusSchema,
  errorMessage: z.string().trim().max(2000).nullable().optional(),
});
export type UpdateAiHandoffRequest = z.infer<
  typeof UpdateAiHandoffRequestSchema
>;

export const JobSchema = z.object({
  jobId: z.string(),
  type: z.enum([
    "prompt_generation",
    "product_analysis",
    "media_analysis",
    "script_generation",
    "video_generation",
    "attribute_generation",
    "template_selection",
    "shot_generation",
  ]),
  status: JobStatusSchema,
  progress: z.number().min(0).max(100),
  result: z.unknown().nullable(),
  error: ApiErrorSchema.nullable(),
});
export type Job = z.infer<typeof JobSchema>;

export const AiConfigSchema = z.object({
  contentMode: ContentModeSchema,
  showUserMasterPrompts: z.boolean().default(false),
  aiHandoffProvider: ProviderSchema.default("google-flow-veo"),
  aiHandoffTargetUrl: OptionalUrlSchema.default(null),
  aiHandoffPromptSelector: z.string().nullable().default(null),
  promptProvider: ProviderSchema,
  promptModel: z.string(),
  shotGenerationPrompt: z.string().nullable().optional(),
  shotGenerationOutputFormat: z.string().nullable().optional(),
  scriptGenerationPrompt: z.string().nullable().optional(),
  scriptGenerationOutputFormat: z.string().nullable().optional(),
  templateSelectionPrompt: z.string().nullable().optional(),
  templateSelectionOutputFormat: z.string().nullable().optional(),
  promptKeyStatus: ProviderKeyStatusSchema,
  videoProvider: ProviderSchema,
  videoModel: z.string(),
  videoKeyStatus: ProviderKeyStatusSchema,
  updatedAt: z.string(),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

export const UpdateAiConfigRequestSchema = z.object({
  contentMode: ContentModeSchema,
  showUserMasterPrompts: z.boolean().optional(),
  aiHandoffProvider: ProviderSchema.optional(),
  aiHandoffTargetUrl: z
    .union([z.string().trim().url().max(2000), z.literal(""), z.null()])
    .optional(),
  aiHandoffPromptSelector: z
    .union([z.string().trim().min(1).max(2000), z.literal(""), z.null()])
    .optional(),
  promptProvider: ProviderSchema,
  promptModel: z.string().min(1),
  promptApiKey: z.string().trim().min(1).optional(),
  videoProvider: ProviderSchema,
  videoModel: z.string().min(1),
  videoApiKey: z.string().trim().min(1).optional(),
});
export type UpdateAiConfigRequest = z.infer<typeof UpdateAiConfigRequestSchema>;

export const UpdateAiHandoffDomConfigRequestSchema = z.object({
  provider: ProviderSchema,
  promptSelector: z.string().trim().min(1).max(2000),
});
export type UpdateAiHandoffDomConfigRequest = z.infer<
  typeof UpdateAiHandoffDomConfigRequestSchema
>;

export const RotateProviderKeyRequestSchema = z.object({
  apiKey: z.string().min(1),
});
export type RotateProviderKeyRequest = z.infer<
  typeof RotateProviderKeyRequestSchema
>;

export const TestProviderConnectionRequestSchema = z.object({
  provider: ProviderSchema,
  model: z.string().trim().min(1).max(120),
  apiKey: z.string().trim().min(1).optional(),
});
export type TestProviderConnectionRequest = z.infer<
  typeof TestProviderConnectionRequestSchema
>;

export const TestProviderConnectionResultSchema = z.object({
  provider: ProviderSchema,
  model: z.string(),
  status: z.enum(["success", "failed"]),
  keySource: ProviderKeySourceSchema,
  message: z.string(),
});
export type TestProviderConnectionResult = z.infer<
  typeof TestProviderConnectionResultSchema
>;

export const SHOT_PROMPT_REQUIRED_PLACEHOLDERS = [
  "{story}",
  "{attributes}",
] as const;

export const SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS = [
  "{source}",
  "{shotTitle}",
  "{shotDuration}",
  "{shotDescription}",
  "{shotDialogue}",
  "{shotAttributes}",
  "{planAttributes}",
  "{templateSelection}",
  "{mediaSummary}",
] as const;

export const DEFAULT_SHOT_GENERATION_PROMPT = [
  "You are an expert screenwriter and AI video prompt architect for Veo.",
  "Read the story and split it into short, continuous video shots with concise spoken dialogue or voiceover for each shot.",
  "",
  "Story:",
  "{story}",
  "",
  "Scenario attributes in compact format attribute=option1,option2;:",
  "{scenarioAttributes}",
  "",
  "Shots attributes in compact format attribute=option1,option2;:",
  "{shotsAttributes}",
  "",
  "{outputFormat}",
].join("\n");

export const DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT = [
  "Use last-state / end-state continuity.",
  "Every shot must include Start state, End state and Dialogue attributes.",
  "The next shot's Start state must continue from the previous shot's End state.",
  "Dialogue should be natural, short and useful for generating voice or captions.",
  "Return the generated shots in the provider JSON schema.",
].join("\n");

export const DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT = [
  "Prompt hoàn chỉnh cho shot",
  "",
  "1. Ngữ cảnh nguồn",
  "{source}",
  "",
  "2. Shot cần tạo",
  "- Tiêu đề: {shotTitle}",
  "- Thời lượng: {shotDuration}",
  "- Mô tả: {shotDescription}",
  "- Lời thoại: {shotDialogue}",
  "",
  "3. Attribute của shot",
  "{shotAttributes}",
  "",
  "4. Attribute của shot plan",
  "{planAttributes}",
  "",
  "5. Kịch bản đã chọn",
  "{templateSelection}",
  "",
  "6. Media tham khảo",
  "{mediaSummary}",
].join("\n");

export const DEFAULT_SINGLE_SHOT_MASTER_PROMPT = [
  "Create the final video generation prompt for one shot.",
  "Use only the data included by placeholders below.",
  "",
  "Story Content:",
  "{storyContent}",
  "",
  "Shot:",
  "- Title: {shotTitle}",
  "- Duration: {shotDuration}",
  "- Description: {shotDescription}",
  "- Dialogue: {shotDialogue}",
  "",
  "Generated shot attributes:",
  "{shotGeneratedAttributes}",
  "",
  "Selected Shot attributes:",
  "{shotAttributes}",
  "",
  "Reference media:",
  "{referenceMedia}",
  "",
  "{outputFormat}",
].join("\n");

export const DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT = [
  "Return one polished video prompt for this shot.",
  "Keep the prompt concise, visually specific, and ready for the configured video provider.",
  "Do not include JSON unless the user explicitly asks for JSON in this prompt.",
].join("\n");

export const DEFAULT_TEMPLATE_SELECTION_PROMPT = [
  "You are a video script analyst.",
  "Read the user's story/script and choose the best matching scenario options from the provided attributes.",
  "",
  "Story:",
  "{story}",
  "",
  "Scenario attributes/catalog:",
  "{scenarioAttributes}",
  "",
  "Rules:",
  "- Use only optionId values from the provided scenario catalog.",
  "- Select 1 to 3 useful options per attribute when the story clearly supports them.",
  "- If no option fits an attribute, return an empty selectedOptionIds array for that attribute.",
  "",
  "{outputFormat}",
].join("\n");

export const DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT = [
  "Return strict JSON only. No markdown, no prose outside JSON.",
  "",
  "Required JSON shape:",
  JSON.stringify(
    {
      attributes: [
        {
          attributeId: "videoPurpose",
          attributeName: "Video Purpose",
          selectedOptionIds: ["videoPurpose-storytelling"],
          selectedOptionLabels: ["Storytelling"],
          reason: "Why these options fit the story.",
        },
      ],
      compactSelection: "videoPurpose=Storytelling;",
      notes: "Short summary of the selection.",
    },
    null,
    2,
  ),
].join("\n");

export const DEFAULT_SCRIPT_GENERATION_PROMPT = [
  "You are a Story Content writer for short AI video.",
  "Turn the user's raw idea, notes, or script into a vivid, complete Story Content draft that can drive scenario analysis and shot generation.",
  "Preserve the source language unless the user explicitly asks for another language.",
  "Make the content lively, specific, emotionally clear, and production-ready. Expand thin ideas with concrete setting, characters, actions, beginning/middle/end, visual moments, dialogue or voiceover cues, and transitions.",
  "Do not add unrelated facts, brands, claims, or copyrighted lyrics.",
  "Use the Story Content and Story attributes below when those placeholders are present.",
  "",
  "Story Content:",
  "{storyContent}",
  "",
  "Story attributes/options:",
  "{storyAttributes}",
  "",
  "{outputFormat}",
].join("\n");

export const DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT = [
  "Return a polished Story Content draft with:",
  "1. Title",
  "2. Full story content",
  "3. Key scenes or moments",
  "4. Tone and visual direction",
].join("\n");

export function getShotPromptMissingPlaceholders(prompt: string) {
  return SHOT_PROMPT_REQUIRED_PLACEHOLDERS.filter(
    (placeholder) => !prompt.includes(placeholder),
  );
}

export function getShotComposerPromptMissingPlaceholders(prompt: string) {
  return SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS.filter(
    (placeholder) => !prompt.includes(placeholder),
  );
}

export const ShotPromptConfigSchema = z.object({
  prompt: z.string(),
  defaultPrompt: z.string(),
  requiredPlaceholders: z.array(z.string()),
  isDefault: z.boolean(),
  shotPrompt: z.string(),
  defaultShotPrompt: z.string(),
  shotOutputFormat: z.string().default(""),
  defaultShotOutputFormat: z.string().default(""),
  shotPromptIsDefault: z.boolean(),
  composerPrompt: z.string(),
  defaultComposerPrompt: z.string(),
  composerRequiredPlaceholders: z.array(z.string()),
  composerIsDefault: z.boolean(),
  scenarioAnalysisPrompt: z.string(),
  scenarioAnalysisOutputFormat: z.string().default(""),
  defaultScenarioAnalysisPrompt: z.string(),
  defaultScenarioAnalysisOutputFormat: z.string().default(""),
  scenarioAnalysisIsDefault: z.boolean(),
  scriptGenerationPrompt: z.string(),
  scriptGenerationOutputFormat: z.string().default(""),
  defaultScriptGenerationPrompt: z.string(),
  defaultScriptGenerationOutputFormat: z.string().default(""),
  scriptGenerationIsDefault: z.boolean(),
  outputFormat: z.string().default(""),
  defaultOutputFormat: z.string().default(""),
  showUserMasterPrompts: z.boolean().default(false),
  aiHandoffProvider: ProviderSchema.default("google-flow-veo"),
  aiHandoffTargetUrl: OptionalUrlSchema.default(null),
  aiHandoffPromptSelector: z.string().nullable().default(null),
  updatedAt: z.string(),
});
export type ShotPromptConfig = z.infer<typeof ShotPromptConfigSchema>;

export const UpdateShotPromptRequestSchema = z.object({
  prompt: z.string().min(1).max(20000),
  composerPrompt: z.string().min(1).max(20000),
  scenarioAnalysisPrompt: z.string().min(1).max(12000).optional(),
});
export type UpdateShotPromptRequest = z.infer<
  typeof UpdateShotPromptRequestSchema
>;

export const MasterPromptSchema = z.object({
  id: z.string(),
  type: MasterPromptTypeSchema,
  name: z.string(),
  content: z.string(),
  outputFormat: z.string().default(""),
  attributeSelection: MasterPromptAttributeSelectionSchema.default({
    attributes: [],
  }),
  workflowAttributeSelection: MasterPromptAttributeSelectionSchema.default({
    attributes: [],
  }),
  isDefault: z.boolean(),
  status: MasterPromptStatusSchema,
  isBuiltIn: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MasterPrompt = z.infer<typeof MasterPromptSchema>;

export const MasterPromptGroupSchema = z.object({
  type: MasterPromptTypeSchema,
  prompts: z.array(MasterPromptSchema),
  defaultPrompt: MasterPromptSchema,
});
export type MasterPromptGroup = z.infer<typeof MasterPromptGroupSchema>;

export const MasterPromptConfigSchema = z.object({
  groups: z.array(MasterPromptGroupSchema),
  updatedAt: z.string(),
});
export type MasterPromptConfig = z.infer<typeof MasterPromptConfigSchema>;

export const CreateMasterPromptRequestSchema = z.object({
  type: MasterPromptTypeSchema,
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(20000),
  outputFormat: z.string().trim().max(12000).optional(),
  attributeSelection: MasterPromptAttributeSelectionSchema.optional(),
  workflowAttributeSelection: MasterPromptAttributeSelectionSchema.optional(),
});
export type CreateMasterPromptRequest = z.infer<
  typeof CreateMasterPromptRequestSchema
>;

export const UpdateMasterPromptRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  content: z.string().trim().min(1).max(20000).optional(),
  outputFormat: z.string().trim().max(12000).optional(),
  attributeSelection: MasterPromptAttributeSelectionSchema.optional(),
  workflowAttributeSelection: MasterPromptAttributeSelectionSchema.optional(),
});
export type UpdateMasterPromptRequest = z.infer<
  typeof UpdateMasterPromptRequestSchema
>;

export const AiLogSchema = z.object({
  requestId: z.string(),
  timestamp: z.string(),
  actorUserId: z.string(),
  actorRole: UserRoleSchema,
  projectId: z.string().optional(),
  flowType: FlowTypeSchema,
  provider: ProviderSchema,
  model: z.string(),
  status: z.enum(["pending", "success", "failed"]),
  latencyMs: z.number().optional(),
});
export type AiLog = z.infer<typeof AiLogSchema>;

export const AiLogDetailSchema = AiLogSchema.extend({
  requestPayload: z.record(z.unknown()),
  responsePayload: z.record(z.unknown()).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
});
export type AiLogDetail = z.infer<typeof AiLogDetailSchema>;

export type ApiSuccess<T> = {
  data: T;
  meta?: ApiMeta;
};

export type ApiFailure = {
  error: ApiError;
  meta?: ApiMeta;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const nowIso = () => new Date().toISOString();
