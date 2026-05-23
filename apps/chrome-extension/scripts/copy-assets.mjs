import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

await mkdir(dist, { recursive: true });

for (const file of ["manifest.json", "popup.html", "popup.css"]) {
  await copyFile(join(root, file), join(dist, file));
}

await rm(join(dist, "types.js"), { force: true });
