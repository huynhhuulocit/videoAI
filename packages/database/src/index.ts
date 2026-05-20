import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Prisma, PrismaClient } from "@prisma/client";

export { Prisma, PrismaClient };

const scrypt = promisify(scryptCallback);

const globalForPrisma = globalThis as typeof globalThis & {
  videoAiPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.videoAiPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.videoAiPrisma = prisma;
}

export const serviceSchemas = [
  "auth",
  "users",
  "projects",
  "media",
  "content",
  "config",
  "video",
  "ai_logs",
  "jobs"
] as const;

export type ServiceSchema = (typeof serviceSchemas)[number];

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const storedKey = Buffer.from(hash, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  if (storedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedKey, derivedKey);
}
