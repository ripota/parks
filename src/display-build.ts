import type { CatalogRecord, GeoJsonFeatureCollection } from "./types.ts";

export function bounds(
  collection: GeoJsonFeatureCollection,
): [number, number, number, number] {
  const result: [number, number, number, number] = [
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
  ];
  function visit(value: unknown): void {
    if (!Array.isArray(value)) throw new Error("Invalid coordinates");
    if (typeof value[0] === "number") {
      const [x, y] = value;
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        Math.abs(x) > 180 ||
        Math.abs(y) > 90
      )
        throw new Error("Invalid position");
      result[0] = Math.min(result[0], x);
      result[1] = Math.min(result[1], y);
      result[2] = Math.max(result[2], x);
      result[3] = Math.max(result[3], y);
    } else value.forEach(visit);
  }
  collection.features.forEach((feature) => visit(feature.geometry.coordinates));
  if (!result.every(Number.isFinite)) throw new Error("Empty geometry");
  return result;
}

export function displayModule(records: CatalogRecord[]): string {
  const display = records.map((record) => ({
    reference: record.reference,
    status: record.status,
    geometryKind: record.geometryKind,
    displayPoint: record.mapPoint
      ? { ...record.mapPoint, source: "reviewed" }
      : {
          latitude: record.latitude,
          longitude: record.longitude,
          source: "official",
        },
    bbox: bounds(record.geojson),
    artifact: `@ripota/parks/boundaries/${record.reference.toLowerCase()}.geojson`,
  }));
  const dataset = {
    schemaVersion: 2,
    geometryRole: "display",
    referenceCount: records.length,
    featureCount: records.reduce(
      (count, record) => count + record.geojson.features.length,
      0,
    ),
    projectUrl: "https://github.com/ripota/parks",
    attribution:
      "Parks on the Air; RI DEM / RIGIS; U.S. Fish and Wildlife Service; National Park Service. See DATA_SOURCES.md and DATA_LICENSE.md.",
    disclaimer:
      "General reference only. Not legal, property, access, navigation, or survey data; does not establish public access or valid activation areas.",
  };
  return `import type { DatasetMetadata, DisplayReference } from "./public-types.js";\nexport type { DatasetMetadata, DisplayReference, DisplayPoint, GeometryKind, ReviewStatus } from "./public-types.js";\nexport const dataset: DatasetMetadata = ${JSON.stringify(dataset)};\nexport const displayReferences: readonly DisplayReference[] = ${JSON.stringify(display)};\n/** Unknown or malformed IDs return undefined; lookup is case-insensitive. */\nexport function getDisplayReference(reference: string): DisplayReference | undefined { return displayReferences.find(record => record.reference === reference.toUpperCase()); }\n`;
}
