import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  releaseAssetNames,
  verifyExistingRelease,
  writeReleaseChecksums,
  type ReleaseInfo,
} from "../src/release.ts";

const temporaryDirectories: string[] = [];
const version = "1.2.3";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "parks-release-test-"),
  );
  temporaryDirectories.push(directory);
  return directory;
}

function publishedRelease(overrides: Partial<ReleaseInfo> = {}): ReleaseInfo {
  return {
    assets: releaseAssetNames(version).map((name) => ({ name })),
    isDraft: false,
    isPrerelease: false,
    ...overrides,
  };
}

async function builtAssets(): Promise<string> {
  const directory = await temporaryDirectory();
  for (const name of releaseAssetNames(version)) {
    await writeFile(path.join(directory, name), `built ${name}\n`);
  }
  return directory;
}

function downloader(
  content: (name: string) => string = (name) => `built ${name}\n`,
  capture?: (directory: string) => void,
) {
  return async (directory: string): Promise<void> => {
    capture?.(directory);
    for (const name of releaseAssetNames(version)) {
      await writeFile(path.join(directory, name), content(name));
    }
  };
}

describe("release asset integrity", () => {
  it("defines the complete stable-release asset set", () => {
    expect(releaseAssetNames(version)).toEqual([
      "catalog.json",
      "all.geojson",
      "checksums.sha256",
      "ripota-parks-1.2.3.tgz",
      "checksums.release.sha256",
    ]);
  });

  it("accepts a published release with byte-identical assets", async () => {
    const builtDirectory = await builtAssets();
    let comparisonDirectory = "";

    await expect(
      verifyExistingRelease(
        publishedRelease(),
        version,
        builtDirectory,
        downloader(undefined, (directory) => {
          comparisonDirectory = directory;
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(access(comparisonDirectory)).rejects.toThrow();
  });

  it("identifies a missing asset before downloading", async () => {
    const builtDirectory = await builtAssets();
    const missing = "checksums.release.sha256";

    await expect(
      verifyExistingRelease(
        publishedRelease({
          assets: releaseAssetNames(version)
            .filter((name) => name !== missing)
            .map((name) => ({ name })),
        }),
        version,
        builtDirectory,
        downloader(),
      ),
    ).rejects.toThrow(`missing assets: ${missing}`);
  });

  it("identifies content mismatches and cleans comparisons", async () => {
    const builtDirectory = await builtAssets();
    const mismatched = "catalog.json";
    let comparisonDirectory = "";

    await expect(
      verifyExistingRelease(
        publishedRelease(),
        version,
        builtDirectory,
        downloader(
          (name) => (name === mismatched ? "corrupt\n" : `built ${name}\n`),
          (directory) => {
            comparisonDirectory = directory;
          },
        ),
      ),
    ).rejects.toThrow(`content mismatch: ${mismatched}`);
    await expect(access(comparisonDirectory)).rejects.toThrow();
  });

  it("rejects draft and prerelease publication states", async () => {
    const builtDirectory = await builtAssets();

    await expect(
      verifyExistingRelease(
        publishedRelease({ isDraft: true }),
        version,
        builtDirectory,
        downloader(),
      ),
    ).rejects.toThrow("draft");
    await expect(
      verifyExistingRelease(
        publishedRelease({ isPrerelease: true }),
        version,
        builtDirectory,
        downloader(),
      ),
    ).rejects.toThrow("prerelease");
  });

  it("writes digests for every non-manifest release asset", async () => {
    const directory = await temporaryDirectory();
    const names = ["catalog.json", "all.geojson"];
    for (const name of names) {
      await writeFile(path.join(directory, name), `content ${name}\n`);
    }

    await writeReleaseChecksums(directory, names);

    const lines = (
      await readFile(path.join(directory, "checksums.release.sha256"), "utf8")
    )
      .trim()
      .split("\n");
    expect(lines).toHaveLength(names.length);
    for (const [index, name] of names.entries()) {
      const hash = createHash("sha256")
        .update(`content ${name}\n`)
        .digest("hex");
      expect(lines[index]).toBe(`${hash}  ${name}`);
    }
  });
});
