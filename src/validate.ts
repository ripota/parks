import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";

import { sourceKeyByName, sources } from "../config/boundary-sources.ts";
import type {
  DerivationManifest,
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
  derivations: DerivationManifest;
  geojsonByReference: Map<string, GeoJsonFeatureCollection>;
  sourceGeojsonByReference: Map<string, GeoJsonFeatureCollection>;
  featureCount: number;
  displayFeatureCount: number;
  sourceFeatureCount: number;
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

function assertRingWinding(
  ring: unknown,
  counterclockwise: boolean,
  context: string,
): void {
  assert(Array.isArray(ring), `${context} has an invalid polygon ring`);
  const coordinates = ring as number[][];
  let signedArea = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    signedArea +=
      coordinates[index][0] * coordinates[index + 1][1] -
      coordinates[index + 1][0] * coordinates[index][1];
  }
  assert(
    signedArea > 0 === counterclockwise,
    `${context} does not follow the GeoJSON right-hand rule`,
  );
}

function validateGeometry(
  geojson: GeoJsonFeatureCollection,
  reference: string,
  geometryRole: "display" | "source",
): void {
  assert(
    geojson.type === "FeatureCollection",
    `${reference} is not a FeatureCollection`,
  );
  assert(geojson.features.length > 0, `${reference} has no features`);
  assert(
    geojson.properties?.schemaVersion === 2,
    `${reference} ${geometryRole} GeoJSON has wrong schema version`,
  );
  assert(
    geojson.properties?.geometryRole === geometryRole,
    `${reference} GeoJSON has wrong geometry role`,
  );
  assert(
    geojson.$schema ===
      `https://ripota.org/schemas/v2/${geometryRole === "display" ? "display" : "source"}-geojson.schema.json`,
    `${reference} ${geometryRole} GeoJSON has wrong schema URL`,
  );
  if (geometryRole === "display") {
    assert(
      geojson.features.length === 1,
      `${reference} display GeoJSON must contain one feature`,
    );
  }
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
    const supportedTypes =
      geometryRole === "display"
        ? ["Point", "Polygon", "MultiPolygon"]
        : ["Point", "LineString", "MultiLineString", "Polygon", "MultiPolygon"];
    assert(
      supportedTypes.includes(feature.geometry.type),
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
      for (const [ringIndex, ring] of feature.geometry.coordinates.entries()) {
        assertRingClosed(ring, context);
        if (geometryRole === "display") {
          assertRingWinding(ring, ringIndex === 0, context);
        }
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
        for (const [ringIndex, ring] of polygon.entries()) {
          assertRingClosed(ring, context);
          if (geometryRole === "display") {
            assertRingWinding(ring, ringIndex === 0, context);
          }
        }
      }
    }

    if (
      geometryRole === "display" &&
      ["Polygon", "MultiPolygon"].includes(feature.geometry.type)
    ) {
      const validity = new IsValidOp(
        new GeoJSONReader(new GeometryFactory()).read(feature.geometry),
      );
      assert(
        validity.isValid(),
        `${context} is topologically invalid: ${String(validity.getValidationError())}`,
      );
    }
  }
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

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
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
  const derivations = await readJson<DerivationManifest>(
    path.join(dataDirectory, "derivations.json"),
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

  assert(
    derivations.schemaVersion === 2 && derivations.algorithmVersion === 1,
    "derivations.json has an unsupported schema or algorithm version",
  );
  assert(
    derivations.unionEngine.name === "jsts" &&
      derivations.unionEngine.version === "2.12.1",
    "derivations.json has an unexpected union engine",
  );
  assert(
    derivations.validationEngine.name === "jsts" &&
      derivations.validationEngine.version === "2.12.1",
    "derivations.json has an unexpected validation engine",
  );
  assert(
    JSON.stringify(derivations.records.map((record) => record.reference)) ===
      JSON.stringify(referenceIds),
    "reference/derivation parity mismatch",
  );
  const derivationByReference = new Map(
    derivations.records.map((record) => [record.reference, record]),
  );
  const expectedFiles = new Set<string>();
  const geojsonByReference = new Map<string, GeoJsonFeatureCollection>();
  const sourceGeojsonByReference = new Map<string, GeoJsonFeatureCollection>();
  let displayFeatureCount = 0;
  let sourceFeatureCount = 0;

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
    const displayPath = path.join(dataDirectory, "boundaries", fileName);
    const sourcePath = path.join(dataDirectory, "source-features", fileName);
    const [displayContent, sourceContent] = await Promise.all([
      readFile(displayPath, "utf8"),
      readFile(sourcePath, "utf8"),
    ]);
    const geojson = JSON.parse(displayContent) as GeoJsonFeatureCollection;
    const sourceGeojson = JSON.parse(sourceContent) as GeoJsonFeatureCollection;
    validateGeometry(geojson, record.reference, "display");
    validateGeometry(sourceGeojson, record.reference, "source");
    for (const candidate of [geojson, sourceGeojson]) {
      assert(
        candidate.properties?.potaReference === record.reference,
        `${record.reference} GeoJSON has wrong reference`,
      );
      assert(
        candidate.properties?.geometryKind === record.geometryKind,
        `${record.reference} GeoJSON has wrong geometry kind`,
      );
      assert(
        candidate.properties?.sourceName === record.sourceName,
        `${record.reference} GeoJSON has wrong source name`,
      );
      assert(
        candidate.properties?.sourceUrl === record.sourceUrl,
        `${record.reference} GeoJSON has wrong source URL`,
      );
    }
    const sourceKey = sourceKeyByName.get(record.sourceName);
    const idsInGeojson =
      record.geometryKind === "activation-zone"
        ? sourceGeojson.features.map(
            (feature) =>
              feature.properties?.[sources.waroRoute.idField] as
                string | number,
          )
        : record.geometryKind === "point"
          ? sourceGeojson.features.map(
              (feature) => feature.properties?.reference as string | number,
            )
          : sourceKey
            ? sourceGeojson.features.map(
                (feature) =>
                  feature.properties?.[sources[sourceKey].idField] as
                    string | number,
              )
            : undefined;
    assert(
      JSON.stringify(idsInGeojson) === JSON.stringify(record.sourceFeatureIds),
      `${record.reference} checked-in feature IDs do not match the reviewed manifest`,
    );
    const derivation = derivationByReference.get(record.reference);
    assert(derivation, `${record.reference} has no derivation record`);
    assert(
      derivation.sourceArtifact === `./source-features/${fileName}` &&
        derivation.displayArtifact === `./boundaries/${fileName}`,
      `${record.reference} has unstable derivation paths`,
    );
    assert(
      derivation.sourceSha256 === sha256(sourceContent) &&
        derivation.displaySha256 === sha256(displayContent),
      `${record.reference} derivation checksum mismatch`,
    );
    assert(
      derivation.sourceFeatureCount === sourceGeojson.features.length &&
        derivation.displayFeatureCount === geojson.features.length,
      `${record.reference} derivation feature count mismatch`,
    );
    const metrics = geometryMetrics(geojson);
    assert(
      derivation.componentCount === metrics.componentCount &&
        derivation.holeCount === metrics.holeCount &&
        derivation.coordinateCount === metrics.coordinateCount,
      `${record.reference} derivation geometry metrics mismatch`,
    );
    if (derivation.unionInputAreaSquareMeters !== undefined) {
      assert(
        derivation.displayAreaSquareMeters !== undefined,
        `${record.reference} derivation display area is missing`,
      );
      const tolerance = Math.max(
        0.01,
        derivation.unionInputAreaSquareMeters * 1e-9,
      );
      assert(
        derivation.displayAreaSquareMeters <=
          derivation.unionInputAreaSquareMeters + tolerance,
        `${record.reference} display area unexpectedly exceeds its union input`,
      );
    } else {
      assert(
        derivation.displayAreaSquareMeters === undefined,
        `${record.reference} point derivation unexpectedly has polygon area`,
      );
    }
    geojsonByReference.set(record.reference, geojson);
    sourceGeojsonByReference.set(record.reference, sourceGeojson);
    displayFeatureCount += geojson.features.length;
    sourceFeatureCount += sourceGeojson.features.length;
  }

  for (const directoryName of ["boundaries", "source-features"]) {
    const actualFiles = new Set(
      (await readdir(path.join(dataDirectory, directoryName))).filter((name) =>
        name.endsWith(".geojson"),
      ),
    );
    assert(
      JSON.stringify(sorted([...actualFiles])) ===
        JSON.stringify(sorted([...expectedFiles])),
      `orphaned or missing ${directoryName} files: expected ${expectedFiles.size}, found ${actualFiles.size}`,
    );
  }

  return {
    references,
    manifest,
    derivations,
    geojsonByReference,
    sourceGeojsonByReference,
    featureCount: displayFeatureCount,
    displayFeatureCount,
    sourceFeatureCount,
  };
}
