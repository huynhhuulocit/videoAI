import { Controller, Get } from "@nestjs/common";
import { ok } from "./response.js";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return ok({
      service: "api-gateway",
      status: "ok"
    });
  }
}
