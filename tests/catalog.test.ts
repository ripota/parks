import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";

import { buildPackageArtifacts } from "../src/package.ts";
import type {
  Catalog,
  GeoJsonFeatureCollection,
  ManifestRecord,
} from "../src/types.ts";
import { validateSnapshot } from "../src/validate.ts";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("reviewed RI POTA snapshot", () => {
  it("preserves the verified reference, status, geometry, and feature inventory", async () => {
    const snapshot = await validateSnapshot(rootDirectory);
    expect(snapshot.references).toHaveLength(61);
    expect(snapshot.manifest).toHaveLength(61);
    expect(snapshot.displayFeatureCount).toBe(61);
    expect(snapshot.sourceFeatureCount).toBe(446);
    expect(
      snapshot.manifest.filter((record) => record.geometryKind === "boundary"),
    ).toHaveLength(60);
    expect(
      snapshot.manifest.filter(
        (record) => record.geometryKind === "activation-zone",
      ),
    ).toHaveLength(1);
    expect(
      snapshot.manifest.filter((record) => record.geometryKind === "point"),
    ).toHaveLength(0);
  });

  it("keeps the special reviewed source decisions visible", async () => {
    const { derivations, manifest, geojsonByReference } =
      await validateSnapshot(rootDirectory);
    const byReference = new Map(
      manifest.map((record) => [record.reference, record] as const),
    );
    expect(byReference.get("US-10547")?.sourceFeatureIds).toEqual(
      expect.arrayContaining([646, 31599]),
    );
    expect(byReference.get("US-2869")?.sourceFeatureIds).toEqual([
      5, 26, 31, 33, 51, 54, 314, 327, 439, 502, 563, 564, 590, 591, 678, 679,
      726, 731, 965, 22917, 27011, 27012, 27013, 38157,
    ]);
    expect(byReference.get("US-4582")).toMatchObject({
      status: "available",
      geometryKind: "activation-zone",
      sourceFeatureIds: [2],
    });
    expect(geojsonByReference.get("US-4582")?.properties).toMatchObject({
      bufferDistanceFeet: 100,
    });
    expect(byReference.get("US-6980")).toMatchObject({
      status: "available",
      geometryKind: "boundary",
      sourceFeatureIds: [807, 808, 809, 810, 852, 854, 855, 857],
    });
    expect(byReference.get("US-6980")?.notes).toMatch(
      /DEM_ID 6163, 6166-6170, and 6173-6174/,
    );
    expect(
      derivations.records.find((record) => record.reference === "US-6980"),
    ).toMatchObject({
      sourceFeatureCount: 8,
      displayFeatureCount: 1,
      componentCount: 3,
      holeCount: 0,
      operations: [
        { operation: "unary-union" },
        {
          operation: "remove-small-holes",
          maximumAreaSquareMeters: 1,
          removedHoleCount: 0,
          removedAreaSquareMeters: 0,
        },
      ],
    });
    expect(
      derivations.records.find((record) => record.reference === "US-6979"),
    ).toMatchObject({
      sourceFeatureCount: 127,
      displayFeatureCount: 1,
      componentCount: 25,
      holeCount: 12,
      operations: [
        { operation: "unary-union" },
        {
          operation: "remove-small-holes",
          maximumAreaSquareMeters: 1,
          removedHoleCount: 5,
          removedAreaSquareMeters: 1.2134447616196593,
        },
      ],
    });
    expect(
      derivations.records.find((record) => record.reference === "US-2868"),
    ).toMatchObject({
      sourceFeatureCount: 4,
      displayFeatureCount: 1,
      componentCount: 1,
      holeCount: 0,
      coordinateCount: 195,
      operations: [
        { operation: "unary-union" },
        {
          operation: "remove-small-holes",
          maximumAreaSquareMeters: 1,
          removedHoleCount: 3,
          removedAreaSquareMeters: 0.0600588898018374,
        },
      ],
    });
  });

  it("validates source and package GeoJSON against the public schemas", async () => {
    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
    const displayGeojsonSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/v2/display-geojson.schema.json"),
        "utf8",
      ),
    );
    const sourceGeojsonSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/v2/source-geojson.schema.json"),
        "utf8",
      ),
    );
    const catalogSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/v2/catalog.schema.json"),
        "utf8",
      ),
    );
    const sourceCatalogSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/v2/source-catalog.schema.json"),
        "utf8",
      ),
    );
    const manifestSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/v2/manifest.schema.json"),
        "utf8",
      ),
    );
    ajv.addSchema(displayGeojsonSchema);
    ajv.addSchema(sourceGeojsonSchema);
    const validateCatalog = ajv.compile(catalogSchema);
    const validateSourceCatalog = ajv.compile(sourceCatalogSchema);
    const validateManifest = ajv.compile(manifestSchema);
    const validateDisplayGeojson = ajv.getSchema(
      "https://ripota.org/schemas/v2/display-geojson.schema.json",
    );
    const validateSourceGeojson = ajv.getSchema(
      "https://ripota.org/schemas/v2/source-geojson.schema.json",
    );
    const snapshot = await validateSnapshot(rootDirectory);
    for (const geojson of snapshot.geojsonByReference.values()) {
      expect(
        validateDisplayGeojson?.(geojson),
        JSON.stringify(validateDisplayGeojson?.errors),
      ).toBe(true);
    }
    for (const geojson of snapshot.sourceGeojsonByReference.values()) {
      expect(
        validateSourceGeojson?.(geojson),
        JSON.stringify(validateSourceGeojson?.errors),
      ).toBe(true);
    }
    const artifacts = await buildPackageArtifacts(rootDirectory);
    const catalog = JSON.parse(artifacts.get("dist/catalog.json")!) as Catalog;
    const aggregate = JSON.parse(
      artifacts.get("dist/all.geojson")!,
    ) as GeoJsonFeatureCollection;
    const sourceCatalog = JSON.parse(
      artifacts.get("dist/source-catalog.json")!,
    ) as Catalog;
    const sourceAggregate = JSON.parse(
      artifacts.get("dist/source-all.geojson")!,
    ) as GeoJsonFeatureCollection;
    expect(
      validateCatalog(catalog),
      JSON.stringify(validateCatalog.errors),
    ).toBe(true);
    expect(
      validateSourceCatalog(sourceCatalog),
      JSON.stringify(validateSourceCatalog.errors),
    ).toBe(true);
    expect(
      validateManifest(snapshot.derivations),
      JSON.stringify(validateManifest.errors),
    ).toBe(true);
    expect(
      validateDisplayGeojson?.(aggregate),
      JSON.stringify(validateDisplayGeojson?.errors),
    ).toBe(true);
    expect(
      validateSourceGeojson?.(sourceAggregate),
      JSON.stringify(validateSourceGeojson?.errors),
    ).toBe(true);
    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.geometryRole).toBe("display");
    expect(catalog.referenceCount).toBe(61);
    expect(catalog.featureCount).toBe(61);
    expect(catalog.sourceFeatureCount).toBe(446);
    expect(aggregate.features).toHaveLength(61);
    expect(sourceCatalog.geometryRole).toBe("source");
    expect(sourceCatalog.featureCount).toBe(446);
    expect(sourceAggregate.features).toHaveLength(446);
    for (const feature of aggregate.features) {
      expect(feature.properties).toEqual(
        expect.objectContaining({
          potaReference: expect.stringMatching(/^US-\d+$/),
          geometryKind: expect.stringMatching(
            /^(boundary|activation-zone|point)$/,
          ),
        }),
      );
    }
  });

  it("publishes accurate checksums for all stable source and combined files", async () => {
    const artifacts = await buildPackageArtifacts(rootDirectory);
    const checksumLines = artifacts
      .get("dist/checksums.sha256")!
      .trim()
      .split("\n");
    expect(checksumLines).toHaveLength(129);
    const manifest = JSON.parse(
      await readFile(path.join(rootDirectory, "data/manifest.json"), "utf8"),
    ) as ManifestRecord[];
    expect(manifest).toHaveLength(61);
    for (const line of checksumLines) {
      const [expectedHash, relativePath] = line.split("  ");
      const content =
        artifacts.get(relativePath) ??
        (await readFile(path.join(rootDirectory, relativePath), "utf8"));
      expect(createHash("sha256").update(content).digest("hex")).toBe(
        expectedHash,
      );
    }
  });
});
