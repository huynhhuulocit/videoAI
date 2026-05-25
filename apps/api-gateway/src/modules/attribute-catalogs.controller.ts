import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { prisma, type Prisma } from "@videoai/database";
import { z } from "zod";
import {
  AttributeCatalogAttributeSchema,
  AttributeCatalogTypeSchema,
  CreateAttributeCatalogRequestSchema,
  GenerateAttributeCatalogRequestSchema,
  UpdateAttributeCatalogRequestSchema,
  UpdateAttributeGenerationPromptRequestSchema,
  type ApiError,
  type ApiErrorCode,
  type AttributeCatalog,
  type AttributeCatalogAttribute,
  type AttributeCatalogType,
  type Provider
} from "@videoai/contracts";
import {
  defaultAdminId,
  enforceSingleDefaultAttributeCatalog,
  getActiveAiConfig,
  getDefaultAttributeCatalog,
  mapAttributeCatalog,
  normalizeAttributeCatalogAttributes,
  resolveProviderApiKey
} from "./db-store.js";
import { readDataExample } from "./data-examples.js";
import { ok } from "./response.js";

const attributeJsonSchema = {
  type: "object",
  properties: {
    attributes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          required: { type: "boolean" },
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
        required: ["id", "name", "description", "required", "options"]
      }
    }
  },
  required: ["attributes"]
} as const;

const openAiAttributeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    attributes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          required: { type: "boolean" },
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
        required: ["id", "name", "description", "required", "options"]
      }
    }
  },
  required: ["attributes"]
} as const;

type ProviderRequest = {
  provider: Provider;
  model: string;
  method: "POST";
  url: string;
  headers: Record<string, string>;
  body: unknown;
};

class AttributeGenerationError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly rawResponse?: unknown
  ) {
    super(message);
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function renderOptionalPromptPlaceholders(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (rendered, [key, value]) => rendered.replaceAll(`{${key}}`, value),
    template
  );
}

function normalizeGeneratedAttributes(value: unknown): AttributeCatalogAttribute[] {
  const root = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const attributesInput = Array.isArray(value)
    ? value
    : Array.isArray(root.attributes)
      ? root.attributes
      : null;

  if (!attributesInput) {
    throw new AttributeGenerationError(
      "AI_PROVIDER_FAILED",
      "AI returned JSON without an attributes array."
    );
  }

  const normalized = attributesInput
    .map((attributeInput, attributeIndex): AttributeCatalogAttribute | null => {
      const attribute = attributeInput && typeof attributeInput === "object"
        ? attributeInput as Record<string, unknown>
        : {};
      const id = String(attribute.id ?? `attribute-${attributeIndex + 1}`).trim();
      const name = String(attribute.name ?? attribute.label ?? "").trim();
      if (!id || !name) {
        return null;
      }
      const optionsInput = Array.isArray(attribute.options) ? attribute.options : [];
      const options = optionsInput
        .map((optionInput, optionIndex) => {
          const option = optionInput && typeof optionInput === "object"
            ? optionInput as Record<string, unknown>
            : {};
          const optionName = String(option.name ?? option.label ?? option.value ?? "").trim();
          if (!optionName) {
            return null;
          }
          return {
            id: String(option.id ?? `${id}-option-${optionIndex + 1}`).trim(),
            name: optionName,
            ...(option.description ? { description: String(option.description).trim() } : {})
          };
        })
        .filter((option): option is { id: string; name: string; description?: string } => Boolean(option));

      if (options.length === 0) {
        return null;
      }

      return {
        id,
        name,
        ...(attribute.description ? { description: String(attribute.description).trim() } : {}),
        required: Boolean(attribute.required),
        options
      };
    })
    .filter((attribute): attribute is AttributeCatalogAttribute => Boolean(attribute));

  const parsed = AttributeCatalogAttributeSchema.array().min(1).safeParse(normalized);
  if (!parsed.success) {
    throw new AttributeGenerationError(
      "AI_PROVIDER_FAILED",
      "AI returned attributes that do not match the catalog contract.",
      { issues: parsed.error.issues }
    );
  }
  return normalizeAttributeCatalogAttributes(parsed.data);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof AttributeGenerationError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {})
    };
  }
  if (error instanceof Error) {
    return {
      code: "AI_PROVIDER_FAILED",
      message: error.message
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "Attribute catalog generation failed."
  };
}

function toBadRequestException(error: ApiError, requestId?: string) {
  return new BadRequestException({
    error,
    meta: requestId ? { requestId } : undefined
  });
}

async function listCatalogs(type: AttributeCatalogType) {
  await enforceSingleDefaultAttributeCatalog(type);
  if (type === "story") {
    return (await prisma.storyAttributeCatalog.findMany({
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    })).map((row) => mapAttributeCatalog(type, row));
  }
  if (type === "scenario") {
    return (await prisma.scenarioAttributeCatalog.findMany({
      where: { status: "active" },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    })).map((row) => mapAttributeCatalog(type, row));
  }
  return (await prisma.shotAttributeCatalog.findMany({
    where: { type, status: "active" },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
  })).map((row) => mapAttributeCatalog(type, row));
}

async function findCatalog(type: AttributeCatalogType, id: string) {
  if (type === "story") {
    const row = await prisma.storyAttributeCatalog.findFirst({ where: { id, status: "active" } });
    return row ? mapAttributeCatalog(type, row) : null;
  }
  if (type === "scenario") {
    const row = await prisma.scenarioAttributeCatalog.findFirst({ where: { id, status: "active" } });
    return row ? mapAttributeCatalog(type, row) : null;
  }
  const row = await prisma.shotAttributeCatalog.findFirst({ where: { id, type, status: "active" } });
  return row ? mapAttributeCatalog(type, row) : null;
}

async function createCatalog(input: {
  type: AttributeCatalogType;
  name: string;
  description?: string | undefined;
  attributes: AttributeCatalogAttribute[];
}) {
  const type = input.type;
  if (type === "story") {
    return prisma.$transaction(async (tx) => {
      const count = await tx.storyAttributeCatalog.count({ where: { status: "active" } });
      const row = await tx.storyAttributeCatalog.create({
        data: {
          id: `story_attr_${Date.now()}`,
          name: input.name,
          description: input.description ?? null,
          attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)),
          isDefault: count === 0,
          status: "active",
          createdByAdminId: defaultAdminId
        }
      });
      return mapAttributeCatalog(type, row);
    });
  }
  if (type === "scenario") {
    return prisma.$transaction(async (tx) => {
      const count = await tx.scenarioAttributeCatalog.count({ where: { status: "active" } });
      const row = await tx.scenarioAttributeCatalog.create({
        data: {
          id: `scenario_attr_${Date.now()}`,
          name: input.name,
          description: input.description ?? null,
          attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)),
          isDefault: count === 0,
          status: "active",
          createdByAdminId: defaultAdminId
        }
      });
      return mapAttributeCatalog(type, row);
    });
  }
  return prisma.$transaction(async (tx) => {
    const count = await tx.shotAttributeCatalog.count({ where: { type, status: "active" } });
    const row = await tx.shotAttributeCatalog.create({
      data: {
        id: `${type}_attr_${Date.now()}`,
        type,
        name: input.name,
        description: input.description ?? null,
        attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)),
        isDefault: count === 0,
        status: "active",
        createdByAdminId: defaultAdminId
      }
    });
    return mapAttributeCatalog(type, row);
  });
}

async function updateCatalog(
  type: AttributeCatalogType,
  id: string,
  input: {
    name?: string | undefined;
    description?: string | undefined;
    attributes?: AttributeCatalogAttribute[] | undefined;
  }
) {
  if (type === "story") {
    const row = await prisma.storyAttributeCatalog.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.attributes !== undefined
          ? { attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)) }
          : {})
      }
    });
    return mapAttributeCatalog(type, row);
  }
  if (type === "scenario") {
    const row = await prisma.scenarioAttributeCatalog.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.attributes !== undefined
          ? { attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)) }
          : {})
      }
    });
    return mapAttributeCatalog(type, row);
  }
  const row = await prisma.shotAttributeCatalog.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.attributes !== undefined
        ? { attributes: toJson(normalizeAttributeCatalogAttributes(input.attributes)) }
        : {})
    }
  });
  return mapAttributeCatalog(type, row);
}

async function archiveCatalog(type: AttributeCatalogType, id: string) {
  const catalog = await findCatalog(type, id);
  if (!catalog) {
    return { archived: false };
  }
  if (catalog.isDefault) {
    throw new BadRequestException("Cannot delete the default attribute catalog. Set another catalog as default first.");
  }
  if (type === "story") {
    await prisma.storyAttributeCatalog.update({ where: { id }, data: { status: "archived" } });
  } else if (type === "scenario") {
    await prisma.scenarioAttributeCatalog.update({ where: { id }, data: { status: "archived" } });
  } else {
    await prisma.shotAttributeCatalog.update({ where: { id }, data: { status: "archived" } });
  }
  return { archived: true };
}

async function setDefaultCatalog(type: AttributeCatalogType, id: string) {
  if (type === "story") {
    return prisma.$transaction(async (tx) => {
      await tx.storyAttributeCatalog.updateMany({ where: { status: "active" }, data: { isDefault: false } });
      const row = await tx.storyAttributeCatalog.update({ where: { id }, data: { isDefault: true } });
      return mapAttributeCatalog(type, row);
    });
  }
  if (type === "scenario") {
    return prisma.$transaction(async (tx) => {
      await tx.scenarioAttributeCatalog.updateMany({ where: { status: "active" }, data: { isDefault: false } });
      const row = await tx.scenarioAttributeCatalog.update({ where: { id }, data: { isDefault: true } });
      return mapAttributeCatalog(type, row);
    });
  }
  return prisma.$transaction(async (tx) => {
    await tx.shotAttributeCatalog.updateMany({ where: { type, status: "active" }, data: { isDefault: false } });
    const row = await tx.shotAttributeCatalog.update({ where: { id }, data: { isDefault: true } });
    return mapAttributeCatalog(type, row);
  });
}

@Controller("attribute-catalogs")
export class AttributeCatalogsController {
  @Get(":type/default")
  async getDefault(@Param("type") rawType: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    return ok(await getDefaultAttributeCatalog(type));
  }
}

@Controller("admin/attribute-catalogs")
export class AdminAttributeCatalogsController {
  @Get()
  async list(@Query("type") rawType: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    const catalogs = await listCatalogs(type);
    return ok({
      type,
      catalogs,
      defaultCatalog: catalogs.find((catalog) => catalog.isDefault) ?? null,
      updatedAt: catalogs[0]?.updatedAt ?? new Date().toISOString()
    });
  }

  @Post()
  async create(@Body() rawBody: unknown) {
    const body = CreateAttributeCatalogRequestSchema.parse(rawBody);
    return ok(await createCatalog(body));
  }

  @Get(":type/:catalogId")
  async get(@Param("type") rawType: string, @Param("catalogId") catalogId: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    return ok(await findCatalog(type, catalogId));
  }

  @Patch(":type/:catalogId")
  async patch(
    @Param("type") rawType: string,
    @Param("catalogId") catalogId: string,
    @Body() rawBody: unknown
  ) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    const body = UpdateAttributeCatalogRequestSchema.parse(rawBody);
    if (body.name === undefined && body.description === undefined && body.attributes === undefined) {
      throw new BadRequestException("At least one attribute catalog field is required.");
    }
    return ok(await updateCatalog(type, catalogId, body));
  }

  @Delete(":type/:catalogId")
  async delete(@Param("type") rawType: string, @Param("catalogId") catalogId: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    return ok(await archiveCatalog(type, catalogId));
  }

  @Post(":type/:catalogId/default")
  async setDefault(@Param("type") rawType: string, @Param("catalogId") catalogId: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    return ok(await setDefaultCatalog(type, catalogId));
  }

  @Post(":type/generate")
  async generate(@Param("type") rawType: string, @Body() rawBody: unknown) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    const body = GenerateAttributeCatalogRequestSchema.parse(rawBody);
    const startedAt = Date.now();
    const config = await getActiveAiConfig();
    const provider = config.promptProvider;
    const model = config.promptModel;
    const requestId = `ai_req_attribute_${Date.now()}`;
    const configuredPrompt = body.prompt?.trim() || (await getAttributeGenerationPromptContent(type));
    if (!configuredPrompt) {
      throw toBadRequestException({
        code: "AI_CONFIG_MISSING",
        message: `${type} Attribute Generation Prompt is required before generating attributes.`
      }, requestId);
    }
    const dataExample = await readDataExample(type);
    const renderedOutputFormat = renderOptionalPromptPlaceholders(
      dataExample.attributeOutputFormat,
      { attributeJsonFormat: dataExample.attributeJsonFormat }
    );
    const prompt = renderOptionalPromptPlaceholders(configuredPrompt, {
      inputText: body.inputText,
      attributeJsonFormat: dataExample.attributeJsonFormat,
      outputFormat: renderedOutputFormat
    });
    const rawRequest = this.buildProviderRequest(provider, model, prompt);

    const requestLog = await prisma.aiRequestLog.create({
      data: {
        requestId,
        actorUserId: defaultAdminId,
        actorRole: "admin",
        projectId: null,
        flowType: "attribute_generation",
        provider,
        model,
        requestPayload: toJson({ type, inputText: body.inputText, rawRequest }),
        mediaReferences: toJson([]),
        status: "pending"
      }
    });

    try {
      const rawResponse = await this.callProvider(provider, model, rawRequest);
      const attributes = normalizeGeneratedAttributes(rawResponse);
      await prisma.$transaction(async (tx) => {
        await tx.aiRequestLog.update({
          where: { id: requestLog.id },
          data: { status: "success", completedAt: new Date() }
        });
        await tx.aiResponseLog.create({
          data: {
            requestLogId: requestLog.id,
            responsePayload: toJson({ rawRequest, rawResponse, attributes }),
            latencyMs: Date.now() - startedAt
          }
        });
      });
      return ok({ type, attributes, rawRequest, rawResponse, provider, model }, requestId);
    } catch (error) {
      const apiError = toApiError(error);
      const rawResponse = error instanceof AttributeGenerationError ? error.rawResponse : undefined;
      await prisma.$transaction(async (tx) => {
        await tx.aiRequestLog.update({
          where: { id: requestLog.id },
          data: { status: "failed", completedAt: new Date() }
        });
        await tx.aiResponseLog.create({
          data: {
            requestLogId: requestLog.id,
            responsePayload: toJson({ rawRequest, rawResponse: rawResponse ?? {} }),
            errorCode: apiError.code,
            errorMessage: apiError.message,
            latencyMs: Date.now() - startedAt
          }
        });
      });
      throw toBadRequestException(apiError, requestId);
    }
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
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: attributeJsonSchema
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
              name: "attribute_catalog",
              strict: true,
              schema: openAiAttributeJsonSchema
            }
          }
        }
      };
    }
    throw new AttributeGenerationError(
      "AI_PROVIDER_FAILED",
      `Provider ${provider} cannot generate attribute catalogs.`,
      { provider, model }
    );
  }

  private async callProvider(provider: Provider, model: string, rawRequest: ProviderRequest) {
    const resolvedKey = await resolveProviderApiKey(provider);
    if (!resolvedKey.apiKey) {
      throw new AttributeGenerationError(
        "AI_CONFIG_MISSING",
        `Missing API key for ${provider} attribute generation. Save a provider key in Admin > AI Config.`,
        { provider, model },
        rawRequest
      );
    }
    const headers = { ...rawRequest.headers };
    if (this.isGeminiProvider(provider)) {
      headers["x-goog-api-key"] = resolvedKey.apiKey;
    }
    if (this.isOpenAiProvider(provider)) {
      headers.authorization = `Bearer ${resolvedKey.apiKey}`;
    }
    const response = await fetch(rawRequest.url, {
      method: "POST",
      headers,
      body: JSON.stringify(rawRequest.body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new AttributeGenerationError(
        response.status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_FAILED",
        `${provider} attribute generation failed with status ${response.status}.`,
        { provider, model, status: response.status },
        payload
      );
    }
    const text = this.isGeminiProvider(provider)
      ? this.extractGeminiText(payload)
      : this.extractOpenAiText(payload);
    return this.parseProviderJson(text, provider, model);
  }

  private extractGeminiText(payload: unknown) {
    const parsed = z.object({
      candidates: z.array(z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string().optional() }))
        })
      })).optional()
    }).safeParse(payload);
    const text = parsed.success
      ? parsed.data.candidates?.flatMap((candidate) => candidate.content.parts)
        .map((part) => part.text ?? "")
        .join("")
        .trim()
      : "";
    if (!text) {
      throw new AttributeGenerationError("AI_PROVIDER_FAILED", "AI returned an empty attribute generation response.", {}, payload);
    }
    return text;
  }

  private extractOpenAiText(payload: unknown) {
    const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const outputText = typeof root.output_text === "string" ? root.output_text : "";
    if (outputText.trim()) {
      return outputText.trim();
    }
    const output = Array.isArray(root.output) ? root.output : [];
    const text = output.flatMap((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const content = Array.isArray(record.content) ? record.content : [];
      return content.map((contentItem) => {
        const contentRecord = contentItem && typeof contentItem === "object"
          ? contentItem as Record<string, unknown>
          : {};
        return typeof contentRecord.text === "string" ? contentRecord.text : "";
      });
    }).join("").trim();
    if (!text) {
      throw new AttributeGenerationError("AI_PROVIDER_FAILED", "AI returned an empty attribute generation response.", {}, payload);
    }
    return text;
  }

  private parseProviderJson(text: string, provider: Provider, model: string) {
    try {
      const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
      return JSON.parse(cleaned);
    } catch {
      throw new AttributeGenerationError(
        "AI_PROVIDER_FAILED",
        "AI returned invalid JSON for attribute generation.",
        { provider, model },
        { text }
      );
    }
  }

  private isGeminiProvider(provider: string) {
    return provider === "gemini" || provider === "google";
  }

  private isOpenAiProvider(provider: string) {
    return provider === "chatgpt" || provider === "openai";
  }
}

@Controller("admin/attribute-generation-prompts")
export class AdminAttributeGenerationPromptsController {
  @Get(":type")
  async get(@Param("type") rawType: string) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    const row = await prisma.attributeGenerationPrompt.findUnique({ where: { type } });
    return ok({
      type,
      content: row?.content ?? "",
      updatedAt: row?.updatedAt.toISOString() ?? null
    });
  }

  @Patch(":type")
  async patch(@Param("type") rawType: string, @Body() rawBody: unknown) {
    const type = AttributeCatalogTypeSchema.parse(rawType);
    const body = UpdateAttributeGenerationPromptRequestSchema.parse(rawBody);
    const row = await prisma.attributeGenerationPrompt.upsert({
      where: { type },
      update: {
        content: body.content,
        createdByAdminId: defaultAdminId
      },
      create: {
        type,
        content: body.content,
        createdByAdminId: defaultAdminId
      }
    });
    return ok({
      type,
      content: row.content,
      updatedAt: row.updatedAt.toISOString()
    });
  }
}

async function getAttributeGenerationPromptContent(type: AttributeCatalogType) {
  const row = await prisma.attributeGenerationPrompt.findUnique({ where: { type } });
  return row?.content.trim() ?? "";
}
