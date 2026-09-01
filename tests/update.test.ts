import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { potaCoordinateSource, sources } from "../config/boundary-sources.ts";
import { writePackageArtifacts } from "../src/package.ts";
import type { GeometryResult } from "../src/boundaries.ts";
import type { CountyBoundary } from "../src/counties.ts";
import type {
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
  PotaReferenceSource,
} from "../src/types.ts";
import { update, writeCandidateSnapshot } from "../src/update.ts";
import { validateSnapshot } from "../src/validate.ts";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "parks-update-test-"));
  temporaryRoots.push(root);
  return root;
}

function manifest(
  reference: string,
  status: "available" | "point-only",
): ManifestRecord {
  const localGeojson = `./boundaries/${reference.toLowerCase()}.geojson`;
  if (status === "point-only") {
    return {
      reference,
      status,
      geometryKind: "point",
      sourceName: potaCoordinateSource.name,
      sourceUrl: `${potaCoordinateSource.url}/${reference}`,
      sourceFeatureIds: [reference],
      localGeojson,
      notes: "Reviewed point fallback fixture.",
    };
  }
  return {
    reference,
    status,
    geometryKind: "boundary",
    sourceName: sources.ridem.name,
    sourceUrl: sources.ridem.url,
    sourceQuery: `OBJECTID = ${Number(reference.split("-")[1])}`,
    sourceFeatureIds: [Number(reference.split("-")[1])],
    localGeojson,
  };
}

function source(record: ManifestRecord): PotaReferenceSource {
  const number = Number(record.reference.split("-")[1]);
  return {
    reference: record.reference,
    name: `Fixture ${number}`,
    latitude: 41.4 + number / 1_000,
    longitude: -71.7 + number / 1_000,
    grid: "FN41",
    locationDesc: "US-RI",
  };
}

function normalized(record: ManifestRecord): PotaReference {
  const upstream = source(record);
  return {
    reference: upstream.reference,
    name: upstream.name,
    latitude: Number(upstream.latitude),
    longitude: Number(upstream.longitude),
    grid: upstream.grid,
    counties: ["Fixture County"],
    locationDesc: upstream.locationDesc!,
    potaUrl: `https://pota.app/#/park/${upstream.reference}`,
  };
}

function geometryResult(record: ManifestRecord): GeometryResult {
  const reference = normalized(record);
  if (record.status === "point-only") {
    const sourceFeature = {
      type: "Feature" as const,
      properties: {
        reference: record.reference,
        name: reference.name,
        grid: reference.grid,
      },
      geometry: {
        type: "Point",
        coordinates: [reference.longitude, reference.latitude],
      },
    };
    return {
      manifest: record,
      sourceGeojson: {
        $schema: "https://ripota.org/schemas/v2/source-geojson.schema.json",
        type: "FeatureCollection",
        properties: {
          schemaVersion: 2,
          geometryRole: "source",
          geometryKind: "point",
          potaReference: record.reference,
          potaName: reference.name,
          sourceName: record.sourceName,
          sourceUrl: record.sourceUrl,
          notes: record.notes,
        },
        features: [sourceFeature],
      },
      displayGeojson: {
        $schema: "https://ripota.org/schemas/v2/display-geojson.schema.json",
        type: "FeatureCollection",
        properties: {
          schemaVersion: 2,
          geometryRole: "display",
          geometryKind: "point",
          potaReference: record.reference,
          potaName: reference.name,
          sourceName: record.sourceName,
          sourceUrl: record.sourceUrl,
          notes: record.notes,
        },
        features: [
          {
            ...sourceFeature,
            properties: {
              potaReference: record.reference,
              potaName: reference.name,
              geometryKind: "point",
              geometryRole: "display",
            },
          },
        ],
      },
      operations: [{ operation: "identity" }],
    };
  }

  const west = reference.longitude - 0.01;
  const east = reference.longitude + 0.01;
  const south = reference.latitude - 0.01;
  const north = reference.latitude + 0.01;
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
  return {
    manifest: record,
    sourceGeojson: {
      $schema: "https://ripota.org/schemas/v2/source-geojson.schema.json",
      type: "FeatureCollection",
      properties: {
        schemaVersion: 2,
        geometryRole: "source",
        geometryKind: "boundary",
        potaReference: record.reference,
        potaName: reference.name,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        sourceQuery: record.sourceQuery,
      },
      features: [
        {
          type: "Feature",
          properties: { OBJECTID: record.sourceFeatureIds![0] },
          geometry,
        },
      ],
    },
    displayGeojson: {
      $schema: "https://ripota.org/schemas/v2/display-geojson.schema.json",
      type: "FeatureCollection",
      properties: {
        schemaVersion: 2,
        geometryRole: "display",
        geometryKind: "boundary",
        potaReference: record.reference,
        potaName: reference.name,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        sourceQuery: record.sourceQuery,
      },
      features: [
        {
          type: "Feature",
          properties: {
            potaReference: record.reference,
            potaName: reference.name,
            geometryKind: "boundary",
            geometryRole: "display",
          },
          geometry,
        },
      ],
    },
    operations: [{ operation: "unary-union" }],
  };
}

const countyBoundaries: CountyBoundary[] = [
  {
    county: "Fixture County",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-72, 41],
          [-71, 41],
          [-71, 42],
          [-72, 42],
          [-72, 41],
        ],
      ],
    },
  },
];

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function createRepositoryFixture(
  liveRecords: ManifestRecord[],
  reviewedRecords: ManifestRecord[],
): Promise<string> {
  const root = await temporaryRoot();
  await writeJson(
    path.join(root, "config/reviewed-sources.json"),
    reviewedRecords,
  );
  await writeCandidateSnapshot(
    path.join(root, "data"),
    liveRecords.map(normalized),
    liveRecords.map(geometryResult),
  );
  await mkdir(path.join(root, "dist"), { recursive: true });
  await writeFile(path.join(root, "dist/catalog.json"), "old catalog\n");
  await writeFile(path.join(root, "dist/all.geojson"), "old aggregate\n");
  await writeFile(path.join(root, "dist/checksums.sha256"), "old checksums\n");
  return root;
}

async function updateFixture(
  rootDirectory: string,
  records: ManifestRecord[],
  extra: Parameters<typeof update>[0] = {},
): Promise<void> {
  const byReference = new Map(
    records.map((record) => [record.reference, record]),
  );
  await update({
    rootDirectory,
    fetchReferences: async () => records.map(source),
    fetchGeometry: async (reference) =>
      geometryResult(byReference.get(reference.reference)!),
    fetchCounties: async () => countyBoundaries,
    ...extra,
  });
}

async function snapshotTrees(root: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  async function visit(relativeDirectory: string): Promise<void> {
    const directory = path.join(root, relativeDirectory);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(relativePath);
      } else {
        snapshot.set(
          relativePath,
          (await readFile(path.join(root, relativePath))).toString("base64"),
        );
      }
    }
  }
  await visit("data");
  await visit("dist");
  return snapshot;
}

async function expectNoUpdateDirectories(root: string): Promise<void> {
  expect(
    (await readdir(root)).filter((name) => name.startsWith(".update-")),
  ).toEqual([]);
}

describe("transactional snapshot updates", () => {
  for (const status of ["available", "point-only"] as const) {
    it(`installs a newly reviewed ${status} reference without a placeholder`, async () => {
      const existing = manifest("US-1", "point-only");
      const added = manifest("US-2", status);
      const records = [existing, added];
      const root = await createRepositoryFixture([existing], records);

      await updateFixture(root, records);

      await expect(
        readFile(path.join(root, "data/boundaries/us-2.geojson"), "utf8"),
      ).resolves.toContain(`"geometryKind": "${added.geometryKind}"`);
      await expect(validateSnapshot(root)).resolves.toMatchObject({
        featureCount: 2,
      });
      await expect(writePackageArtifacts(root, true)).resolves.toBeUndefined();
      await expectNoUpdateDirectories(root);
    });
  }

  it("blocks a stale live boundary for a removed reference", async () => {
    const kept = manifest("US-1", "point-only");
    const removed = manifest("US-2", "available");
    const root = await createRepositoryFixture([kept, removed], [kept]);
    const before = await snapshotTrees(root);

    await expect(updateFixture(root, [kept])).rejects.toThrow(
      "Stale live files: us-2.geojson",
    );
    expect(await snapshotTrees(root)).toEqual(before);
    await expectNoUpdateDirectories(root);
  });

  it("rejects a candidate missing a manifest-declared boundary", async () => {
    const record = manifest("US-1", "available");
    const root = await createRepositoryFixture([], [record]);
    const candidateData = path.join(root, "candidate/data");
    await writeCandidateSnapshot(
      candidateData,
      [normalized(record)],
      [geometryResult(record)],
    );
    await unlink(path.join(candidateData, "boundaries/us-1.geojson"));

    await expect(validateSnapshot(root, candidateData)).rejects.toThrow();
  });

  it("leaves the live snapshot unchanged after staging fails", async () => {
    const existing = manifest("US-1", "point-only");
    const added = manifest("US-2", "available");
    const records = [existing, added];
    const root = await createRepositoryFixture([existing], records);
    const before = await snapshotTrees(root);

    await expect(
      updateFixture(root, records, {
        beforeCommit: () => {
          throw new Error("injected staging failure");
        },
      }),
    ).rejects.toThrow("injected staging failure");
    expect(await snapshotTrees(root)).toEqual(before);
    await expectNoUpdateDirectories(root);
  });

  it("restores the exact prior snapshot after a commit failure", async () => {
    const existing = manifest("US-1", "point-only");
    const added = manifest("US-2", "available");
    const records = [existing, added];
    const root = await createRepositoryFixture([existing], records);
    const before = await snapshotTrees(root);

    await expect(
      updateFixture(root, records, {
        commitStep: (step) => {
          if (step === "after-dist-install") {
            throw new Error("injected commit failure");
          }
        },
      }),
    ).rejects.toThrow("injected commit failure");
    expect(await snapshotTrees(root)).toEqual(before);
    await expectNoUpdateDirectories(root);
  });
});
