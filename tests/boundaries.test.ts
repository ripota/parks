import { describe, expect, it } from "vitest";

import { displayGeometryRule } from "../config/boundary-sources.ts";
import { removeSmallHoles } from "../src/boundaries.ts";
import type { GeoJsonGeometry } from "../src/types.ts";

const outerRing = [
  [-71.41, 41.44],
  [-71.38, 41.44],
  [-71.38, 41.47],
  [-71.41, 41.47],
  [-71.41, 41.44],
];
const sliverRing = [
  [-71.4, 41.45],
  [-71.399, 41.45],
  [-71.3995, 41.450000001],
  [-71.4, 41.45],
];
const meaningfulHole = [
  [-71.4, 41.45],
  [-71.399, 41.45],
  [-71.399, 41.451],
  [-71.4, 41.451],
  [-71.4, 41.45],
];

describe("display geometry hole cleanup", () => {
  it("removes sub-resolution holes while preserving meaningful holes", () => {
    const geometry: GeoJsonGeometry = {
      type: "Polygon",
      coordinates: [outerRing, sliverRing, meaningfulHole],
    };

    const result = removeSmallHoles(geometry);

    expect(result.geometry).toEqual({
      type: "Polygon",
      coordinates: [outerRing, meaningfulHole],
    });
    expect(result.operation).toMatchObject({
      operation: "remove-small-holes",
      maximumAreaSquareMeters:
        displayGeometryRule.maximumArtifactHoleAreaSquareMeters,
      removedHoleCount: 1,
    });
    expect(
      result.operation.operation === "remove-small-holes" &&
        result.operation.removedAreaSquareMeters,
    ).toBeGreaterThan(0);
  });

  it("applies the same cleanup independently to every multipolygon component", () => {
    const geometry: GeoJsonGeometry = {
      type: "MultiPolygon",
      coordinates: [
        [outerRing, sliverRing],
        [outerRing, meaningfulHole],
      ],
    };

    const result = removeSmallHoles(geometry);

    expect(result.geometry).toEqual({
      type: "MultiPolygon",
      coordinates: [[outerRing], [outerRing, meaningfulHole]],
    });
    expect(result.operation).toMatchObject({
      removedHoleCount: 1,
    });
  });

  it("rejects nonpositive cleanup thresholds", () => {
    expect(() =>
      removeSmallHoles({ type: "Polygon", coordinates: [outerRing] }, 0),
    ).toThrow("Small-hole removal threshold must be positive");
  });
});
