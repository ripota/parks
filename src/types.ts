import type { PotaReference } from "./index.ts";

export type { PotaReference };

export type GeometryKind = "boundary" | "activation-zone" | "point";
export type GeometryRole = "display" | "source";
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

export type MapPointOverride = {
  reference: string;
  latitude: number;
  longitude: number;
  notes: string;
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
  $schema?: string;
  type: "FeatureCollection";
  properties?: Record<string, unknown>;
  features: GeoJsonFeature[];
};

export type CatalogRecord = PotaReference & {
  mapPoint?: Omit<MapPointOverride, "reference">;
  status: ReviewStatus;
  geometryKind: GeometryKind;
  source: {
    name: string;
    url: string;
    query?: string;
    featureIds: Array<string | number>;
    artifact: string;
    notes?: string;
  };
  geojson: GeoJsonFeatureCollection;
};

export type Catalog = {
  $schema: string;
  schemaVersion: number;
  geometryRole: GeometryRole;
  referenceCount: number;
  featureCount: number;
  sourceFeatureCount?: number;
  references: CatalogRecord[];
};

export type DerivationOperation =
  | { operation: "identity" }
  | { operation: "unary-union" }
  | {
      operation: "remove-small-holes";
      maximumAreaSquareMeters: number;
      removedHoleCount: number;
      removedAreaSquareMeters: number;
    }
  | {
      operation: "buffer";
      distanceFeet: number;
      distanceMeters: number;
      ruleSourceUrl: string;
    };

export type DerivationRecord = {
  reference: string;
  sourceArtifact: string;
  displayArtifact: string;
  sourceSha256: string;
  displaySha256: string;
  sourceFeatureCount: number;
  displayFeatureCount: number;
  componentCount: number;
  holeCount: number;
  coordinateCount: number;
  unionInputAreaSquareMeters?: number;
  displayAreaSquareMeters?: number;
  operations: DerivationOperation[];
};

export type DerivationManifest = {
  $schema: "https://ripota.org/schemas/v2/manifest.schema.json";
  schemaVersion: 2;
  algorithmVersion: 1 | 2;
  unionEngine: {
    name: "jsts";
    version: "2.12.1";
  };
  validationEngine: {
    name: "jsts";
    version: "2.12.1";
  };
  records: DerivationRecord[];
};
