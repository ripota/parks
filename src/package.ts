#!/usr/bin/env -S node --experimental-strip-types

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";
import { buildWebArtifacts } from "./web-geometry.ts";
import { v3Artifacts } from "./fallback.ts";
import { bounds, displayModule } from "./display-build.ts";

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

export const SCHEMA_VERSION = 2;

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

async function buildEntry(
  name: string,
  input?: string,
): Promise<Map<string, string>> {
  const fileName = path.join(sourceDirectory, `${name}.ts`);
  const source = input ?? (await readFile(fileName, "utf8"));
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
    [`dist/${name}.js`, runtime.outputText],
    [`dist/${name}.d.ts`, declarations.outputText],
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

  function catalogReferences(
    geometryRole: "display" | "source",
  ): CatalogRecord[] {
    return snapshot.references
      .filter(
        (reference) =>
          manifestByReference.get(reference.reference)?.status !==
          "research-needed",
      )
      .map((reference) => {
        const manifest = manifestByReference.get(reference.reference);
        const mapPoint = snapshot.mapPointOverridesByReference.get(
          reference.reference,
        );
        const geojson =
          geometryRole === "display"
            ? snapshot.geojsonByReference.get(reference.reference)
            : snapshot.sourceGeojsonByReference.get(reference.reference);
        if (!manifest?.geometryKind || !manifest.sourceFeatureIds || !geojson) {
          throw new Error(
            `${reference.reference} cannot be included in the package catalog`,
          );
        }

        return {
          ...reference,
          ...(mapPoint
            ? {
                mapPoint: {
                  latitude: mapPoint.latitude,
                  longitude: mapPoint.longitude,
                  notes: mapPoint.notes,
                },
              }
            : {}),
          status: manifest.status,
          geometryKind: manifest.geometryKind,
          source: {
            name: manifest.sourceName,
            url: manifest.sourceUrl,
            ...(manifest.sourceQuery ? { query: manifest.sourceQuery } : {}),
            featureIds: manifest.sourceFeatureIds,
            artifact: `source-features/${reference.reference.toLowerCase()}.geojson`,
            ...(manifest.notes ? { notes: manifest.notes } : {}),
          },
          geojson:
            geometryRole === "display"
              ? { ...geojson, bbox: bounds(geojson) }
              : geojson,
        };
      });
  }

  const displayReferences = catalogReferences("display");
  const sourceReferences = catalogReferences("source");

  const catalog: Catalog = {
    $schema: "https://ripota.org/schemas/v2/catalog.schema.json",
    schemaVersion: SCHEMA_VERSION,
    geometryRole: "display",
    referenceCount: displayReferences.length,
    featureCount: snapshot.displayFeatureCount,
    sourceFeatureCount: snapshot.sourceFeatureCount,
    references: displayReferences,
  };
  const sourceCatalog: Catalog = {
    $schema: "https://ripota.org/schemas/v2/source-catalog.schema.json",
    schemaVersion: SCHEMA_VERSION,
    geometryRole: "source",
    referenceCount: sourceReferences.length,
    featureCount: snapshot.sourceFeatureCount,
    references: sourceReferences,
  };

  function aggregate(
    references: CatalogRecord[],
    geometryRole: "display" | "source",
  ): GeoJsonFeatureCollection {
    const allFeatures: GeoJsonFeature[] = [];
    for (const record of references) {
      for (const feature of record.geojson.features) {
        allFeatures.push({
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            potaReference: record.reference,
            geometryKind: record.geometryKind,
            geometryRole,
          },
        });
      }
    }
    return {
      $schema:
        geometryRole === "display"
          ? "https://ripota.org/schemas/v2/display-geojson.schema.json"
          : "https://ripota.org/schemas/v2/source-geojson.schema.json",
      type: "FeatureCollection",
      properties: {
        schemaVersion: SCHEMA_VERSION,
        geometryRole,
        referenceCount: references.length,
        featureCount: allFeatures.length,
        ...(geometryRole === "display"
          ? { sourceFeatureCount: snapshot.sourceFeatureCount }
          : {}),
      },
      features: allFeatures,
    };
  }

  const displayAggregate = aggregate(displayReferences, "display");
  const sourceAggregate = aggregate(sourceReferences, "source");

  const v3 = v3Artifacts(
    snapshot.references,
    snapshot.manifest,
    displayReferences,
  );
  const artifacts = new Map<string, string>([
    ...v3.artifacts,
    ...buildWebArtifacts(
      v3.records.map(
        (record) =>
          displayReferences.find(
            (reviewed) => reviewed.reference === record.reference,
          )?.geojson ?? record.geojson,
      ),
      displayAggregate,
    ),
    ...(await buildEntry("index")),
    ...(await buildEntry("compare")),
    ...(await buildEntry("public-types")),
    ...(await buildEntry("display", displayModule(v3.records))),
    ["dist/catalog.json", json(catalog)],
    ["dist/source-catalog.json", json(sourceCatalog)],
    ["dist/all.geojson", json(displayAggregate)],
    ["dist/source-all.geojson", json(sourceAggregate)],
  ]);

  for (const record of displayReferences) {
    artifacts.set(
      `dist/boundaries/${record.reference.toLowerCase()}.geojson`,
      json(record.geojson),
    );
  }

  const checksumInputs = new Map<string, string>();
  checksumInputs.set(
    "data/references.json",
    await readFile(path.join(dataDirectory, "references.json"), "utf8"),
  );
  checksumInputs.set(
    "data/manifest.json",
    await readFile(path.join(dataDirectory, "manifest.json"), "utf8"),
  );
  checksumInputs.set(
    "data/derivations.json",
    await readFile(path.join(dataDirectory, "derivations.json"), "utf8"),
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
    const sourceRelativePath = `data/source-features/${path.basename(manifest.localGeojson)}`;
    checksumInputs.set(
      sourceRelativePath,
      await readFile(
        path.join(
          dataDirectory,
          "source-features",
          path.basename(sourceRelativePath),
        ),
        "utf8",
      ),
    );
  }
  for (const [relativePath, content] of artifacts) {
    if (
      relativePath.startsWith("dist/boundaries-web/") ||
      relativePath.startsWith("dist/web-") ||
      relativePath === "dist/all-web.geojson" ||
      relativePath.startsWith("dist/v3/") ||
      relativePath.startsWith("dist/boundaries/") ||
      relativePath === "dist/catalog.json" ||
      relativePath === "dist/source-catalog.json" ||
      relativePath === "dist/all.geojson" ||
      relativePath === "dist/source-all.geojson"
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
  if (checkOnly) {
    const entries = await readdir(path.join(outputDirectory, "dist"), {
      recursive: true,
      withFileTypes: true,
    });
    const actual = entries
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path.relative(outputDirectory, path.join(entry.parentPath, entry.name)),
      )
      .sort();
    const expected = [...artifacts.keys()]
      .filter((name) => name.startsWith("dist/"))
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(
        "Orphaned or missing dist artifacts; review the generated inventory",
      );
  }
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
    const webMeasurements = JSON.parse(
      await readFile(
        path.join(rootDirectory, "dist/web-measurements.json"),
        "utf8",
      ),
    ) as {
      records: Array<{
        reference: string;
        detailed: { raw: number; gzip: number };
        web: { raw: number; gzip: number };
      }>;
    };
    console.log(
      `Web payload measurements: ${JSON.stringify(webMeasurements.records.filter((record) => ["ALL", "US-2870"].includes(record.reference)))}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
