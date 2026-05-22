import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { prisma } from "@videoai/database";
import {
  CreateMasterPromptRequestSchema,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  RotateProviderKeyRequestSchema,
  SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS,
  SHOT_PROMPT_REQUIRED_PLACEHOLDERS,
  TestProviderConnectionRequestSchema,
  UpdateAiConfigRequestSchema,
  UpdateMasterPromptRequestSchema,
  UpdateShotPromptRequestSchema
} from "@videoai/contracts";
import {
  archiveMasterPrompt,
  createMasterPrompt,
  getDefaultMasterPrompt,
  getActiveAiConfig,
  getMasterPromptConfig,
  mapAiLog,
  mapAiLogDetail,
  markProviderKeyConfigured,
  replaceActiveAiConfig,
  resolveProviderApiKey,
  setDefaultMasterPrompt,
  updateMasterPrompt
} from "./db-store.js";
import { ok } from "./response.js";

@Controller("admin")
export class AdminController {
  @Get("ai-config")
  async getAiConfig() {
    return ok(await getActiveAiConfig());
  }

  @Put("ai-config")
  async putAiConfig(@Body() rawBody: unknown) {
    const body = UpdateAiConfigRequestSchema.parse(rawBody);
    return ok(await replaceActiveAiConfig(body));
  }

  @Put("ai-config/provider-keys/:provider")
  async putProviderKey(@Param("provider") provider: string, @Body() rawBody: unknown) {
    const body = RotateProviderKeyRequestSchema.parse(rawBody);
    return ok(await markProviderKeyConfigured(provider, body.apiKey));
  }

  @Post("ai-config/test-connection")
  async testProviderConnection(@Body() rawBody: unknown) {
    const body = TestProviderConnectionRequestSchema.parse(rawBody);
    const resolvedKey = await resolveProviderApiKey(body.provider, body.apiKey);

    if (!resolvedKey.apiKey) {
      return ok({
        provider: body.provider,
        model: body.model,
        status: "failed" as const,
        keySource: resolvedKey.source,
        message: `Missing API key. Save a key for ${body.provider} in Admin > AI Config.`
      });
    }

    if (this.isOpenAiProvider(body.provider)) {
      return ok(await this.testOpenAiConnection(body.provider, body.model, resolvedKey.apiKey, resolvedKey.source));
    }

    if (this.isGeminiProvider(body.provider)) {
      return ok(await this.testGeminiConnection(body.provider, body.model, resolvedKey.apiKey, resolvedKey.source));
    }

    return ok({
      provider: body.provider,
      model: body.model,
      status: "success" as const,
      keySource: resolvedKey.source,
      message: `Key source is available. No live test adapter is defined for ${body.provider}.`
    });
  }

  @Get("master-prompts")
  async getMasterPrompts() {
    return ok(await getMasterPromptConfig());
  }

  @Post("master-prompts")
  async postMasterPrompt(@Body() rawBody: unknown) {
    const body = CreateMasterPromptRequestSchema.parse(rawBody);
    return ok(await createMasterPrompt(body));
  }

  @Patch("master-prompts/:promptId")
  async patchMasterPrompt(@Param("promptId") promptId: string, @Body() rawBody: unknown) {
    const body = UpdateMasterPromptRequestSchema.parse(rawBody);
    if (body.name === undefined && body.content === undefined) {
      throw new BadRequestException("At least one master prompt field is required.");
    }
    return ok(await updateMasterPrompt(promptId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.content !== undefined ? { content: body.content } : {})
    }));
  }

  @Delete("master-prompts/:promptId")
  async deleteMasterPrompt(@Param("promptId") promptId: string) {
    const result = await archiveMasterPrompt(promptId);
    if (!result.archived) {
      throw new BadRequestException("Cannot delete the default master prompt. Set another prompt as default first.");
    }
    return ok(result);
  }

  @Post("master-prompts/:promptId/default")
  async postMasterPromptDefault(@Param("promptId") promptId: string) {
    return ok(await setDefaultMasterPrompt(promptId));
  }

  @Get("shot-prompt")
  async getShotPrompt() {
    const config = await prisma.aiSiteConfig.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" }
    });

    const shotsPrompt = await getDefaultMasterPrompt("shots", config.shotGenerationPrompt);
    const scenarioPrompt = await getDefaultMasterPrompt("scenario", config.templateSelectionPrompt);

    return ok({
      prompt: shotsPrompt.content,
      defaultPrompt: DEFAULT_SHOT_GENERATION_PROMPT,
      requiredPlaceholders: [...SHOT_PROMPT_REQUIRED_PLACEHOLDERS],
      isDefault: shotsPrompt.isBuiltIn,
      composerPrompt: config.shotComposerPrompt ?? DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      defaultComposerPrompt: DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      composerRequiredPlaceholders: [...SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS],
      composerIsDefault: !config.shotComposerPrompt,
      scenarioAnalysisPrompt: scenarioPrompt.content,
      defaultScenarioAnalysisPrompt: DEFAULT_TEMPLATE_SELECTION_PROMPT,
      scenarioAnalysisIsDefault: scenarioPrompt.isBuiltIn,
      updatedAt: config.updatedAt.toISOString()
    });
  }

  @Patch("shot-prompt")
  async patchShotPrompt(@Body() rawBody: unknown) {
    const body = UpdateShotPromptRequestSchema.parse(rawBody);
    const activeConfig = await prisma.aiSiteConfig.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" }
    });
    const config = await prisma.aiSiteConfig.update({
      where: { id: activeConfig.id },
      data: {
        shotGenerationPrompt: body.prompt,
        shotComposerPrompt: body.composerPrompt,
        templateSelectionPrompt: body.scenarioAnalysisPrompt ?? activeConfig.templateSelectionPrompt
      }
    });

    return ok({
      prompt: config.shotGenerationPrompt ?? DEFAULT_SHOT_GENERATION_PROMPT,
      defaultPrompt: DEFAULT_SHOT_GENERATION_PROMPT,
      requiredPlaceholders: [...SHOT_PROMPT_REQUIRED_PLACEHOLDERS],
      isDefault: false,
      composerPrompt: config.shotComposerPrompt ?? DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      defaultComposerPrompt: DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      composerRequiredPlaceholders: [...SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS],
      composerIsDefault: false,
      scenarioAnalysisPrompt: config.templateSelectionPrompt ?? DEFAULT_TEMPLATE_SELECTION_PROMPT,
      defaultScenarioAnalysisPrompt: DEFAULT_TEMPLATE_SELECTION_PROMPT,
      scenarioAnalysisIsDefault: !config.templateSelectionPrompt?.trim(),
      updatedAt: config.updatedAt.toISOString()
    });
  }

  @Get("ai-logs")
  async getAiLogs() {
    const logs = await prisma.aiRequestLog.findMany({
      include: {
        responses: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    });
    return ok(logs.map(mapAiLog));
  }

  @Get("ai-logs/:requestId")
  async getAiLog(@Param("requestId") requestId: string) {
    const log = await prisma.aiRequestLog.findUnique({
      where: { requestId },
      include: {
        responses: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
    return ok(log ? mapAiLogDetail(log) : null);
  }

  private isOpenAiProvider(provider: string) {
    return provider === "chatgpt" || provider === "openai";
  }

  private isGeminiProvider(provider: string) {
    return provider === "gemini" || provider === "google";
  }

  private async testOpenAiConnection(
    provider: string,
    model: string,
    apiKey: string,
    keySource: "input" | "stored" | "env" | "missing"
  ) {
    try {
      const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${apiKey}`
        }
      });

      if (response.ok) {
        return {
          provider,
          model,
          status: "success" as const,
          keySource,
          message: "OpenAI API key and model are reachable."
        };
      }

      return {
        provider,
        model,
        status: "failed" as const,
        keySource,
        message: `OpenAI model check failed with status ${response.status}.`
      };
    } catch (error) {
      return {
        provider,
        model,
        status: "failed" as const,
        keySource,
        message: error instanceof Error ? error.message : "OpenAI connection test failed."
      };
    }
  }

  private async testGeminiConnection(
    provider: string,
    model: string,
    apiKey: string,
    keySource: "input" | "stored" | "env" | "missing"
  ) {
    const modelName = model.trim().replace(/^models\//, "");
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}?key=${encodeURIComponent(apiKey)}`,
        { method: "GET" }
      );

      if (response.ok) {
        return {
          provider,
          model,
          status: "success" as const,
          keySource,
          message: "Gemini API key and model are reachable."
        };
      }

      return {
        provider,
        model,
        status: "failed" as const,
        keySource,
        message: `Gemini model check failed with status ${response.status}.`
      };
    } catch (error) {
      return {
        provider,
        model,
        status: "failed" as const,
        keySource,
        message: error instanceof Error ? error.message : "Gemini connection test failed."
      };
    }
  }
}
