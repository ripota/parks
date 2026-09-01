import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

let consumerDirectory: string;
let tarballPath: string;

beforeAll(async () => {
  consumerDirectory = await mkdtemp(
    path.join(os.tmpdir(), "parks-packed-consumer-"),
  );
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--json", "--pack-destination", consumerDirectory],
    { cwd: rootDirectory },
  );
  const packResult = JSON.parse(stdout) as Array<{ filename: string }>;
  tarballPath = path.join(consumerDirectory, packResult[0].filename);
  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  await execFileAsync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      tarballPath,
    ],
    { cwd: consumerDirectory },
  );
}, 30_000);

afterAll(async () => {
  if (consumerDirectory) {
    await rm(consumerDirectory, { recursive: true, force: true });
  }
});

describe("packed package consumer", () => {
  it("contains every required public and attribution file", async () => {
    const { stdout } = await execFileAsync("tar", ["-tf", tarballPath]);
    const entries = new Set(stdout.trim().split("\n"));
    for (const requiredPath of [
      "package/package.json",
      "package/README.md",
      "package/DATA_LICENSE.md",
      "package/DATA_SOURCES.md",
      "package/LICENSE",
      "package/data/references.json",
      "package/data/manifest.json",
      "package/data/boundaries/us-0513.geojson",
      "package/dist/catalog.json",
      "package/dist/all.geojson",
      "package/dist/checksums.sha256",
      "package/schemas/catalog.schema.json",
      "package/schemas/geojson.schema.json",
    ]) {
      expect(entries.has(requiredPath), `${requiredPath} is missing`).toBe(
        true,
      );
    }
  });

  it("executes the installed README Node example unchanged", async () => {
    const installedReadme = await readFile(
      path.join(consumerDirectory, "node_modules/@ripota/parks/README.md"),
      "utf8",
    );
    const examples = [...installedReadme.matchAll(/```js\n([\s\S]*?)```/g)].map(
      (match) => match[1],
    );
    expect(examples).toHaveLength(1);
    const examplePath = path.join(consumerDirectory, "readme-example.mjs");
    await writeFile(examplePath, examples.join("\n"));

    await expect(
      execFileAsync(process.execPath, [examplePath], {
        cwd: consumerDirectory,
      }),
    ).resolves.toMatchObject({ stdout: "" });
  });

  it("loads every documented export through the installed public interface", async () => {
    const scriptPath = path.join(consumerDirectory, "verify-exports.mjs");
    await writeFile(
      scriptPath,
      `
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import rootCatalog from "@ripota/parks" with { type: "json" };
import namedCatalog from "@ripota/parks/catalog.json" with { type: "json" };
import references from "@ripota/parks/references.json" with { type: "json" };
import manifest from "@ripota/parks/manifest.json" with { type: "json" };
import catalogSchema from "@ripota/parks/schemas/catalog.schema.json" with { type: "json" };
import geojsonSchema from "@ripota/parks/schemas/geojson.schema.json" with { type: "json" };

async function readExport(specifier) {
  return readFile(new URL(import.meta.resolve(specifier)), "utf8");
}

assert.deepEqual(rootCatalog, namedCatalog);
assert.equal(references.length, rootCatalog.referenceCount);
assert.equal(manifest.length, rootCatalog.referenceCount);
assert.equal(catalogSchema.$id, "https://ripota.org/schemas/catalog.schema.json");
assert.equal(geojsonSchema.$id, "https://ripota.org/schemas/geojson.schema.json");
const aggregate = JSON.parse(await readExport("@ripota/parks/all.geojson"));
const checksums = await readExport("@ripota/parks/checksums.sha256");
const boundary = JSON.parse(await readExport("@ripota/parks/boundaries/us-0513.geojson"));
assert.equal(aggregate.features.length, rootCatalog.featureCount);
assert.match(checksums, /dist\\/catalog\\.json/);
assert.equal(boundary.properties.potaReference, "US-0513");
`,
    );

    await expect(
      execFileAsync(process.execPath, [scriptPath], {
        cwd: consumerDirectory,
      }),
    ).resolves.toMatchObject({ stdout: "" });
  });
});
