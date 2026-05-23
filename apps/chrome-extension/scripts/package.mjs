import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const packages = join(root, "packages");
const output = join(packages, "videoai-ai-handoff-extension.tar.gz");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

function tarHeader(name, size) {
  const buffer = Buffer.alloc(512);
  buffer.write(name);
  buffer.write("0000644", 100);
  buffer.write("0000000", 108);
  buffer.write("0000000", 116);
  buffer.write(size.toString(8).padStart(11, "0"), 124);
  buffer.write(
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0"),
    136,
  );
  buffer.fill(" ", 148, 156);
  buffer.write("0", 156);
  buffer.write("ustar", 257);
  buffer.write("00", 263);
  let checksum = 0;
  for (const byte of buffer) {
    checksum += byte;
  }
  buffer.write(checksum.toString(8).padStart(6, "0"), 148);
  buffer[154] = 0;
  buffer[155] = 32;
  return buffer;
}

async function* tarStream(files) {
  for (const file of files) {
    const info = await stat(file);
    const name = `${basename(dist)}/${relative(dist, file).replaceAll("\\", "/")}`;
    const data = await import("node:fs/promises").then((fs) =>
      fs.readFile(file),
    );
    yield tarHeader(name, info.size);
    yield data;
    const padding = (512 - (info.size % 512)) % 512;
    if (padding > 0) {
      yield Buffer.alloc(padding);
    }
  }
  yield Buffer.alloc(1024);
}

await mkdir(packages, { recursive: true });
await pipeline(
  Readable.from(tarStream(await listFiles(dist))),
  createGzip(),
  createWriteStream(output),
);
console.log(`Wrote ${output}`);
