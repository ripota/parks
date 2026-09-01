import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { references } from "../dist/index.js";
import {
  measurePackagePayloads,
  type PackagePayloadMeasurements,
} from "../src/package-size.ts";
import type { Catalog, PotaReference } from "../src/types.ts";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(
    await readFile(path.join(rootDirectory, relativePath), "utf8"),
  ) as T;
}

let measurementsPromise: Promise<PackagePayloadMeasurements> | undefined;

function payloadMeasurements(): Promise<PackagePayloadMeasurements> {
  measurementsPromise ??= measurePackagePayloads(rootDirectory);
  return measurementsPromise;
}

describe("lightweight root API", () => {
  it("is identical to the canonical raw reference metadata", async () => {
    const referencesJson = await readJson<PotaReference[]>(
      "data/references.json",
    );

    expect(references).toEqual(referencesJson);
  });

  it("matches every catalog record after catalog-only fields are removed", async () => {
    const catalog = await readJson<Catalog>("dist/catalog.json");
    const catalogMetadata = catalog.references.map(
      ({
        status: _status,
        geometryKind: _kind,
        source: _source,
        geojson: _geojson,
        ...reference
      }) => reference,
    );

    expect(catalogMetadata).toEqual(references);
    expect(catalog.schemaVersion).toBe(1);
  });

  it("has a closed runtime graph containing only the entry and references JSON", async () => {
    const measurements = await payloadMeasurements();

    expect(measurements.rootInputs).toEqual([
      "data/references.json",
      "dist/index.js",
    ]);
    const runtimeGraphText = (
      await Promise.all(
        measurements.rootInputs.map((relativePath) =>
          readFile(path.join(rootDirectory, relativePath), "utf8"),
        ),
      )
    ).join("\n");
    expect(runtimeGraphText).not.toMatch(
      /catalog\.json|all\.geojson|FeatureCollection|MultiPolygon|"coordinates"|"featureIds"|"geometryKind"|"geojson"/,
    );
  }, 30_000);

  it("stays below the accepted minified and Brotli budgets", async () => {
    const measurements = await payloadMeasurements();

    expect(measurements.root.minifiedBytes).toBeLessThan(50_000);
    expect(measurements.root.brotliBytes).toBeLessThan(20_000);
    expect(measurements.root.minifiedBytes).toBeLessThan(
      measurements.catalog.minifiedBytes,
    );
    expect(measurements.root.brotliBytes).toBeLessThan(
      measurements.catalog.brotliBytes,
    );
  });

  it("publishes package API v2 while retaining artifact schema v1", async () => {
    const packageJson = await readJson<{
      version: string;
      exports: Record<string, unknown>;
    }>("package.json");
    const catalog = await readJson<Catalog>("dist/catalog.json");
    const aggregate = await readJson<{
      properties: { schemaVersion: number };
    }>("dist/all.geojson");

    expect(packageJson.version).toMatch(/^2\./);
    expect(packageJson.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    });
    expect(catalog.schemaVersion).toBe(1);
    expect(aggregate.properties.schemaVersion).toBe(1);
  });
});
