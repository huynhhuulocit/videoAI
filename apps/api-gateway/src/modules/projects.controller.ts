import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { Prisma, prisma } from "@videoai/database";
import { z } from "zod";
import {
  AnalyzeProductRequestSchema,
  AnalyzeTemplateSelectionRequestSchema,
  CreateProjectRequestSchema,
  CreateScriptRequestSchema,
  CreateVideoRequestSchema,
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  GeneratePromptRequestSchema,
  GenerateShotsRequestSchema,
  SaveProjectTemplateSelectionRequestSchema,
  ShotSelectionSchema,
  TemplateAttributeSchema,
  TemplateSelectionSchema,
  UpdateShotPlanRequestSchema,
  VideoShotAttributeSchema,
  type AiConfig,
  type ApiError,
  type ApiErrorCode,
  type GenerateShotsJobResult,
  type Job,
  type Provider,
  type ShotSelection,
  type TemplateAttribute,
  type TemplateSelection,
  type TemplateSelectionAnalysisResult,
  type VideoShot,
  type VideoShotAttribute,
  type VideoShotPlan
} from "@videoai/contracts";
import {
  defaultUserId,
  getActiveAiConfig,
  mapJob,
  mapProject,
  mapVideoShotPlan,
  resolveProviderApiKey,
  toFlowType
} from "./db-store.js";
import { ok } from "./response.js";
import { ShotPlansService } from "./shot-plans.service.js";

const aiShotAttributeSchema = z.object({
  name: z.string().optional(),
  value: z.string().optional()
});

const aiShotSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  durationSeconds: z.number().optional(),
  attributes: z.array(aiShotAttributeSchema).optional()
});

const aiShotPlanSchema = z.object({
  name: z.string().optional(),
  durationSeconds: z.number().optional(),
  shots: z.array(aiShotSchema)
});

const aiTemplateSelectionAttributeSchema = z.object({
  attributeId: z.string().optional(),
  attributeName: z.string().optional(),
  selectedOptionIds: z.array(z.string()).optional(),
  selectedOptionLabels: z.array(z.string()).optional(),
  reason: z.string().optional()
});

const aiTemplateSelectionSchema = z.object({
  attributes: z.array(aiTemplateSelectionAttributeSchema).default([]),
  compactSelection: z.string().optional(),
  notes: z.string().optional()
});

const shotPlanJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    durationSeconds: { type: "integer", minimum: 1, maximum: 8 },
    shots: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          durationSeconds: { type: "integer", minimum: 1, maximum: 8 },
          attributes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "string" }
              },
              required: ["name", "value"]
            }
          }
        },
        required: ["title", "description", "durationSeconds", "attributes"]
      }
    }
  },
  required: ["name", "durationSeconds", "shots"]
} as const;

const templateSelectionJsonSchema = {
  type: "object",
  properties: {
    attributes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          attributeId: { type: "string" },
          attributeName: { type: "string" },
          selectedOptionIds: {
            type: "array",
            items: { type: "string" }
          },
          selectedOptionLabels: {
            type: "array",
            items: { type: "string" }
          },
          reason: { type: "string" }
        },
        required: ["attributeId", "selectedOptionIds"]
      }
    },
    compactSelection: { type: "string" },
    notes: { type: "string" }
  },
  required: ["attributes", "compactSelection"]
} as const;

const openAiTemplateSelectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    attributes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          attributeId: { type: "string" },
          attributeName: { type: "string" },
          selectedOptionIds: {
            type: "array",
            items: { type: "string" }
          },
          selectedOptionLabels: {
            type: "array",
            items: { type: "string" }
          },
          reason: { type: "string" }
        },
        required: ["attributeId", "attributeName", "selectedOptionIds", "selectedOptionLabels", "reason"]
      }
    },
    compactSelection: { type: "string" },
    notes: { type: "string" }
  },
  required: ["attributes", "compactSelection", "notes"]
} as const;

type ParsedProviderShotPlan = z.infer<typeof aiShotPlanSchema>;
type ParsedTemplateSelection = z.infer<typeof aiTemplateSelectionSchema>;

type ProviderRequest = {
  provider: Provider;
  model: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

type TextProviderResult = {
  text: string;
  rawResponse: unknown;
};

class AiJobError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly rawResponse?: unknown
  ) {
    super(message);
  }
}

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ShotPlansService) private readonly shotPlansService: ShotPlansService) {}

  @Get()
  async listProjects() {
    const projects = await prisma.projectRecord.findMany({
      where: { ownerUserId: defaultUserId, status: "active" },
      orderBy: { updatedAt: "desc" }
    });
    return ok(projects.map(mapProject));
  }

  @Post()
  async createProject(@Body() rawBody: unknown) {
    const body = CreateProjectRequestSchema.parse(rawBody);
    const project = await prisma.projectRecord.create({
      data: {
        id: `project_${Date.now()}`,
        ownerUserId: defaultUserId,
        name: body.name,
        description: body.description ?? null,
        flowType: body.flowType,
        status: "active"
      }
    });
    return ok(mapProject(project));
  }

  @Get(":projectId")
  async getProject(@Param("projectId") projectId: string) {
    const project = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    return ok(project ? mapProject(project) : null);
  }

  @Patch(":projectId")
  async updateProject(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = CreateProjectRequestSchema.partial().parse(rawBody);
    const existing = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId
      }
    });

    if (!existing) {
      return ok(null);
    }

    const updateData: { name?: string; description?: string | null; flowType?: "script" | "product" } = {};
    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.flowType !== undefined) {
      updateData.flowType = body.flowType;
    }

    const project = await prisma.projectRecord.update({
      where: { id: projectId },
      data: updateData
    });
    return ok(mapProject(project));
  }

  @Delete(":projectId")
  async deleteProject(@Param("projectId") projectId: string) {
    const existing = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId
      }
    });

    if (!existing) {
      return ok({ deleted: false });
    }

    await prisma.projectRecord.update({
      where: { id: projectId },
      data: { status: "archived" }
    });
    return ok({ deleted: true });
  }

  @Get(":projectId/shots")
  async listShotPlans(@Param("projectId") projectId: string) {
    const shotPlans = await prisma.videoShotPlanRecord.findMany({
      where: {
        projectId,
        ownerUserId: defaultUserId,
        status: "active"
      },
      orderBy: { updatedAt: "desc" }
    });
    return ok(shotPlans.map(mapVideoShotPlan));
  }

  @Post(":projectId/shots/generate")
  async generateShots(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = GenerateShotsRequestSchema.parse(rawBody);
    return ok(await this.shotPlansService.createShotGenerationJob(projectId, body));
  }

  @Patch(":projectId/shots/:shotPlanId")
  async updateShotPlan(
    @Param("projectId") projectId: string,
    @Param("shotPlanId") shotPlanId: string,
    @Body() rawBody: unknown
  ) {
    const body = UpdateShotPlanRequestSchema.parse(rawBody);
    const existing = await prisma.videoShotPlanRecord.findFirst({
      where: {
        id: shotPlanId,
        projectId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });

    if (!existing) {
      return ok(null);
    }

    const shotPlan = await prisma.videoShotPlanRecord.update({
      where: { id: shotPlanId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
        ...(body.attributes !== undefined ? { attributes: this.toJson(body.attributes) } : {}),
        ...(body.shots !== undefined ? { shots: this.toJson(body.shots) } : {})
      }
    });
    return ok(mapVideoShotPlan(shotPlan));
  }

  @Delete(":projectId/shots/:shotPlanId")
  async deleteShotPlan(@Param("projectId") projectId: string, @Param("shotPlanId") shotPlanId: string) {
    const result = await prisma.videoShotPlanRecord.updateMany({
      where: {
        id: shotPlanId,
        projectId,
        ownerUserId: defaultUserId,
        status: "active"
      },
      data: { status: "archived" }
    });
    return ok({ deleted: result.count > 0 });
  }

  @Post(":projectId/prompts/generate")
  async generatePrompt(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = GeneratePromptRequestSchema.parse(rawBody);
    return ok(await this.createJob("prompt_generation", projectId, body));
  }

  @Post(":projectId/products/analyze")
  async analyzeProduct(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = AnalyzeProductRequestSchema.parse(rawBody);
    return ok(await this.createJob("product_analysis", projectId, body));
  }

  @Post(":projectId/template-selection/analyze")
  async analyzeTemplateSelection(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = AnalyzeTemplateSelectionRequestSchema.parse(rawBody);
    return ok(await this.createJob("template_selection", projectId, body));
  }

  @Patch(":projectId/template-selection")
  async saveTemplateSelection(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = SaveProjectTemplateSelectionRequestSchema.parse(rawBody);
    if (body.templateSelection) {
      await this.validateTemplateSelection(body.templateSelection);
    }

    const result = await prisma.projectRecord.updateMany({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      },
      data: {
        templateSelection: body.templateSelection ? this.toJson(body.templateSelection) : Prisma.JsonNull
      }
    });

    return ok({ saved: result.count > 0, templateSelection: body.templateSelection });
  }

  @Post(":projectId/scripts")
  async createScript(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = CreateScriptRequestSchema.parse(rawBody);
    const config = await getActiveAiConfig();
    const script = await prisma.scriptRecord.create({
      data: {
        id: `script_${Date.now()}`,
        projectId,
        promptId: body.promptId ?? null,
        ownerUserId: defaultUserId,
        scriptText: body.finalPrompt,
        provider: config.promptProvider,
        model: config.promptModel,
        status: "succeeded"
      }
    });

    return ok({
      scriptId: script.id,
      projectId,
      status: script.status,
      finalPrompt: script.scriptText
    });
  }

  @Post(":projectId/videos")
  async createVideo(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = CreateVideoRequestSchema.parse(rawBody);
    return ok(await this.createJob("video_generation", projectId, body));
  }

  private async createJob(type: Job["type"], projectId: string, input: unknown) {
    const startedAt = Date.now();
    const config = await getActiveAiConfig();
    const provider = type === "video_generation" ? config.videoProvider : config.promptProvider;
    const model = type === "video_generation" ? config.videoModel : config.promptModel;
    const jobId = `job_${type}_${Date.now()}`;
    const requestId = `ai_req_${Date.now()}`;
    const mediaIds = this.extractMediaIds(input);
    await this.validateMediaIds(projectId, mediaIds);
    const templateSelection = this.extractTemplateSelection(input);
    await this.validateTemplateSelection(templateSelection);
    const shotSelection = this.extractShotSelection(input);
    await this.validateShotSelection(shotSelection);
    const videoGenerationId = type === "video_generation" ? `video_gen_${Date.now()}` : null;

    const { requestLog } = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.jobStatusRecord.create({
        data: {
          jobId,
          type,
          status: "queued",
          progress: 0
        }
      });
      const createdRequestLog = await tx.aiRequestLog.create({
        data: {
          requestId,
          actorUserId: defaultUserId,
          actorRole: "user",
          projectId,
          flowType: toFlowType(type),
          provider,
          model,
          requestPayload: this.toJson(this.toRecord(input)),
          mediaReferences: this.toJson(mediaIds),
          status: "pending"
        }
      });

      if (videoGenerationId) {
        const videoInput = this.toRecord(input);
        await tx.videoGenerationRecord.create({
          data: {
            id: videoGenerationId,
            projectId,
            ownerUserId: defaultUserId,
            promptId: videoInput.promptId ? String(videoInput.promptId) : null,
            scriptId: videoInput.scriptId ? String(videoInput.scriptId) : null,
            provider,
            model,
            status: "queued",
            jobId
          }
        });
      }

      return { job: createdJob, requestLog: createdRequestLog };
    });

    try {
      await this.markJobProcessing(jobId, videoGenerationId);
      await this.completeJob(jobId, requestLog.id, type, projectId, input, config, startedAt, videoGenerationId);
    } catch (error) {
      await this.failJob(jobId, requestLog.id, startedAt, error, videoGenerationId);
    }
    const completedJob = await prisma.jobStatusRecord.findUniqueOrThrow({ where: { jobId } });
    return mapJob(completedJob);
  }

  private async markJobProcessing(jobId: string, videoGenerationId: string | null) {
    await prisma.$transaction(async (tx) => {
      await tx.jobStatusRecord.update({
        where: { jobId },
        data: {
          status: "processing",
          progress: 45
        }
      });

      if (videoGenerationId) {
        await tx.videoGenerationRecord.update({
          where: { id: videoGenerationId },
          data: {
            status: "processing"
          }
        });
      }
    });
  }

  private async failJob(
    jobId: string,
    requestLogId: string,
    startedAt: number,
    error: unknown,
    videoGenerationId: string | null
  ) {
    const apiError = this.toApiError(error);
    const rawResponse = error instanceof AiJobError ? error.rawResponse : undefined;

    await prisma.$transaction(async (tx) => {
      await tx.jobStatusRecord.update({
        where: { jobId },
        data: {
          status: "failed",
          progress: 100,
          error: this.toJson(apiError)
        }
      });
      await tx.aiRequestLog.update({
        where: { id: requestLogId },
        data: {
          status: "failed",
          completedAt: new Date()
        }
      });
      await tx.aiResponseLog.create({
        data: {
          requestLogId,
          responsePayload: this.toJson(rawResponse === undefined ? {} : { rawResponse }),
          errorCode: apiError.code,
          errorMessage: apiError.message,
          latencyMs: Date.now() - startedAt
        }
      });

      if (videoGenerationId) {
        await tx.videoGenerationRecord.update({
          where: { id: videoGenerationId },
          data: {
            status: "failed",
            completedAt: new Date()
          }
        });
      }
    });
  }

  private async completeJob(
    jobId: string,
    requestLogId: string,
    type: Job["type"],
    projectId: string,
    input: unknown,
    config: AiConfig,
    startedAt: number,
    videoGenerationId: string | null
  ) {
    const result = await this.createProviderResult(type, projectId, input, config, videoGenerationId);
    await prisma.$transaction(async (tx) => {
      await tx.jobStatusRecord.update({
        where: { jobId },
        data: {
          status: "succeeded",
          progress: 100,
          result: this.toJson(result)
        }
      });
      await tx.aiRequestLog.update({
        where: { id: requestLogId },
        data: {
          status: "success",
          completedAt: new Date()
        }
      });
      await tx.aiResponseLog.create({
        data: {
          requestLogId,
          responsePayload: this.toJson(result),
          latencyMs: Date.now() - startedAt
        }
      });

      if (type === "shot_generation") {
        const resultRecord = this.toRecord(result);
        const shotPlan = this.toRecord(resultRecord.shotPlan);
        const activeShotPlanCount = await tx.videoShotPlanRecord.count({
          where: {
            ownerUserId: defaultUserId,
            status: "active"
          }
        });
        await tx.videoShotPlanRecord.create({
          data: {
            id: String(shotPlan.id),
            projectId,
            ownerUserId: defaultUserId,
            name: String(shotPlan.name),
            sourceText: String(shotPlan.sourceText),
            durationSeconds: Number(shotPlan.durationSeconds),
            attributes: this.toJson(shotPlan.attributes ?? []),
            shots: this.toJson(shotPlan.shots ?? []),
            isDefault: activeShotPlanCount === 0,
            status: "active"
          }
        });
      }

      if (type === "template_selection") {
        const resultRecord = this.toRecord(result);
        await tx.projectRecord.update({
          where: { id: projectId },
          data: {
            templateSelection: this.toJson(resultRecord.templateSelection ?? null)
          }
        });
      }

      if (videoGenerationId) {
        await tx.videoGenerationRecord.update({
          where: { id: videoGenerationId },
          data: {
            status: "succeeded",
            completedAt: new Date()
          }
        });
      }
    });

    if (type === "shot_generation") {
      return;
    }

    if (type === "prompt_generation" || type === "product_analysis") {
      const payload = this.toRecord(input);
      await prisma.promptRecord.create({
        data: {
          id: String(this.toRecord(result).promptId ?? this.toRecord(result).analysisId ?? `prompt_${Date.now()}`),
          projectId,
          ownerUserId: defaultUserId,
          sourceType: type === "prompt_generation" ? "script_flow" : "product_flow",
          inputText: payload.inputText ? String(payload.inputText) : null,
          productUrl: payload.productUrl ? String(payload.productUrl) : null,
          mediaAssetIds: this.toJson(this.extractMediaIds(input)),
          generatedPrompt: String(this.toRecord(result).generatedPrompt ?? ""),
          finalPrompt: null,
          provider: config.promptProvider,
          model: config.promptModel,
          status: "succeeded",
          mediaAnalysisSummary: this.toJson(this.toRecord(result).mediaInsights ?? []),
          providerMetadata: this.toJson({
            masterPrompt: payload.masterPrompt ?? null,
            templateSelection: payload.templateSelection ?? null,
            shotSelection: payload.shotSelection ?? null
          })
        }
      });
    }
  }

  private async createProviderResult(
    type: Job["type"],
    projectId: string,
    input: unknown,
    config: AiConfig,
    videoGenerationId: string | null
  ) {
    const payload = this.toRecord(input);
    const mediaIds = this.extractMediaIds(input).map(String);
    const templateGuidance = this.createTemplateGuidance(payload.templateSelection);
    const shotGuidance = this.createShotGuidance(payload.shotSelection);

    if (type === "shot_generation") {
      const durationSeconds = this.clampDuration(Number(payload.durationSeconds ?? 8));
      const sourceText = String(payload.sourceText ?? "");
      const attributes = this.extractShotPlanAttributes(input);
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : undefined;
      return this.createShotPlanWithAi(projectId, sourceText, durationSeconds, attributes, config, masterPrompt);
    }

    if (type === "template_selection") {
      const inputText = String(payload.inputText ?? "");
      const templateId = String(payload.templateId ?? "");
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : undefined;
      return this.createTemplateSelectionWithAi(projectId, inputText, templateId, config, masterPrompt);
    }

    if (type === "prompt_generation") {
      const inputText = String(payload.inputText ?? "Create a product introduction video.");
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : config.scriptGenerationPrompt;
      return this.createStoryContentWithAi(
        projectId,
        inputText,
        mediaIds,
        shotGuidance,
        templateGuidance,
        config,
        masterPrompt
      );
    }

    if (type === "product_analysis") {
      const productUrl = String(payload.productUrl ?? "");
      const productName = this.deriveProductName(productUrl);
      return {
        analysisId: `analysis_${Date.now()}`,
        projectId,
        productFacts: [
          `Product source: ${this.deriveHostname(productUrl)}`,
          `Main product: ${productName}`,
          "The introduction should focus on shape, material, daily use benefits, and trust-building details."
        ],
        mediaInsights: this.createMediaInsights(mediaIds),
        generatedPrompt: [
          "Product video prompt",
          "1. Product focus",
          `- Create a short commerce video introducing ${productName}.`,
          "2. Opening structure",
          "- Open with a clear close-up of the product, place it on a clean background, then explain the key benefit in one easy sentence.",
          "3. Visual direction",
          mediaIds.length > 0
            ? `- Keep the visual style aligned with ${mediaIds.length} uploaded reference media file(s).`
            : "- Use clear lighting, minimal props, and smooth camera movement.",
          templateGuidance
        ].filter(Boolean).join("\n\n"),
        provider: config.promptProvider,
        model: config.promptModel
      };
    }

    if (type === "video_generation") {
      return {
        videoGenerationId: videoGenerationId ?? `video_gen_${Date.now()}`,
        projectId,
        status: "succeeded",
        provider: config.videoProvider,
        model: config.videoModel
      };
    }

    return { projectId, input: this.toRecord(input) };
  }

  private async createTemplateSelectionWithAi(
    projectId: string,
    inputText: string,
    templateId: string,
    config: AiConfig,
    masterPrompt?: string
  ): Promise<TemplateSelectionAnalysisResult> {
    const template = await prisma.videoTemplateRecord.findFirst({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });

    if (!template) {
      throw new BadRequestException("Template is missing or archived.");
    }

    const attributes = TemplateAttributeSchema.array().parse(template.attributes);
    const provider = config.promptProvider;
    const model = config.promptModel;
    const prompt = this.buildTemplateSelectionPrompt(
      masterPrompt ?? config.templateSelectionPrompt ?? DEFAULT_TEMPLATE_SELECTION_PROMPT,
      inputText,
      {
        id: template.id,
        name: template.name,
        attributes
      }
    );
    const rawRequest = this.buildTemplateSelectionProviderRequest(provider, model, prompt);
    const rawResponse = await this.callTemplateSelectionProvider(provider, model, rawRequest);
    const templateSelection = this.normalizeTemplateSelection(rawResponse, {
      templateId: template.id,
      templateName: template.name,
      attributes
    });

    return {
      projectId,
      templateSelection,
      compactSelection: this.formatTemplateSelectionCompact(templateSelection),
      rawRequest,
      rawResponse,
      provider,
      model
    };
  }

  private buildTemplateSelectionPrompt(
    masterPrompt: string,
    inputText: string,
    template: { id: string; name: string; attributes: TemplateAttribute[] }
  ) {
    const attributeCatalog = template.attributes.map((attribute) => ({
      attributeId: attribute.id,
      attributeName: attribute.name,
      options: attribute.options.map((option) => ({
        optionId: option.id,
        label: option.label,
        value: option.value
      }))
    }));

    const attributeCatalogText = JSON.stringify(
      {
        templateId: template.id,
        templateName: template.name,
        attributes: attributeCatalog
      },
      null,
      2
    );
    const renderedPrompt = this.renderOptionalPromptPlaceholders(
      masterPrompt.trim() || DEFAULT_TEMPLATE_SELECTION_PROMPT,
      {
        story: inputText,
        attributes: attributeCatalogText
      }
    );

    return [
      renderedPrompt,
      "",
      "Scenario catalog:",
      attributeCatalogText,
      "",
      "User story/script:",
      inputText
    ].join("\n");
  }

  private buildScriptGenerationPrompt(
    configuredPrompt: string | null | undefined,
    inputText: string,
    mediaIds: string[],
    shotGuidance: string,
    templateGuidance: string
  ) {
    const masterPrompt = configuredPrompt?.trim() || DEFAULT_SCRIPT_GENERATION_PROMPT;
    const mediaSummary =
      mediaIds.length > 0
        ? `Use ${mediaIds.length} reference media file(s) to keep visual style, lighting, composition, and pacing consistent.`
        : "No reference media. Use a clean modern style, soft lighting, and stable camera movement.";
    const shotSelection = shotGuidance || "No selected shot plan.";
    const scenarioSelection = templateGuidance || "No selected scenario options.";
    const renderedPrompt = this.renderOptionalPromptPlaceholders(masterPrompt, {
      inputText,
      mediaSummary,
      shotSelection,
      scenarioSelection
    });

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      "User source text:",
      inputText,
      "",
      "Reference media:",
      mediaSummary,
      "",
      "Shot selection:",
      shotSelection,
      "",
      "Scenario selection:",
      scenarioSelection,
      "",
      "Output format:",
      "Return readable sections with concise bullets for direction, visual style, and script/prompt content."
    ].join("\n");
  }

  private async createStoryContentWithAi(
    projectId: string,
    inputText: string,
    mediaIds: string[],
    shotGuidance: string,
    templateGuidance: string,
    config: AiConfig,
    configuredPrompt: string | null | undefined
  ) {
    const provider = config.promptProvider;
    const model = config.promptModel;
    const prompt = this.buildScriptGenerationPrompt(
      configuredPrompt,
      inputText,
      mediaIds,
      shotGuidance,
      templateGuidance
    );
    const rawRequest = this.buildStoryContentProviderRequest(provider, model, prompt);
    const result = await this.callStoryContentProvider(provider, model, rawRequest);

    return {
      promptId: `prompt_${Date.now()}`,
      projectId,
      generatedPrompt: result.text,
      mediaInsights: this.createMediaInsights(mediaIds),
      provider,
      model,
      rawRequest,
      rawResponse: result.rawResponse
    };
  }

  private buildStoryContentProviderRequest(provider: Provider, model: string, prompt: string): ProviderRequest {
    if (this.isGeminiProvider(provider)) {
      return {
        provider,
        model,
        method: "POST",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": "[REDACTED]"
        },
        body: {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        }
      };
    }

    if (this.isOpenAiProvider(provider)) {
      return {
        provider,
        model,
        method: "POST",
        url: "https://api.openai.com/v1/responses",
        headers: {
          authorization: "Bearer [REDACTED]",
          "content-type": "application/json"
        },
        body: {
          model,
          input: prompt
        }
      };
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate Story Content.`,
      { provider, model }
    );
  }

  private async callStoryContentProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    if (this.isGeminiProvider(provider)) {
      return this.callGeminiForStoryContent(model, rawRequest);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForStoryContent(model, rawRequest);
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate Story Content.`,
      { provider, model },
      rawRequest
    );
  }

  private async callGeminiForStoryContent(model: string, rawRequest: ProviderRequest): Promise<TextProviderResult> {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} Story Content generation. Save a provider key or set ${resolvedKey.envName}.`,
        { provider: rawRequest.provider, model, env: resolvedKey.envName },
        rawRequest
      );
    }

    const response = await fetch(rawRequest.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(rawRequest.body)
    });

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        response.status === 429
          ? `Gemini Story Content generation is rate limited or out of quota (status ${response.status}).`
          : `Gemini Story Content generation failed with status ${response.status}.`,
        { provider: rawRequest.provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.cleanGeneratedStoryText(
      this.extractGeminiText(providerPayload, "Story Content generation"),
      rawRequest.provider,
      model,
      providerPayload
    );
    return { text, rawResponse: providerPayload };
  }

  private async callOpenAiForStoryContent(model: string, rawRequest: ProviderRequest): Promise<TextProviderResult> {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} Story Content generation. Save a provider key or set ${resolvedKey.envName}.`,
        { provider: rawRequest.provider, model, env: resolvedKey.envName },
        rawRequest
      );
    }

    const response = await fetch(rawRequest.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(rawRequest.body)
    });

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        response.status === 429
          ? `ChatGPT Story Content generation is rate limited or out of quota (status ${response.status}).`
          : `ChatGPT Story Content generation failed with status ${response.status}.`,
        { provider: rawRequest.provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.cleanGeneratedStoryText(
      this.extractOpenAiText(providerPayload, "Story Content generation"),
      rawRequest.provider,
      model,
      providerPayload
    );
    return { text, rawResponse: providerPayload };
  }

  private cleanGeneratedStoryText(text: string, provider: Provider, model: string, rawResponse: unknown) {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        "AI returned empty Story Content.",
        { provider, model },
        rawResponse
      );
    }
    return trimmed;
  }

  private buildTemplateSelectionProviderRequest(provider: Provider, model: string, prompt: string): ProviderRequest {
    if (this.isGeminiProvider(provider)) {
      return {
        provider,
        model,
        method: "POST",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": "[REDACTED]"
        },
        body: {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: templateSelectionJsonSchema
          }
        }
      };
    }

    if (this.isOpenAiProvider(provider)) {
      return {
        provider,
        model,
        method: "POST",
        url: "https://api.openai.com/v1/responses",
        headers: {
          authorization: "Bearer [REDACTED]",
          "content-type": "application/json"
        },
        body: {
          model,
          input: prompt,
          text: {
            format: {
              type: "json_schema",
              name: "template_option_selection",
              strict: true,
              schema: openAiTemplateSelectionJsonSchema
            }
          }
        }
      };
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot analyze template options.`,
      { provider, model }
    );
  }

  private async callTemplateSelectionProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    if (this.isGeminiProvider(provider)) {
      return this.callGeminiForTemplateSelection(model, rawRequest);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForTemplateSelection(model, rawRequest);
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot analyze template options.`,
      { provider, model },
      rawRequest
    );
  }

  private async callGeminiForTemplateSelection(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} template option analysis. Save a provider key or set ${resolvedKey.envName}.`,
        { provider: rawRequest.provider, model, env: resolvedKey.envName },
        rawRequest
      );
    }

    const response = await fetch(rawRequest.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(rawRequest.body)
    });

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        response.status === 429
          ? `Gemini template option analysis is rate limited or out of quota (status ${response.status}).`
          : `Gemini template option analysis failed with status ${response.status}.`,
        { provider: rawRequest.provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.extractGeminiText(providerPayload, "scenario analysis");
    return this.parseTemplateSelectionJson(text, rawRequest.provider, model);
  }

  private async callOpenAiForTemplateSelection(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} template option analysis. Save a provider key or set ${resolvedKey.envName}.`,
        { provider: rawRequest.provider, model, env: resolvedKey.envName },
        rawRequest
      );
    }

    const response = await fetch(rawRequest.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(rawRequest.body)
    });

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        response.status === 429
          ? `ChatGPT template option analysis is rate limited or out of quota (status ${response.status}).`
          : `ChatGPT template option analysis failed with status ${response.status}.`,
        { provider: rawRequest.provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.extractOpenAiText(providerPayload, "scenario analysis");
    return this.parseTemplateSelectionJson(text, rawRequest.provider, model);
  }

  private parseTemplateSelectionJson(text: string, provider: Provider, model: string) {
    const rawResponse = this.parseProviderJson(text, provider, model, "scenario analysis");
    const parsed = aiTemplateSelectionSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        "AI returned JSON that does not match the template selection contract.",
        { provider, model, issues: parsed.error.issues },
        rawResponse
      );
    }
    return parsed.data;
  }

  private normalizeTemplateSelection(
    rawResponse: ParsedTemplateSelection,
    template: { templateId: string; templateName: string; attributes: TemplateAttribute[] }
  ): TemplateSelection {
    const selectedAttributes = template.attributes
      .map((attribute) => {
        const aiAttribute = rawResponse.attributes.find((candidate) => {
          const candidateId = candidate.attributeId?.trim().toLowerCase();
          const candidateName = candidate.attributeName?.trim().toLowerCase();
          return (
            candidateId === attribute.id.toLowerCase() ||
            candidateName === attribute.name.toLowerCase()
          );
        });

        const selectedIds = new Set(
          (aiAttribute?.selectedOptionIds ?? []).map((optionId) => optionId.trim())
        );
        const selectedLabels = new Set(
          (aiAttribute?.selectedOptionLabels ?? []).map((label) => label.trim().toLowerCase())
        );
        const options = attribute.options.filter(
          (option) =>
            selectedIds.has(option.id) ||
            selectedLabels.has(option.label.toLowerCase()) ||
            selectedLabels.has(option.value.toLowerCase())
        );

        return {
          id: attribute.id,
          name: attribute.name,
          options
        };
      })
      .filter((attribute) => attribute.options.length > 0);

    return {
      templateId: template.templateId,
      templateName: template.templateName,
      attributes: selectedAttributes
    };
  }

  private formatTemplateSelectionCompact(selection: TemplateSelection) {
    if (selection.attributes.length === 0) {
      return "";
    }

    return selection.attributes
      .map(
        (attribute) =>
          `${attribute.id}=${attribute.options.map((option) => option.label).join(",")};`
      )
      .join("\n");
  }

  private async createShotPlanWithAi(
    projectId: string,
    sourceText: string,
    durationSeconds: number,
    attributes: VideoShotAttribute[],
    config: AiConfig,
    masterPrompt?: string
  ): Promise<GenerateShotsJobResult> {
    const provider = config.promptProvider;
    const model = config.promptModel;
    const prompt = this.buildShotGenerationPrompt(
      masterPrompt ?? config.shotGenerationPrompt,
      sourceText,
      durationSeconds,
      attributes
    );
    const rawResponse = await this.callShotProvider(provider, model, prompt);
    const shotPlan = this.normalizeAiShotPlan(rawResponse, {
      projectId,
      sourceText,
      durationSeconds,
      attributes
    });

    return {
      shotPlan,
      rawRequest: { prompt },
      rawResponse,
      provider,
      model
    };
  }

  private async callShotProvider(provider: Provider, model: string, prompt: string) {
    if (this.isGeminiProvider(provider)) {
      return this.callGeminiForShots(provider, model, prompt);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForShots(provider, model, prompt);
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate prompt shots.`,
      { provider, model }
    );
  }

  private async callGeminiForShots(provider: Provider, model: string, prompt: string) {
    const resolvedKey = await resolveProviderApiKey(provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${provider} shot generation. Save a provider key or set ${resolvedKey.envName}.`,
        { provider, model, env: resolvedKey.envName }
      );
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: shotPlanJsonSchema
          }
        })
      }
    );

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        `Gemini shot generation failed with status ${response.status}.`,
        { provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.extractGeminiText(providerPayload, "shot generation");
    return this.parseProviderJson(text, provider, model, "shot generation");
  }

  private async callOpenAiForShots(provider: Provider, model: string, prompt: string) {
    const resolvedKey = await resolveProviderApiKey(provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${provider} shot generation. Save a provider key or set ${resolvedKey.envName}.`,
        { provider, model, env: resolvedKey.envName }
      );
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "video_shot_plan",
            schema: shotPlanJsonSchema
          }
        }
      })
    });

    const providerPayload = await this.readProviderPayload(response);
    if (!response.ok) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        `ChatGPT shot generation failed with status ${response.status}.`,
        { provider, model, status: response.status },
        providerPayload
      );
    }

    const text = this.extractOpenAiText(providerPayload, "shot generation");
    return this.parseProviderJson(text, provider, model, "shot generation");
  }

  private isGeminiProvider(provider: Provider) {
    return provider === "gemini" || provider === "google";
  }

  private isOpenAiProvider(provider: Provider) {
    return provider === "chatgpt" || provider === "openai";
  }

  private buildShotGenerationPrompt(
    configuredPrompt: string | null | undefined,
    sourceText: string,
    durationSeconds: number,
    attributes: VideoShotAttribute[]
  ) {
    const attributeText = attributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`)
      .join("\n") || "none=No extra plan-level attributes provided;";
    const renderedPrompt = this.renderOptionalPromptPlaceholders(
      configuredPrompt?.trim() || DEFAULT_SHOT_GENERATION_PROMPT,
      {
        story: sourceText,
        attributes: attributeText,
        durationSeconds: String(durationSeconds)
      }
    );

    return [
      renderedPrompt,
      "",
      "Runtime context:",
      "Source content:",
      sourceText,
      "",
      "Shot plan attributes to apply to the whole plan in compact format attribute=option1,option2;:",
      attributeText,
      "",
      `Target seconds per shot: ${durationSeconds}`,
      "",
      "Provider output contract:",
      "- Every shot must have attributes named exactly Start state, End state, and Dialogue.",
      "- The Start state of shot 2+ must continue from the previous shot's End state.",
      "- Use the last-state / end-state principle so the video can be generated as continuous short clips.",
      "- Dialogue should be short, natural spoken dialogue, narration, or voiceover for that exact shot.",
      `- Each shot duration must be between 1 and ${durationSeconds} seconds, never more than 8 seconds.`,
      "- Keep visuals concrete, filmable, emotionally clear, and free from abrupt continuity jumps.",
      "- Return only strict JSON. Do not include markdown, comments, or prose outside JSON.",
      "",
      "Required JSON shape:",
      JSON.stringify(
        {
          name: "Shot plan name",
          durationSeconds,
          shots: [
            {
              title: "Shot 1: Hook",
              description: "Filmable description of the moment.",
              durationSeconds,
              attributes: [
                { name: "Start state", value: "How the shot begins." },
                { name: "End state", value: "How the shot ends." },
                { name: "Dialogue", value: "Short spoken line or voiceover for this shot." },
                { name: "Camera", value: "Camera movement and framing." },
                { name: "Visual", value: "Lighting, composition, production details." },
                { name: "Action", value: "Primary action in the shot." },
                { name: "Transition", value: "How this shot connects to the next one." }
              ]
            }
          ]
        },
        null,
        2
      ),
    ].join("\n");
  }

  private renderOptionalPromptPlaceholders(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
      (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
      template
    );
  }

  private async readProviderPayload(response: Response) {
    const text = await response.text();
    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private extractGeminiText(payload: unknown, operation: string) {
    const candidates = this.toArray(this.toRecord(payload).candidates);
    const parts = candidates.flatMap((candidate) => {
      const content = this.toRecord(candidate).content;
      return this.toArray(this.toRecord(content).parts);
    });
    const text = parts
      .map((part) => this.toRecord(part).text)
      .filter((value): value is string => typeof value === "string")
      .join("\n")
      .trim();

    if (!text) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        `Gemini did not return JSON text for ${operation}.`,
        { provider: "gemini" },
        payload
      );
    }

    return text;
  }

  private extractOpenAiText(payload: unknown, operation: string) {
    const payloadRecord = this.toRecord(payload);
    if (typeof payloadRecord.output_text === "string" && payloadRecord.output_text.trim()) {
      return payloadRecord.output_text.trim();
    }

    const output = this.toArray(payloadRecord.output);
    const text = output
      .flatMap((item) => this.toArray(this.toRecord(item).content))
      .map((content) => this.toRecord(content).text)
      .filter((value): value is string => typeof value === "string")
      .join("\n")
      .trim();

    if (!text) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        `ChatGPT did not return JSON text for ${operation}.`,
        { provider: "chatgpt" },
        payload
      );
    }

    return text;
  }

  private parseProviderJson(text: string, provider: Provider, model: string, operation: string) {
    const trimmed = text.trim();
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      const extracted = this.extractJsonObjectText(trimmed);
      if (extracted) {
        try {
          return JSON.parse(extracted) as unknown;
        } catch {
          // Fall through to the typed provider error below.
        }
      }
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `AI returned invalid JSON for ${operation}.`,
      { provider, model },
      trimmed.slice(0, 4000)
    );
  }

  private extractJsonObjectText(value: string) {
    const start = value.indexOf("{");
    if (start < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < value.length; index += 1) {
      const char = value.charAt(index);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        continue;
      }
      if (inString) {
        continue;
      }
      if (char === "{") {
        depth += 1;
      }
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          return value.slice(start, index + 1);
        }
      }
    }

    return null;
  }

  private normalizeAiShotPlan(
    rawResponse: unknown,
    context: {
      projectId: string;
      sourceText: string;
      durationSeconds: number;
      attributes: VideoShotAttribute[];
    }
  ): VideoShotPlan {
    const candidate = this.unwrapShotPlanCandidate(rawResponse);
    const parsed = aiShotPlanSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.shots.length === 0) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        "AI returned JSON that does not match the shot plan contract.",
        { issues: parsed.success ? [] : parsed.error.issues },
        rawResponse
      );
    }

    const now = new Date();
    const timestamp = Date.now();
    let previousEndState = "";
    const durationSeconds = this.clampDuration(
      parsed.data.durationSeconds ?? context.durationSeconds
    );
    const shots = parsed.data.shots.map((shot, index) => {
      const normalizedDuration = this.clampDuration(
        shot.durationSeconds ?? durationSeconds
      );
      const description = this.cleanText(
        shot.description,
        `Describe shot ${index + 1} as a concrete video moment.`
      );
      const title = this.cleanText(shot.title, `Shot ${index + 1}`);
      const attributes = this.ensureStateAttributes(
        this.normalizeAiShotAttributes(shot.attributes ?? [], index),
        {
          shotIndex: index,
          description,
          previousEndState
        }
      );
      const endState =
        attributes.find((attribute) => this.isNamedAttribute(attribute, "End state"))?.value ??
        description;
      previousEndState = endState;

      return {
        id: `shot_${timestamp}_${index + 1}`,
        title,
        description,
        durationSeconds: normalizedDuration,
        attributes,
        mediaIds: []
      };
    });

    return {
      id: `shot_plan_${timestamp}`,
      ownerUserId: defaultUserId,
      projectId: context.projectId,
      name: this.cleanText(parsed.data.name, `Shot plan ${now.toLocaleDateString("en-CA")}`),
      sourceText: context.sourceText,
      durationSeconds,
      attributes: context.attributes,
      shots,
      isDefault: false,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  private unwrapShotPlanCandidate(rawResponse: unknown) {
    const record = this.toRecord(rawResponse);
    if (Array.isArray(record.shots)) {
      return rawResponse;
    }
    if (record.shotPlan) {
      return record.shotPlan;
    }
    if (record.plan) {
      return record.plan;
    }
    return rawResponse;
  }

  private normalizeAiShotAttributes(
    attributes: ParsedProviderShotPlan["shots"][number]["attributes"],
    shotIndex: number
  ): VideoShotAttribute[] {
    return (attributes ?? [])
      .map((attribute, index) => {
        const name = this.cleanText(attribute.name, "");
        const value = this.cleanText(attribute.value, "");
        if (!name || !value) {
          return null;
        }

        return {
          id: `shot_${shotIndex + 1}_${this.slug(name)}_${index + 1}`,
          name,
          value
        };
      })
      .filter((attribute): attribute is VideoShotAttribute => Boolean(attribute));
  }

  private ensureStateAttributes(
    attributes: VideoShotAttribute[],
    context: { shotIndex: number; description: string; previousEndState: string }
  ) {
    const hasStartState = attributes.some((attribute) =>
      this.isNamedAttribute(attribute, "Start state")
    );
    const hasEndState = attributes.some((attribute) =>
      this.isNamedAttribute(attribute, "End state")
    );
    const hasDialogue = attributes.some((attribute) =>
      this.isNamedAttribute(attribute, "Dialogue")
    );
    const nextAttributes = [...attributes];

    if (!hasStartState) {
      nextAttributes.unshift({
        id: `shot_${context.shotIndex + 1}_start_state`,
        name: "Start state",
        value:
          context.shotIndex === 0
            ? `Open with: ${context.description}`
            : `Continue from previous shot: ${context.previousEndState || context.description}`
      });
    }

    if (!hasEndState) {
      nextAttributes.push({
        id: `shot_${context.shotIndex + 1}_end_state`,
        name: "End state",
        value: `End with: ${context.description}`
      });
    }

    if (!hasDialogue) {
      nextAttributes.push({
        id: `shot_${context.shotIndex + 1}_dialogue`,
        name: "Dialogue",
        value: "Use a short natural line, narration, or voiceover for this shot."
      });
    }

    return nextAttributes;
  }

  private isNamedAttribute(attribute: VideoShotAttribute, expectedName: string) {
    return attribute.name.trim().toLowerCase() === expectedName.toLowerCase();
  }

  private cleanText(value: unknown, fallback: string) {
    if (typeof value !== "string") {
      return fallback;
    }
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }

  private slug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "attribute";
  }

  private createMediaInsights(mediaIds: string[]) {
    if (mediaIds.length === 0) {
      return ["No reference media was attached. AI will rely on the text input or product URL."];
    }

    return [
      `${mediaIds.length} valid media file(s) attached.`,
      "Use the uploaded media to reference product framing, palette, pacing, and visual style.",
      "Do not copy reference media directly; use it only as visual direction."
    ];
  }

  private createShotPlanDraft(projectId: string, sourceText: string, durationSeconds: number) {
    const now = new Date();
    const timestamp = Date.now();
    const storyText = this.extractStoryText(sourceText);
    const beats = this.createStoryBeats(storyText).slice(0, 20);
    const fallbackBeats = [
      "Establish the main character, location, and emotional context.",
      "Show the action that changes the situation and moves the story forward.",
      "Resolve the moment with a clear final image that can lead into the next action or call to action."
    ];
    const selectedBeats = [...beats];
    for (const fallbackBeat of fallbackBeats) {
      if (selectedBeats.length >= 3) {
        break;
      }
      selectedBeats.push(fallbackBeat);
    }
    const titles = [
      "Opening State",
      "Inciting Beat",
      "Rising Action",
      "Turning Point",
      "Key Detail",
      "Emotional Shift",
      "Payoff",
      "Resolution"
    ];
    let previousEndState = "";
    const shots = selectedBeats.map((beat, index) => {
      const action = this.compactText(beat, 220);
      const stateSummary = this.compactText(beat, 140);
      const startState =
        index === 0
          ? `The story opens with: ${stateSummary}`
          : `Continue from previous shot: ${previousEndState}`;
      const endState = `The shot ends with: ${stateSummary}`;
      previousEndState = endState;

      return {
        id: `shot_${timestamp}_${index + 1}`,
        title: `Shot ${index + 1}: ${titles[index] ?? "Story Beat"}`,
        description: action,
        durationSeconds,
        mediaIds: [],
        attributes: [
          {
            id: `shot_${index + 1}_start_state`,
            name: "Start state",
            value: startState
          },
          {
            id: `shot_${index + 1}_end_state`,
            name: "End state",
            value: endState
          },
          {
            id: `shot_${index + 1}_camera`,
            name: "Camera",
            value:
              index === 0
                ? "Establish the scene, then move gently toward the subject."
                : "Preserve screen direction and continue motion from the previous shot."
          },
          {
            id: `shot_${index + 1}_visual`,
            name: "Visual",
            value:
              index === selectedBeats.length - 1
                ? "Clean final frame with a memorable emotional or CTA moment."
                : "Readable composition with continuity from the previous end state."
          },
          {
            id: `shot_${index + 1}_action`,
            name: "Action",
            value: action
          },
          {
            id: `shot_${index + 1}_transition`,
            name: "Transition",
            value:
              index === 0
                ? "Open clearly from the story context."
                : "Match the previous end state before introducing the next action."
          }
        ]
      };
    });

    return {
      id: `shot_plan_${timestamp}`,
      ownerUserId: defaultUserId,
      projectId,
      name: `Shot plan ${now.toLocaleDateString("en-CA")}`,
      sourceText,
      durationSeconds,
      shots,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  private extractStoryText(sourceText: string) {
    const markers = [
      "Nội dung câu chuyện:",
      "Noi dung cau chuyen:",
      "Story content:",
      "Story:"
    ];
    const lowerSource = sourceText.toLowerCase();
    let markerIndex = -1;
    let markerLength = 0;

    for (const marker of markers) {
      const index = lowerSource.lastIndexOf(marker.toLowerCase());
      if (index > markerIndex) {
        markerIndex = index;
        markerLength = marker.length;
      }
    }

    const rawStory =
      markerIndex >= 0 ? sourceText.slice(markerIndex + markerLength) : sourceText;
    return rawStory
      .replace(/\{story\}/gi, "")
      .replace(/\[(?:paste|dán|dan)[^\]]*\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private createStoryBeats(storyText: string) {
    const normalized = storyText
      .replace(/\r/g, "")
      .split(/\n+|(?:^|\s)(?:[-*]|\d+[.)])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const sourceParts = normalized.length > 0 ? normalized : [storyText.trim()];
    const beats: string[] = [];

    for (const part of sourceParts) {
      const sentences = this.splitStorySentences(part);
      if (sentences.length > 1) {
        beats.push(...sentences.map((sentence) => this.compactText(sentence, 320)));
        continue;
      }

      if (part.length <= 260) {
        beats.push(part);
        continue;
      }

      if (sentences.length === 0) {
        beats.push(part);
        continue;
      }

      let current = "";
      for (const sentence of sentences) {
        const next = current ? `${current} ${sentence}` : sentence;
        if (next.length > 260 && current) {
          beats.push(current);
          current = sentence;
        } else {
          current = next;
        }
      }
      if (current) {
        beats.push(current);
      }
    }

    return beats
      .map((beat) => this.compactText(beat, 320))
      .filter((beat) => beat.length > 0);
  }

  private splitStorySentences(value: string) {
    return value
      .split(/(?<=[.!?;:])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
  }

  private compactText(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    const sliced = normalized.slice(0, maxLength - 3);
    const lastSpace = sliced.lastIndexOf(" ");
    return `${sliced.slice(0, lastSpace > 80 ? lastSpace : sliced.length).trim()}...`;
  }

  private deriveHostname(productUrl: string) {
    try {
      return new URL(productUrl).hostname;
    } catch {
      return "unknown source";
    }
  }

  private deriveProductName(productUrl: string) {
    try {
      const url = new URL(productUrl);
      const rawSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "product");
      const titleSource = rawSegment.split("-i.")[0] ?? rawSegment;
      const title = titleSource.replace(/-/g, " ").replace(/\s+/g, " ").trim();
      return title || "selected product";
    } catch {
      return "selected product";
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return { value };
  }

  private toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private toApiError(error: unknown): ApiError {
    if (error instanceof AiJobError) {
      return {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      };
    }

    return {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "AI job failed."
    };
  }

  private extractMediaIds(value: unknown) {
    const payload = this.toRecord(value);
    return Array.isArray(payload.mediaIds) ? payload.mediaIds.map(String) : [];
  }

  private extractTemplateSelection(value: unknown): TemplateSelection | null {
    const payload = this.toRecord(value);
    const parsed = TemplateSelectionSchema.safeParse(payload.templateSelection);
    return parsed.success ? parsed.data : null;
  }

  private extractShotSelection(value: unknown): ShotSelection | null {
    const payload = this.toRecord(value);
    const parsed = ShotSelectionSchema.safeParse(payload.shotSelection);
    return parsed.success ? parsed.data : null;
  }

  private extractShotPlanAttributes(value: unknown): VideoShotAttribute[] {
    const payload = this.toRecord(value);
    const parsed = VideoShotAttributeSchema.array().safeParse(payload.attributes);
    return parsed.success ? parsed.data : [];
  }

  private async validateMediaIds(projectId: string, mediaIds: string[]) {
    const uniqueMediaIds = [...new Set(mediaIds)];
    if (uniqueMediaIds.length === 0) {
      return;
    }

    const count = await prisma.mediaAsset.count({
      where: {
        id: { in: uniqueMediaIds },
        projectId,
        ownerUserId: defaultUserId,
        status: "validated"
      }
    });

    if (count !== uniqueMediaIds.length) {
      throw new BadRequestException("One or more media files are missing, rejected, or deleted.");
    }
  }

  private async validateTemplateSelection(templateSelection: TemplateSelection | null) {
    if (!templateSelection) {
      return;
    }

    const template = await prisma.videoTemplateRecord.findFirst({
      where: {
        id: templateSelection.templateId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });

    if (!template) {
      throw new BadRequestException("Template is missing or archived.");
    }
  }

  private async validateShotSelection(shotSelection: ShotSelection | null) {
    if (!shotSelection) {
      return;
    }

    const shotPlan = await prisma.videoShotPlanRecord.findFirst({
      where: {
        id: shotSelection.shotPlanId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });

    if (!shotPlan) {
      throw new BadRequestException("Shot plan is missing or archived.");
    }
  }

  private createTemplateGuidance(rawSelection: unknown) {
    const parsed = TemplateSelectionSchema.safeParse(rawSelection);
    if (!parsed.success || parsed.data.attributes.length === 0) {
      return "";
    }

    const selections = parsed.data.attributes
      .filter((attribute) => attribute.options.length > 0)
      .map((attribute) => `${attribute.name}: ${attribute.options.map((option) => option.label).join(", ")}`);

    if (selections.length === 0) {
      return "";
    }

    return [
      `Template attributes: ${parsed.data.templateName}`,
      ...selections.map((selection) => `- ${selection}`)
    ].join("\n");
  }

  private createShotGuidance(rawSelection: unknown) {
    const parsed = ShotSelectionSchema.safeParse(rawSelection);
    if (!parsed.success || parsed.data.shots.length === 0) {
      return "";
    }

    const planAttributes = parsed.data.attributes
      .filter((attribute) => attribute.name && attribute.value)
      .map((attribute) => `- ${attribute.name}: ${attribute.value}`);
    const shots = parsed.data.shots.map((shot, index) => {
      const attributes = shot.attributes
        .filter((attribute) => attribute.name && attribute.value)
        .map((attribute) => `   - ${attribute.name}: ${attribute.value}`);
      return [
        `${index + 1}. ${shot.title} (${shot.durationSeconds}s)`,
        `   - Description: ${shot.description}`,
        ...attributes
      ].join("\n");
    });

    return [
      `Selected shot plan: ${parsed.data.shotPlanName}`,
      ...(planAttributes.length > 0 ? ["Plan-level attributes:", ...planAttributes] : []),
      ...shots
    ].join("\n");
  }

  private clampDuration(value: number) {
    if (!Number.isFinite(value)) {
      return 8;
    }
    return Math.min(8, Math.max(1, Math.round(value)));
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
