import {
  potaCoordinateSource,
  potaTrailActivationRule,
  sourceKeyByName,
  sources,
  type BoundarySource,
} from "../config/boundary-sources.ts";
import { fetchJson } from "./counties.ts";
import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
} from "./types.ts";

export type GeometryResult = {
  geojson: GeoJsonFeatureCollection;
  manifest: ManifestRecord;
};

function featureFilePath(reference: string): string {
  return `./boundaries/${reference.toLowerCase()}.geojson`;
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

  return {
    geojson: {
      type: "FeatureCollection",
      properties: {
        geometryKind: "boundary",
        potaReference: reference.reference,
        potaName: reference.name,
        sourceName: source.name,
        sourceUrl: source.url,
        sourceQuery: reviewed.sourceQuery,
      },
      features,
    },
    manifest: { ...reviewed, sourceFeatureIds },
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

  return {
    geojson: {
      type: "FeatureCollection",
      properties: {
        geometryKind: "activation-zone",
        potaReference: reference.reference,
        potaName: reference.name,
        sourceName: source.name,
        sourceUrl: source.url,
        sourceQuery: reviewed.sourceQuery,
        sourceFeatureIds,
        sourceGeometryType: route.features[0].geometry.type,
        bufferDistanceFeet: potaTrailActivationRule.bufferDistanceFeet,
        bufferDistanceMeters: potaTrailActivationRule.bufferDistanceMeters,
        bufferRuleSourceUrl: potaTrailActivationRule.sourceUrl,
      },
      features: bufferLineStrings(
        lineStrings,
        potaTrailActivationRule.bufferDistanceMeters,
      ),
    },
    manifest: { ...reviewed, sourceFeatureIds },
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
  return {
    geojson: {
      type: "FeatureCollection",
      properties: {
        geometryKind: "point",
        potaReference: reference.reference,
        potaName: reference.name,
        sourceName: potaCoordinateSource.name,
        sourceUrl: `${potaCoordinateSource.url}/${reference.reference}`,
        notes: reviewed.notes,
      },
      features: [
        {
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
        },
      ],
    },
    manifest: reviewed,
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
