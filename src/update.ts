#!/usr/bin/env -S node --experimental-strip-types

import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  DerivationManifest,
  DerivationRecord,
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
  PotaReferenceSource,
} from "./types.ts";
import { readJson, validateSnapshot } from "./validate.ts";

const defaultRootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

type CommitStep =
  | "after-data-backup"
  | "after-data-install"
  | "after-dist-backup"
  | "after-dist-install";

export type UpdateOptions = {
  beforeCommit?: (candidateRoot: string) => Promise<void> | void;
  commitStep?: (step: CommitStep) => Promise<void> | void;
  fetchCounties?: typeof fetchCountyBoundaries;
  fetchGeometry?: typeof fetchReviewedGeometry;
  fetchReferences?: () => Promise<PotaReferenceSource[]>;
  rootDirectory?: string;
};

export class SnapshotRollbackError extends AggregateError {
  constructor(errors: unknown[]) {
    super(
      errors,
      "Snapshot commit failed and rollback was incomplete; preserve the update directory for recovery.",
    );
    this.name = "SnapshotRollbackError";
  }
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function geometryMetrics(geojson: GeoJsonFeatureCollection): {
  componentCount: number;
  holeCount: number;
  coordinateCount: number;
} {
  let componentCount = 0;
  let holeCount = 0;
  let coordinateCount = 0;
  function countPositions(coordinates: unknown): void {
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      coordinateCount += 1;
      return;
    }
    if (Array.isArray(coordinates)) {
      coordinates.forEach(countPositions);
    }
  }
  for (const feature of geojson.features) {
    if (feature.geometry.type === "Polygon") {
      const rings = feature.geometry.coordinates as unknown[];
      componentCount += 1;
      holeCount += Math.max(0, rings.length - 1);
    } else if (feature.geometry.type === "MultiPolygon") {
      const polygons = feature.geometry.coordinates as unknown[][];
      componentCount += polygons.length;
      holeCount += polygons.reduce(
        (total, rings) => total + Math.max(0, rings.length - 1),
        0,
      );
    } else if (feature.geometry.type === "Point") {
      componentCount += 1;
    }
    countPositions(feature.geometry.coordinates);
  }
  return { componentCount, holeCount, coordinateCount };
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

export async function assertNoStaleBoundaryFiles(
  boundaryDirectory: string,
  manifest: ManifestRecord[],
): Promise<void> {
  const expected = new Set(
    manifest
      .map((record) => record.localGeojson)
      .filter((value): value is string => Boolean(value))
      .map((filePath) => path.basename(filePath)),
  );
  let names: string[] = [];
  try {
    names = await readdir(boundaryDirectory);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
  const actual = new Set(names.filter((name) => name.endsWith(".geojson")));
  const orphaned = [...actual].filter((name) => !expected.has(name));
  if (orphaned.length) {
    throw new Error(
      `Boundary inventory needs explicit review. Stale live files: ${orphaned.join(", ")}.`,
    );
  }
}

export async function writeCandidateSnapshot(
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
  await mkdir(path.join(candidateDataDirectory, "boundaries"), {
    recursive: true,
  });
  await mkdir(path.join(candidateDataDirectory, "source-features"), {
    recursive: true,
  });
  const derivationRecords: DerivationRecord[] = [];
  for (const result of results) {
    if (result.manifest.status === "research-needed") continue;
    const fileName = `${result.manifest.reference.toLowerCase()}.geojson`;
    const sourceContent = json(result.sourceGeojson);
    const displayContent = json(result.displayGeojson);
    await atomicWrite(
      path.join(candidateDataDirectory, "boundaries", fileName),
      displayContent,
    );
    await atomicWrite(
      path.join(candidateDataDirectory, "source-features", fileName),
      sourceContent,
    );
    derivationRecords.push({
      reference: result.manifest.reference,
      sourceArtifact: `./source-features/${fileName}`,
      displayArtifact: `./boundaries/${fileName}`,
      sourceSha256: sha256(sourceContent),
      displaySha256: sha256(displayContent),
      sourceFeatureCount: result.sourceGeojson.features.length,
      displayFeatureCount: result.displayGeojson.features.length,
      ...geometryMetrics(result.displayGeojson),
      ...(result.unionInputAreaSquareMeters === undefined
        ? {}
        : {
            unionInputAreaSquareMeters: result.unionInputAreaSquareMeters,
          }),
      ...(result.displayAreaSquareMeters === undefined
        ? {}
        : { displayAreaSquareMeters: result.displayAreaSquareMeters }),
      operations: result.operations,
    });
  }
  const derivations: DerivationManifest = {
    $schema: "https://ripota.org/schemas/v2/manifest.schema.json",
    schemaVersion: 2,
    algorithmVersion: 2,
    unionEngine: { name: "jsts", version: "2.12.1" },
    validationEngine: { name: "jsts", version: "2.12.1" },
    records: derivationRecords,
  };
  await atomicWrite(
    path.join(candidateDataDirectory, "derivations.json"),
    json(derivations),
  );
}

async function runCommitStep(
  hook: UpdateOptions["commitStep"],
  step: CommitStep,
): Promise<void> {
  if (hook) {
    await hook(step);
  }
}

export async function commitStagedSnapshot(
  rootDirectory: string,
  candidateRoot: string,
  commitStep?: UpdateOptions["commitStep"],
): Promise<void> {
  const liveData = path.join(rootDirectory, "data");
  const liveDist = path.join(rootDirectory, "dist");
  const stagedData = path.join(candidateRoot, "data");
  const stagedDist = path.join(candidateRoot, "dist");
  const previousData = path.join(candidateRoot, "previous-data");
  const previousDist = path.join(candidateRoot, "previous-dist");
  const failedData = path.join(candidateRoot, "failed-data");
  const failedDist = path.join(candidateRoot, "failed-dist");
  let dataBackedUp = false;
  let dataInstalled = false;
  let distBackedUp = false;
  let distInstalled = false;

  try {
    await rename(liveData, previousData);
    dataBackedUp = true;
    await runCommitStep(commitStep, "after-data-backup");
    await rename(stagedData, liveData);
    dataInstalled = true;
    await runCommitStep(commitStep, "after-data-install");
    await rename(liveDist, previousDist);
    distBackedUp = true;
    await runCommitStep(commitStep, "after-dist-backup");
    await rename(stagedDist, liveDist);
    distInstalled = true;
    await runCommitStep(commitStep, "after-dist-install");
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    async function rollback(operation: () => Promise<void>): Promise<void> {
      try {
        await operation();
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }

    if (distInstalled) {
      await rollback(() => rename(liveDist, failedDist));
    }
    if (distBackedUp) {
      await rollback(() => rename(previousDist, liveDist));
    }
    if (dataInstalled) {
      await rollback(() => rename(liveData, failedData));
    }
    if (dataBackedUp) {
      await rollback(() => rename(previousData, liveData));
    }

    if (rollbackErrors.length > 0) {
      throw new SnapshotRollbackError([error, ...rollbackErrors]);
    }
    throw error;
  }
}

export async function update(options: UpdateOptions = {}): Promise<void> {
  const rootDirectory = options.rootDirectory ?? defaultRootDirectory;
  const fetchReferences =
    options.fetchReferences ??
    (() => fetchJson<PotaReferenceSource[]>(potaReferencesUrl));
  const fetchGeometry = options.fetchGeometry ?? fetchReviewedGeometry;
  const fetchCounties = options.fetchCounties ?? fetchCountyBoundaries;
  const reviewedSources = await readJson<ManifestRecord[]>(
    path.join(rootDirectory, "config/reviewed-sources.json"),
  );
  const upstreamReferences = await fetchReferences();
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
    return fetchGeometry(reference, reviewed);
  });

  const counties = await fetchCounties();
  const referencesWithCounties = references.map((reference, index) => {
    const result = results[index];
    const displayCounties = deriveCounties(
      reference,
      result.displayGeojson,
      counties,
    );
    if (result.manifest.geometryKind === "boundary") {
      const sourceCounties = deriveCounties(
        reference,
        result.sourceGeojson,
        counties,
      );
      if (JSON.stringify(sourceCounties) !== JSON.stringify(displayCounties)) {
        throw new Error(
          `${reference.reference} display union changed county membership`,
        );
      }
    }
    return { ...reference, counties: displayCounties };
  });

  const candidateRoot = await mkdtemp(path.join(rootDirectory, ".update-"));
  const candidateDataDirectory = path.join(candidateRoot, "data");
  let preserveCandidate = false;
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
    await assertNoStaleBoundaryFiles(
      path.join(rootDirectory, "data/boundaries"),
      validation.manifest,
    );
    await assertNoStaleBoundaryFiles(
      path.join(rootDirectory, "data/source-features"),
      validation.manifest.map((record) => ({
        ...record,
        localGeojson: `./source-features/${record.reference.toLowerCase()}.geojson`,
      })),
    );
    await writePackageArtifacts(
      rootDirectory,
      false,
      candidateDataDirectory,
      candidateRoot,
    );
    await writePackageArtifacts(
      rootDirectory,
      true,
      candidateDataDirectory,
      candidateRoot,
    );
    await options.beforeCommit?.(candidateRoot);
    await commitStagedSnapshot(
      rootDirectory,
      candidateRoot,
      options.commitStep,
    );
    console.log(
      `Updated ${validation.references.length} references, ${validation.displayFeatureCount} display features, and ${validation.sourceFeatureCount} source features from reviewed sources.`,
    );
  } catch (error) {
    preserveCandidate = error instanceof SnapshotRollbackError;
    throw error;
  } finally {
    if (!preserveCandidate) {
      await rm(candidateRoot, { recursive: true, force: true });
    }
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
