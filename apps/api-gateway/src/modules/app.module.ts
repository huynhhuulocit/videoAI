import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import {
  AdminAttributeCatalogsController,
  AdminAttributeGenerationPromptsController,
  AttributeCatalogsController
} from "./attribute-catalogs.controller.js";
import { HealthController } from "./health.controller.js";
import { JobsController } from "./jobs.controller.js";
import { MediaController } from "./media.controller.js";
import { MeController } from "./me.controller.js";
import { ProjectsController } from "./projects.controller.js";
import {
  AdminProjectTemplatesController,
  ProjectTemplatesController,
  UserProjectTemplatesController
} from "./project-templates.controller.js";
import { ShotPlansService } from "./shot-plans.service.js";
import { ShotsController } from "./shots.controller.js";
import { TemplatesController } from "./templates.controller.js";

@Module({
  controllers: [
    HealthController,
    MeController,
    ProjectsController,
    MediaController,
    TemplatesController,
    ShotsController,
    JobsController,
    AttributeCatalogsController,
    AdminAttributeCatalogsController,
    AdminAttributeGenerationPromptsController,
    AdminProjectTemplatesController,
    ProjectTemplatesController,
    UserProjectTemplatesController,
    AdminController
  ],
  providers: [ShotPlansService]
})
export class AppModule {}
