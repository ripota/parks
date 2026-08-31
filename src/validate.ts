import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { sourceKeyByName, sources } from "../config/boundary-sources.ts";
import type {
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
} from "./types.ts";

const RI_BOUNDS = {
  west: -72.1,
  east: -70.8,
  south: 40.9,
  north: 42.2,
};

export type SnapshotValidation = {
  references: PotaReference[];
  manifest: ManifestRecord[];
  geojsonByReference: Map<string, GeoJsonFeatureCollection>;
  featureCount: number;
};

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function positions(coordinates: unknown, output: number[][] = []): number[][] {
  if (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    output.push(coordinates as number[]);
    return output;
  }

  assert(
    Array.isArray(coordinates),
    "GeoJSON coordinates must be nested arrays",
  );
  for (const child of coordinates) {
    positions(child, output);
  }
  return output;
}

function assertRingClosed(ring: unknown, context: string): void {
  assert(
    Array.isArray(ring) && ring.length >= 4,
    `${context} has an invalid polygon ring`,
  );
  const first = ring[0];
  const last = ring.at(-1);
  assert(
    Array.isArray(first) &&
      Array.isArray(last) &&
      first.length >= 2 &&
      first[0] === last[0] &&
      first[1] === last[1],
    `${context} has an open polygon ring`,
  );
}

function validateGeometry(
  geojson: GeoJsonFeatureCollection,
  reference: string,
): void {
  assert(
    geojson.type === "FeatureCollection",
    `${reference} is not a FeatureCollection`,
  );
  assert(geojson.features.length > 0, `${reference} has no features`);
  if ("crs" in geojson) {
    const crsName = String(
      (
        geojson as GeoJsonFeatureCollection & {
          crs?: { properties?: { name?: unknown } };
        }
      ).crs?.properties?.name ?? "",
    );
    assert(
      crsName === "EPSG:4326" || crsName.endsWith(":CRS84"),
      `${reference} declares unsupported CRS ${crsName}`,
    );
  }

  for (const [featureIndex, feature] of geojson.features.entries()) {
    const context = `${reference} feature ${featureIndex}`;
    assert(feature.type === "Feature", `${context} is not a Feature`);
    assert(
      feature.geometry && typeof feature.geometry === "object",
      `${context} has no geometry`,
    );
    assert(
      ["Point", "Polygon", "MultiPolygon"].includes(feature.geometry.type),
      `${context} has unsupported geometry ${feature.geometry.type}`,
    );

    const coordinatePositions = positions(feature.geometry.coordinates);
    assert(coordinatePositions.length > 0, `${context} has no coordinates`);

    for (const position of coordinatePositions) {
      const [longitude, latitude] = position;
      assert(
        Number.isFinite(longitude) && Number.isFinite(latitude),
        `${context} has non-finite coordinates`,
      );
      assert(
        longitude >= RI_BOUNDS.west &&
          longitude <= RI_BOUNDS.east &&
          latitude >= RI_BOUNDS.south &&
          latitude <= RI_BOUNDS.north,
        `${context} has coordinates outside the Rhode Island review area: ${longitude}, ${latitude}`,
      );
    }

    if (feature.geometry.type === "Polygon") {
      assert(
        Array.isArray(feature.geometry.coordinates),
        `${context} polygon coordinates are invalid`,
      );
      for (const ring of feature.geometry.coordinates) {
        assertRingClosed(ring, context);
      }
    }

    if (feature.geometry.type === "MultiPolygon") {
      assert(
        Array.isArray(feature.geometry.coordinates),
        `${context} multipolygon coordinates are invalid`,
      );
      for (const polygon of feature.geometry.coordinates) {
        assert(
          Array.isArray(polygon),
          `${context} multipolygon member is invalid`,
        );
        for (const ring of polygon) {
          assertRingClosed(ring, context);
        }
      }
    }
  }
}

export async function validateSnapshot(
  rootDirectory: string,
  dataDirectory = path.join(rootDirectory, "data"),
): Promise<SnapshotValidation> {
  const references = await readJson<PotaReference[]>(
    path.join(dataDirectory, "references.json"),
  );
  const manifest = await readJson<ManifestRecord[]>(
    path.join(dataDirectory, "manifest.json"),
  );
  const reviewed = await readJson<ManifestRecord[]>(
    path.join(rootDirectory, "config/reviewed-sources.json"),
  );

  assert(
    Array.isArray(references) && references.length > 0,
    "references.json must be a nonempty array",
  );
  assert(Array.isArray(manifest), "manifest.json must be an array");
  assert(
    manifest.length === references.length,
    "reference/manifest length mismatch",
  );
  assert(
    JSON.stringify(manifest) === JSON.stringify(reviewed),
    "data/manifest.json must exactly match the reviewed source mapping",
  );

  const referenceIds = references.map((record) => record.reference);
  const manifestIds = manifest.map((record) => record.reference);
  assert(
    new Set(referenceIds).size === referenceIds.length,
    "duplicate reference IDs",
  );
  assert(
    new Set(manifestIds).size === manifestIds.length,
    "duplicate manifest IDs",
  );
  assert(
    JSON.stringify(referenceIds) === JSON.stringify(sorted(referenceIds)),
    "references are not sorted",
  );
  assert(
    JSON.stringify(manifestIds) === JSON.stringify(sorted(manifestIds)),
    "manifest is not sorted",
  );
  assert(
    JSON.stringify(referenceIds) === JSON.stringify(manifestIds),
    "reference/manifest parity mismatch",
  );

  for (const reference of references) {
    assert(
      /^US-\d+$/.test(reference.reference),
      `invalid reference ${reference.reference}`,
    );
    assert(
      reference.potaUrl === `https://pota.app/#/park/${reference.reference}`,
      `${reference.reference} has an invalid POTA URL`,
    );
    assert(
      Number.isFinite(reference.latitude) &&
        Number.isFinite(reference.longitude),
      `${reference.reference} has invalid coordinates`,
    );
    assert(
      reference.locationDesc.split(",").includes("US-RI"),
      `${reference.reference} does not include US-RI in its official locations`,
    );
    assert(
      reference.counties.length > 0,
      `${reference.reference} has no county`,
    );
    assert(
      JSON.stringify(reference.counties) ===
        JSON.stringify(sorted(reference.counties)),
      `${reference.reference} counties are not sorted`,
    );
    for (const county of reference.counties) {
      assert(
        county.endsWith(" County"),
        `${reference.reference} has invalid county ${county}`,
      );
    }
  }

  const expectedFiles = new Set<string>();
  const geojsonByReference = new Map<string, GeoJsonFeatureCollection>();
  let featureCount = 0;

  for (const record of manifest) {
    assert(
      ["available", "point-only", "research-needed"].includes(record.status),
      `${record.reference} has no explicit reviewed status`,
    );
    assert(
      record.sourceName.length > 0,
      `${record.reference} has no source name`,
    );
    assert(
      /^https:\/\//.test(record.sourceUrl),
      `${record.reference} has an invalid source URL`,
    );
    assert(
      !(record.notes ?? "").match(/todo/i),
      `${record.reference} has an unreviewed TODO`,
    );

    if (record.status === "research-needed") {
      assert(
        !record.localGeojson,
        `${record.reference} research record unexpectedly has GeoJSON`,
      );
      continue;
    }

    assert(record.geometryKind, `${record.reference} has no geometry kind`);
    assert(
      record.sourceFeatureIds?.length,
      `${record.reference} has no reviewed source feature IDs`,
    );
    const expectedPath = `./boundaries/${record.reference.toLowerCase()}.geojson`;
    assert(
      record.localGeojson === expectedPath,
      `${record.reference} has unstable GeoJSON path`,
    );
    assert(
      record.status !== "point-only" || record.geometryKind === "point",
      `${record.reference} point fallback is mislabeled`,
    );
    assert(
      record.status !== "available" || record.geometryKind !== "point",
      `${record.reference} available record is mislabeled as point`,
    );

    const fileName = path.basename(record.localGeojson);
    expectedFiles.add(fileName);
    const geojson = await readJson<GeoJsonFeatureCollection>(
      path.join(dataDirectory, "boundaries", fileName),
    );
    validateGeometry(geojson, record.reference);
    assert(
      geojson.properties?.potaReference === record.reference,
      `${record.reference} GeoJSON has wrong reference`,
    );
    assert(
      geojson.properties?.geometryKind === record.geometryKind,
      `${record.reference} GeoJSON has wrong geometry kind`,
    );
    assert(
      geojson.properties?.sourceName === record.sourceName,
      `${record.reference} GeoJSON has wrong source name`,
    );
    assert(
      geojson.properties?.sourceUrl === record.sourceUrl,
      `${record.reference} GeoJSON has wrong source URL`,
    );
    const sourceKey = sourceKeyByName.get(record.sourceName);
    const idsInGeojson =
      record.geometryKind === "activation-zone"
        ? geojson.properties?.sourceFeatureIds
        : record.geometryKind === "point"
          ? geojson.features.map(
              (feature) => feature.properties?.reference as string | number,
            )
          : sourceKey
            ? geojson.features.map(
                (feature) =>
                  feature.properties?.[sources[sourceKey].idField] as
                    string | number,
              )
            : undefined;
    assert(
      JSON.stringify(idsInGeojson) === JSON.stringify(record.sourceFeatureIds),
      `${record.reference} checked-in feature IDs do not match the reviewed manifest`,
    );
    geojsonByReference.set(record.reference, geojson);
    featureCount += geojson.features.length;
  }

  const actualFiles = new Set(
    (await readdir(path.join(dataDirectory, "boundaries"))).filter((name) =>
      name.endsWith(".geojson"),
    ),
  );
  assert(
    JSON.stringify(sorted([...actualFiles])) ===
      JSON.stringify(sorted([...expectedFiles])),
    `orphaned or missing boundary files: expected ${expectedFiles.size}, found ${actualFiles.size}`,
  );

  return { references, manifest, geojsonByReference, featureCount };
}
