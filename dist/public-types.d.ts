/** Canonical POTA identity used by the source snapshot and geometry pipeline. */
export type PotaReference = {
    reference: string;
    name: string;
    latitude: number;
    longitude: number;
    grid: string;
    counties: string[];
    locationDesc: string;
    potaUrl: string;
};
export type ParkType = "park" | "beach" | "forest" | "management-area" | "wildlife-refuge" | "preserve" | "historic-site" | "trail" | "recreation-area" | "fishing-access" | "campground";
export type ParkAmenity = "parking" | "restrooms" | "picnic-tables" | "shelter" | "drinking-water" | "boat-launch" | "camping";
export type OrangeGuidance = Readonly<{
    status: "required" | "recommended" | "area-dependent" | "not-required";
    season: string | null;
    details: string;
    sourceUrl: string;
}>;
/** Best-effort visitor guidance; check the linked manager before visiting. */
export type Park = Readonly<Omit<PotaReference, "counties">> & Readonly<{
    counties: readonly string[];
    type: ParkType;
    manager: string;
    websiteUrl: string;
    amenities: readonly ParkAmenity[];
    access: Readonly<{
        hours?: string;
        parking?: string;
        fees?: string;
        pets?: string;
        accessibility?: string;
    }>;
    activationNotes: readonly string[];
    orange: OrangeGuidance;
    sources: readonly string[];
}>;
/** Readonly opt-in map contracts. */
export type GeometryKind = "boundary" | "activation-zone" | "point";
export type ReviewStatus = "available" | "point-only" | "research-needed";
export type DisplayPoint = Readonly<{
    latitude: number;
    longitude: number;
    source: "official" | "reviewed" | "point-on-surface";
    notes?: string;
}>;
export type DisplayReference = Readonly<{
    reference: string;
    status: ReviewStatus;
    geometryKind?: GeometryKind;
    displayPoint: DisplayPoint;
    bbox?: readonly [number, number, number, number];
    artifact?: `@ripota/parks/boundaries/${string}.geojson` | `@ripota/parks/v3/boundaries/${string}.geojson`;
}>;
export type DatasetMetadata = Readonly<{
    schemaVersion: number;
    geometryRole: "display";
    referenceCount: number;
    featureCount: number;
    projectUrl: string;
    attribution: string;
    disclaimer: string;
}>;
export type Coordinates = number | readonly Coordinates[];
export type GeoJsonFeatureCollection = Readonly<{
    $schema?: string;
    type: "FeatureCollection";
    bbox?: readonly [number, number, number, number];
    properties?: Readonly<Record<string, unknown>>;
    features: readonly Readonly<{
        type: "Feature";
        properties: Readonly<Record<string, unknown>> | null;
        geometry: Readonly<{
            type: string;
            coordinates: Coordinates;
        }>;
    }>[];
}>;
export type CatalogRecord = Readonly<{
    reference: string;
    name: string;
    latitude: number;
    longitude: number;
    grid: string;
    counties: readonly string[];
    locationDesc: string;
    potaUrl: string;
    mapPoint?: Readonly<{
        latitude: number;
        longitude: number;
        notes: string;
    }>;
    status: ReviewStatus;
    geometryKind: GeometryKind;
    source: Readonly<{
        name: string;
        url: string;
        query?: string;
        featureIds: readonly (string | number)[];
        artifact: string;
        notes?: string;
    }>;
    geojson: GeoJsonFeatureCollection;
}>;
export type Catalog = Readonly<{
    $schema: string;
    schemaVersion: number;
    geometryRole: "display" | "source";
    referenceCount: number;
    featureCount: number;
    sourceFeatureCount?: number;
    references: readonly CatalogRecord[];
}>;
export type V3CatalogRecord = Omit<CatalogRecord, "source"> & (Readonly<{
    status: "research-needed";
    geometryKind: "point";
    fidelity: "official-point-fallback";
    source?: never;
    provenance: Readonly<{
        kind: "official-pota-coordinate";
        url: string;
    }>;
}> | Readonly<{
    status: "available" | "point-only";
    fidelity: "reviewed-display";
    source: CatalogRecord["source"];
    provenance: Readonly<{
        kind: "reviewed-source";
        url: string;
    }>;
}>);
export type V3Catalog = Omit<Catalog, "references" | "schemaVersion"> & Readonly<{
    schemaVersion: 3;
    references: readonly V3CatalogRecord[];
}>;
