import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildParks } from "../src/park-metadata.ts";
import references from "../data/references.json" with { type: "json" };

const metadata = JSON.parse(
  await readFile(
    new URL("../config/park-metadata.json", import.meta.url),
    "utf8",
  ),
);

describe("maintained park metadata", () => {
  it("covers every accepted reference without changing identity", () => {
    const parks = buildParks(references, metadata);
    expect(parks.map(({ reference }) => reference)).toEqual(
      references.map(({ reference }) => reference),
    );
    expect(parks).toHaveLength(61);
    expect(
      parks.every(
        (park) =>
          park.websiteUrl &&
          park.manager &&
          park.orange.details &&
          park.sources.length,
      ),
    ).toBe(true);
  });
  it("preserves optional image metadata and leaves unsourced heroes absent", () => {
    const data = structuredClone(metadata);
    const withHero = references[0].reference;
    const withoutHero = references[1].reference;
    data[withHero].heroImageId = "coastal-trail";
    data[withHero].summary = "A coastal trail follows the rocky shoreline.";
    delete data[withoutHero].heroImageId;
    delete data[withoutHero].summary;
    const parks = buildParks(references, data);
    expect(parks[0].heroImageId).toBe("coastal-trail");
    expect(parks[0].summary).toBe(data[withHero].summary);
    expect(parks[1]).not.toHaveProperty("heroImageId");
    expect(parks[1]).not.toHaveProperty("summary");
  });
  it.each([
    [
      "invalid hero image ID",
      (data: typeof metadata) => {
        data[references[0].reference].heroImageId = "../escape";
      },
    ],
    [
      "null hero placeholder",
      (data: typeof metadata) => {
        data[references[0].reference].heroImageId = null;
      },
    ],
    [
      "blank summary",
      (data: typeof metadata) => {
        data[references[0].reference].summary = "   ";
      },
    ],
    [
      "missing record",
      (data: typeof metadata) => {
        delete data[references[0].reference];
      },
    ],
    [
      "extra record",
      (data: typeof metadata) => {
        data["US-999999"] = data[references[0].reference];
      },
    ],
    [
      "identity override",
      (data: typeof metadata) => {
        data[references[0].reference].name = "Override";
      },
    ],
    [
      "unknown type",
      (data: typeof metadata) => {
        data[references[0].reference].type = "unknown";
      },
    ],
    [
      "unknown amenity",
      (data: typeof metadata) => {
        data[references[0].reference].amenities = ["wifi"];
      },
    ],
    [
      "invalid website",
      (data: typeof metadata) => {
        data[references[0].reference].websiteUrl = "javascript:alert(1)";
      },
    ],
    [
      "invalid evidence",
      (data: typeof metadata) => {
        data[references[0].reference].orange.sourceUrl = "not a URL";
      },
    ],
    [
      "empty sources",
      (data: typeof metadata) => {
        data[references[0].reference].sources = [];
      },
    ],
    [
      "unknown orange status",
      (data: typeof metadata) => {
        data[references[0].reference].orange.status = "unknown";
      },
    ],
    [
      "missing season",
      (data: typeof metadata) => {
        delete data[references[0].reference].orange.season;
      },
    ],
  ] as const)("rejects %s", (_name, mutate) => {
    const invalid = structuredClone(metadata);
    mutate(invalid);
    expect(() => buildParks(references, invalid)).toThrow();
  });
  it("rejects duplicate identity records", () => {
    expect(() => buildParks([...references, references[0]], metadata)).toThrow(
      /Duplicate/,
    );
  });
});
