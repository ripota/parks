import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { imageAssetRelativePath, readParkImages } from "../src/park-images.ts";
import type { ParkImage } from "../src/public-types.ts";

// Real 2x3 RGB images encoded with cwebp, kept inline so tests are offline.
const lossy = Buffer.from(
  "UklGRlIAAABXRUJQVlA4IEYAAADQAQCdASoCAAMAAgA0JagCdAEO92ZIAAD+4p+odLPf4a//n3hzdKwSHom/txDf/IV7j/Bxuv65lo/g43X/WP0r12BLXAAA",
  "base64",
);
const lossless = Buffer.from(
  "UklGRjIAAABXRUJQVlA4TCUAAAAvAYAAAC8gEEjaH3qN+RcQFPk/2vwHskXCBoFAGpIJYJUj+h8OAA==",
  "base64",
);
function extendedImage() {
  const header = Buffer.alloc(18);
  header.write("VP8X");
  header.writeUInt32LE(10, 4);
  header.writeUIntLE(1, 12, 3);
  header.writeUIntLE(2, 15, 3);
  const image = Buffer.concat([
    lossy.subarray(0, 12),
    header,
    lossy.subarray(12),
  ]);
  image.writeUInt32LE(image.length - 8, 4);
  return image;
}

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(bytes: Buffer = lossy) {
  const directory = await mkdtemp(path.join(tmpdir(), "park-images-test-"));
  directories.push(directory);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const image = {
    id: "shoreline",
    artifact:
      `@ripota/parks/images/shoreline.${sha256.slice(0, 12)}.webp` as const,
    width: 2,
    height: 3,
    bytes: bytes.length,
    sha256,
    mimeType: "image/webp",
    alt: "Rocky shoreline beside a coastal trail",
    focalPoint: { x: 0.5, y: 0.5 },
    credit: "Example photographer / USFWS",
    source: {
      pageUrl: "https://www.fws.gov/media/example",
      imageUrl: "https://www.fws.gov/sites/default/files/example.jpg",
      sha256: "a".repeat(64),
      retrievedAt: "2026-09-12",
    },
    rights: {
      kind: "public-domain",
      label: "Public Domain",
      url: "https://www.fws.gov/media/example",
      reviewedAt: "2026-09-12",
    },
    transforms: ["Resized and encoded as WebP"],
  } satisfies ParkImage;
  const registry = { schemaVersion: 1 as const, images: [image] };
  await mkdir(path.join(directory, "config"));
  await mkdir(path.join(directory, "assets/images"), { recursive: true });
  const asset = path.join(directory, imageAssetRelativePath(image));
  await writeFile(asset, bytes);
  const save = (data: unknown = registry) =>
    writeFile(
      path.join(directory, "config/park-images.json"),
      JSON.stringify(data),
    );
  await save();
  const parks = [{ reference: "US-0001", heroImageId: image.id }];
  return { directory, image, registry, asset, parks, save };
}

describe("reviewed park images", () => {
  it.each([
    ["lossy", lossy],
    ["lossless", lossless],
    ["extended", extendedImage()],
  ])(
    "accepts a valid %s WebP and shared or absent heroes",
    async (_kind, bytes) => {
      const data = await fixture(bytes as Buffer);
      expect(
        await readParkImages(data.directory, [
          ...data.parks,
          { reference: "US-0002", heroImageId: data.image.id },
          { reference: "US-0003" },
        ]),
      ).toEqual(data.registry);
    },
  );

  it("accepts an empty registry without inventing placeholders or requiring an empty directory", async () => {
    const data = await fixture();
    const empty = { schemaVersion: 1, images: [] };
    await data.save(empty);
    await rm(path.join(data.directory, "assets/images"), { recursive: true });
    expect(
      await readParkImages(data.directory, [{ reference: "US-0001" }]),
    ).toEqual(empty);
    await mkdir(path.join(data.directory, "assets/images"));
    expect(await readParkImages(data.directory, [])).toEqual(empty);
  });

  it.each([
    [
      "unsafe ID",
      (image: any) => {
        image.id = "../shoreline";
      },
    ],
    [
      "unsafe artifact",
      (image: any) => {
        image.artifact = "@ripota/parks/images/../secret.webp";
      },
    ],
    [
      "external artifact",
      (image: any) => {
        image.artifact = "https://example.com/image.webp";
      },
    ],
    [
      "invalid source URL",
      (image: any) => {
        image.source.pageUrl = "javascript:alert(1)";
      },
    ],
    [
      "credentialed source URL",
      (image: any) => {
        image.source.imageUrl = "https://user:pass@example.com/photo.jpg";
      },
    ],
    [
      "invalid rights URL",
      (image: any) => {
        image.rights.url = "not a URL";
      },
    ],
    [
      "unknown rights kind",
      (image: any) => {
        image.rights.kind = "government-website";
      },
    ],
    [
      "missing rights",
      (image: any) => {
        delete image.rights;
      },
    ],
    [
      "invalid review date",
      (image: any) => {
        image.rights.reviewedAt = "2026-02-30";
      },
    ],
    [
      "invalid retrieval date",
      (image: any) => {
        image.source.retrievedAt = "September 12";
      },
    ],
    [
      "unknown field",
      (image: any) => {
        image.source.author = "Unknown";
      },
    ],
    [
      "blank alt text",
      (image: any) => {
        image.alt = "   ";
      },
    ],
    [
      "invalid focal point",
      (image: any) => {
        image.focalPoint.x = 1.1;
      },
    ],
    [
      "invalid digest",
      (image: any) => {
        image.source.sha256 = "abc";
      },
    ],
    [
      "wrong MIME type",
      (image: any) => {
        image.mimeType = "image/jpeg";
      },
    ],
  ] as const)("rejects %s", async (_name, mutate) => {
    const data = await fixture();
    const registry = structuredClone(data.registry);
    mutate(registry.images[0]);
    await data.save(registry);
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /Invalid park images/,
    );
  });

  it("rejects a filename that disagrees with its ID or digest", async () => {
    const data = await fixture();
    const image = {
      ...data.image,
      artifact: "@ripota/parks/images/shoreline.000000000000.webp" as const,
    };
    await data.save({ ...data.registry, images: [image] });
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /Invalid park image artifact/,
    );
    expect(() => imageAssetRelativePath({ ...image, id: "../escape" })).toThrow(
      /Invalid/,
    );
  });

  it("rejects duplicate IDs, unresolved heroes, and unused registry images", async () => {
    const data = await fixture();
    await data.save({ ...data.registry, images: [data.image, data.image] });
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /Duplicate park image ID/,
    );
    await data.save();
    await expect(
      readParkImages(data.directory, [
        { reference: "US-0001", heroImageId: "missing" },
      ]),
    ).rejects.toThrow(/Missing hero image missing for US-0001/);
    await expect(
      readParkImages(data.directory, [{ reference: "US-0001" }]),
    ).rejects.toThrow(/Orphaned park images/);
  });

  it("rejects missing files and missing directories for nonempty registries", async () => {
    const data = await fixture();
    await rm(data.asset);
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /inventory mismatch; missing: assets\/images/,
    );
    await rm(path.join(data.directory, "assets/images"), { recursive: true });
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /inventory mismatch; missing: assets\/images/,
    );
  });

  it("rejects unregistered assets and nested directories", async () => {
    const data = await fixture();
    const extra = path.join(data.directory, "assets/images/orphan.webp");
    await writeFile(extra, lossy);
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /extra: assets\/images\/orphan.webp/,
    );
    await rm(extra);
    await mkdir(path.join(data.directory, "assets/images/nested"));
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /only regular image files/,
    );
  });

  it("rejects symlinked assets and symlinked inventories", async () => {
    const data = await fixture();
    const outside = path.join(data.directory, "outside.webp");
    await writeFile(outside, lossy);
    await rm(data.asset);
    await symlink(outside, data.asset);
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /only regular image files/,
    );
    await rm(path.join(data.directory, "assets/images"), { recursive: true });
    await symlink(
      path.join(data.directory, "config"),
      path.join(data.directory, "assets/images"),
    );
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /not a symlink/,
    );
  });

  it("detects changed bytes, declared lengths, and dimensions", async () => {
    const data = await fixture();
    const changed = Buffer.from(lossy);
    changed[changed.length - 1] ^= 1;
    await writeFile(data.asset, changed);
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /SHA-256 mismatch/,
    );
    await writeFile(data.asset, lossy);
    data.image.bytes += 1;
    await data.save();
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /byte length mismatch/,
    );
    data.image.bytes -= 1;
    data.image.width += 1;
    await data.save();
    await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
      /dimensions mismatch/,
    );
  });

  it.each([
    ["non-WebP content", () => Buffer.from("This is not a photograph")],
    ["truncated file", () => lossy.subarray(0, lossy.length - 2)],
    [
      "truncated chunk",
      () => {
        const image = Buffer.from(lossy);
        image.writeUInt32LE(image.length, 16);
        return image;
      },
    ],
    [
      "bad frame signature",
      () => {
        const image = Buffer.from(lossy);
        image[23] = 0;
        return image;
      },
    ],
    [
      "invalid padding",
      () => {
        const image = Buffer.from(lossless);
        image[image.length - 1] = 1;
        return image;
      },
    ],
    [
      "animation",
      () => {
        const image = extendedImage();
        image[20] |= 0x02;
        return image;
      },
    ],
    [
      "canvas/frame mismatch",
      () => {
        const image = extendedImage();
        image.writeUIntLE(20, 24, 3);
        return image;
      },
    ],
    [
      "missing compressed frame",
      () => {
        const image = extendedImage().subarray(0, 30);
        image.writeUInt32LE(image.length - 8, 4);
        return image;
      },
    ],
  ] as const)(
    "rejects %s even with matching recorded bytes and digest",
    async (_name, makeBytes) => {
      const data = await fixture(makeBytes());
      await expect(readParkImages(data.directory, data.parks)).rejects.toThrow(
        /Invalid WebP/,
      );
    },
  );
});
