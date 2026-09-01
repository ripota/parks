import type { PotaReference } from "./index.ts";

export type { PotaReference };

export type GeometryKind = "boundary" | "activation-zone" | "point";
export type ReviewStatus = "available" | "point-only" | "research-needed";

export type PotaReferenceSource = {
  reference: string;
  name: string;
  latitude: string | number;
  longitude: string | number;
  grid: string;
  counties?: string[];
  location?: string;
  locationDesc?: string;
  [key: string]: unknown;
};

export type ManifestRecord = {
  reference: string;
  status: ReviewStatus;
  geometryKind?: GeometryKind;
  sourceName: string;
  sourceUrl: string;
  sourceQuery?: string;
  sourceFeatureIds?: Array<string | number>;
  localGeojson?: string;
  notes?: string;
};

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry: GeoJsonGeometry;
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  properties?: Record<string, unknown>;
  features: GeoJsonFeature[];
};

export type CatalogRecord = PotaReference & {
  status: ReviewStatus;
  geometryKind: GeometryKind;
  source: {
    name: string;
    url: string;
    query?: string;
    featureIds: Array<string | number>;
    notes?: string;
  };
  geojson: GeoJsonFeatureCollection;
};

export type Catalog = {
  schemaVersion: number;
  referenceCount: number;
  featureCount: number;
  references: CatalogRecord[];
};
