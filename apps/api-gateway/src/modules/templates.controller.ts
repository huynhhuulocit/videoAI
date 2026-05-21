import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { prisma, type Prisma } from "@videoai/database";
import { z } from "zod";
import {
  CreateTemplateRequestSchema,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  GenerateTemplateRequestSchema,
  TemplateAttributeSchema,
  UpdateTemplateRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type Provider,
  type TemplateAttribute,
  type TemplateOption
} from "@videoai/contracts";
import {
  defaultUserId,
  getActiveAiConfig,
  mapVideoTemplate,
  resolveProviderApiKey
} from "./db-store.js";
import { ok } from "./response.js";

const aiTemplateOptionSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  label: z.string().optional(),
  value: z.string().optional(),
  description: z.string().optional()
});

const aiTemplateAttributeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  options: z.array(aiTemplateOptionSchema).optional().default([])
});

const aiTemplateGenerationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  attributes: z.array(aiTemplateAttributeSchema).optional().default([])
});

const templateGenerationJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    attributes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          options: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["id", "name", "description"]
            }
          }
        },
        required: ["id", "name", "description", "options"]
      }
    }
  },
  required: ["name", "description", "attributes"]
} as const;

const openAiTemplateGenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    attributes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" }
              },
              required: ["id", "name", "description"]
            }
          }
        },
        required: ["id", "name", "description", "options"]
      }
    }
  },
  required: ["name", "description", "attributes"]
} as const;

type ParsedProviderTemplate = z.infer<typeof aiTemplateGenerationSchema>;

type ProviderRequest = {
  provider: Provider;
  model: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

class AiTemplateGenerationError extends Error {
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

@Controller("templates")
export class TemplatesController {
  @Get()
  async listTemplates() {
    const templates = await prisma.videoTemplateRecord.findMany({
      where: {
        ownerUserId: defaultUserId,
        status: "active"
      },
      orderBy: { updatedAt: "desc" }
    });
    return ok(templates.map(mapVideoTemplate));
  }

  @Post("generate")
  async generateTemplate(@Body() rawBody: unknown) {
    const body = GenerateTemplateRequestSchema.parse(rawBody);
    const startedAt = Date.now();
    const config = await getActiveAiConfig();
    const provider = config.promptProvider;
    const model = config.promptModel;
    const requestId = `ai_req_template_${Date.now()}`;
    const masterPrompt =
      body.masterPrompt?.trim() || config.templateSelectionPrompt || DEFAULT_TEMPLATE_SELECTION_PROMPT;
    const prompt = this.buildTemplateGenerationPrompt(masterPrompt, body.idea);
    let rawRequest: ProviderRequest;

    try {
      rawRequest = this.buildProviderRequest(provider, model, prompt);
    } catch (error) {
      throw this.toBadRequestException(this.toApiError(error), requestId);
    }

    const requestLog = await prisma.aiRequestLog.create({
      data: {
        requestId,
        actorUserId: defaultUserId,
        actorRole: "user",
        projectId: null,
        flowType: "template_generation",
        provider,
        model,
        requestPayload: this.toJson({
          idea: body.idea,
          masterPrompt: body.masterPrompt ?? null,
          rawRequest
        }),
        mediaReferences: this.toJson([]),
        status: "pending"
      }
    });

    try {
      const rawResponse = await this.callTemplateProvider(provider, model, rawRequest);
      const draft = this.normalizeAiTemplate(rawResponse, rawRequest);

      const template = await prisma.$transaction(async (tx) => {
        const createdTemplate = await tx.videoTemplateRecord.create({
          data: {
            id: `template_${Date.now()}`,
            ownerUserId: defaultUserId,
            name: draft.name,
            description: draft.description,
            idea: body.idea,
            attributes: this.toJson(draft.attributes),
            isDefault: false,
            status: "active"
          }
        });

        await tx.aiRequestLog.update({
          where: { id: requestLog.id },
          data: {
            status: "success",
            completedAt: new Date()
          }
        });
        await tx.aiResponseLog.create({
          data: {
            requestLogId: requestLog.id,
            responsePayload: this.toJson({
              rawRequest,
              rawResponse,
              template: draft
            }),
            latencyMs: Date.now() - startedAt
          }
        });

        return createdTemplate;
      });

      return ok(
        {
          ...mapVideoTemplate(template),
          rawRequest,
          rawResponse,
          provider,
          model
        },
        requestId
      );
    } catch (error) {
      const apiError = this.toApiError(error);
      const rawResponse = error instanceof AiTemplateGenerationError ? error.rawResponse : undefined;
      const errorRawRequest =
        error instanceof AiTemplateGenerationError ? error.rawRequest ?? rawRequest : rawRequest;

      await prisma.$transaction(async (tx) => {
        await tx.aiRequestLog.update({
          where: { id: requestLog.id },
          data: {
            status: "failed",
            completedAt: new Date()
          }
        });
        await tx.aiResponseLog.create({
          data: {
            requestLogId: requestLog.id,
            responsePayload: this.toJson({
              rawRequest: errorRawRequest,
              rawResponse: rawResponse ?? {}
            }),
            errorCode: apiError.code,
            errorMessage: apiError.message,
            latencyMs: Date.now() - startedAt
          }
        });
      });

      throw this.toBadRequestException(apiError, requestId);
    }
  }

  @Post()
  async createTemplate(@Body() rawBody: unknown) {
    const body = CreateTemplateRequestSchema.parse(rawBody);
    const template = await prisma.$transaction(async (tx) => {
      return tx.videoTemplateRecord.create({
        data: {
          id: `template_${Date.now()}`,
          ownerUserId: defaultUserId,
          name: body.name,
          description: body.description ?? null,
          idea: body.idea ?? null,
          attributes: this.toJson(body.attributes),
          isDefault: false,
          status: "active"
        }
      });
    });
    return ok(mapVideoTemplate(template));
  }

  @Get(":templateId")
  async getTemplate(@Param("templateId") templateId: string) {
    const template = await prisma.videoTemplateRecord.findFirst({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    return ok(template ? mapVideoTemplate(template) : null);
  }

  @Patch(":templateId")
  async updateTemplate(@Param("templateId") templateId: string, @Body() rawBody: unknown) {
    const body = UpdateTemplateRequestSchema.parse(rawBody);
    const existing = await prisma.videoTemplateRecord.findFirst({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });

    if (!existing) {
      return ok(null);
    }

    const template = await prisma.videoTemplateRecord.update({
      where: { id: templateId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.idea !== undefined ? { idea: body.idea } : {}),
        ...(body.attributes !== undefined ? { attributes: this.toJson(body.attributes) } : {})
      }
    });
    return ok(mapVideoTemplate(template));
  }

  @Delete(":templateId")
  async deleteTemplate(@Param("templateId") templateId: string) {
    const result = await prisma.videoTemplateRecord.updateMany({
        where: {
          id: templateId,
          ownerUserId: defaultUserId,
          status: "active"
        },
        data: { isDefault: false, status: "archived" }
    });
    return ok({ deleted: result.count > 0 });
  }

  private buildTemplateGenerationPrompt(masterPrompt: string, idea: string) {
    const outputContract = JSON.stringify(
      {
        name: "Reusable scenario name",
        description: "Short explanation of when this scenario should be used.",
        attributes: [
          {
            id: "video-purpose",
            name: "Video Purpose",
            description: "What the video should achieve.",
            options: [
              {
                id: "video-purpose-education",
                name: "Education",
                description: "Use when the video teaches or explains."
              }
            ]
          }
        ]
      },
      null,
      2
    );
    return this.renderOptionalPromptPlaceholders(
      masterPrompt.trim() || DEFAULT_TEMPLATE_SELECTION_PROMPT,
      {
        story: idea,
        attributes: outputContract
      }
    );
  }

  private renderOptionalPromptPlaceholders(template: string, values: Record<string, string>) {
    return Object.entries(values).reduce(
      (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
      template
    );
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
            responseJsonSchema: templateGenerationJsonSchema
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
              name: "video_scenario_template",
              strict: true,
              schema: openAiTemplateGenerationJsonSchema
            }
          }
        }
      };
    }

    throw new AiTemplateGenerationError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate scenarios.`,
      { provider, model }
    );
  }

  private async callTemplateProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    if (this.isGeminiProvider(provider)) {
      return this.callGeminiForTemplateGeneration(model, rawRequest);
    }

    if (this.isOpenAiProvider(provider)) {
      return this.callOpenAiForTemplateGeneration(model, rawRequest);
    }

    throw new AiTemplateGenerationError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate scenarios.`,
      { provider, model },
      rawRequest
    );
  }

  private async callGeminiForTemplateGeneration(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiTemplateGenerationError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} scenario generation. Save a provider key or set ${resolvedKey.envName}.`,
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
      const isRateLimited = response.status === 429;
      throw new AiTemplateGenerationError(
        isRateLimited ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        isRateLimited
          ? `Gemini scenario generation is rate limited or out of quota (status ${response.status}).`
          : `Gemini scenario generation failed with status ${response.status}.`,
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

    const text = this.extractGeminiText(providerPayload, "scenario generation");
    return this.parseTemplateGenerationJson(text, rawRequest.provider, model, rawRequest, providerPayload);
  }

  private async callOpenAiForTemplateGeneration(model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(rawRequest.provider);
    const apiKey = resolvedKey.apiKey;
    if (!apiKey) {
      throw new AiTemplateGenerationError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${rawRequest.provider} scenario generation. Save a provider key or set ${resolvedKey.envName}.`,
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
      const isRateLimited = response.status === 429;
      throw new AiTemplateGenerationError(
        isRateLimited ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        isRateLimited
          ? `ChatGPT scenario generation is rate limited or out of quota (status ${response.status}).`
          : `ChatGPT scenario generation failed with status ${response.status}.`,
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

    const text = this.extractOpenAiText(providerPayload, "scenario generation");
    return this.parseTemplateGenerationJson(text, rawRequest.provider, model, rawRequest, providerPayload);
  }

  private parseTemplateGenerationJson(
    text: string,
    provider: Provider,
    model: string,
    rawRequest: ProviderRequest,
    providerPayload: unknown
  ) {
    const rawResponse = this.parseProviderJson(text, provider, model, rawRequest, providerPayload);
    const candidate = this.unwrapTemplateCandidate(rawResponse);
    const parsed = aiTemplateGenerationSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new AiTemplateGenerationError(
        "AI_PROVIDER_FAILED",
        "AI returned JSON that does not match the Scenario template contract.",
        { provider, model, issues: parsed.error.issues },
        rawRequest,
        rawResponse
      );
    }
    return parsed.data;
  }

  private unwrapTemplateCandidate(rawResponse: unknown) {
    const record = this.toRecord(rawResponse);
    if (Array.isArray(record.attributes)) {
      return rawResponse;
    }
    if (record.template) {
      return record.template;
    }
    if (record.scenario) {
      return record.scenario;
    }
    if (record.videoTemplate) {
      return record.videoTemplate;
    }
    return rawResponse;
  }

  private normalizeAiTemplate(rawResponse: ParsedProviderTemplate, rawRequest: ProviderRequest) {
    const name = this.cleanText(rawResponse.name, "");
    const description = this.cleanText(rawResponse.description, "");

    if (!name) {
      throw new AiTemplateGenerationError(
        "AI_PROVIDER_FAILED",
        "AI scenario response is missing a scenario name.",
        { provider: rawRequest.provider, model: rawRequest.model },
        rawRequest,
        rawResponse
      );
    }

    const usedAttributeIds = new Set<string>();
    const attributes = rawResponse.attributes
      .map((attribute, attributeIndex) => {
        const attributeName = this.cleanText(attribute.name, "");
        if (!attributeName) {
          return null;
        }

        const attributeId = this.uniqueIdentifier(
          this.cleanText(attribute.id, attributeName),
          `attribute-${attributeIndex + 1}`,
          usedAttributeIds
        );
        const usedOptionIds = new Set<string>();
        const options = attribute.options
          .map((option, optionIndex) =>
            this.normalizeAiTemplateOption(option, attributeId, optionIndex, usedOptionIds)
          )
          .filter((option): option is TemplateOption => Boolean(option));

        if (options.length === 0) {
          return null;
        }

        const normalizedAttribute: TemplateAttribute = {
          id: attributeId,
          name: attributeName,
          ...(this.cleanText(attribute.description, "")
            ? { description: this.cleanText(attribute.description, "") }
            : {}),
          options
        };
        return normalizedAttribute;
      })
      .filter((attribute): attribute is TemplateAttribute => Boolean(attribute));

    const validated = TemplateAttributeSchema.array().min(1).safeParse(attributes);
    if (!validated.success) {
      throw new AiTemplateGenerationError(
        "AI_PROVIDER_FAILED",
        "AI scenario response has invalid attributes or options.",
        { provider: rawRequest.provider, model: rawRequest.model, issues: validated.error.issues },
        rawRequest,
        rawResponse
      );
    }

    return {
      name,
      description: description || null,
      attributes: validated.data
    };
  }

  private normalizeAiTemplateOption(
    option: ParsedProviderTemplate["attributes"][number]["options"][number],
    attributeId: string,
    optionIndex: number,
    usedOptionIds: Set<string>
  ): TemplateOption | null {
    const label =
      this.cleanText(option.name, "") ||
      this.cleanText(option.label, "") ||
      this.cleanText(option.value, "");
    if (!label) {
      return null;
    }
    const value = this.cleanText(option.value, label);
    const optionId = this.uniqueIdentifier(
      this.cleanText(option.id, `${attributeId}-${label}`),
      `${attributeId}-option-${optionIndex + 1}`,
      usedOptionIds
    );
    const description = this.cleanText(option.description, "");

    return {
      id: optionId,
      label,
      value,
      ...(description ? { description } : {})
    };
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
      throw new AiTemplateGenerationError(
        "AI_PROVIDER_FAILED",
        `Gemini did not return JSON text for ${operation}.`,
        { provider: "gemini" },
        undefined,
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
      throw new AiTemplateGenerationError(
        "AI_PROVIDER_FAILED",
        `ChatGPT did not return JSON text for ${operation}.`,
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
    rawRequest: ProviderRequest,
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

    throw new AiTemplateGenerationError(
      "AI_PROVIDER_FAILED",
      "AI returned invalid JSON for scenario generation.",
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

  private isGeminiProvider(provider: Provider) {
    return provider === "gemini" || provider === "google";
  }

  private isOpenAiProvider(provider: Provider) {
    return provider === "chatgpt" || provider === "openai";
  }

  private cleanText(value: unknown, fallback: string) {
    if (typeof value !== "string") {
      return fallback;
    }
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed || fallback;
  }

  private uniqueIdentifier(value: string, fallback: string, used: Set<string>) {
    const base = this.slug(value || fallback);
    let candidate = base;
    let index = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${index}`;
      index += 1;
    }
    used.add(candidate);
    return candidate;
  }

  private slug(value: string) {
    return (
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "item"
    );
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private toApiError(error: unknown): ApiError {
    if (error instanceof AiTemplateGenerationError) {
      return {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {})
      };
    }

    return {
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Scenario generation failed."
    };
  }

  private toBadRequestException(apiError: ApiError, requestId: string) {
    return new BadRequestException({
      error: {
        ...apiError,
        details: {
          ...(apiError.details ?? {}),
          requestId
        }
      },
      meta: { requestId }
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
