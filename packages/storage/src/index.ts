import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

export type StoredObjectMetadata = {
  key: string;
  sizeBytes: number;
  updatedAt: string;
};

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
};

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<StoredObjectMetadata>;
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  createReadUrl(key: string): Promise<string>;
  createWriteUrl(key: string): Promise<string>;
  getMetadata(key: string): Promise<StoredObjectMetadata>;
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir: string) {}

  async putObject(input: PutObjectInput): Promise<StoredObjectMetadata> {
    const target = this.resolveKey(input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body);
    return this.getMetadata(input.key);
  }

  async getObject(key: string): Promise<Buffer> {
    return readFile(this.resolveKey(key));
  }

  async deleteObject(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async createReadUrl(key: string): Promise<string> {
    return `/storage/${encodeURIComponent(key)}`;
  }

  async createWriteUrl(key: string): Promise<string> {
    return `/api/v1/storage/local/${encodeURIComponent(key)}`;
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata> {
    const file = await stat(this.resolveKey(key));
    return {
      key,
      sizeBytes: file.size,
      updatedAt: file.mtime.toISOString()
    };
  }

  private resolveKey(key: string) {
    const normalized = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return join(this.rootDir, normalized);
  }
}
