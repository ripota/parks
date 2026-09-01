import referencesJson from "../data/references.json" with { type: "json" };

export type PotaReference = {
  reference: string;
  name: string;
  latitude: number;
  longitude: number;
  grid: string;
  counties: string[];
  locationDesc: string;
  potaUrl: string;
};

export const references: PotaReference[] = referencesJson;
