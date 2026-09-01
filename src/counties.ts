import { booleanIntersects } from "@turf/boolean-intersects";

import { countyBoundaryUrl } from "../config/boundary-sources.ts";
import type {
  GeoJsonFeatureCollection,
  GeoJsonGeometry,
  PotaReference,
} from "./types.ts";

export type CountyBoundary = {
  county: string;
  geometry: GeoJsonGeometry;
};

export const REQUEST_TIMEOUT_MS = 15_000;
export const MAX_REQUEST_ATTEMPTS = 3;

const RETRY_BASE_DELAY_MS = 250;
const RETRY_MAX_DELAY_MS = 2_000;

export type FetchJsonOptions = {
  fetch?: typeof fetch;
  maxAttempts?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
};

export class UpstreamRequestError extends Error {
  readonly attempts: number;
  readonly status?: number;
  readonly url: string;

  constructor(
    message: string,
    details: {
      attempts: number;
      cause?: unknown;
      status?: number;
      url: string;
    },
  ) {
    super(message, { cause: details.cause });
    this.name = "UpstreamRequestError";
    this.attempts = details.attempts;
    this.status = details.status;
    this.url = details.url;
  }
}

function countyName(name: string): string {
  return `${name
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())} County`;
}

type Bounds = [west: number, south: number, east: number, north: number];

const boundsByGeometry = new WeakMap<GeoJsonGeometry, Bounds>();

function geometryBounds(geometry: GeoJsonGeometry): Bounds {
  const cached = boundsByGeometry.get(geometry);
  if (cached) {
    return cached;
  }
  const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function visit(value: unknown): void {
    if (
      Array.isArray(value) &&
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number"
    ) {
      bounds[0] = Math.min(bounds[0], value[0]);
      bounds[1] = Math.min(bounds[1], value[1]);
      bounds[2] = Math.max(bounds[2], value[0]);
      bounds[3] = Math.max(bounds[3], value[1]);
      return;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        visit(child);
      }
    }
  }
  visit(geometry.coordinates);
  boundsByGeometry.set(geometry, bounds);
  return bounds;
}

function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return !(
    left[2] < right[0] ||
    left[0] > right[2] ||
    left[3] < right[1] ||
    left[1] > right[3]
  );
}

function concise(message: string, maximumLength = 300): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  return singleLine.length <= maximumLength
    ? singleLine
    : `${singleLine.slice(0, maximumLength - 1)}…`;
}

function attemptLabel(attempts: number): string {
  return `${attempts} ${attempts === 1 ? "attempt" : "attempts"}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function retryAfterMilliseconds(
  value: string | null,
  now: () => number,
): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now()) : undefined;
}

function retryDelay(
  attempt: number,
  retryAfter: string | null,
  now: () => number,
): number {
  const requested = retryAfterMilliseconds(retryAfter, now);
  return Math.min(
    requested ?? RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    RETRY_MAX_DELAY_MS,
  );
}

function arcGisErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return undefined;
  }
  const error = value.error;
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const record = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };
  const details = Array.isArray(record.details)
    ? record.details.filter(
        (detail): detail is string => typeof detail === "string",
      )
    : [];
  const parts = [
    record.code === undefined
      ? "ArcGIS error"
      : `ArcGIS error ${String(record.code)}`,
    typeof record.message === "string"
      ? record.message
      : "Unknown upstream error",
    ...details,
  ];
  return concise(parts.join(": "));
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function fetchJson<T>(
  url: URL | string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const sourceUrl = url.toString();
  const fetchImplementation = options.fetch ?? fetch;
  const maxAttempts = options.maxAttempts ?? MAX_REQUEST_ATTEMPTS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || timeoutMs <= 0) {
    throw new TypeError(
      "fetchJson requires positive timeout and attempt limits",
    );
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImplementation(sourceUrl, {
        signal: controller.signal,
        headers: {
          "user-agent": "ripota/parks reviewed data updater",
          accept: "application/json",
        },
      });
      if (!response.ok) {
        const message = concise(response.statusText || "HTTP failure");
        if (isRetryableStatus(response.status) && attempt < maxAttempts) {
          await sleep(
            retryDelay(attempt, response.headers.get("retry-after"), now),
          );
          continue;
        }
        throw new UpstreamRequestError(
          `GET ${sourceUrl} failed after ${attemptLabel(attempt)} (HTTP ${response.status}): ${message}`,
          { attempts: attempt, status: response.status, url: sourceUrl },
        );
      }

      let value: unknown;
      try {
        value = await response.json();
      } catch (error) {
        throw new UpstreamRequestError(
          `GET ${sourceUrl} returned malformed JSON after ${attemptLabel(attempt)} (HTTP ${response.status}): ${concise(error instanceof Error ? error.message : String(error))}`,
          {
            attempts: attempt,
            cause: error,
            status: response.status,
            url: sourceUrl,
          },
        );
      }

      const upstreamMessage = arcGisErrorMessage(value);
      if (upstreamMessage) {
        throw new UpstreamRequestError(
          `GET ${sourceUrl} failed after ${attemptLabel(attempt)} (HTTP ${response.status}): ${upstreamMessage}`,
          { attempts: attempt, status: response.status, url: sourceUrl },
        );
      }
      return value as T;
    } catch (error) {
      if (error instanceof UpstreamRequestError) {
        throw error;
      }
      const reason = timedOut
        ? `timed out after ${timeoutMs}ms`
        : concise(error instanceof Error ? error.message : String(error));
      if (attempt < maxAttempts) {
        await sleep(retryDelay(attempt, null, now));
        continue;
      }
      throw new UpstreamRequestError(
        `GET ${sourceUrl} failed after ${attemptLabel(attempt)}: ${reason}`,
        { attempts: attempt, cause: error, url: sourceUrl },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("unreachable request state");
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
  const geometries =
    geojson.features.length > 0
      ? geojson.features.map((feature) => feature.geometry)
      : [
          {
            type: "Point",
            coordinates: [reference.longitude, reference.latitude],
          },
        ];
  return [
    ...new Set(
      countyBoundaries
        .filter((county) =>
          geometries.some(
            (geometry) =>
              boundsIntersect(
                geometryBounds(geometry),
                geometryBounds(county.geometry),
              ) &&
              booleanIntersects(
                geometry as Parameters<typeof booleanIntersects>[0],
                county.geometry as Parameters<typeof booleanIntersects>[1],
              ),
          ),
        )
        .map((county) => county.county),
    ),
  ].sort((left, right) => left.localeCompare(right));
}
