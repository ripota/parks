import { createHash } from "node:crypto";
import type {
  CatalogRecord,
  GeoJsonFeatureCollection,
  ManifestRecord,
  PotaReference,
} from "./types.ts";
import { bounds } from "./display-build.ts";

export function fallbackPoint(
  reference: PotaReference,
  manifest: ManifestRecord,
): GeoJsonFeatureCollection {
  if (
    manifest.reference !== reference.reference ||
    manifest.status !== "research-needed" ||
    manifest.geometryKind ||
    manifest.localGeojson ||
    manifest.sourceFeatureIds ||
    manifest.sourceQuery
  )
    throw new Error(`${reference.reference} invalid research-needed mapping`);
  if (
    !Number.isFinite(reference.longitude) ||
    Math.abs(reference.longitude) > 180 ||
    !Number.isFinite(reference.latitude) ||
    Math.abs(reference.latitude) > 90
  )
    throw new Error(`${reference.reference} invalid official coordinates`);
  const properties = {
    schemaVersion: 3,
    geometryRole: "display",
    geometryKind: "point",
    status: "research-needed",
    potaReference: reference.reference,
    fidelity: "official-point-fallback",
    provenance: { kind: "official-pota-coordinate", url: reference.potaUrl },
  };
  return {
    $schema: "https://ripota.org/schemas/v3/display-geojson.schema.json",
    type: "FeatureCollection",
    bbox: [
      reference.longitude,
      reference.latitude,
      reference.longitude,
      reference.latitude,
    ],
    properties,
    features: [
      {
        type: "Feature",
        properties,
        geometry: {
          type: "Point",
          coordinates: [reference.longitude, reference.latitude],
        },
      },
    ],
  };
}
export type V3Record = Omit<CatalogRecord, "source"> & {
  source?: CatalogRecord["source"];
  fidelity: "reviewed-display" | "official-point-fallback";
  provenance: {
    kind: "reviewed-source" | "official-pota-coordinate";
    url: string;
  };
};
export function v3Artifacts(
  references: PotaReference[],
  manifest: ManifestRecord[],
  reviewed: CatalogRecord[],
): { records: V3Record[]; artifacts: Map<string, string> } {
  const byId = new Map(reviewed.map((record) => [record.reference, record]));
  const records = references.map((reference, index): V3Record => {
    const mapping = manifest[index];
    if (mapping.status === "research-needed")
      return {
        ...reference,
        status: "research-needed",
        geometryKind: "point",
        fidelity: "official-point-fallback",
        provenance: {
          kind: "official-pota-coordinate",
          url: reference.potaUrl,
        },
        geojson: fallbackPoint(reference, mapping),
      };
    const record = byId.get(reference.reference);
    if (!record)
      throw new Error(`${reference.reference} missing reviewed geometry`);
    return {
      ...record,
      fidelity: "reviewed-display",
      provenance: { kind: "reviewed-source", url: record.source.url },
      geojson: {
        ...record.geojson,
        $schema: "https://ripota.org/schemas/v3/display-geojson.schema.json",
        properties: {
          ...record.geojson.properties,
          schemaVersion: 3,
          status: record.status,
          fidelity: "reviewed-display",
        },
      },
    };
  });
  const artifacts = new Map<string, string>();
  const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
  const derivations = records.map((record) => {
    const artifact = `dist/v3/boundaries/${record.reference.toLowerCase()}.geojson`;
    const content = json(record.geojson);
    artifacts.set(artifact, content);
    return {
      reference: record.reference,
      status: record.status,
      artifact,
      operation:
        record.fidelity === "official-point-fallback"
          ? "official-coordinate-point"
          : "reviewed-display-identity",
      provenance: record.provenance,
      sha256: createHash("sha256").update(content).digest("hex"),
    };
  });
  const features = records.flatMap((record) =>
    record.geojson.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        potaReference: record.reference,
        geometryRole: "display",
        geometryKind: record.geometryKind,
        status: record.status,
        fidelity: record.fidelity,
      },
    })),
  );
  artifacts.set(
    "dist/v3/catalog.json",
    json({
      $schema: "https://ripota.org/schemas/v3/catalog.schema.json",
      schemaVersion: 3,
      geometryRole: "display",
      referenceCount: records.length,
      featureCount: features.length,
      references: records,
    }),
  );
  const aggregate: GeoJsonFeatureCollection = {
    $schema: "https://ripota.org/schemas/v3/display-geojson.schema.json",
    type: "FeatureCollection",
    properties: {
      schemaVersion: 3,
      geometryRole: "display",
      referenceCount: records.length,
      featureCount: features.length,
    },
    features,
  };
  if (features.length) aggregate.bbox = bounds(aggregate);
  artifacts.set("dist/v3/all.geojson", json(aggregate));
  artifacts.set(
    "dist/v3/derivations.json",
    json({ schemaVersion: 3, records: derivations }),
  );
  return { records, artifacts };
}
