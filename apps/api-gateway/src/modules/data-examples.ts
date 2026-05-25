import { accessSync, constants } from "node:fs";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AttributeCatalogType, DataExample, UpdateDataExampleRequest } from "@videoai/contracts";

const dataExampleFiles = {
  story: {
    directory: "story",
    masterPrompt: "story-master-prompt.md",
    attributePrompt: "story-attribute-generation-prompt.md",
    attributeJsonFormat: "story-attribute-json-format.md",
    attributeOutputFormat: "story-attribute-output-format.md",
  },
  scenario: {
    directory: "scenario",
    masterPrompt: "scenario-master-prompt.md",
    attributePrompt: "scenario-attribute-generation-prompt.md",
    attributeJsonFormat: "scenario-attribute-json-format.md",
    attributeOutputFormat: "scenario-attribute-output-format.md",
  },
  shots: {
    directory: "shots",
    masterPrompt: "shots-master-prompt.md",
    attributePrompt: "shots-attribute-generation-prompt.md",
    attributeJsonFormat: "shots-attribute-json-format.md",
    attributeOutputFormat: "shots-attribute-output-format.md",
  },
  shot: {
    directory: "shot",
    masterPrompt: "shot-master-prompt.md",
    attributePrompt: "shot-attribute-generation-prompt.md",
    attributeJsonFormat: "shot-attribute-json-format.md",
    attributeOutputFormat: "shot-attribute-output-format.md",
  },
} satisfies Record<
  AttributeCatalogType,
  {
    directory: string;
    masterPrompt: string;
    attributePrompt: string;
    attributeJsonFormat: string;
    attributeOutputFormat: string;
  }
>;

function dataExamplesRoot() {
  let directory = resolve(process.cwd());
  while (true) {
    const candidate = resolve(directory, "data-examples");
    try {
      accessSync(candidate, constants.R_OK);
      return candidate;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) {
        throw new Error("Cannot locate data-examples directory from the API gateway working directory.");
      }
      directory = parent;
    }
  }
}

function resolveDataExamplePaths(type: AttributeCatalogType) {
  const fileConfig = dataExampleFiles[type];
  const directory = resolve(dataExamplesRoot(), fileConfig.directory);
  const masterPromptPath = resolve(directory, fileConfig.masterPrompt);
  const attributePromptPath = resolve(directory, fileConfig.attributePrompt);
  const attributeJsonFormatPath = resolve(directory, fileConfig.attributeJsonFormat);
  const attributeOutputFormatPath = resolve(
    directory,
    fileConfig.attributeOutputFormat,
  );
  const root = dataExamplesRoot();

  for (const filePath of [
    masterPromptPath,
    attributePromptPath,
    attributeJsonFormatPath,
    attributeOutputFormatPath,
  ]) {
    if (!filePath.startsWith(root)) {
      throw new Error(`Invalid data example path for ${type}.`);
    }
  }

  return {
    masterPromptPath,
    attributePromptPath,
    attributeJsonFormatPath,
    attributeOutputFormatPath,
  };
}

async function assertReadable(filePath: string) {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`Data example file is not readable: ${filePath}`);
  }
}

async function assertWritable(filePath: string) {
  try {
    await access(filePath, constants.W_OK);
  } catch {
    throw new Error(`Data example file is not writable: ${filePath}`);
  }
}

export async function readDataExample(type: AttributeCatalogType): Promise<DataExample> {
  const {
    attributeJsonFormatPath,
    attributeOutputFormatPath,
    attributePromptPath,
    masterPromptPath,
  } = resolveDataExamplePaths(type);
  await assertReadable(masterPromptPath);
  await assertReadable(attributePromptPath);
  await assertReadable(attributeJsonFormatPath);
  await assertReadable(attributeOutputFormatPath);

  const [
    masterPromptContent,
    attributeGenerationPrompt,
    attributeJsonFormat,
    attributeOutputFormat,
    masterStats,
    attributeStats,
    attributeJsonFormatStats,
    attributeOutputFormatStats,
  ] =
    await Promise.all([
      readFile(masterPromptPath, "utf8"),
      readFile(attributePromptPath, "utf8"),
      readFile(attributeJsonFormatPath, "utf8"),
      readFile(attributeOutputFormatPath, "utf8"),
      stat(masterPromptPath),
      stat(attributePromptPath),
      stat(attributeJsonFormatPath),
      stat(attributeOutputFormatPath),
    ]);
  const updatedAt = new Date(
    Math.max(
      masterStats.mtimeMs,
      attributeStats.mtimeMs,
      attributeJsonFormatStats.mtimeMs,
      attributeOutputFormatStats.mtimeMs,
    ),
  ).toISOString();

  return {
    type,
    masterPromptContent,
    attributeGenerationPrompt,
    attributeJsonFormat,
    attributeOutputFormat,
    updatedAt,
  };
}

export async function updateDataExample(
  type: AttributeCatalogType,
  body: UpdateDataExampleRequest,
): Promise<DataExample> {
  const {
    attributeJsonFormatPath,
    attributeOutputFormatPath,
    attributePromptPath,
    masterPromptPath,
  } = resolveDataExamplePaths(type);
  const writes: Array<Promise<void>> = [];

  if (body.masterPromptContent !== undefined) {
    await assertWritable(masterPromptPath);
    writes.push(writeFile(masterPromptPath, body.masterPromptContent, "utf8"));
  }

  if (body.attributeGenerationPrompt !== undefined) {
    await assertWritable(attributePromptPath);
    writes.push(writeFile(attributePromptPath, body.attributeGenerationPrompt, "utf8"));
  }

  if (body.attributeJsonFormat !== undefined) {
    await assertWritable(attributeJsonFormatPath);
    writes.push(writeFile(attributeJsonFormatPath, body.attributeJsonFormat, "utf8"));
  }

  if (body.attributeOutputFormat !== undefined) {
    await assertWritable(attributeOutputFormatPath);
    writes.push(writeFile(attributeOutputFormatPath, body.attributeOutputFormat, "utf8"));
  }

  await Promise.all(writes);
  return readDataExample(type);
}
