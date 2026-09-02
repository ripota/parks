import {
  displayGeometryRule,
  potaCoordinateSource,
  potaTrailActivationRule,
  sourceKeyByName,
  sources,
  type BoundarySource,
} from "../config/boundary-sources.ts";
import area from "@turf/area";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import UnaryUnionOp from "jsts/org/locationtech/jts/operation/union/UnaryUnionOp.js";
import type {
  Feature as StandardFeature,
  FeatureCollection as StandardFeatureCollection,
  MultiPolygon,
  Polygon,
} from "geojson";
import { fetchJson } from "./counties.ts";
import type {
  DerivationOperation,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
} from "./types.ts";

export type GeometryResult = {
  sourceGeojson: GeoJsonFeatureCollection;
  displayGeojson: GeoJsonFeatureCollection;
  manifest: ManifestRecord;
  operations: DerivationOperation[];
  unionInputAreaSquareMeters?: number;
  displayAreaSquareMeters?: number;
};

function featureFilePath(reference: string): string {
  return `./boundaries/${reference.toLowerCase()}.geojson`;
}

function collectionProperties(
  reference: PotaReference,
  reviewed: ManifestRecord,
  geometryRole: "display" | "source",
): Record<string, unknown> {
  return {
    schemaVersion: 2,
    geometryRole,
    geometryKind: reviewed.geometryKind,
    potaReference: reference.reference,
    potaName: reference.name,
    sourceName: reviewed.sourceName,
    sourceUrl: reviewed.sourceUrl,
    ...(reviewed.sourceQuery ? { sourceQuery: reviewed.sourceQuery } : {}),
    sourceFeatureIds: reviewed.sourceFeatureIds,
    ...(reviewed.notes ? { notes: reviewed.notes } : {}),
  };
}

function sourceCollection(
  reference: PotaReference,
  reviewed: ManifestRecord,
  features: GeoJsonFeature[],
  extraProperties: Record<string, unknown> = {},
): GeoJsonFeatureCollection {
  return {
    $schema: "https://ripota.org/schemas/v2/source-geojson.schema.json",
    type: "FeatureCollection",
    properties: {
      ...collectionProperties(reference, reviewed, "source"),
      ...extraProperties,
    },
    features,
  };
}

function displayCollection(
  reference: PotaReference,
  reviewed: ManifestRecord,
  feature: GeoJsonFeature,
  extraProperties: Record<string, unknown> = {},
): GeoJsonFeatureCollection {
  return {
    $schema: "https://ripota.org/schemas/v2/display-geojson.schema.json",
    type: "FeatureCollection",
    properties: {
      ...collectionProperties(reference, reviewed, "display"),
      ...extraProperties,
    },
    features: [feature],
  };
}

function signedRingArea(ring: number[][]): number {
  let result = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    result +=
      ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return result / 2;
}

function rewindRing(ring: number[][], counterclockwise: boolean): number[][] {
  return signedRingArea(ring) > 0 === counterclockwise
    ? ring
    : [...ring].reverse();
}

function rewindPolygonalGeometry(
  geometry: GeoJsonFeature["geometry"],
): GeoJsonFeature["geometry"] {
  const rewindPolygon = (rings: number[][][]) =>
    rings.map((ring, index) => rewindRing(ring, index === 0));
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: rewindPolygon(geometry.coordinates as number[][][]),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: (geometry.coordinates as number[][][][]).map(rewindPolygon),
    };
  }
  throw new Error(`Cannot rewind non-polygon geometry ${geometry.type}`);
}

function ringAreaSquareMeters(ring: number[][]): number {
  return area({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  } as StandardFeature<Polygon>);
}

export function removeSmallHoles(
  geometry: GeoJsonFeature["geometry"],
  maximumAreaSquareMeters = displayGeometryRule.maximumArtifactHoleAreaSquareMeters,
): {
  geometry: GeoJsonFeature["geometry"];
  operation: DerivationOperation;
} {
  if (maximumAreaSquareMeters <= 0) {
    throw new Error("Small-hole removal threshold must be positive");
  }

  let removedHoleCount = 0;
  let removedAreaSquareMeters = 0;
  const filterPolygon = (rings: number[][][]): number[][][] => [
    rings[0],
    ...rings.slice(1).filter((ring) => {
      const holeAreaSquareMeters = ringAreaSquareMeters(ring);
      if (holeAreaSquareMeters > maximumAreaSquareMeters) {
        return true;
      }
      removedHoleCount += 1;
      removedAreaSquareMeters += holeAreaSquareMeters;
      return false;
    }),
  ];

  let filteredGeometry: GeoJsonFeature["geometry"];
  if (geometry.type === "Polygon") {
    filteredGeometry = {
      type: "Polygon",
      coordinates: filterPolygon(geometry.coordinates as number[][][]),
    };
  } else if (geometry.type === "MultiPolygon") {
    filteredGeometry = {
      type: "MultiPolygon",
      coordinates: (geometry.coordinates as number[][][][]).map(filterPolygon),
    };
  } else {
    throw new Error(`Cannot remove holes from ${geometry.type}`);
  }

  return {
    geometry: filteredGeometry,
    operation: {
      operation: "remove-small-holes",
      maximumAreaSquareMeters,
      removedHoleCount,
      removedAreaSquareMeters,
    },
  };
}

function dissolve(
  reference: PotaReference,
  reviewed: ManifestRecord,
  features: GeoJsonFeature[],
): {
  geojson: GeoJsonFeatureCollection;
  unionInputAreaSquareMeters: number;
  displayAreaSquareMeters: number;
  operations: DerivationOperation[];
} {
  if (
    features.some(
      (feature) =>
        feature.geometry.type !== "Polygon" &&
        feature.geometry.type !== "MultiPolygon",
    )
  ) {
    throw new Error(
      `${reference.reference} display union received non-polygon geometry`,
    );
  }
  const polygonFeatures = {
    type: "FeatureCollection",
    features,
  } as unknown as StandardFeatureCollection<Polygon | MultiPolygon>;
  const reader = new GeoJSONReader(new GeometryFactory());
  const dissolved = UnaryUnionOp.union(
    reader.read({
      type: "GeometryCollection",
      geometries: features.map((feature) => feature.geometry),
    }),
  );
  const validity = new IsValidOp(dissolved);
  if (!validity.isValid()) {
    throw new Error(
      `${reference.reference} display union is invalid: ${String(validity.getValidationError())}`,
    );
  }
  const cleaned = removeSmallHoles(
    new GeoJSONWriter().write(dissolved) as GeoJsonFeature["geometry"],
  );
  const feature: GeoJsonFeature = {
    type: "Feature",
    properties: {
      potaReference: reference.reference,
      potaName: reference.name,
      geometryKind: reviewed.geometryKind,
      geometryRole: "display",
    },
    geometry: rewindPolygonalGeometry(cleaned.geometry),
  };
  return {
    geojson: displayCollection(reference, reviewed, feature),
    unionInputAreaSquareMeters: area(polygonFeatures),
    displayAreaSquareMeters: area(
      feature as unknown as StandardFeature<Polygon | MultiPolygon>,
    ),
    operations: [{ operation: "unary-union" }, cleaned.operation],
  };
}

function queryUrl(source: BoundarySource, where: string): URL {
  const url = new URL(`${source.url}/query`);
  url.search = new URLSearchParams({
    where,
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  }).toString();
  return url;
}

function sortFeatureProperties(
  properties: Record<string, unknown> | null,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function assertReviewedFeatureIds(
  reference: string,
  actual: Array<string | number>,
  expected: Array<string | number> | undefined,
): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${reference} source feature IDs changed: reviewed ${JSON.stringify(expected)}, upstream ${JSON.stringify(actual)}. Research and update config/reviewed-sources.json before accepting this mapping.`,
    );
  }
}

async function fetchBoundary(
  reference: PotaReference,
  reviewed: ManifestRecord,
  source: BoundarySource,
): Promise<GeometryResult> {
  if (!reviewed.sourceQuery) {
    throw new Error(`${reference.reference} has no reviewed source query`);
  }
  const geojson = await fetchJson<GeoJsonFeatureCollection>(
    queryUrl(source, reviewed.sourceQuery),
  );
  if (geojson.type !== "FeatureCollection" || geojson.features.length === 0) {
    throw new Error(`No GeoJSON features returned for ${reference.reference}`);
  }

  const features = geojson.features
    .map((feature) => ({
      ...feature,
      properties: sortFeatureProperties(feature.properties),
    }))
    .sort((left, right) =>
      String(left.properties[source.idField]).localeCompare(
        String(right.properties[source.idField]),
        undefined,
        { numeric: true },
      ),
    );
  const sourceFeatureIds = features.map(
    (feature) => feature.properties[source.idField] as string | number,
  );
  assertReviewedFeatureIds(
    reference.reference,
    sourceFeatureIds,
    reviewed.sourceFeatureIds,
  );

  const sourceGeojson = sourceCollection(reference, reviewed, features);
  const display = dissolve(reference, reviewed, features);

  return {
    sourceGeojson,
    displayGeojson: display.geojson,
    manifest: { ...reviewed, sourceFeatureIds },
    operations: display.operations,
    unionInputAreaSquareMeters: display.unionInputAreaSquareMeters,
    displayAreaSquareMeters: display.displayAreaSquareMeters,
  };
}

function getLineStrings(geometry: GeoJsonFeature["geometry"]): number[][][] {
  if (geometry.type === "LineString") {
    return [geometry.coordinates as number[][]];
  }
  if (geometry.type === "MultiLineString") {
    return geometry.coordinates as number[][][];
  }
  throw new Error(`Unsupported trail geometry type: ${geometry.type}`);
}

function projectionFor(coordinates: number[][][]): {
  project: (point: number[]) => number[];
  unproject: (point: number[]) => number[];
} {
  const allPoints = coordinates.flat();
  const centerLongitude =
    allPoints.reduce((total, point) => total + point[0], 0) / allPoints.length;
  const centerLatitude =
    allPoints.reduce((total, point) => total + point[1], 0) / allPoints.length;
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos((centerLatitude * Math.PI) / 180);

  return {
    project: ([longitude, latitude]) => [
      (longitude - centerLongitude) * metersPerDegreeLongitude,
      (latitude - centerLatitude) * metersPerDegreeLatitude,
    ],
    unproject: ([x, y]) => [
      x / metersPerDegreeLongitude + centerLongitude,
      y / metersPerDegreeLatitude + centerLatitude,
    ],
  };
}

function circleRing(
  center: number[],
  radiusMeters: number,
  projection: ReturnType<typeof projectionFor>,
  steps = 24,
): number[][] {
  const projectedCenter = projection.project(center);
  const ring: number[][] = [];
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    ring.push(
      projection.unproject([
        projectedCenter[0] + Math.cos(angle) * radiusMeters,
        projectedCenter[1] + Math.sin(angle) * radiusMeters,
      ]),
    );
  }
  return ring;
}

function segmentRing(
  start: number[],
  end: number[],
  radiusMeters: number,
  projection: ReturnType<typeof projectionFor>,
): number[][] | null {
  const [startX, startY] = projection.project(start);
  const [endX, endY] = projection.project(end);
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) {
    return null;
  }
  const normalX = (-deltaY / length) * radiusMeters;
  const normalY = (deltaX / length) * radiusMeters;
  return [
    projection.unproject([startX + normalX, startY + normalY]),
    projection.unproject([endX + normalX, endY + normalY]),
    projection.unproject([endX - normalX, endY - normalY]),
    projection.unproject([startX - normalX, startY - normalY]),
    projection.unproject([startX + normalX, startY + normalY]),
  ];
}

function bufferLineStrings(
  lineStrings: number[][][],
  radiusMeters: number,
): GeoJsonFeature[] {
  const projection = projectionFor(lineStrings);
  const features: GeoJsonFeature[] = [];
  for (const lineString of lineStrings) {
    for (let index = 0; index < lineString.length - 1; index += 1) {
      const ring = segmentRing(
        lineString[index],
        lineString[index + 1],
        radiusMeters,
        projection,
      );
      if (ring) {
        features.push({
          type: "Feature",
          properties: { bufferPart: "segment", segmentIndex: index },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      }
    }
    for (let index = 0; index < lineString.length; index += 1) {
      features.push({
        type: "Feature",
        properties: { bufferPart: "vertex-cap", vertexIndex: index },
        geometry: {
          type: "Polygon",
          coordinates: [
            circleRing(lineString[index], radiusMeters, projection),
          ],
        },
      });
    }
  }
  return features;
}

async function fetchBufferedTrail(
  reference: PotaReference,
  reviewed: ManifestRecord,
  source: BoundarySource,
): Promise<GeometryResult> {
  if (!reviewed.sourceQuery) {
    throw new Error(`${reference.reference} has no reviewed trail query`);
  }
  const route = await fetchJson<GeoJsonFeatureCollection>(
    queryUrl(source, reviewed.sourceQuery),
  );
  if (route.type !== "FeatureCollection" || route.features.length === 0) {
    throw new Error(`No route features returned for ${reference.reference}`);
  }
  const sourceFeatureIds = route.features.map(
    (feature) => feature.properties?.[source.idField] as string | number,
  );
  assertReviewedFeatureIds(
    reference.reference,
    sourceFeatureIds,
    reviewed.sourceFeatureIds,
  );
  const lineStrings = route.features.flatMap((feature) =>
    getLineStrings(feature.geometry),
  );

  const sourceFeatures = route.features
    .map((feature) => ({
      ...feature,
      properties: sortFeatureProperties(feature.properties),
    }))
    .sort((left, right) =>
      String(left.properties[source.idField]).localeCompare(
        String(right.properties[source.idField]),
        undefined,
        { numeric: true },
      ),
    );
  const bufferFeatures = bufferLineStrings(
    lineStrings,
    potaTrailActivationRule.bufferDistanceMeters,
  );
  const display = dissolve(reference, reviewed, bufferFeatures);

  return {
    sourceGeojson: sourceCollection(reference, reviewed, sourceFeatures, {
      sourceGeometryType: route.features[0].geometry.type,
    }),
    displayGeojson: {
      ...display.geojson,
      properties: {
        ...display.geojson.properties,
        bufferDistanceFeet: potaTrailActivationRule.bufferDistanceFeet,
        bufferDistanceMeters: potaTrailActivationRule.bufferDistanceMeters,
        bufferRuleSourceUrl: potaTrailActivationRule.sourceUrl,
      },
    },
    manifest: { ...reviewed, sourceFeatureIds },
    operations: [
      {
        operation: "buffer",
        distanceFeet: potaTrailActivationRule.bufferDistanceFeet,
        distanceMeters: potaTrailActivationRule.bufferDistanceMeters,
        ruleSourceUrl: potaTrailActivationRule.sourceUrl,
      },
      ...display.operations,
    ],
    unionInputAreaSquareMeters: display.unionInputAreaSquareMeters,
    displayAreaSquareMeters: display.displayAreaSquareMeters,
  };
}

function pointOnlyGeometry(
  reference: PotaReference,
  reviewed: ManifestRecord,
): GeometryResult {
  assertReviewedFeatureIds(
    reference.reference,
    [reference.reference],
    reviewed.sourceFeatureIds,
  );
  const sourceFeature: GeoJsonFeature = {
    type: "Feature",
    properties: {
      reference: reference.reference,
      name: reference.name,
      grid: reference.grid,
    },
    geometry: {
      type: "Point",
      coordinates: [reference.longitude, reference.latitude],
    },
  };
  const displayFeature: GeoJsonFeature = {
    ...sourceFeature,
    properties: {
      potaReference: reference.reference,
      potaName: reference.name,
      geometryKind: "point",
      geometryRole: "display",
    },
  };
  return {
    sourceGeojson: sourceCollection(reference, reviewed, [sourceFeature]),
    displayGeojson: displayCollection(reference, reviewed, displayFeature),
    manifest: reviewed,
    operations: [{ operation: "identity" }],
  };
}

export async function fetchReviewedGeometry(
  reference: PotaReference,
  reviewed: ManifestRecord,
): Promise<GeometryResult> {
  if (reviewed.reference !== reference.reference) {
    throw new Error(`Reviewed mapping mismatch for ${reference.reference}`);
  }
  if (reviewed.status === "point-only") {
    return pointOnlyGeometry(reference, reviewed);
  }
  if (reviewed.status === "research-needed") {
    throw new Error(
      `${reference.reference} still needs research and cannot be packaged without an explicit geometry status`,
    );
  }
  const sourceKey = sourceKeyByName.get(reviewed.sourceName);
  if (!sourceKey) {
    throw new Error(
      `${reference.reference} uses unknown source ${reviewed.sourceName}`,
    );
  }
  const source = sources[sourceKey];
  return reviewed.geometryKind === "activation-zone"
    ? fetchBufferedTrail(reference, reviewed, source)
    : fetchBoundary(reference, reviewed, source);
}

export function expectedBoundaryPath(record: ManifestRecord): string {
  return featureFilePath(record.reference);
}
