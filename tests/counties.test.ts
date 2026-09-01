import { describe, expect, it } from "vitest";

import { deriveCounties, type CountyBoundary } from "../src/counties.ts";
import type {
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  PotaReference,
} from "../src/types.ts";

const reference: PotaReference = {
  reference: "US-1",
  name: "Fixture",
  latitude: 0,
  longitude: 0,
  grid: "AA00",
  counties: [],
  locationDesc: "US-RI",
  potaUrl: "https://pota.app/#/park/US-1",
};

function collection(
  ...geometries: GeoJsonGeometry[]
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: geometries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

function boundary(county: string, geometry: GeoJsonGeometry): CountyBoundary {
  return { county, geometry };
}

const square = (minimum: number, maximum: number): GeoJsonGeometry => ({
  type: "Polygon",
  coordinates: [
    [
      [minimum, minimum],
      [maximum, minimum],
      [maximum, maximum],
      [minimum, maximum],
      [minimum, minimum],
    ],
  ],
});

describe("county geometry intersection", () => {
  it("detects edge crossings with no park vertex inside the county", () => {
    const park = square(0, 4);
    const narrowCounty: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [1, -1],
          [2, -1],
          [2, 5],
          [1, 5],
          [1, -1],
        ],
      ],
    };

    expect(
      deriveCounties(reference, collection(park), [
        boundary("Crossing County", narrowCounty),
      ]),
    ).toEqual(["Crossing County"]);
  });

  it("detects a county contained entirely by a park", () => {
    expect(
      deriveCounties(reference, collection(square(-2, 5)), [
        boundary("Contained County", square(0, 1)),
      ]),
    ).toEqual(["Contained County"]);
  });

  it("counts point contact on a county boundary as an intersection", () => {
    expect(
      deriveCounties(
        reference,
        collection({ type: "Point", coordinates: [0, 1] }),
        [boundary("Boundary County", square(0, 1))],
      ),
    ).toEqual(["Boundary County"]);
  });

  it("does not count geometry contained by a county hole", () => {
    const countyWithHole: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
          [0, 0],
        ],
        [
          [4, 4],
          [6, 4],
          [6, 6],
          [4, 6],
          [4, 4],
        ],
      ],
    };

    expect(
      deriveCounties(
        reference,
        collection({ type: "Point", coordinates: [5, 5] }, square(4.5, 5.5)),
        [boundary("Hole County", countyWithHole)],
      ),
    ).toEqual([]);
  });

  it("supports park and county MultiPolygons", () => {
    const park: GeoJsonGeometry = {
      type: "MultiPolygon",
      coordinates: [square(20, 21).coordinates, square(2, 3).coordinates],
    };
    const county: GeoJsonGeometry = {
      type: "MultiPolygon",
      coordinates: [square(-10, -9).coordinates, square(1, 2.5).coordinates],
    };

    expect(
      deriveCounties(reference, collection(park), [
        boundary("Multi County", county),
      ]),
    ).toEqual(["Multi County"]);
  });

  it("returns unique county names in deterministic alphabetical order", () => {
    expect(
      deriveCounties(reference, collection(square(0, 2)), [
        boundary("Washington County", square(0, 1)),
        boundary("Kent County", square(1, 2)),
        boundary("Kent County", square(0, 2)),
      ]),
    ).toEqual(["Kent County", "Washington County"]);
  });
});
