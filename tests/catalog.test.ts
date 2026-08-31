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
    expect(snapshot.featureCount).toBe(690);
    expect(
      snapshot.manifest.filter((record) => record.geometryKind === "boundary"),
    ).toHaveLength(59);
    expect(
      snapshot.manifest.filter(
        (record) => record.geometryKind === "activation-zone",
      ),
    ).toHaveLength(1);
    expect(
      snapshot.manifest.filter((record) => record.geometryKind === "point"),
    ).toHaveLength(1);
  });

  it("keeps the special reviewed source decisions visible", async () => {
    const { manifest, geojsonByReference } =
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
      status: "point-only",
      geometryKind: "point",
      sourceFeatureIds: ["US-6980"],
    });
    expect(byReference.get("US-6980")?.notes).toMatch(/41\.5739, -71\.7864/);
  });

  it("validates source and package GeoJSON against the public schemas", async () => {
    const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
    const geojsonSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/geojson.schema.json"),
        "utf8",
      ),
    );
    const catalogSchema = JSON.parse(
      await readFile(
        path.join(rootDirectory, "schemas/catalog.schema.json"),
        "utf8",
      ),
    );
    ajv.addSchema(geojsonSchema);
    const validateCatalog = ajv.compile(catalogSchema);
    const validateGeojson = ajv.getSchema(
      "https://ripota.org/schemas/geojson.schema.json",
    );
    const snapshot = await validateSnapshot(rootDirectory);
    for (const geojson of snapshot.geojsonByReference.values()) {
      expect(
        validateGeojson?.(geojson),
        JSON.stringify(validateGeojson?.errors),
      ).toBe(true);
    }
    const artifacts = await buildPackageArtifacts(rootDirectory);
    const catalog = JSON.parse(artifacts.get("dist/catalog.json")!) as Catalog;
    const aggregate = JSON.parse(
      artifacts.get("dist/all.geojson")!,
    ) as GeoJsonFeatureCollection;
    expect(
      validateCatalog(catalog),
      JSON.stringify(validateCatalog.errors),
    ).toBe(true);
    expect(
      validateGeojson?.(aggregate),
      JSON.stringify(validateGeojson?.errors),
    ).toBe(true);
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.referenceCount).toBe(61);
    expect(catalog.featureCount).toBe(690);
    expect(aggregate.features).toHaveLength(690);
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
    expect(checksumLines).toHaveLength(65);
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
