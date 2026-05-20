import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { prisma, type Prisma } from "@videoai/database";
import { GenerateShotsRequestSchema, UpdateShotPlanRequestSchema } from "@videoai/contracts";
import { defaultUserId, mapVideoShotPlan } from "./db-store.js";
import { ok } from "./response.js";
import { ShotPlansService } from "./shot-plans.service.js";

@Controller("shots")
export class ShotsController {
  constructor(@Inject(ShotPlansService) private readonly shotPlansService: ShotPlansService) {}

  @Get()
  async listShotPlans() {
    const shotPlans = await prisma.videoShotPlanRecord.findMany({
      where: {
        ownerUserId: defaultUserId,
        status: "active"
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }]
    });
    return ok(shotPlans.map(mapVideoShotPlan));
  }

  @Get(":shotPlanId")
  async getShotPlan(@Param("shotPlanId") shotPlanId: string) {
    const shotPlan = await prisma.videoShotPlanRecord.findFirst({
      where: {
        id: shotPlanId,
        ownerUserId: defaultUserId,
        status: "active"
      }
    });
    return ok(shotPlan ? mapVideoShotPlan(shotPlan) : null);
  }

  @Post("generate")
  async generateShots(@Body() rawBody: unknown) {
    const body = GenerateShotsRequestSchema.parse(rawBody);
    return ok(await this.shotPlansService.createShotGenerationJob(null, body));
  }

  @Patch(":shotPlanId")
  async updateShotPlan(@Param("shotPlanId") shotPlanId: string, @Body() rawBody: unknown) {
    const body = UpdateShotPlanRequestSchema.parse(rawBody);
    const existing = await prisma.videoShotPlanRecord.findFirst({
      where: {
        id: shotPlanId,
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

  @Delete(":shotPlanId")
  async deleteShotPlan(@Param("shotPlanId") shotPlanId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.videoShotPlanRecord.findFirst({
        where: {
          id: shotPlanId,
          ownerUserId: defaultUserId,
          status: "active"
        }
      });
      if (!existing) {
        return { count: 0 };
      }
      const archived = await tx.videoShotPlanRecord.updateMany({
        where: {
          id: shotPlanId,
          ownerUserId: defaultUserId,
          status: "active"
        },
        data: { isDefault: false, status: "archived" }
      });
      if (existing.isDefault) {
        const nextDefault = await tx.videoShotPlanRecord.findFirst({
          where: {
            ownerUserId: defaultUserId,
            status: "active"
          },
          orderBy: { updatedAt: "desc" }
        });
        if (nextDefault) {
          await tx.videoShotPlanRecord.update({
            where: { id: nextDefault.id },
            data: { isDefault: true }
          });
        }
      }
      return archived;
    });
    return ok({ deleted: result.count > 0 });
  }

  @Post(":shotPlanId/default")
  async setDefaultShotPlan(@Param("shotPlanId") shotPlanId: string) {
    const shotPlan = await prisma.$transaction(async (tx) => {
      const existing = await tx.videoShotPlanRecord.findFirst({
        where: {
          id: shotPlanId,
          ownerUserId: defaultUserId,
          status: "active"
        }
      });
      if (!existing) {
        return null;
      }
      await tx.videoShotPlanRecord.updateMany({
        where: {
          ownerUserId: defaultUserId,
          status: "active"
        },
        data: { isDefault: false }
      });
      return tx.videoShotPlanRecord.update({
        where: { id: shotPlanId },
        data: { isDefault: true }
      });
    });

    return ok(shotPlan ? mapVideoShotPlan(shotPlan) : null);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }
}
