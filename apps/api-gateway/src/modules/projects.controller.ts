import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { Prisma, prisma } from "@videoai/database";
import { z } from "zod";
import {
  AnalyzeProductRequestSchema,
  AnalyzeTemplateSelectionRequestSchema,
  AttributeCatalogAttributeSchema,
  CreateProjectRequestSchema,
  CreateScriptRequestSchema,
  CreateVideoRequestSchema,
  GeneratePromptRequestSchema,
  GenerateShotsRequestSchema,
  SaveProjectStoryContentRequestSchema,
  SaveProjectAttributeSelectionsRequestSchema,
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
  type AttributeCatalog,
  type AttributeSelection,
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
  assertNoMasterPromptAttributePlaceholder,
  getActiveAiConfig,
  getDefaultAttributeCatalog,
  mapJob,
  mapProject,
  mapVideoShotPlan,
  resolveProviderApiKey,
  toFlowType
} from "./db-store.js";
import { ok } from "./response.js";
import { ShotPlansService } from "./shot-plans.service.js";

const aiShotAttributeSchema = z.object({
  name: z.string().trim().min(1),
  value: z.string().trim().min(1)
});

const aiShotSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  durationSeconds: z.number().int().min(1).max(8),
  attributes: z.array(aiShotAttributeSchema).min(1)
});

const aiShotPlanSchema = z.object({
  name: z.string().trim().min(1),
  durationSeconds: z.number().int().min(1).max(8),
  shots: z.array(aiShotSchema).min(1)
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
    this.assertUserPromptOverrideAllowed(body.masterPrompt);
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
        ...(body.description !== undefined ? { description: body.description } : {}),
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
    this.assertUserPromptOverrideAllowed(body.masterPrompt);
    return ok(await this.createJob("prompt_generation", projectId, body));
  }

  @Get(":projectId/story-content")
  async getStoryContent(@Param("projectId") projectId: string) {
    const project = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    if (!project) {
      return ok({ storyContent: "" });
    }

    const prompt = await prisma.promptRecord.findFirst({
      where: {
        projectId,
        ownerUserId: defaultUserId,
        sourceType: { in: ["script_flow", "story_content"] },
        status: "succeeded"
      },
      orderBy: { updatedAt: "desc" }
    });

    return ok({ storyContent: prompt?.generatedPrompt ?? "" });
  }

  @Patch(":projectId/story-content")
  async saveStoryContent(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = SaveProjectStoryContentRequestSchema.parse(rawBody);
    const project = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    if (!project) {
      return ok({ saved: false, storyContent: body.storyContent });
    }

    const config = await getActiveAiConfig();
    await prisma.promptRecord.create({
      data: {
        id: `story_content_${Date.now()}`,
        projectId,
        ownerUserId: defaultUserId,
        sourceType: "story_content",
        inputText: body.storyContent,
        productUrl: null,
        mediaAssetIds: this.toJson([]),
        generatedPrompt: body.storyContent,
        finalPrompt: null,
        provider: config.promptProvider,
        model: config.promptModel,
        status: "succeeded",
        mediaAnalysisSummary: this.toJson([]),
        providerMetadata: this.toJson({ savedFrom: "one_click_step_1" })
      }
    });

    return ok({ saved: true, storyContent: body.storyContent });
  }

  @Post(":projectId/products/analyze")
  async analyzeProduct(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = AnalyzeProductRequestSchema.parse(rawBody);
    return ok(await this.createJob("product_analysis", projectId, body));
  }

  @Post(":projectId/template-selection/analyze")
  async analyzeTemplateSelection(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = AnalyzeTemplateSelectionRequestSchema.parse(rawBody);
    this.assertUserPromptOverrideAllowed(body.masterPrompt);
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
        templateSelection: body.templateSelection ? this.toJson(body.templateSelection) : Prisma.JsonNull,
        attributeSelections: this.toJson({
          ...(await this.getExistingProjectAttributeSelections(projectId)),
          scenario: body.templateSelection ? this.templateSelectionToAttributeSelection(body.templateSelection) : null
        })
      }
    });

    return ok({ saved: result.count > 0, templateSelection: body.templateSelection });
  }

  @Patch(":projectId/attribute-selections")
  async saveAttributeSelections(@Param("projectId") projectId: string, @Body() rawBody: unknown) {
    const body = SaveProjectAttributeSelectionsRequestSchema.parse(rawBody);
    const result = await prisma.projectRecord.updateMany({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      },
      data: {
        attributeSelections: this.toJson(body.attributeSelections)
      }
    });

    return ok({
      saved: result.count > 0,
      attributeSelections: body.attributeSelections
    });
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
        await tx.videoShotPlanRecord.create({
          data: {
            id: String(shotPlan.id),
            projectId,
            ownerUserId: defaultUserId,
            name: String(shotPlan.name),
            description: shotPlan.description ? String(shotPlan.description) : null,
            sourceText: String(shotPlan.sourceText),
            durationSeconds: Number(shotPlan.durationSeconds),
            attributes: this.toJson(shotPlan.attributes ?? []),
            shots: this.toJson(shotPlan.shots ?? []),
            isDefault: false,
            status: "active"
          }
        });
      }

      if (type === "template_selection") {
        const resultRecord = this.toRecord(result);
        const existingProject = await tx.projectRecord.findUnique({ where: { id: projectId } });
        const existingSelections = this.toRecord(existingProject?.attributeSelections);
        const scenarioSelection = this.templateSelectionToAttributeSelection(resultRecord.templateSelection);
        await tx.projectRecord.update({
          where: { id: projectId },
          data: {
            templateSelection: this.toJson(resultRecord.templateSelection ?? null),
            attributeSelections: this.toJson({
              ...existingSelections,
              ...(scenarioSelection ? { scenario: scenarioSelection } : {})
            })
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
      const sourceText = String(payload.sourceText ?? "");
      const attributes = this.extractShotPlanAttributes(input);
      const scenarioAttributes = this.extractVideoShotAttributes(payload.scenarioAttributes);
      const shotsAttributes = this.extractVideoShotAttributes(payload.shotsAttributes);
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : undefined;
      return this.createShotPlanWithAi(
        projectId,
        sourceText,
        attributes,
        scenarioAttributes,
        shotsAttributes,
        config,
        masterPrompt
      );
    }

    if (type === "template_selection") {
      const inputText = String(payload.inputText ?? "");
      const templateId = payload.templateId ? String(payload.templateId) : undefined;
      const catalogId = payload.catalogId ? String(payload.catalogId) : undefined;
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : undefined;
      return this.createTemplateSelectionWithAi(
        projectId,
        inputText,
        templateId,
        catalogId,
        config,
        masterPrompt,
        Boolean(payload.saveAsTemplate),
        payload.templateName ? String(payload.templateName) : undefined,
        payload.templateDescription ? String(payload.templateDescription) : undefined
      );
    }

    if (type === "prompt_generation") {
      const inputText = String(payload.inputText ?? "").trim();
      if (!inputText) {
        throw new AiJobError("VALIDATION_ERROR", "inputText is required for Story Content generation.");
      }
      const masterPrompt = payload.masterPrompt ? String(payload.masterPrompt) : config.scriptGenerationPrompt;
      const storyAttributes = this.formatAttributeSelectionCompact(
        this.extractAttributeSelection(payload.attributeSelections, "story")
      );
      return this.createStoryContentWithAi(
        projectId,
        inputText,
        mediaIds,
        shotGuidance,
        templateGuidance,
        storyAttributes,
        config,
        masterPrompt
      );
    }

    if (type === "product_analysis") {
      const productUrl = String(payload.productUrl ?? "").trim();
      if (!productUrl) {
        throw new AiJobError("VALIDATION_ERROR", "productUrl is required for product analysis.");
      }
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
            : "",
          templateGuidance
        ].filter(Boolean).join("\n\n"),
        provider: config.promptProvider,
        model: config.promptModel
      };
    }

    if (type === "video_generation") {
      const finalPrompt = String(payload.finalPrompt ?? "").trim();
      if (!finalPrompt) {
        throw new AiJobError(
          "VALIDATION_ERROR",
          "Final prompt is required before creating video.",
          { provider: config.videoProvider, model: config.videoModel }
        );
      }
      const rawRequest = this.buildVideoProviderRequest(
        config.videoProvider,
        config.videoModel,
        finalPrompt
      );
      const rawResponse = await this.callVideoProvider(
        config.videoProvider,
        config.videoModel,
        rawRequest
      );
      return {
        videoGenerationId: videoGenerationId ?? `video_gen_${Date.now()}`,
        projectId,
        status: "succeeded",
        provider: config.videoProvider,
        model: config.videoModel,
        rawRequest,
        rawResponse
      };
    }

    return { projectId, input: this.toRecord(input) };
  }

  private buildVideoProviderRequest(provider: Provider, model: string, finalPrompt: string): ProviderRequest {
    if (this.isGeminiVideoProvider(provider)) {
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
              parts: [{ text: finalPrompt }]
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
          input: finalPrompt
        }
      };
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot create video because no VideoAI adapter is configured for it.`,
      { provider, model }
    );
  }

  private async callVideoProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    if (this.isGeminiVideoProvider(provider)) {
      return this.callGeminiForVideo(provider, model, rawRequest);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForVideo(provider, model, rawRequest);
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot create video because no VideoAI adapter is configured for it.`,
      { provider, model },
      rawRequest
    );
  }

  private async callGeminiForVideo(provider: Provider, model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${provider} video generation. Save a provider key in Admin > AI Config.`,
        { provider, model },
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
          ? `${provider} video generation is rate limited or out of quota (status ${response.status}).`
          : `${provider} video generation failed with status ${response.status}.`,
        { provider, model, status: response.status },
        providerPayload
      );
    }

    return providerPayload;
  }

  private async callOpenAiForVideo(provider: Provider, model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${provider} video generation. Save a provider key in Admin > AI Config.`,
        { provider, model },
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
          ? `ChatGPT video generation is rate limited or out of quota (status ${response.status}).`
          : `ChatGPT video generation failed with status ${response.status}.`,
        { provider, model, status: response.status },
        providerPayload
      );
    }

    return providerPayload;
  }

  private async createTemplateSelectionWithAi(
    projectId: string,
    inputText: string,
    templateId: string | undefined,
    catalogId: string | undefined,
    config: AiConfig,
    masterPrompt?: string,
    saveAsTemplate?: boolean,
    templateNameOverride?: string,
    templateDescriptionOverride?: string
  ): Promise<TemplateSelectionAnalysisResult> {
    const template = templateId
      ? await prisma.videoTemplateRecord.findFirst({
          where: {
            id: templateId,
            ownerUserId: defaultUserId,
            status: "active"
          }
        })
      : null;
    const catalog = template ? null : await this.resolveScenarioCatalog(catalogId);
    if (!template && !catalog) {
      throw new BadRequestException("Scenario attribute catalog is missing. Configure a default catalog in Admin > Scenario > Attribute.");
    }

    const attributes = template
      ? TemplateAttributeSchema.array().parse(template.attributes)
      : this.catalogAttributesToTemplateAttributes(catalog);
    const sourceId = template?.id ?? catalog!.id;
    const sourceName = template?.name ?? catalog!.name;
    const provider = config.promptProvider;
    const model = config.promptModel;
    const prompt = this.buildTemplateSelectionPrompt(
      this.requirePrompt(masterPrompt ?? config.templateSelectionPrompt, "Scenario master prompt"),
      inputText,
      {
        id: sourceId,
        name: sourceName,
        attributes
      }
    );
    const rawRequest = this.buildTemplateSelectionProviderRequest(provider, model, prompt);
    const rawResponse = await this.callTemplateSelectionProvider(provider, model, rawRequest);
    let templateSelection = this.normalizeTemplateSelection(rawResponse, {
      templateId: sourceId,
      templateName: sourceName,
      attributes
    });

    if (saveAsTemplate) {
      const project = await prisma.projectRecord.findFirst({
        where: {
          id: projectId,
          ownerUserId: defaultUserId,
          status: "active"
        }
      });
      if (!project) {
        throw new BadRequestException("Project is missing or archived.");
      }
      const nameSource = templateNameOverride?.trim() || project.name.trim();
      if (!nameSource) {
        throw new BadRequestException("Scenario name is required before saving AI analysis.");
      }
      const name = nameSource.slice(0, 120);
      const description = (templateDescriptionOverride?.trim() || project.description?.trim() || "").slice(0, 500);
      const savedTemplate = await prisma.videoTemplateRecord.create({
        data: {
          id: `template_${Date.now()}`,
          ownerUserId: defaultUserId,
          name,
          description: description || null,
          idea: inputText,
          attributes: this.toJson(templateSelection.attributes),
          isDefault: false,
          status: "active"
        }
      });
      templateSelection = {
        ...templateSelection,
        templateId: savedTemplate.id,
        templateName: savedTemplate.name
      };
    }

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
    const promptTemplate = this.requirePrompt(masterPrompt, "Scenario master prompt");
    const renderedPrompt = this.renderOptionalPromptPlaceholders(
      promptTemplate,
      {
        story: inputText,
        attributes: attributeCatalogText,
        scenarioAttributes: attributeCatalogText
      }
    );

    return renderedPrompt;
  }

  private buildScriptGenerationPrompt(
    configuredPrompt: string | null | undefined,
    inputText: string,
    mediaIds: string[],
    shotGuidance: string,
    templateGuidance: string,
    storyAttributes: string
  ) {
    const masterPrompt = this.requirePrompt(configuredPrompt, "Story Content master prompt");
    const mediaSummary =
      mediaIds.length > 0
        ? `Use ${mediaIds.length} reference media file(s) to keep visual style, lighting, composition, and pacing consistent.`
        : "";
    const shotSelection = shotGuidance;
    const scenarioSelection = templateGuidance;
    const renderedPrompt = this.renderOptionalPromptPlaceholders(masterPrompt, {
      inputText,
      mediaSummary,
      shotSelection,
      scenarioSelection,
      storyAttributes
    });
    return renderedPrompt;
  }

  private async createStoryContentWithAi(
    projectId: string,
    inputText: string,
    mediaIds: string[],
    shotGuidance: string,
    templateGuidance: string,
    storyAttributes: string,
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
      templateGuidance,
      storyAttributes
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
        `Missing API key for ${rawRequest.provider} Story Content generation. Save a provider key in Admin > AI Config.`,
        { provider: rawRequest.provider, model },
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
        `Missing API key for ${rawRequest.provider} Story Content generation. Save a provider key in Admin > AI Config.`,
        { provider: rawRequest.provider, model },
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
        `Missing API key for ${rawRequest.provider} template option analysis. Save a provider key in Admin > AI Config.`,
        { provider: rawRequest.provider, model },
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
        `Missing API key for ${rawRequest.provider} template option analysis. Save a provider key in Admin > AI Config.`,
        { provider: rawRequest.provider, model },
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
    attributes: VideoShotAttribute[],
    scenarioAttributes: VideoShotAttribute[],
    shotsAttributes: VideoShotAttribute[],
    config: AiConfig,
    masterPrompt?: string
  ): Promise<GenerateShotsJobResult> {
    const provider = config.promptProvider;
    const model = config.promptModel;
    const prompt = this.buildShotGenerationPrompt(
      masterPrompt ?? config.shotGenerationPrompt,
      sourceText,
      attributes,
      scenarioAttributes,
      shotsAttributes
    );
    const rawResponse = await this.callShotProvider(provider, model, prompt);
    const shotPlan = this.normalizeAiShotPlan(rawResponse, {
      projectId,
      sourceText,
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
        `Missing API key for ${provider} shot generation. Save a provider key in Admin > AI Config.`,
        { provider, model }
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
        `Missing API key for ${provider} shot generation. Save a provider key in Admin > AI Config.`,
        { provider, model }
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

  private isGeminiVideoProvider(provider: Provider) {
    return this.isGeminiProvider(provider) || provider === "veo";
  }

  private isOpenAiProvider(provider: Provider) {
    return provider === "chatgpt" || provider === "openai";
  }

  private buildShotGenerationPrompt(
    configuredPrompt: string | null | undefined,
    sourceText: string,
    attributes: VideoShotAttribute[],
    scenarioAttributes: VideoShotAttribute[],
    shotsAttributes: VideoShotAttribute[]
  ) {
    const attributeText = attributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`)
      .join("\n");
    const scenarioAttributeText = scenarioAttributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`)
      .join("\n");
    const shotsAttributeText = shotsAttributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`)
      .join("\n");
    const masterPrompt = this.requirePrompt(configuredPrompt, "Shots master prompt");
    const renderedPrompt = this.renderOptionalPromptPlaceholders(
      masterPrompt,
      {
        story: sourceText,
        attributes: attributeText,
        scenarioAttributes: scenarioAttributeText,
        shotsAttributes: shotsAttributeText
      }
    );
    return renderedPrompt;
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
    const durationSeconds = parsed.data.durationSeconds;
    const shots = parsed.data.shots.map((shot, index) => {
      const attributes = this.validateRequiredStateAttributes(
        this.normalizeAiShotAttributes(shot.attributes, index),
        index,
        rawResponse
      );

      return {
        id: `shot_${timestamp}_${index + 1}`,
        title: this.cleanText(shot.title),
        description: this.cleanText(shot.description),
        durationSeconds: shot.durationSeconds,
        attributes,
        mediaIds: []
      };
    });

    return {
      id: `shot_plan_${timestamp}`,
      ownerUserId: defaultUserId,
      projectId: context.projectId,
      name: this.cleanText(parsed.data.name),
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
    return attributes
      .map((attribute, index) => {
        const name = this.cleanText(attribute.name);
        const value = this.cleanText(attribute.value);

        return {
          id: `shot_${shotIndex + 1}_${this.slug(name)}_${index + 1}`,
          name,
          value
        };
      });
  }

  private validateRequiredStateAttributes(
    attributes: VideoShotAttribute[],
    shotIndex: number,
    rawResponse: unknown
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
    if (!hasStartState || !hasEndState || !hasDialogue) {
      throw new AiJobError(
        "AI_PROVIDER_FAILED",
        `AI shot ${shotIndex + 1} is missing required Start state, End state, or Dialogue attributes.`,
        {
          shotIndex: shotIndex + 1,
          requiredAttributes: ["Start state", "End state", "Dialogue"]
        },
        rawResponse
      );
    }

    return attributes;
  }

  private isNamedAttribute(attribute: VideoShotAttribute, expectedName: string) {
    return attribute.name.trim().toLowerCase() === expectedName.toLowerCase();
  }

  private cleanText(value: string) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      throw new AiJobError("AI_PROVIDER_FAILED", "AI returned an empty required text field.");
    }
    return trimmed;
  }

  private requirePrompt(value: string | null | undefined, label: string) {
    const prompt = value?.trim();
    if (!prompt) {
      throw new AiJobError("AI_CONFIG_MISSING", `${label} is required. Configure it in Admin > Master Prompt.`);
    }
    return prompt;
  }

  private slug(value: string) {
    const slug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48);
    if (!slug) {
      throw new AiJobError("AI_PROVIDER_FAILED", "AI returned an attribute name that cannot be used as an id.");
    }
    return slug;
  }

  private createMediaInsights(mediaIds: string[]) {
    if (mediaIds.length === 0) {
      return [];
    }

    return [
      `${mediaIds.length} valid media file(s) attached.`,
      "Use the uploaded media to reference product framing, palette, pacing, and visual style.",
      "Do not copy reference media directly; use it only as visual direction."
    ];
  }

  private deriveHostname(productUrl: string) {
    try {
      return new URL(productUrl).hostname;
    } catch {
      throw new AiJobError("VALIDATION_ERROR", "productUrl must be a valid URL.");
    }
  }

  private deriveProductName(productUrl: string) {
    let url: URL;
    try {
      url = new URL(productUrl);
    } catch {
      throw new AiJobError("VALIDATION_ERROR", "productUrl must be a valid product URL.");
    }
    const rawSegment = decodeURIComponent(url.pathname.split("/").filter(Boolean)[0] ?? "");
    const titleSource = rawSegment.split("-i.")[0] ?? rawSegment;
    const title = titleSource.replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (!title) {
      throw new AiJobError("VALIDATION_ERROR", "productUrl must include a product path segment.");
    }
    return title;
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

  private extractVideoShotAttributes(value: unknown): VideoShotAttribute[] {
    const parsed = VideoShotAttributeSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  }

  private extractAttributeSelection(value: unknown, type: "story" | "scenario" | "shots"): AttributeSelection | null {
    const payload = this.toRecord(value);
    const selections = this.toRecord(payload.attributeSelections ?? payload);
    const parsed = z.object({
      catalogId: z.string(),
      catalogName: z.string(),
      type: z.literal(type),
      attributes: z.array(z.object({
        id: z.string(),
        name: z.string(),
        required: z.boolean().default(false),
        options: z.array(z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional()
        }))
      }))
    }).safeParse(selections[type]);
    return parsed.success ? parsed.data : null;
  }

  private formatAttributeSelectionCompact(selection: AttributeSelection | null) {
    if (!selection) {
      return "";
    }
    return selection.attributes
      .filter((attribute) => attribute.options.length > 0)
      .map((attribute) => `${attribute.id}=${attribute.options.map((option) => option.name).join(",")};`)
      .join("\n");
  }

  private templateSelectionToAttributeSelection(value: unknown): AttributeSelection | null {
    const parsed = TemplateSelectionSchema.safeParse(value);
    if (!parsed.success) {
      return null;
    }
    return {
      catalogId: parsed.data.templateId,
      catalogName: parsed.data.templateName,
      type: "scenario",
      attributes: parsed.data.attributes.map((attribute) => ({
        id: attribute.id,
        name: attribute.name,
        required: false,
        options: attribute.options.map((option) => ({
          id: option.id,
          name: option.label,
          ...(option.description ? { description: option.description } : {})
        }))
      }))
    };
  }

  private async getExistingProjectAttributeSelections(projectId: string) {
    const project = await prisma.projectRecord.findFirst({
      where: {
        id: projectId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    return this.toRecord(project?.attributeSelections);
  }

  private async resolveScenarioCatalog(catalogId?: string): Promise<AttributeCatalog> {
    if (catalogId) {
      const catalog = await prisma.scenarioAttributeCatalog.findFirst({
        where: {
          id: catalogId,
          status: "active"
        }
      });
      if (catalog) {
        return {
          id: catalog.id,
          type: "scenario",
          name: catalog.name,
          ...(catalog.description ? { description: catalog.description } : {}),
          attributes: AttributeCatalogAttributeSchema.array().parse(catalog.attributes),
          isDefault: catalog.isDefault,
          status: catalog.status === "archived" ? "archived" : "active",
          createdAt: catalog.createdAt.toISOString(),
          updatedAt: catalog.updatedAt.toISOString()
        };
      }
    }
    const defaultCatalog = await getDefaultAttributeCatalog("scenario");
    if (!defaultCatalog) {
      throw new BadRequestException("Default Scenario attribute catalog is missing.");
    }
    return defaultCatalog;
  }

  private catalogAttributesToTemplateAttributes(catalog: AttributeCatalog | null): TemplateAttribute[] {
    if (!catalog) {
      return [];
    }
    return catalog.attributes.map((attribute) => ({
      id: attribute.id,
      name: attribute.name,
      ...(attribute.description ? { description: attribute.description } : {}),
      required: attribute.required,
      options: attribute.options.map((option) => ({
        id: option.id,
        label: option.name,
        value: option.name,
        ...(option.description ? { description: option.description } : {})
      }))
    }));
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
      const catalog = await prisma.scenarioAttributeCatalog.findFirst({
        where: {
          id: templateSelection.templateId,
          status: "active"
        }
      });
      if (!catalog) {
        throw new BadRequestException("Scenario catalog is missing or archived.");
      }
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

  private assertUserPromptOverrideAllowed(masterPrompt: string | null | undefined) {
    try {
      assertNoMasterPromptAttributePlaceholder(masterPrompt);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid master prompt override.");
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

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
