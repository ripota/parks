import { countyBoundaryUrl } from "../config/boundary-sources.ts";
import type {
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  PotaReference,
} from "./types.ts";

type CountyBoundary = {
  county: string;
  geometry: GeoJsonGeometry;
};

function countyName(name: string): string {
  return `${name
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())} County`;
}

function ringContainsPoint(ring: number[][], point: number[]): boolean {
  const [x, y] = point;
  let contains = false;
  for (
    let current = 0, previous = ring.length - 1;
    current < ring.length;
    previous = current, current += 1
  ) {
    const [currentX, currentY] = ring[current];
    const [previousX, previousY] = ring[previous];
    const intersects =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) / (previousY - currentY) +
          currentX;
    if (intersects) {
      contains = !contains;
    }
  }
  return contains;
}

function polygonContainsPoint(polygon: number[][][], point: number[]): boolean {
  return (
    ringContainsPoint(polygon[0], point) &&
    !polygon.slice(1).some((ring) => ringContainsPoint(ring, point))
  );
}

function geometryContainsPoint(
  geometry: GeoJsonGeometry,
  point: number[],
): boolean {
  if (geometry.type === "Polygon") {
    return polygonContainsPoint(geometry.coordinates as number[][][], point);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((polygon) =>
      polygonContainsPoint(polygon, point),
    );
  }
  return false;
}

function flattenCoordinatePoints(
  coordinates: unknown,
  points: number[][] = [],
): number[][] {
  if (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    points.push(coordinates as number[]);
    return points;
  }
  if (Array.isArray(coordinates)) {
    for (const coordinate of coordinates) {
      flattenCoordinatePoints(coordinate, points);
    }
  }
  return points;
}

export async function fetchJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ripota/parks reviewed data updater",
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${url.toString()} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchCountyBoundaries(): Promise<CountyBoundary[]> {
  const url = new URL(countyBoundaryUrl);
  url.search = new URLSearchParams({
    where: "1=1",
    outFields: "COUNTY",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  }).toString();
  const counties = await fetchJson<GeoJsonFeatureCollection>(url);
  return counties.features.map((feature) => ({
    county: countyName(String(feature.properties?.COUNTY)),
    geometry: feature.geometry,
  }));
}

export function deriveCounties(
  reference: PotaReference,
  geojson: GeoJsonFeatureCollection,
  countyBoundaries: CountyBoundary[],
): string[] {
  const geometryPoints = geojson.features.flatMap((feature) =>
    flattenCoordinatePoints(feature.geometry.coordinates),
  );
  const points =
    geometryPoints.length > 0
      ? geometryPoints
      : [[reference.longitude, reference.latitude]];
  return countyBoundaries
    .filter((county) =>
      points.some((point) => geometryContainsPoint(county.geometry, point)),
    )
    .map((county) => county.county)
    .sort((left, right) => left.localeCompare(right));
}
