import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@videoai/database";
import { z } from "zod";
import {
  VideoShotAttributeSchema,
  type ApiError,
  type ApiErrorCode,
  type GenerateShotsJobResult,
  type GenerateShotsRequest,
  type Provider,
  type VideoShotAttribute,
  type VideoShotPlan
} from "@videoai/contracts";
import {
  defaultUserId,
  getActiveAiConfig,
  mapJob,
  resolveProviderApiKey,
  toFlowType
} from "./db-store.js";

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

const openAiShotPlanJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    durationSeconds: { type: "integer" },
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          durationSeconds: { type: "integer" },
          attributes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
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

type ParsedProviderShotPlan = z.infer<typeof aiShotPlanSchema>;

type ProviderRequest = {
  provider: Provider;
  model: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

class AiJobError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly rawRequest?: unknown,
    public readonly rawResponse?: unknown
  ) {
    super(message);
  }
}

@Injectable()
export class ShotPlansService {
  async createShotGenerationJob(projectId: string | null, input: GenerateShotsRequest) {
    if (projectId) {
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
    }

    const startedAt = Date.now();
    const config = await getActiveAiConfig();
    const provider = config.promptProvider;
    const model = config.promptModel;
    const sourceText = input.sourceText;
    const requestedName = input.name?.trim();
    const requestedDescription = input.description?.trim();
    const attributes = this.extractShotPlanAttributes(input);
    const scenarioAttributes = this.extractAttributeArray(input.scenarioAttributes);
    const shotsAttributes = this.extractAttributeArray(input.shotsAttributes);
    const prompt = this.buildShotGenerationPrompt(
      input.masterPrompt ?? config.shotGenerationPrompt,
      sourceText,
      attributes,
      scenarioAttributes,
      shotsAttributes
    );
    const rawRequest = this.buildProviderRequest(provider, model, prompt);
    const jobId = `job_shot_generation_${Date.now()}`;
    const requestId = `ai_req_${Date.now()}`;

    const { requestLog } = await prisma.$transaction(async (tx) => {
      const createdJob = await tx.jobStatusRecord.create({
        data: {
          jobId,
          type: "shot_generation",
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
          flowType: toFlowType("shot_generation"),
          provider,
          model,
          requestPayload: this.toJson({
            sourceText,
            attributes,
            scenarioAttributes,
            shotsAttributes,
            masterPrompt: input.masterPrompt ?? null,
            rawRequest
          }),
          mediaReferences: this.toJson([]),
          status: "pending"
        }
      });

      return { job: createdJob, requestLog: createdRequestLog };
    });

    try {
      await this.markJobProcessing(jobId);
      await this.completeShotJob(
        jobId,
        requestLog.id,
        projectId,
        {
          sourceText,
          attributes,
          scenarioAttributes,
          shotsAttributes,
          provider,
          model,
          ...(requestedName ? { requestedName } : {}),
          ...(requestedDescription ? { requestedDescription } : {}),
          rawRequest
        },
        startedAt
      );
    } catch (error) {
      await this.failJob(jobId, requestLog.id, startedAt, error, rawRequest);
    }

    const completedJob = await prisma.jobStatusRecord.findUniqueOrThrow({ where: { jobId } });
    return mapJob(completedJob);
  }

  private async markJobProcessing(jobId: string) {
    await prisma.jobStatusRecord.update({
      where: { jobId },
      data: {
        status: "processing",
        progress: 45
      }
    });
  }

  private async failJob(
    jobId: string,
    requestLogId: string,
    startedAt: number,
    error: unknown,
    defaultRawRequest: unknown
  ) {
    const apiError = this.toApiError(error);
    const rawRequest = error instanceof AiJobError ? error.rawRequest ?? defaultRawRequest : defaultRawRequest;
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
          responsePayload: this.toJson({
            rawRequest,
            rawResponse: rawResponse ?? {}
          }),
          errorCode: apiError.code,
          errorMessage: apiError.message,
          latencyMs: Date.now() - startedAt
        }
      });
    });
  }

  private async completeShotJob(
    jobId: string,
    requestLogId: string,
    projectId: string | null,
    context: {
      sourceText: string;
      attributes: VideoShotAttribute[];
      scenarioAttributes: VideoShotAttribute[];
      shotsAttributes: VideoShotAttribute[];
      provider: Provider;
      model: string;
      requestedName?: string;
      requestedDescription?: string;
      rawRequest: ProviderRequest;
    },
    startedAt: number
  ) {
    const rawResponse = await this.callShotProvider(
      context.provider,
      context.model,
      context.rawRequest
    );
    const shotPlan = this.normalizeAiShotPlan(rawResponse, {
      projectId,
      sourceText: context.sourceText,
      attributes: context.attributes
    });
    const finalShotPlan = {
      ...shotPlan,
      ...(context.requestedName ? { name: context.requestedName } : {}),
      ...(context.requestedDescription ? { description: context.requestedDescription } : {})
    };
    const result: GenerateShotsJobResult = {
      shotPlan: finalShotPlan,
      rawRequest: context.rawRequest,
      rawResponse,
      provider: context.provider,
      model: context.model
    };

    await prisma.$transaction(async (tx) => {
      await tx.videoShotPlanRecord.create({
        data: {
          id: finalShotPlan.id,
          projectId,
          ownerUserId: defaultUserId,
          name: finalShotPlan.name,
          description: finalShotPlan.description ?? null,
          sourceText: finalShotPlan.sourceText,
          durationSeconds: finalShotPlan.durationSeconds,
          attributes: this.toJson(finalShotPlan.attributes),
          shots: this.toJson(finalShotPlan.shots),
          isDefault: false,
          status: "active"
        }
      });
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
    });
  }

  private buildShotGenerationPrompt(
    configuredPrompt: string | null | undefined,
    sourceText: string,
    attributes: VideoShotAttribute[],
    scenarioAttributes: VideoShotAttribute[],
    shotsAttributes: VideoShotAttribute[]
  ) {
    const template = this.requirePrompt(configuredPrompt, "Shots master prompt");
    const attributeText = this.formatPlanAttributes(attributes);
    const scenarioAttributeText = this.formatPlanAttributes(scenarioAttributes);
    const shotsAttributeText = this.formatPlanAttributes(shotsAttributes);
    const renderedPrompt = this.renderOptionalPromptPlaceholders(template, {
      story: sourceText,
      attributes: attributeText,
      scenarioAttributes: scenarioAttributeText,
      shotsAttributes: shotsAttributeText
    });

    return renderedPrompt;
  }

  private renderOptionalPromptPlaceholders(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
      (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
      template
    );
  }

  private formatPlanAttributes(attributes: VideoShotAttribute[]) {
    const lines = attributes
      .filter((attribute) => attribute.name.trim() && attribute.value.trim())
      .map((attribute) => `${attribute.name.trim()}=${attribute.value.trim()};`);
    return lines.join("\n");
  }

  private buildProviderRequest(provider: Provider, model: string, prompt: string): ProviderRequest {
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
            responseJsonSchema: shotPlanJsonSchema
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
              name: "video_shot_plan",
              strict: true,
              schema: openAiShotPlanJsonSchema
            }
          }
        }
      };
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate prompt shots.`,
      { provider, model }
    );
  }

  private async callShotProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    if (this.isGeminiProvider(provider)) {
      return this.callGeminiForShots(model, rawRequest);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForShots(model, rawRequest);
    }

    throw new AiJobError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate prompt shots.`,
      { provider, model },
      rawRequest
    );
  }

  private async callGeminiForShots(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} shot generation. Save a provider key in Admin > AI Config.`,
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
      const isRateLimited = response.status === 429;
      throw new AiJobError(
        isRateLimited ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        isRateLimited
          ? `Gemini shot generation is rate limited or out of quota (status ${response.status}).`
          : `Gemini shot generation failed with status ${response.status}.`,
        {
          provider: rawRequest.provider,
          model,
          status: response.status,
          providerError: this.extractProviderError(providerPayload)
        },
        rawRequest,
        providerPayload
      );
    }

    const text = this.extractGeminiText(providerPayload);
    return this.parseProviderJson(text, rawRequest.provider, model, rawRequest, providerPayload);
  }

  private async callOpenAiForShots(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiJobError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} shot generation. Save a provider key in Admin > AI Config.`,
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
      const isRateLimited = response.status === 429;
      throw new AiJobError(
        isRateLimited ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        isRateLimited
          ? `ChatGPT shot generation is rate limited or out of quota (status ${response.status}).`
          : `ChatGPT shot generation failed with status ${response.status}.`,
        {
          provider: rawRequest.provider,
          model,
          status: response.status,
          providerError: this.extractProviderError(providerPayload)
        },
        rawRequest,
        providerPayload
      );
    }

    const text = this.extractOpenAiText(providerPayload);
    return this.parseProviderJson(text, rawRequest.provider, model, rawRequest, providerPayload);
  }

  private isGeminiProvider(provider: Provider) {
    return provider === "gemini" || provider === "google";
  }

  private isOpenAiProvider(provider: Provider) {
    return provider === "chatgpt" || provider === "openai";
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

  private extractProviderError(payload: unknown) {
    const error = this.toRecord(this.toRecord(payload).error);
    const message = typeof error.message === "string" ? error.message : undefined;
    const code = typeof error.code === "string" ? error.code : undefined;
    const type = typeof error.type === "string" ? error.type : undefined;
    return { code, type, message };
  }

  private extractGeminiText(payload: unknown) {
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
        "Gemini did not return JSON text for shot generation.",
        { provider: "gemini" },
        undefined,
        payload
      );
    }

    return text;
  }

  private extractOpenAiText(payload: unknown) {
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
        "ChatGPT did not return JSON text for shot generation.",
        { provider: "chatgpt" },
        undefined,
        payload
      );
    }

    return text;
  }

  private parseProviderJson(
    text: string,
    provider: Provider,
    model: string,
    rawRequest: unknown,
    providerPayload: unknown
  ) {
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
      "AI returned invalid JSON for shot generation.",
      { provider, model },
      rawRequest,
      { providerPayload, text: trimmed.slice(0, 4000) }
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
      projectId: string | null;
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
        undefined,
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
        undefined,
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

  private extractShotPlanAttributes(value: unknown): VideoShotAttribute[] {
    const payload = this.toRecord(value);
    return this.extractAttributeArray(payload.attributes);
  }

  private extractAttributeArray(value: unknown): VideoShotAttribute[] {
    const parsed = VideoShotAttributeSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
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

  private requirePrompt(value: string | null | undefined, label: string) {
    const prompt = value?.trim();
    if (!prompt) {
      throw new AiJobError("AI_CONFIG_MISSING", `${label} is required. Configure it in Admin > Master Prompt.`);
    }
    return prompt;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
