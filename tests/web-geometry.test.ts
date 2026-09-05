import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { Ajv } from "ajv";
import { expect, it } from "vitest";
import { geometryCounts, simplifyWeb } from "../src/web-geometry.ts";
import type { GeoJsonFeatureCollection } from "../src/types.ts";
const json = async (name: string) => JSON.parse(await readFile(name, "utf8"));
it("preserves topology, holes, identity and reproducibility for all references", async () => {
  const catalog = await json("dist/catalog.json");
  const derivations = await json("dist/web-derivations.json");
  const validate = new Ajv().compile(
    await json("schemas/web/v1/display-geojson.schema.json"),
  );
  for (const record of catalog.references) {
    const result = simplifyWeb(record.geojson);
    const webText = await readFile(
      `dist/boundaries-web/${record.reference.toLowerCase()}.geojson`,
      "utf8",
    );
    expect(validate(result.geojson), JSON.stringify(validate.errors)).toBe(
      true,
    );
    expect(JSON.parse(webText)).toEqual(result.geojson);
    const before = geometryCounts(record.geojson.features[0].geometry),
      after = geometryCounts(result.geojson.features[0].geometry);
    expect(after.components).toBe(before.components);
    expect(after.holes).toBe(before.holes);
    const metadata = derivations.records.find(
      (item: { reference: string }) => item.reference === record.reference,
    );
    expect(metadata.outputSha256).toBe(
      createHash("sha256").update(webText).digest("hex"),
    );
    expect(metadata.inputSha256).toBe(
      createHash("sha256")
        .update(
          await readFile(
            `dist/boundaries/${record.reference.toLowerCase()}.geojson`,
          ),
        )
        .digest("hex"),
    );
    if (record.reference === "US-4582") {
      expect(result.geojson.features[0].geometry).toEqual(
        record.geojson.features[0].geometry,
      );
      expect(result.geojson.properties?.bufferDistanceFeet).toBe(100);
      expect(metadata.algorithm).toBe("identity");
    }
  }
}, 30000);
it("measures actual artifact bytes and enforces representative size budgets", async () => {
  const measurements = await json("dist/web-measurements.json");
  for (const id of [
    "ALL",
    "US-2870",
    "US-6979",
    "US-6992",
    "US-0513",
    "US-4582",
  ]) {
    const row = measurements.records.find(
      (record: { reference: string }) => record.reference === id,
    );
    for (const tier of ["detailed", "web"]) {
      const file =
        id === "ALL"
          ? `dist/all${tier === "web" ? "-web" : ""}.geojson`
          : `dist/boundaries${tier === "web" ? "-web" : ""}/${id.toLowerCase()}.geojson`;
      const content = await readFile(file);
      expect(row[tier]).toEqual({
        raw: content.length,
        gzip: gzipSync(content).length,
      });
    }
    if (["ALL", "US-2870"].includes(id))
      expect(row.web.gzip).toBeLessThan(row.detailed.gzip * 0.7);
  }
});
it("retains points and rejects invalid geometry", () => {
  const input: GeoJsonFeatureCollection = {
    type: "FeatureCollection",
    properties: {
      potaReference: "US-0001",
      geometryRole: "display",
      geometryKind: "point",
    },
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [-71, 41] },
      },
    ],
  };
  expect(simplifyWeb(input).geojson.features[0].geometry).toEqual(
    input.features[0].geometry,
  );
  expect(() => simplifyWeb({ ...input, features: [] })).toThrow(
    "one dissolved",
  );
  expect(() =>
    simplifyWeb({
      ...input,
      features: [
        {
          ...input.features[0],
          geometry: { type: "Point", coordinates: [181, 41] },
        },
      ],
    }),
  ).toThrow("Invalid position");
});
