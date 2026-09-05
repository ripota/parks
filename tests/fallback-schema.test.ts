import { readFile } from "node:fs/promises";
import { Ajv } from "ajv";
import { expect, it } from "vitest";
import { fallbackPoint, v3Artifacts } from "../src/fallback.ts";
import type { ManifestRecord, PotaReference } from "../src/types.ts";
it("validates fallback contracts and rejects reviewed/fallback mismatches", async () => {
  const reference: PotaReference = {
    reference: "US-0001",
    name: "Fixture",
    latitude: 41.5,
    longitude: -71.5,
    counties: ["Kent County"],
    grid: "FN41",
    locationDesc: "US-RI",
    potaUrl: "https://pota.app/#/park/US-0001",
  };
  const manifest: ManifestRecord = {
    reference: reference.reference,
    status: "research-needed",
    sourceName: "Parks on the Air",
    sourceUrl: reference.potaUrl,
  };
  const { artifacts } = v3Artifacts([reference], [manifest], []);
  const ajv = new Ajv({ strict: false });
  ajv.addSchema(
    JSON.parse(
      await readFile("schemas/v3/display-geojson.schema.json", "utf8"),
    ),
  );
  const validate = ajv.compile(
    JSON.parse(await readFile("schemas/v3/catalog.schema.json", "utf8")),
  );
  const catalog = JSON.parse(artifacts.get("dist/v3/catalog.json")!);
  expect(validate(catalog), JSON.stringify(validate.errors)).toBe(true);
  const invalid = structuredClone(catalog);
  invalid.references[0].status = "available";
  expect(validate(invalid)).toBe(false);
  const fabricated = structuredClone(catalog);
  fabricated.references[0].source = {
    name: "invented",
    url: "https://example.org",
    featureIds: [1],
    artifact: "source-features/us-0001.geojson",
  };
  expect(validate(fabricated)).toBe(false);
  expect(() =>
    fallbackPoint(
      { ...reference, latitude: undefined as unknown as number },
      manifest,
    ),
  ).toThrow("invalid official coordinates");
  expect(() =>
    fallbackPoint(reference, { ...manifest, status: "point-only" }),
  ).toThrow("invalid research-needed mapping");
});
