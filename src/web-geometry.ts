import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import GeoJSONWriter from "jsts/org/locationtech/jts/io/GeoJSONWriter.js";
import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import TopologyPreservingSimplifier from "jsts/org/locationtech/jts/simplify/TopologyPreservingSimplifier.js";
import area from "@turf/area";
import type { FeatureCollection } from "geojson";
import { bounds } from "./display-build.ts";
import type { GeoJsonFeatureCollection, GeoJsonGeometry } from "./types.ts";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export const WEB_TOLERANCE_DEGREES = 0.00002;
export function geometryCounts(geometry: GeoJsonGeometry): {
  components: number;
  holes: number;
  coordinates: number;
} {
  if (geometry.type === "Point")
    return { components: 1, holes: 0, coordinates: 1 };
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);
  return {
    components: polygons.length,
    holes: polygons.reduce((n, polygon) => n + polygon.length - 1, 0),
    coordinates: polygons.flat().reduce((n, ring) => n + ring.length, 0),
  };
}
function validate(geometry: GeoJsonGeometry): void {
  if (!["Point", "Polygon", "MultiPolygon"].includes(geometry.type))
    throw new Error("Unsupported web geometry");
  const read = new GeoJSONReader(new GeometryFactory()).read(geometry);
  if (read.isEmpty() || !new IsValidOp(read).isValid())
    throw new Error("Invalid web topology");
  if (geometry.type !== "Point") {
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates as number[][][]]
        : (geometry.coordinates as number[][][][]);
    for (const polygon of polygons)
      for (const ring of polygon) {
        if (
          ring.length < 4 ||
          JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))
        )
          throw new Error("Invalid web ring");
      }
  }
}
export function simplifyWeb(input: GeoJsonFeatureCollection): {
  geojson: GeoJsonFeatureCollection;
  derivation: Record<string, unknown>;
} {
  if (input.features.length !== 1)
    throw new Error("Web derivation requires one dissolved display feature");
  const original = input.features[0].geometry;
  validate(original);
  bounds(input);
  const before = geometryCounts(original);
  const identity =
    original.type === "Point" ||
    input.properties?.geometryKind === "activation-zone";
  const read = new GeoJSONReader(new GeometryFactory()).read(original);
  let tolerance = identity ? 0 : WEB_TOLERANCE_DEGREES;
  let geometry = original;
  const inputArea = area(input as unknown as FeatureCollection);
  let outputArea = inputArea;
  // Reduce tolerance deterministically if the relative area gate needs more detail.
  for (let attempt = 0; !identity && attempt < 12; attempt++) {
    geometry = new GeoJSONWriter().write(
      TopologyPreservingSimplifier.simplify(read, tolerance),
    ) as GeoJsonGeometry;
    validate(geometry);
    const after = geometryCounts(geometry);
    if (before.components !== after.components || before.holes !== after.holes)
      throw new Error("Web simplification changed components or holes");
    outputArea = area({
      ...input,
      features: [{ ...input.features[0], geometry }],
    } as unknown as FeatureCollection);
    if (Math.abs(outputArea - inputArea) <= inputArea * 0.005) break;
    tolerance /= 2;
    if (attempt === 11)
      throw new Error("Web simplification exceeds area delta gate");
  }
  const geojson: GeoJsonFeatureCollection = {
    ...input,
    $schema: "https://ripota.org/schemas/web/v1/display-geojson.schema.json",
    properties: {
      ...input.properties,
      schemaVersion: 1,
      geometryRole: "display",
      fidelity: "web",
      detailedArtifact: `@ripota/parks/${input.properties?.status === "research-needed" ? "v3/" : ""}boundaries/${String(input.properties?.potaReference).toLowerCase()}.geojson`,
    },
    features: [
      {
        ...input.features[0],
        properties: {
          ...input.features[0].properties,
          potaReference: input.properties?.potaReference,
          geometryRole: "display",
          geometryKind: input.properties?.geometryKind,
          fidelity: "web",
        },
        geometry,
      },
    ],
  };
  geojson.bbox = bounds(geojson);
  const extent = bounds(input);
  if (
    geojson.bbox.some(
      (value, i) => Math.abs(value - extent[i]) > tolerance + 1e-12,
    )
  )
    throw new Error("Web extent exceeds tolerance");
  return {
    geojson,
    derivation: {
      reference: input.properties?.potaReference,
      algorithm: identity ? "identity" : "TopologyPreservingSimplifier",
      algorithmVersion: 1,
      engine: "jsts",
      engineVersion: "2.12.1",
      toleranceDegrees: tolerance,
      maximumToleranceDegrees: WEB_TOLERANCE_DEGREES,
      inputCoordinateCount: before.coordinates,
      outputCoordinateCount: geometryCounts(geometry).coordinates,
      componentCount: before.components,
      holeCount: before.holes,
      inputAreaSquareMeters: inputArea,
      outputAreaSquareMeters: outputArea,
      areaDeltaSquareMeters: outputArea - inputArea,
      inputSha256: hash(json(input)),
      outputSha256: hash(json(geojson)),
      ...(input.properties?.geometryKind === "activation-zone"
        ? {
            bufferDistanceFeet: 100,
            reason: "Preserve the reviewed activation-zone geometry exactly",
          }
        : {}),
    },
  };
}
export function buildWebArtifacts(
  inputs: GeoJsonFeatureCollection[],
  detailedAggregate?: GeoJsonFeatureCollection,
): Map<string, string> {
  const artifacts = new Map<string, string>();
  const records: Record<string, unknown>[] = [];
  const collections: GeoJsonFeatureCollection[] = [];
  const measurements: Array<{
    reference: string;
    detailed: { raw: number; gzip: number };
    web: { raw: number; gzip: number };
  }> = [];
  const measure = (content: string) => ({
    raw: Buffer.byteLength(content),
    gzip: gzipSync(content).length,
  });
  for (const input of inputs) {
    const { geojson, derivation } = simplifyWeb(input);
    const reference = String(input.properties?.potaReference);
    if (
      !/^US-\d+$/.test(reference) ||
      artifacts.has(`dist/boundaries-web/${reference.toLowerCase()}.geojson`)
    )
      throw new Error("Invalid or duplicate web reference");
    artifacts.set(
      `dist/boundaries-web/${reference.toLowerCase()}.geojson`,
      json(geojson),
    );
    records.push(derivation);
    collections.push(geojson);
    measurements.push({
      reference,
      detailed: measure(json(input)),
      web: measure(json(geojson)),
    });
  }
  const aggregate = (
    items: GeoJsonFeatureCollection[],
    web: boolean,
  ): GeoJsonFeatureCollection => ({
    $schema: web
      ? "https://ripota.org/schemas/web/v1/display-geojson.schema.json"
      : "https://ripota.org/schemas/v2/display-geojson.schema.json",
    type: "FeatureCollection",
    properties: {
      schemaVersion: web ? 1 : 2,
      geometryRole: "display",
      ...(web ? { fidelity: "web" } : {}),
      referenceCount: items.length,
      featureCount: items.length,
    },
    features: items.flatMap((item) => item.features),
  });
  const allWeb = aggregate(collections, true);
  if (collections.length) allWeb.bbox = bounds(allWeb);
  artifacts.set("dist/all-web.geojson", json(allWeb));
  const total = {
    reference: "ALL",
    detailed: measure(json(detailedAggregate ?? aggregate(inputs, false))),
    web: measure(json(allWeb)),
  };
  // Fixtures can be tiny; enforce representative and total budgets on the real inventory.
  if (inputs.some((item) => item.properties?.potaReference === "US-2870")) {
    for (const measurement of [
      total,
      measurements.find((item) => item.reference === "US-2870")!,
    ]) {
      if (measurement.web.gzip > measurement.detailed.gzip * 0.7)
        throw new Error(
          `${measurement.reference} web gzip reduction is below 30%`,
        );
    }
  }
  artifacts.set(
    "dist/web-derivations.json",
    json({ schemaVersion: 1, records }),
  );
  artifacts.set(
    "dist/web-measurements.json",
    json({
      schemaVersion: 1,
      compression: "gzip",
      maximumGzipRatio: 0.7,
      records: [...measurements, total],
    }),
  );
  return artifacts;
}
