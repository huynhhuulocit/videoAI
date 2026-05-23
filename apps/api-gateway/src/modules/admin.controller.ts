import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { prisma } from "@videoai/database";
import {
  CreateMasterPromptRequestSchema,
  DEFAULT_SHOT_GENERATION_PROMPT,
  DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
  DEFAULT_SINGLE_SHOT_MASTER_PROMPT,
  DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT,
  DEFAULT_SCRIPT_GENERATION_PROMPT,
  DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
  DEFAULT_TEMPLATE_SELECTION_PROMPT,
  DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
  RotateProviderKeyRequestSchema,
  SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS,
  SHOT_PROMPT_REQUIRED_PLACEHOLDERS,
  TestProviderConnectionRequestSchema,
  UpdateAiConfigRequestSchema,
  UpdateMasterPromptRequestSchema,
  UpdateMasterPromptAttributeConfigRequestSchema,
  UpdateShotPromptRequestSchema
} from "@videoai/contracts";
import {
  archiveMasterPrompt,
  createMasterPrompt,
  getDefaultMasterPrompt,
  getDefaultMasterPromptContent,
  getConfiguredDefaultMasterPrompt,
  getActiveAiConfig,
  getMasterPromptConfig,
  getMasterPromptAttributeConfig,
  mapAiLog,
  mapAiLogDetail,
  markProviderKeyConfigured,
  replaceMasterPromptAttributeConfig,
  replaceActiveAiConfig,
  renderMasterPromptText,
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
    let config = await replaceActiveAiConfig(body);
    if (body.promptApiKey) {
      await markProviderKeyConfigured(body.promptProvider, body.promptApiKey);
    }
    if (body.videoApiKey) {
      await markProviderKeyConfigured(body.videoProvider, body.videoApiKey);
    }
    if (body.promptApiKey || body.videoApiKey) {
      config = await getActiveAiConfig();
    }
    return ok(config);
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

  @Get("master-prompt-config")
  async getMasterPromptConfigAttributes() {
    return ok(await getMasterPromptAttributeConfig());
  }

  @Patch("master-prompt-config")
  async patchMasterPromptConfigAttributes(@Body() rawBody: unknown) {
    const body = UpdateMasterPromptAttributeConfigRequestSchema.parse(rawBody);
    return ok(await this.runAdminMutation(() => replaceMasterPromptAttributeConfig(body)));
  }

  @Post("master-prompts")
  async postMasterPrompt(@Body() rawBody: unknown) {
    const body = CreateMasterPromptRequestSchema.parse(rawBody);
    return ok(await this.runAdminMutation(() => createMasterPrompt({
      type: body.type,
      name: body.name,
      content: body.content,
      ...(body.outputFormat !== undefined ? { outputFormat: body.outputFormat } : {}),
      ...(body.attributeSelection !== undefined ? { attributeSelection: body.attributeSelection } : {}),
      ...(body.workflowAttributeSelection !== undefined
        ? { workflowAttributeSelection: body.workflowAttributeSelection }
        : {})
    })));
  }

  @Patch("master-prompts/:promptId")
  async patchMasterPrompt(@Param("promptId") promptId: string, @Body() rawBody: unknown) {
    const body = UpdateMasterPromptRequestSchema.parse(rawBody);
    if (
      body.name === undefined &&
      body.content === undefined &&
      body.outputFormat === undefined &&
      body.attributeSelection === undefined &&
      body.workflowAttributeSelection === undefined
    ) {
      throw new BadRequestException("At least one master prompt field is required.");
    }
    return ok(await this.runAdminMutation(() => updateMasterPrompt(promptId, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.outputFormat !== undefined ? { outputFormat: body.outputFormat } : {}),
      ...(body.attributeSelection !== undefined ? { attributeSelection: body.attributeSelection } : {}),
      ...(body.workflowAttributeSelection !== undefined
        ? { workflowAttributeSelection: body.workflowAttributeSelection }
        : {})
    })));
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
    const scriptsPrompt = await getDefaultMasterPrompt("scripts");
    const shotPrompt = await getConfiguredDefaultMasterPrompt("shot");
    if (!shotPrompt) {
      throw new BadRequestException("Active Shot master prompt is required before using Step 4 shot prompts.");
    }
    const renderedShotsPrompt = await getDefaultMasterPromptContent("shots", config.shotGenerationPrompt);
    const renderedScenarioPrompt = await getDefaultMasterPromptContent("scenario", config.templateSelectionPrompt);
    const renderedScriptsPrompt = await getDefaultMasterPromptContent("scripts");
    const renderedShotPrompt = await renderMasterPromptText(shotPrompt);

    return ok({
      prompt: renderedShotsPrompt,
      defaultPrompt: DEFAULT_SHOT_GENERATION_PROMPT,
      outputFormat: shotsPrompt.outputFormat,
      defaultOutputFormat: DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
      requiredPlaceholders: [...SHOT_PROMPT_REQUIRED_PLACEHOLDERS],
      isDefault: shotsPrompt.isBuiltIn,
      shotPrompt: renderedShotPrompt,
      defaultShotPrompt: DEFAULT_SINGLE_SHOT_MASTER_PROMPT,
      shotOutputFormat: shotPrompt.outputFormat,
      defaultShotOutputFormat: DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT,
      shotPromptIsDefault: false,
      composerPrompt: config.shotComposerPrompt ?? DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      defaultComposerPrompt: DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      composerRequiredPlaceholders: [...SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS],
      composerIsDefault: !config.shotComposerPrompt,
      scenarioAnalysisPrompt: renderedScenarioPrompt,
      scenarioAnalysisOutputFormat: scenarioPrompt.outputFormat,
      defaultScenarioAnalysisPrompt: DEFAULT_TEMPLATE_SELECTION_PROMPT,
      defaultScenarioAnalysisOutputFormat: DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
      scenarioAnalysisIsDefault: scenarioPrompt.isBuiltIn,
      scriptGenerationPrompt: renderedScriptsPrompt,
      scriptGenerationOutputFormat: scriptsPrompt.outputFormat,
      defaultScriptGenerationPrompt: DEFAULT_SCRIPT_GENERATION_PROMPT,
      defaultScriptGenerationOutputFormat: DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
      scriptGenerationIsDefault: scriptsPrompt.isBuiltIn,
      showUserMasterPrompts: config.showUserMasterPrompts,
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

    const shotPrompt = await getConfiguredDefaultMasterPrompt("shot");
    if (!shotPrompt) {
      throw new BadRequestException("Active Shot master prompt is required before using Step 4 shot prompts.");
    }

    return ok({
      prompt: config.shotGenerationPrompt ?? DEFAULT_SHOT_GENERATION_PROMPT,
      defaultPrompt: DEFAULT_SHOT_GENERATION_PROMPT,
      outputFormat: DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
      defaultOutputFormat: DEFAULT_SHOT_GENERATION_OUTPUT_FORMAT,
      requiredPlaceholders: [...SHOT_PROMPT_REQUIRED_PLACEHOLDERS],
      isDefault: false,
      shotPrompt: await renderMasterPromptText(shotPrompt),
      defaultShotPrompt: DEFAULT_SINGLE_SHOT_MASTER_PROMPT,
      shotOutputFormat: shotPrompt.outputFormat,
      defaultShotOutputFormat: DEFAULT_SINGLE_SHOT_OUTPUT_FORMAT,
      shotPromptIsDefault: false,
      composerPrompt: config.shotComposerPrompt ?? DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      defaultComposerPrompt: DEFAULT_SHOT_PROMPT_COMPOSER_PROMPT,
      composerRequiredPlaceholders: [...SHOT_PROMPT_COMPOSER_REQUIRED_PLACEHOLDERS],
      composerIsDefault: false,
      scenarioAnalysisPrompt: config.templateSelectionPrompt ?? DEFAULT_TEMPLATE_SELECTION_PROMPT,
      scenarioAnalysisOutputFormat: DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
      defaultScenarioAnalysisPrompt: DEFAULT_TEMPLATE_SELECTION_PROMPT,
      defaultScenarioAnalysisOutputFormat: DEFAULT_TEMPLATE_SELECTION_OUTPUT_FORMAT,
      scenarioAnalysisIsDefault: !config.templateSelectionPrompt?.trim(),
      scriptGenerationPrompt: await getDefaultMasterPromptContent("scripts"),
      scriptGenerationOutputFormat: DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
      defaultScriptGenerationPrompt: DEFAULT_SCRIPT_GENERATION_PROMPT,
      defaultScriptGenerationOutputFormat: DEFAULT_SCRIPT_GENERATION_OUTPUT_FORMAT,
      scriptGenerationIsDefault: false,
      showUserMasterPrompts: config.showUserMasterPrompts,
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

  private async runAdminMutation<T>(mutation: () => Promise<T>) {
    try {
      return await mutation();
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error instanceof Error ? error.message : "Admin request is invalid.");
    }
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
