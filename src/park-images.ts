import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Ajv } from "ajv";
import imageSchema from "../schemas/park-images.schema.json" with { type: "json" };
import type { Park, ParkImage, ParkImageRegistry } from "./public-types.ts";

const ajv = new Ajv({ allErrors: true });
ajv.addFormat("http-url", (value: string) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
});
ajv.addFormat("calendar-date", (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
});
const validate = ajv.compile<ParkImageRegistry>(imageSchema);

/** Convert a content-addressed public export to its checked-in package path. */
export function imageAssetRelativePath(
  image: Pick<ParkImage, "id" | "artifact" | "sha256">,
): string {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(image.id) ||
    !/^[a-f0-9]{64}$/.test(image.sha256) ||
    image.artifact !==
      `@ripota/parks/images/${image.id}.${image.sha256.slice(0, 12)}.webp`
  ) {
    throw new Error(`Invalid park image artifact for ${image.id}`);
  }
  return `assets/images/${image.id}.${image.sha256.slice(0, 12)}.webp`;
}

type Dimensions = { width: number; height: number };

/** Validate the still-WebP container and read dimensions from its frame header.
 * Container specification: https://developers.google.com/speed/webp/docs/riff_container
 * This is a structural check, not a replacement for visual review/full decoding.
 */
function webpDimensions(bytes: Buffer, id: string): Dimensions {
  const invalid = (reason: string): never => {
    throw new Error(`Invalid WebP for ${id}: ${reason}`);
  };
  if (
    bytes.length < 20 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  ) {
    return invalid("header or file length");
  }
  let canvas: Dimensions | undefined;
  let frame: Dimensions | undefined;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) return invalid("truncated chunk header");
    const kind = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + size;
    const paddedEnd = end + (size % 2);
    if (paddedEnd > bytes.length || (size % 2 && bytes[end] !== 0)) {
      return invalid("truncated chunk or invalid padding");
    }
    if (kind === "VP8X") {
      if (offset !== 12 || size !== 10 || bytes[start] & 0x02) {
        return invalid("invalid or animated extended header");
      }
      canvas = {
        width: bytes.readUIntLE(start + 4, 3) + 1,
        height: bytes.readUIntLE(start + 7, 3) + 1,
      };
    } else if (kind === "VP8 ") {
      if (
        frame ||
        size <= 10 ||
        bytes[start] & 1 ||
        bytes.readUIntLE(start + 3, 3) !== 0x2a019d
      ) {
        return invalid("invalid or duplicate VP8 frame");
      }
      frame = {
        width: bytes.readUInt16LE(start + 6) & 0x3fff,
        height: bytes.readUInt16LE(start + 8) & 0x3fff,
      };
    } else if (kind === "VP8L") {
      if (
        frame ||
        size <= 5 ||
        bytes[start] !== 0x2f ||
        bytes[start + 4] & 0xe0
      ) {
        return invalid("invalid or duplicate VP8L frame");
      }
      const bits = bytes.readUInt32LE(start + 1);
      frame = {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    } else if (kind === "ANIM" || kind === "ANMF") {
      return invalid("animated images are not supported");
    }
    offset = paddedEnd;
  }
  if (!frame || !frame.width || !frame.height)
    return invalid("missing image frame");
  if (
    canvas &&
    (canvas.width !== frame.width || canvas.height !== frame.height)
  ) {
    return invalid("canvas and frame dimensions differ");
  }
  return frame;
}

/** Validate reviewed provenance, hero references, and the complete local inventory. */
export async function readParkImages(
  rootDirectory: string,
  parks: readonly Pick<Park, "reference" | "heroImageId">[],
): Promise<ParkImageRegistry> {
  const registry: unknown = JSON.parse(
    await readFile(path.join(rootDirectory, "config/park-images.json"), "utf8"),
  );
  if (!validate(registry)) {
    throw new Error(`Invalid park images: ${ajv.errorsText(validate.errors)}`);
  }
  const imagesById = new Map<string, ParkImage>();
  for (const image of registry.images) {
    if (imagesById.has(image.id)) {
      throw new Error(`Duplicate park image ID: ${image.id}`);
    }
    imageAssetRelativePath(image);
    imagesById.set(image.id, image);
  }
  const usedIds = new Set<string>();
  for (const park of parks) {
    if (park.heroImageId === undefined) continue;
    if (!imagesById.has(park.heroImageId)) {
      throw new Error(
        `Missing hero image ${park.heroImageId} for ${park.reference}`,
      );
    }
    usedIds.add(park.heroImageId);
  }
  const orphans = registry.images.filter(({ id }) => !usedIds.has(id));
  if (orphans.length) {
    throw new Error(
      `Orphaned park images: ${orphans.map(({ id }) => id).join(", ")}`,
    );
  }
  const imageDirectory = path.join(rootDirectory, "assets/images");
  let actual: string[] = [];
  try {
    if (!(await lstat(imageDirectory)).isDirectory()) {
      throw new Error(
        "Park image inventory must be a directory, not a symlink",
      );
    }
    const entries = await readdir(imageDirectory, { withFileTypes: true });
    if (entries.some((entry) => !entry.isFile())) {
      throw new Error(
        "Park image inventory must contain only regular image files",
      );
    }
    actual = entries.map(({ name }) => `assets/images/${name}`);
  } catch (error) {
    if (!(
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    )) {
      throw error;
    }
  }
  const expected = new Set(registry.images.map(imageAssetRelativePath));
  const missing = [...expected].filter((file) => !actual.includes(file));
  const extra = actual.filter((file) => !expected.has(file));
  if (missing.length || extra.length) {
    throw new Error(
      `Park image inventory mismatch; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
    );
  }
  for (const image of registry.images) {
    const bytes = await readFile(
      path.join(rootDirectory, imageAssetRelativePath(image)),
    );
    if (bytes.length !== image.bytes) {
      throw new Error(`Park image byte length mismatch for ${image.id}`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== image.sha256) {
      throw new Error(`Park image SHA-256 mismatch for ${image.id}`);
    }
    const dimensions = webpDimensions(bytes, image.id);
    if (
      dimensions.width !== image.width ||
      dimensions.height !== image.height
    ) {
      throw new Error(`Park image dimensions mismatch for ${image.id}`);
    }
  }
  return registry;
}
