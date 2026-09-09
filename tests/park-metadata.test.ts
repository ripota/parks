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
  it.each([
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
