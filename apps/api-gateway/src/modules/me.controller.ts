import { Controller, Get, Headers } from "@nestjs/common";
import { getCurrentUser } from "./db-store.js";
import { ok } from "./response.js";

@Controller("me")
export class MeController {
  @Get()
  async me(@Headers("x-demo-role") demoRole?: string) {
    return ok(await getCurrentUser(demoRole));
  }
}
