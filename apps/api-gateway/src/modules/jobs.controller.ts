import { Controller, Get, Param } from "@nestjs/common";
import { prisma } from "@videoai/database";
import { mapJob } from "./db-store.js";
import { ok } from "./response.js";

@Controller("jobs")
export class JobsController {
  @Get(":jobId")
  async getJob(@Param("jobId") jobId: string) {
    const job = await prisma.jobStatusRecord.findUnique({ where: { jobId } });
    return ok(
      job
        ? mapJob(job)
        : {
        jobId,
        type: "prompt_generation",
        status: "failed",
        progress: 0,
        result: null,
        error: {
          code: "JOB_NOT_FOUND",
          message: "Job not found"
        }
      }
    );
  }
}
