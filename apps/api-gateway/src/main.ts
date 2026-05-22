import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./modules/app.module.js";

const portValue = process.env.PORT?.trim();
if (!portValue) {
  throw new Error("PORT is required for api-gateway.");
}
const port = Number(portValue);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer.");
}
const webOrigin = process.env.WEB_ORIGIN?.trim();
if (!webOrigin) {
  throw new Error("WEB_ORIGIN is required for api-gateway CORS.");
}

const app = await NestFactory.create(AppModule, {
  cors: {
    origin: webOrigin,
    credentials: true
  }
});

app.setGlobalPrefix("api/v1");
await app.listen(port);

console.log(JSON.stringify({ service: "api-gateway", message: `listening on ${port}` }));
