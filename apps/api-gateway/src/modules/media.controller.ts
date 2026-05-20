import { createReadStream, mkdirSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { prisma } from "@videoai/database";
import { randomUUID } from "node:crypto";
import { diskStorage } from "multer";
import { defaultUserId, mapMediaAsset } from "./db-store.js";
import { ok } from "./response.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm"]);
const maxImageBytes = 10 * 1024 * 1024;
const maxVideoBytes = 200 * 1024 * 1024;
const maxVideoSeconds = 180;
const configuredStorageRoot = process.env.LOCAL_STORAGE_ROOT ?? "storage/uploads";
const workspaceRoot = process.env.INIT_CWD ?? process.cwd();
const uploadRoot = isAbsolute(configuredStorageRoot)
  ? configuredStorageRoot
  : resolve(workspaceRoot, configuredStorageRoot);

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
};

function getProjectUploadDir(projectId: string) {
  const directory = join(uploadRoot, projectId);
  mkdirSync(directory, { recursive: true });
  return directory;
}

function getStorageKey(projectId: string, filename: string) {
  return `${projectId}/${filename}`;
}

function parseDurationSeconds(value: string | undefined) {
  if (!value) {
    return null;
  }
  const duration = Math.ceil(Number(value));
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function classifyMedia(file: UploadedMediaFile) {
  const extension = extname(file.originalname).toLowerCase();
  const isImage = imageTypes.has(file.mimetype) && imageExtensions.has(extension);
  const isVideo = videoTypes.has(file.mimetype) && videoExtensions.has(extension);
  if (isImage) {
    return "image";
  }
  if (isVideo) {
    return "video";
  }
  return "unknown";
}

function validateMedia(file: UploadedMediaFile, mediaType: "image" | "video" | "unknown", durationSeconds: number | null) {
  if (mediaType === "unknown") {
    return "Unsupported media type.";
  }
  if (mediaType === "image" && file.size > maxImageBytes) {
    return "Image file exceeds the 10 MB limit.";
  }
  if (mediaType === "video" && file.size > maxVideoBytes) {
    return "Video file exceeds the 200 MB limit.";
  }
  if (mediaType === "video" && durationSeconds !== null && durationSeconds > maxVideoSeconds) {
    return "Video duration exceeds the 3 minute limit.";
  }
  return null;
}

async function ensureProjectAccess(projectId: string) {
  const project = await prisma.projectRecord.findFirst({
    where: {
      id: projectId,
      ownerUserId: defaultUserId,
      status: "active"
    }
  });

  if (!project) {
    throw new NotFoundException("Project not found");
  }
}

@Controller("projects/:projectId/media")
export class MediaController {
  @Get()
  async listMedia(@Param("projectId") projectId: string) {
    await ensureProjectAccess(projectId);
    const assets = await prisma.mediaAsset.findMany({
      where: {
        projectId,
        ownerUserId: defaultUserId,
        status: { not: "deleted" }
      },
      orderBy: { createdAt: "desc" }
    });
    return ok(assets.map(mapMediaAsset));
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (request, _file, callback) => {
          const projectId = String(request.params.projectId ?? "unassigned");
          callback(null, getProjectUploadDir(projectId));
        },
        filename: (_request, file, callback) => {
          const extension = extname(file.originalname).toLowerCase();
          callback(null, `${Date.now()}-${randomUUID()}${extension}`);
        }
      }),
      limits: {
        fileSize: maxVideoBytes
      }
    })
  )
  async uploadMedia(
    @Param("projectId") projectId: string,
    @UploadedFile() file: UploadedMediaFile | undefined,
    @Body("durationSeconds") durationSecondsValue?: string
  ) {
    await ensureProjectAccess(projectId);

    if (!file) {
      throw new BadRequestException("File is required");
    }

    const mediaType = classifyMedia(file);
    const durationSeconds = parseDurationSeconds(durationSecondsValue);
    const validationError = validateMedia(file, mediaType, durationSeconds);
    const asset = await prisma.mediaAsset.create({
      data: {
        id: `media_${Date.now()}_${randomUUID().slice(0, 8)}`,
        ownerUserId: defaultUserId,
        projectId,
        storageProvider: "local",
        storageKey: getStorageKey(projectId, file.filename),
        originalFilename: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
        mediaType: mediaType === "video" ? "video" : "image",
        sizeBytes: file.size,
        durationSeconds,
        status: validationError ? "rejected" : "validated",
        validationError
      }
    });

    return ok(mapMediaAsset(asset));
  }

  @Get(":mediaId/content")
  async getMediaContent(@Param("projectId") projectId: string, @Param("mediaId") mediaId: string, @Res() response: any) {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        projectId,
        ownerUserId: defaultUserId,
        status: { not: "deleted" }
      }
    });

    if (!asset) {
      throw new NotFoundException("Media not found");
    }

    const filePath = join(uploadRoot, asset.storageKey);
    response.setHeader("content-type", asset.mimeType);
    response.setHeader("cache-control", "private, max-age=300");
    createReadStream(filePath).on("error", () => response.status(404).end()).pipe(response);
  }

  @Get(":mediaId")
  async getMedia(@Param("projectId") projectId: string, @Param("mediaId") mediaId: string) {
    await ensureProjectAccess(projectId);
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        projectId,
        ownerUserId: defaultUserId,
        status: { not: "deleted" }
      }
    });
    return ok(asset ? mapMediaAsset(asset) : null);
  }

  @Delete(":mediaId")
  async deleteMedia(@Param("projectId") projectId: string, @Param("mediaId") mediaId: string) {
    await ensureProjectAccess(projectId);
    const result = await prisma.mediaAsset.updateMany({
      where: {
        id: mediaId,
        projectId,
        ownerUserId: defaultUserId,
        status: { not: "deleted" }
      },
      data: {
        status: "deleted"
      }
    });
    return ok({ deleted: result.count > 0 });
  }
}
