import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parks, getPark } from "../dist/index.js";
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

const identity = ({
  reference,
  name,
  latitude,
  longitude,
  grid,
  counties,
  locationDesc,
  potaUrl,
}: (typeof parks)[number]) => ({
  reference,
  name,
  latitude,
  longitude,
  grid,
  counties,
  locationDesc,
  potaUrl,
});

describe("park root API", () => {
  it("looks up normalized references and removes the old root aliases", async () => {
    expect(getPark("  us-0513 ")).toBe(
      parks.find((park) => park.reference === "US-0513"),
    );
    expect(getPark("unknown")).toBeUndefined();
    expect(getPark("")).toBeUndefined();
    const root = await import("../dist/index.js");
    expect(Object.keys(root).sort()).toEqual(["getPark", "parks"]);
  });
  it("preserves the canonical raw reference identity", async () => {
    const referencesJson = await readJson<PotaReference[]>(
      "data/references.json",
    );

    expect(parks.map(identity)).toEqual(referencesJson);
    expect(parks).toHaveLength(61);
    expect(parks).toEqual(await readJson("dist/parks.json"));
  });

  it("matches every catalog record after catalog-only fields are removed", async () => {
    const catalog = await readJson<Catalog>("dist/catalog.json");
    const catalogMetadata = catalog.references.map(
      ({
        status: _status,
        geometryKind: _kind,
        mapPoint: _mapPoint,
        source: _source,
        geojson: _geojson,
        ...reference
      }) => reference,
    );

    expect(catalogMetadata).toEqual(parks.map(identity));
    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.geometryRole).toBe("display");
  });

  it("has a closed runtime graph containing only the entry and parks JSON", async () => {
    const measurements = await payloadMeasurements();

    expect(measurements.rootInputs).toEqual([
      "dist/index.js",
      "dist/parks.json",
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

    expect(measurements.root.minifiedBytes).toBeLessThan(150_000);
    expect(measurements.root.brotliBytes).toBeLessThan(25_000);
    expect(measurements.root.minifiedBytes).toBeLessThan(
      measurements.catalog.minifiedBytes,
    );
    expect(measurements.root.brotliBytes).toBeLessThan(
      measurements.catalog.brotliBytes,
    );
  });

  it("publishes package API v4 with artifact schema v2", async () => {
    const packageJson = await readJson<{
      version: string;
      exports: Record<string, unknown>;
    }>("package.json");
    const catalog = await readJson<Catalog>("dist/catalog.json");
    const aggregate = await readJson<{
      properties: { schemaVersion: number };
    }>("dist/all.geojson");

    expect(packageJson.version).toMatch(/^4\./);
    expect(packageJson.exports["."]).toEqual({
      types: "./dist/index.d.ts",
      default: "./dist/index.js",
    });
    expect(catalog.schemaVersion).toBe(2);
    expect(aggregate.properties.schemaVersion).toBe(2);
  });
});
