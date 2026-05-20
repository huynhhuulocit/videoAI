import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";

const port = Number(process.env.PORT ?? 4000);

const app = await NestFactory.create(AppModule, {
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  }
});

app.setGlobalPrefix("api/v1");
await app.listen(port);

console.log(JSON.stringify({ service: "api-gateway", message: `listening on ${port}` }));
