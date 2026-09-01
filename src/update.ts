#!/usr/bin/env -S node --experimental-strip-types

import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { potaReferencesUrl } from "../config/boundary-sources.ts";
import { fetchReviewedGeometry } from "./boundaries.ts";
import {
  deriveCounties,
  fetchCountyBoundaries,
  fetchJson,
} from "./counties.ts";
import { atomicWrite, writePackageArtifacts } from "./package.ts";
import { normalizePotaReferences } from "./references.ts";
import type { GeometryResult } from "./boundaries.ts";
import type {
  ManifestRecord,
  PotaReference,
  PotaReferenceSource,
} from "./types.ts";
import { readJson, validateSnapshot } from "./validate.ts";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function assertReviewCoverage(
  references: PotaReference[],
  reviewedSources: ManifestRecord[],
): void {
  const upstream = new Set(references.map((record) => record.reference));
  const reviewed = new Set(reviewedSources.map((record) => record.reference));
  const unreviewed = [...upstream].filter(
    (reference) => !reviewed.has(reference),
  );
  const missing = [...reviewed].filter((reference) => !upstream.has(reference));
  if (unreviewed.length || missing.length) {
    throw new Error(
      [
        unreviewed.length
          ? `Unreviewed upstream references: ${unreviewed.join(", ")}`
          : "",
        missing.length
          ? `Reviewed references missing upstream: ${missing.join(", ")}`
          : "",
        "Research the change and update config/reviewed-sources.json explicitly.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  transform: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(values.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await transform(values[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () =>
      worker(),
    ),
  );
  return output;
}

async function assertNoOrphanFiles(
  boundaryDirectory: string,
  manifest: ManifestRecord[],
): Promise<void> {
  const expected = new Set(
    manifest
      .map((record) => record.localGeojson)
      .filter((value): value is string => Boolean(value))
      .map((filePath) => path.basename(filePath)),
  );
  const actual = new Set(
    (await readdir(boundaryDirectory)).filter((name) =>
      name.endsWith(".geojson"),
    ),
  );
  const orphaned = [...actual].filter((name) => !expected.has(name));
  const missing = [...expected].filter((name) => !actual.has(name));
  if (orphaned.length || missing.length) {
    throw new Error(
      `Boundary inventory needs explicit review. Orphaned: ${orphaned.join(", ") || "none"}; missing: ${missing.join(", ") || "none"}.`,
    );
  }
}

async function writeCandidateSnapshot(
  candidateDataDirectory: string,
  references: PotaReference[],
  results: GeometryResult[],
): Promise<void> {
  await atomicWrite(
    path.join(candidateDataDirectory, "references.json"),
    json(references),
  );
  await atomicWrite(
    path.join(candidateDataDirectory, "manifest.json"),
    json(results.map((result) => result.manifest)),
  );
  for (const result of results) {
    const fileName = `${result.manifest.reference.toLowerCase()}.geojson`;
    await atomicWrite(
      path.join(candidateDataDirectory, "boundaries", fileName),
      json(result.geojson),
    );
  }
}

async function installCandidateSnapshot(
  candidateDataDirectory: string,
  manifest: ManifestRecord[],
): Promise<void> {
  const dataDirectory = path.join(rootDirectory, "data");
  await atomicWrite(
    path.join(dataDirectory, "references.json"),
    await readFile(
      path.join(candidateDataDirectory, "references.json"),
      "utf8",
    ),
  );
  await atomicWrite(
    path.join(dataDirectory, "manifest.json"),
    await readFile(path.join(candidateDataDirectory, "manifest.json"), "utf8"),
  );
  for (const record of manifest) {
    if (!record.localGeojson) {
      continue;
    }
    const fileName = path.basename(record.localGeojson);
    await atomicWrite(
      path.join(dataDirectory, "boundaries", fileName),
      await readFile(
        path.join(candidateDataDirectory, "boundaries", fileName),
        "utf8",
      ),
    );
  }
}

export async function update(): Promise<void> {
  const reviewedSources = await readJson<ManifestRecord[]>(
    path.join(rootDirectory, "config/reviewed-sources.json"),
  );
  const upstreamReferences =
    await fetchJson<PotaReferenceSource[]>(potaReferencesUrl);
  const references = normalizePotaReferences(upstreamReferences);
  assertReviewCoverage(references, reviewedSources);
  const reviewedByReference = new Map(
    reviewedSources.map((record) => [record.reference, record]),
  );

  const results = await mapWithConcurrency(references, 6, async (reference) => {
    const reviewed = reviewedByReference.get(reference.reference);
    if (!reviewed) {
      throw new Error(`${reference.reference} has no reviewed source mapping`);
    }
    return fetchReviewedGeometry(reference, reviewed);
  });

  const counties = await fetchCountyBoundaries();
  const referencesWithCounties = references.map((reference, index) => ({
    ...reference,
    counties: deriveCounties(reference, results[index].geojson, counties),
  }));

  const candidateRoot = await mkdtemp(path.join(rootDirectory, ".update-"));
  const candidateDataDirectory = path.join(candidateRoot, "data");
  try {
    await writeCandidateSnapshot(
      candidateDataDirectory,
      referencesWithCounties,
      results,
    );
    const validation = await validateSnapshot(
      rootDirectory,
      candidateDataDirectory,
    );
    await assertNoOrphanFiles(
      path.join(rootDirectory, "data/boundaries"),
      validation.manifest,
    );
    await installCandidateSnapshot(candidateDataDirectory, validation.manifest);
    await writePackageArtifacts(rootDirectory);
    console.log(
      `Updated ${validation.references.length} references and ${validation.featureCount} features from reviewed sources.`,
    );
  } finally {
    await rm(candidateRoot, { recursive: true, force: true });
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await update();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
