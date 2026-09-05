import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { brotliCompressSync } from "node:zlib";
import { expect, it } from "vitest";
import { getReference } from "../dist/index.js";
import {
  dataset,
  displayReferences,
  getDisplayReference,
} from "../dist/display.js";
import { bounds } from "../src/display-build.ts";

it("provides reviewed presentation points and exact exported bounds", async () => {
  expect(getDisplayReference("us-4582")?.displayPoint).toMatchObject({
    source: "reviewed",
    latitude: 41.7445710002769,
  });
  expect(getReference("us-4582")?.latitude).not.toBe(
    getDisplayReference("US-4582")?.displayPoint.latitude,
  );
  expect(getReference("unknown")).toBeUndefined();
  expect(getDisplayReference("unknown")).toBeUndefined();
  expect(dataset.referenceCount).toBe(displayReferences.length);
  for (const record of displayReferences) {
    const geojson = JSON.parse(
      await readFile(
        new URL(
          `../dist/boundaries/${record.reference.toLowerCase()}.geojson`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(record.bbox).toEqual(bounds(geojson));
    expect(geojson.bbox).toEqual(record.bbox);
    expect(record.artifact).toBe(
      `@ripota/parks/boundaries/${record.reference.toLowerCase()}.geojson`,
    );
    expect(record.displayPoint.source).toBe(
      record.reference === "US-4582" ? "reviewed" : "official",
    );
  }
});
it("keeps the display graph geometry-free and within explicit budgets", async () => {
  const bundle = await build({
    entryPoints: ["dist/display.js"],
    bundle: true,
    minify: true,
    write: false,
    metafile: true,
  });
  expect(Object.keys(bundle.metafile!.inputs)).toEqual(["dist/display.js"]);
  const content = bundle.outputFiles[0].contents;
  expect(Buffer.from(content).toString()).not.toMatch(
    /FeatureCollection|Polygon|coordinates|catalog\.json/,
  );
  expect(content.length).toBeLessThan(30000);
  expect(brotliCompressSync(content).length).toBeLessThan(8000);
});

it("publishes exact bounds on the detailed aggregate", async () => {
  const aggregate = JSON.parse(
    await readFile(new URL("../dist/all.geojson", import.meta.url), "utf8"),
  );
  expect(aggregate.bbox).toEqual(bounds(aggregate));
});
