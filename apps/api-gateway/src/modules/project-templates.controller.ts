import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Prisma, prisma } from "@videoai/database";
import {
  CreateProjectTemplateRequestSchema,
  CreateUserProjectTemplateRequestSchema,
  PROJECT_TEMPLATE_STEP_ORDER,
  ProjectTemplateStepKeySchema,
  ProjectTemplateStepsSnapshotSchema,
  UpdateProjectTemplateRequestSchema,
  UpdateUserProjectTemplateRequestSchema,
  type AttributeCatalogType,
  type AttributeCatalog,
  type MasterPromptType,
  type ProjectTemplateSnapshot,
  type ProjectTemplateStepKey,
  type ProjectTemplateStepsSnapshot,
} from "@videoai/contracts";
import {
  defaultAdminId,
  defaultUserId,
  getDefaultAttributeCatalog,
  mapMasterPrompt,
  mapProjectTemplate,
  mapUserProjectTemplate,
} from "./db-store.js";
import { ok } from "./response.js";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function stepToMasterPromptType(step: ProjectTemplateStepKey): MasterPromptType {
  return step === "story" ? "scripts" : step;
}

function stepToAttributeCatalogType(step: ProjectTemplateStepKey): AttributeCatalogType {
  return step;
}

function buildDefaultAttributeSelection(
  type: AttributeCatalogType,
  catalog: AttributeCatalog,
) {
  return {
    catalogId: catalog.id,
    catalogName: catalog.name,
    type,
    attributes: catalog.attributes
      .map((attribute) => {
        const firstOption = attribute.options[0];
        if (!firstOption) {
          return null;
        }
        return {
          id: attribute.id,
          name: attribute.name,
          required: attribute.required,
          selectionMode: "user_selection" as const,
          options: [
            {
              id: firstOption.id,
              name: firstOption.name,
              ...(firstOption.description
                ? { description: firstOption.description }
                : {}),
            },
          ],
        };
      })
      .filter((attribute): attribute is NonNullable<typeof attribute> =>
        Boolean(attribute),
      ),
  };
}

function selectedStepsForFinal(finalStep: ProjectTemplateStepKey) {
  const finalIndex = PROJECT_TEMPLATE_STEP_ORDER.indexOf(finalStep);
  return PROJECT_TEMPLATE_STEP_ORDER.slice(finalIndex);
}

function validateSnapshotSteps(
  finalStep: ProjectTemplateStepKey,
  steps: ProjectTemplateStepsSnapshot,
) {
  const requiredSteps = selectedStepsForFinal(finalStep);
  const requiredSet = new Set<ProjectTemplateStepKey>(requiredSteps);
  const entries = Object.entries(steps) as Array<
    [ProjectTemplateStepKey, ProjectTemplateStepsSnapshot[ProjectTemplateStepKey]]
  >;
  const presentSteps = entries
    .filter(([, value]) => Boolean(value))
    .map(([step]) => step);

  const missing = requiredSteps.filter((step) => !steps[step]);
  if (missing.length > 0) {
    throw new BadRequestException(
      `Project template is missing selected step data: ${missing.join(", ")}.`,
    );
  }

  const extra = presentSteps.filter((step) => !requiredSet.has(step));
  if (extra.length > 0) {
    throw new BadRequestException(
      `Project template includes unselected step data: ${extra.join(", ")}.`,
    );
  }

  for (const step of requiredSteps) {
    const snapshot = steps[step];
    if (!snapshot) {
      continue;
    }
    if (snapshot.step !== step) {
      throw new BadRequestException(
        `Project template step "${step}" has mismatched snapshot key "${snapshot.step}".`,
      );
    }
  }
}

async function getRequiredMasterPromptForStep(input: {
  step: ProjectTemplateStepKey;
  promptId: string | undefined;
}) {
  const type = stepToMasterPromptType(input.step);
  const promptId = input.promptId?.trim();
  if (!promptId) {
    throw new BadRequestException(
      `Selected ${input.step} master prompt is required before creating a Project Template.`,
    );
  }
  const row = await prisma.masterPrompt.findFirst({
    where: {
      id: promptId,
      type,
      status: "active",
    },
  });
  if (!row) {
    throw new BadRequestException(
      `Selected ${input.step} master prompt is missing, archived, or has the wrong type.`,
    );
  }
  return mapMasterPrompt(row);
}

async function buildSelectedPromptSteps(
  finalStep: ProjectTemplateStepKey,
  promptIds: Partial<Record<ProjectTemplateStepKey, string | undefined>>,
) {
  const steps: Partial<ProjectTemplateStepsSnapshot> = {};
  for (const step of selectedStepsForFinal(finalStep)) {
    const [masterPrompt, attributeCatalog] = await Promise.all([
      getRequiredMasterPromptForStep({ step, promptId: promptIds[step] }),
      getDefaultAttributeCatalog(stepToAttributeCatalogType(step)),
    ]);
    if (!attributeCatalog) {
      throw new BadRequestException(
        `Active default ${step} attribute catalog is required before creating a Project Template.`,
      );
    }
    const catalogType = stepToAttributeCatalogType(step);
    steps[step] = {
      step,
      masterPrompt: {
        id: masterPrompt.id,
        name: masterPrompt.name,
        content: masterPrompt.content,
        outputFormat: masterPrompt.outputFormat,
      },
      attributeCatalog: {
        id: attributeCatalog.id,
        name: attributeCatalog.name,
        ...(attributeCatalog.description
          ? { description: attributeCatalog.description }
          : {}),
        attributes: attributeCatalog.attributes,
      },
      attributeSelection: buildDefaultAttributeSelection(
        catalogType,
        attributeCatalog,
      ),
    };
  }
  return ProjectTemplateStepsSnapshotSchema.parse(steps);
}

function makeProjectSnapshot(input: {
  templateId?: string | null;
  userTemplateId?: string | null;
  name: string;
  description?: string | null;
  finalStep: ProjectTemplateStepKey;
  steps: ProjectTemplateStepsSnapshot;
}): ProjectTemplateSnapshot {
  validateSnapshotSteps(input.finalStep, input.steps);
  return {
    templateId: input.templateId ?? null,
    userTemplateId: input.userTemplateId ?? null,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    finalStep: input.finalStep,
    steps: input.steps,
  };
}

@Controller("admin/project-templates")
export class AdminProjectTemplatesController {
  @Get()
  async list() {
    const rows = await prisma.projectTemplate.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(mapProjectTemplate));
  }

  @Get("default-snapshot")
  async defaultSnapshot(
    @Query("finalStep") rawFinalStep?: string,
    @Query("storyMasterPromptId") storyMasterPromptId?: string,
    @Query("scenarioMasterPromptId") scenarioMasterPromptId?: string,
    @Query("shotsMasterPromptId") shotsMasterPromptId?: string,
    @Query("shotMasterPromptId") shotMasterPromptId?: string,
  ) {
    const finalStep = ProjectTemplateStepKeySchema.parse(
      rawFinalStep?.trim() || "shot",
    );
    const steps = await buildSelectedPromptSteps(finalStep, {
      story: storyMasterPromptId,
      scenario: scenarioMasterPromptId,
      shots: shotsMasterPromptId,
      shot: shotMasterPromptId,
    });
    return ok({ finalStep, steps });
  }

  @Post()
  async create(@Body() rawBody: unknown) {
    const body = CreateProjectTemplateRequestSchema.parse(rawBody);
    validateSnapshotSteps(body.finalStep, body.steps);
    const row = await prisma.projectTemplate.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        finalStep: body.finalStep,
        steps: toJson(body.steps),
        status: "active",
        createdByAdminId: defaultAdminId,
      },
    });
    return ok(mapProjectTemplate(row));
  }

  @Get(":templateId")
  async get(@Param("templateId") templateId: string) {
    const row = await prisma.projectTemplate.findFirst({
      where: { id: templateId, status: "active" },
    });
    if (!row) {
      throw new BadRequestException("Project Template is missing or archived.");
    }
    return ok(mapProjectTemplate(row));
  }

  @Patch(":templateId")
  async patch(
    @Param("templateId") templateId: string,
    @Body() rawBody: unknown,
  ) {
    const body = UpdateProjectTemplateRequestSchema.parse(rawBody);
    const existing = await prisma.projectTemplate.findFirst({
      where: { id: templateId, status: "active" },
    });
    if (!existing) {
      throw new BadRequestException("Project Template is missing or archived.");
    }
    validateSnapshotSteps(body.finalStep, body.steps);
    const row = await prisma.projectTemplate.update({
      where: { id: existing.id },
      data: {
        name: body.name,
        description: body.description ?? null,
        finalStep: body.finalStep,
        steps: toJson(body.steps),
      },
    });
    return ok(mapProjectTemplate(row));
  }

  @Delete(":templateId")
  async delete(@Param("templateId") templateId: string) {
    const result = await prisma.projectTemplate.updateMany({
      where: { id: templateId, status: "active" },
      data: { status: "archived" },
    });
    return ok({ deleted: result.count > 0 });
  }
}

@Controller("project-templates")
export class ProjectTemplatesController {
  @Get()
  async list() {
    const rows = await prisma.projectTemplate.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(mapProjectTemplate));
  }
}

@Controller("user-project-templates")
export class UserProjectTemplatesController {
  @Get()
  async list() {
    const rows = await prisma.userProjectTemplate.findMany({
      where: { ownerUserId: defaultUserId, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    return ok(rows.map(mapUserProjectTemplate));
  }

  @Post()
  async create(@Body() rawBody: unknown) {
    const body = CreateUserProjectTemplateRequestSchema.parse(rawBody);
    const adminTemplate = await prisma.projectTemplate.findFirst({
      where: { id: body.adminTemplateId, status: "active" },
    });
    if (!adminTemplate) {
      throw new BadRequestException("Admin Project Template is missing or archived.");
    }
    const finalStep = ProjectTemplateStepKeySchema.parse(adminTemplate.finalStep);
    const steps = ProjectTemplateStepsSnapshotSchema.parse(adminTemplate.steps);
    validateSnapshotSteps(finalStep, steps);
    const row = await prisma.userProjectTemplate.create({
      data: {
        ownerUserId: defaultUserId,
        adminTemplateId: adminTemplate.id,
        name: body.name ?? adminTemplate.name,
        description: body.description ?? adminTemplate.description,
        finalStep,
        steps: toJson(steps),
        status: "active",
      },
    });
    return ok(mapUserProjectTemplate(row));
  }

  @Get(":templateId")
  async get(@Param("templateId") templateId: string) {
    const row = await prisma.userProjectTemplate.findFirst({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active",
      },
    });
    if (!row) {
      throw new BadRequestException("Custom Template is missing or archived.");
    }
    return ok(mapUserProjectTemplate(row));
  }

  @Patch(":templateId")
  async patch(
    @Param("templateId") templateId: string,
    @Body() rawBody: unknown,
  ) {
    const body = UpdateUserProjectTemplateRequestSchema.parse(rawBody);
    const existing = await prisma.userProjectTemplate.findFirst({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active",
      },
    });
    if (!existing) {
      throw new BadRequestException("Custom Template is missing or archived.");
    }
    validateSnapshotSteps(
      ProjectTemplateStepKeySchema.parse(existing.finalStep),
      body.steps,
    );
    const row = await prisma.userProjectTemplate.update({
      where: { id: existing.id },
      data: { steps: toJson(body.steps) },
    });
    return ok(mapUserProjectTemplate(row));
  }

  @Delete(":templateId")
  async delete(@Param("templateId") templateId: string) {
    const result = await prisma.userProjectTemplate.updateMany({
      where: {
        id: templateId,
        ownerUserId: defaultUserId,
        status: "active",
      },
      data: { status: "archived" },
    });
    return ok({ deleted: result.count > 0 });
  }
}

export async function resolveUserProjectTemplateSnapshot(
  templateId: string,
): Promise<ProjectTemplateSnapshot> {
  const row = await prisma.userProjectTemplate.findFirst({
    where: {
      id: templateId,
      ownerUserId: defaultUserId,
      status: "active",
    },
  });
  if (!row) {
    throw new BadRequestException("Custom Template is missing or archived.");
  }
  const finalStep = ProjectTemplateStepKeySchema.parse(row.finalStep);
  const steps = ProjectTemplateStepsSnapshotSchema.parse(row.steps);
  return makeProjectSnapshot({
    templateId: row.adminTemplateId,
    userTemplateId: row.id,
    name: row.name,
    description: row.description,
    finalStep,
    steps,
  });
}

export async function resolveProjectTemplateSnapshot(
  templateId: string,
): Promise<ProjectTemplateSnapshot> {
  const row = await prisma.projectTemplate.findFirst({
    where: {
      id: templateId,
      status: "active",
    },
  });
  if (!row) {
    throw new BadRequestException("Project Template is missing or archived.");
  }
  const finalStep = ProjectTemplateStepKeySchema.parse(row.finalStep);
  const steps = ProjectTemplateStepsSnapshotSchema.parse(row.steps);
  return makeProjectSnapshot({
    templateId: row.id,
    userTemplateId: null,
    name: row.name,
    description: row.description,
    finalStep,
    steps,
  });
}
