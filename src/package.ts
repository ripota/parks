#!/usr/bin/env -S node --experimental-strip-types

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import {
  formatPackagePayloadMeasurements,
  measurePackagePayloads,
} from "./package-size.ts";
import type {
  Catalog,
  CatalogRecord,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
} from "./types.ts";
import { validateSnapshot } from "./validate.ts";

export const SCHEMA_VERSION = 1;

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

export async function atomicWrite(
  filePath: string,
  content: string,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, filePath);
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function assertNoTypeScriptErrors(
  diagnostics: readonly ts.Diagnostic[] | undefined,
): void {
  const errors = diagnostics?.filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (!errors?.length) {
    return;
  }
  throw new Error(
    ts.formatDiagnostics(errors, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => sourceDirectory,
      getNewLine: () => "\n",
    }),
  );
}

async function buildRootEntry(): Promise<Map<string, string>> {
  const fileName = path.join(sourceDirectory, "index.ts");
  const source = await readFile(fileName, "utf8");
  const compilerOptions = {
    target: ts.ScriptTarget.ES2024,
    module: ts.ModuleKind.ESNext,
    verbatimModuleSyntax: true,
    newLine: ts.NewLineKind.LineFeed,
  } satisfies ts.CompilerOptions;
  const runtime = ts.transpileModule(source, {
    compilerOptions,
    fileName,
    reportDiagnostics: true,
  });
  const declarations = ts.transpileDeclaration(source, {
    compilerOptions: {
      ...compilerOptions,
      isolatedDeclarations: true,
    },
    fileName,
    reportDiagnostics: true,
  });
  assertNoTypeScriptErrors(runtime.diagnostics);
  assertNoTypeScriptErrors(declarations.diagnostics);
  return new Map([
    ["dist/index.js", runtime.outputText],
    ["dist/index.d.ts", declarations.outputText],
  ]);
}

export async function buildPackageArtifacts(
  rootDirectory: string,
  dataDirectory = path.join(rootDirectory, "data"),
): Promise<Map<string, string>> {
  const snapshot = await validateSnapshot(rootDirectory, dataDirectory);
  const manifestByReference = new Map(
    snapshot.manifest.map((record) => [record.reference, record]),
  );

  const catalogReferences: CatalogRecord[] = snapshot.references.map(
    (reference) => {
      const manifest = manifestByReference.get(reference.reference);
      const geojson = snapshot.geojsonByReference.get(reference.reference);
      if (!manifest?.geometryKind || !manifest.sourceFeatureIds || !geojson) {
        throw new Error(
          `${reference.reference} cannot be included in the package catalog`,
        );
      }

      return {
        ...reference,
        status: manifest.status,
        geometryKind: manifest.geometryKind,
        source: {
          name: manifest.sourceName,
          url: manifest.sourceUrl,
          ...(manifest.sourceQuery ? { query: manifest.sourceQuery } : {}),
          featureIds: manifest.sourceFeatureIds,
          ...(manifest.notes ? { notes: manifest.notes } : {}),
        },
        geojson,
      };
    },
  );

  const catalog: Catalog = {
    schemaVersion: SCHEMA_VERSION,
    referenceCount: catalogReferences.length,
    featureCount: snapshot.featureCount,
    references: catalogReferences,
  };

  const allFeatures: GeoJsonFeature[] = [];
  for (const record of catalogReferences) {
    for (const feature of record.geojson.features) {
      allFeatures.push({
        ...feature,
        properties: {
          ...(feature.properties ?? {}),
          potaReference: record.reference,
          geometryKind: record.geometryKind,
        },
      });
    }
  }

  const aggregate: GeoJsonFeatureCollection = {
    type: "FeatureCollection",
    properties: {
      schemaVersion: SCHEMA_VERSION,
      referenceCount: catalogReferences.length,
      featureCount: allFeatures.length,
    },
    features: allFeatures,
  };

  const artifacts = new Map<string, string>([
    ...(await buildRootEntry()),
    ["dist/catalog.json", json(catalog)],
    ["dist/all.geojson", json(aggregate)],
  ]);

  const checksumInputs = new Map<string, string>();
  checksumInputs.set(
    "data/references.json",
    await readFile(path.join(dataDirectory, "references.json"), "utf8"),
  );
  checksumInputs.set(
    "data/manifest.json",
    await readFile(path.join(dataDirectory, "manifest.json"), "utf8"),
  );
  for (const manifest of snapshot.manifest) {
    if (!manifest.localGeojson) {
      continue;
    }
    const relativePath = `data/boundaries/${path.basename(manifest.localGeojson)}`;
    checksumInputs.set(
      relativePath,
      await readFile(
        path.join(dataDirectory, "boundaries", path.basename(relativePath)),
        "utf8",
      ),
    );
  }
  for (const [relativePath, content] of artifacts) {
    if (
      relativePath === "dist/catalog.json" ||
      relativePath === "dist/all.geojson"
    ) {
      checksumInputs.set(relativePath, content);
    }
  }

  const checksumFile = [...checksumInputs]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([relativePath, content]) => `${sha256(content)}  ${relativePath}`)
    .join("\n");
  artifacts.set("dist/checksums.sha256", `${checksumFile}\n`);

  return artifacts;
}

export async function writePackageArtifacts(
  rootDirectory: string,
  checkOnly = false,
  dataDirectory = path.join(rootDirectory, "data"),
  outputDirectory = rootDirectory,
): Promise<void> {
  const artifacts = await buildPackageArtifacts(rootDirectory, dataDirectory);
  for (const [relativePath, content] of artifacts) {
    const filePath = path.join(outputDirectory, relativePath);
    if (checkOnly) {
      let actual: string;
      try {
        actual = await readFile(filePath, "utf8");
      } catch {
        throw new Error(`${relativePath} is missing; run npm run package`);
      }
      if (actual !== content) {
        throw new Error(`${relativePath} is stale; run npm run package`);
      }
    } else {
      await atomicWrite(filePath, content);
      console.log(`Wrote ${relativePath}`);
    }
  }
}

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await writePackageArtifacts(
      rootDirectory,
      process.argv.includes("--check"),
    );
    console.log(
      formatPackagePayloadMeasurements(
        await measurePackagePayloads(rootDirectory),
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
