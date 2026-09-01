import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Ajv, type ValidateFunction } from "ajv";
import { beforeAll, describe, expect, it } from "vitest";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function featureCollection(type: string, coordinates: unknown): unknown {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type, coordinates },
      },
    ],
  };
}

let validateCatalog: ValidateFunction;
let validateGeojson: ValidateFunction;

beforeAll(async () => {
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
  validateCatalog = ajv.compile(catalogSchema);
  validateGeojson = ajv.getSchema(
    "https://ripota.org/schemas/geojson.schema.json",
  )!;
});

describe("public GeoJSON schemas", () => {
  it("accepts valid Point, Polygon, and MultiPolygon coordinates", async () => {
    const ring = [
      [-71.6, 41.4],
      [-71.5, 41.4],
      [-71.5, 41.5],
      [-71.6, 41.4],
    ];

    for (const value of [
      featureCollection("Point", [-71.5, 41.5]),
      featureCollection("Polygon", [ring]),
      featureCollection("MultiPolygon", [[ring]]),
    ]) {
      expect(
        validateGeojson(value),
        JSON.stringify(validateGeojson.errors),
      ).toBe(true);
    }
  });

  it.each([
    ["one-number Point", featureCollection("Point", [999])],
    ["nonnumeric Point", featureCollection("Point", [-71.5, "41.5"])],
    [
      "malformed Polygon nesting",
      featureCollection("Polygon", [
        [-71.6, 41.4],
        [-71.5, 41.4],
        [-71.5, 41.5],
        [-71.6, 41.4],
      ]),
    ],
    ["empty Polygon ring", featureCollection("Polygon", [[]])],
    [
      "malformed MultiPolygon nesting",
      featureCollection("MultiPolygon", [
        [
          [-71.6, 41.4],
          [-71.5, 41.4],
          [-71.5, 41.5],
          [-71.6, 41.4],
        ],
      ]),
    ],
    ["empty MultiPolygon ring", featureCollection("MultiPolygon", [[[]]])],
  ])("rejects %s coordinates", async (_name, value) => {
    expect(validateGeojson(value)).toBe(false);
  });

  it("resolves the catalog GeoJSON reference entirely offline", async () => {
    const catalog = JSON.parse(
      await readFile(path.join(rootDirectory, "dist/catalog.json"), "utf8"),
    );
    expect(
      validateCatalog(catalog),
      JSON.stringify(validateCatalog.errors),
    ).toBe(true);
  });
});
