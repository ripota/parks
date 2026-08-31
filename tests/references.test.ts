import { describe, expect, it } from "vitest";

import {
  normalizePotaReferences,
  officialPotaParkUrl,
} from "../src/references.ts";

describe("POTA reference normalization", () => {
  it("normalizes, sorts, and links reference records", () => {
    expect(
      normalizePotaReferences([
        {
          reference: " us-2 ",
          name: "Second",
          latitude: "41.2",
          longitude: "-71.2",
          grid: "FN41",
          counties: ["Washington County", "Kent County"],
          location: "US-RI",
        },
        {
          reference: "US-1",
          name: "First",
          latitude: 41.1,
          longitude: -71.1,
          grid: "FN41",
          locationDesc: "US-RI",
        },
      ]),
    ).toEqual([
      {
        reference: "US-1",
        name: "First",
        latitude: 41.1,
        longitude: -71.1,
        grid: "FN41",
        counties: [],
        locationDesc: "US-RI",
        potaUrl: "https://pota.app/#/park/US-1",
      },
      {
        reference: "US-2",
        name: "Second",
        latitude: 41.2,
        longitude: -71.2,
        grid: "FN41",
        counties: ["Kent County", "Washington County"],
        locationDesc: "US-RI",
        potaUrl: "https://pota.app/#/park/US-2",
      },
    ]);
    expect(officialPotaParkUrl(" us-6980 ")).toBe(
      "https://pota.app/#/park/US-6980",
    );
  });
});
