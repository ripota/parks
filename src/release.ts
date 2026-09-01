#!/usr/bin/env -S node --experimental-strip-types

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ReleaseInfo = {
  assets: Array<{ name: string }>;
  isDraft: boolean;
  isPrerelease: boolean;
  url?: string;
};

type DownloadAssets = (directory: string) => Promise<void>;

const BUILT_ASSET_NAMES = [
  "catalog.json",
  "source-catalog.json",
  "all.geojson",
  "source-all.geojson",
  "checksums.sha256",
] as const;
const RELEASE_CHECKSUM_NAME = "checksums.release.sha256";

function tarballName(version: string): string {
  return `ripota-parks-${version}.tgz`;
}

export function releaseAssetNames(version: string): string[] {
  return [...BUILT_ASSET_NAMES, tarballName(version), RELEASE_CHECKSUM_NAME];
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function packageVersion(rootDirectory: string): Promise<string> {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDirectory, "package.json"), "utf8"),
  ) as { version?: unknown };
  if (
    typeof packageJson.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(packageJson.version)
  ) {
    throw new Error(
      "Release automation supports published stable semantic versions only",
    );
  }
  return packageJson.version;
}

async function assertEmptyDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const entries = await readdir(directory);
  if (entries.length > 0) {
    throw new Error(`Release asset directory must be empty: ${directory}`);
  }
}

export async function writeReleaseChecksums(
  directory: string,
  assetNames: string[],
): Promise<void> {
  const lines = await Promise.all(
    assetNames.map(async (name) => {
      const content = await readFile(path.join(directory, name));
      return `${sha256(content)}  ${name}`;
    }),
  );
  await writeFile(
    path.join(directory, RELEASE_CHECKSUM_NAME),
    `${lines.join("\n")}\n`,
  );
}

export async function buildReleaseAssets(
  rootDirectory: string,
  outputDirectory: string,
): Promise<string[]> {
  const version = await packageVersion(rootDirectory);
  await assertEmptyDirectory(outputDirectory);
  for (const name of BUILT_ASSET_NAMES) {
    await copyFile(
      path.join(rootDirectory, "dist", name),
      path.join(outputDirectory, name),
    );
  }
  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--json", "--pack-destination", outputDirectory],
    { cwd: rootDirectory },
  );
  const result = JSON.parse(stdout) as Array<{ filename?: unknown }>;
  const expectedTarball = tarballName(version);
  if (result[0]?.filename !== expectedTarball) {
    throw new Error(
      `npm pack produced ${String(result[0]?.filename)}, expected ${expectedTarball}`,
    );
  }
  await writeReleaseChecksums(outputDirectory, [
    ...BUILT_ASSET_NAMES,
    expectedTarball,
  ]);
  const expected = releaseAssetNames(version);
  const actual = (await readdir(outputDirectory)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    throw new Error(
      `Release asset inventory mismatch: expected ${expected.join(", ")}; found ${actual.join(", ")}`,
    );
  }
  return expected;
}

export async function verifyExistingRelease(
  release: ReleaseInfo,
  version: string,
  builtDirectory: string,
  downloadAssets: DownloadAssets,
): Promise<void> {
  if (release.isDraft) {
    throw new Error("Existing release is a draft, not a public release");
  }
  if (release.isPrerelease) {
    throw new Error(
      "Existing release is a prerelease; stable version tags require a non-prerelease publication",
    );
  }
  const expected = releaseAssetNames(version);
  const published = new Set(release.assets.map((asset) => asset.name));
  const missing = expected.filter((name) => !published.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Existing release is missing assets: ${missing.join(", ")}`,
    );
  }

  const downloadDirectory = await mkdtemp(
    path.join(os.tmpdir(), "parks-release-verify-"),
  );
  try {
    await downloadAssets(downloadDirectory);
    const mismatches: string[] = [];
    for (const name of expected) {
      try {
        const [built, downloaded] = await Promise.all([
          readFile(path.join(builtDirectory, name)),
          readFile(path.join(downloadDirectory, name)),
        ]);
        if (sha256(built) !== sha256(downloaded)) {
          mismatches.push(name);
        }
      } catch {
        mismatches.push(name);
      }
    }
    if (mismatches.length > 0) {
      throw new Error(
        `Existing release asset content mismatch: ${mismatches.join(", ")}`,
      );
    }
  } finally {
    await rm(downloadDirectory, { recursive: true, force: true });
  }
}

async function releaseInfo(tag: string): Promise<ReleaseInfo | undefined> {
  try {
    const { stdout } = await execFileAsync(
      "gh",
      ["release", "view", tag, "--json", "assets,isDraft,isPrerelease,url"],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return JSON.parse(stdout) as ReleaseInfo;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    if (/release not found/i.test(stderr)) {
      return undefined;
    }
    throw error;
  }
}

async function verifyPublishedRelease(
  tag: string,
  version: string,
  builtDirectory: string,
  release: ReleaseInfo,
): Promise<void> {
  await verifyExistingRelease(
    release,
    version,
    builtDirectory,
    async (downloadDirectory) => {
      await execFileAsync("gh", [
        "release",
        "download",
        tag,
        "--dir",
        downloadDirectory,
      ]);
    },
  );
}

function assertMatchingTag(tag: string, version: string): void {
  if (tag !== `v${version}`) {
    throw new Error(`Tag ${tag} does not match package version ${version}`);
  }
}

export async function verifyRelease(
  rootDirectory: string,
  tag: string,
  builtDirectory: string,
): Promise<void> {
  const version = await packageVersion(rootDirectory);
  assertMatchingTag(tag, version);
  const release = await releaseInfo(tag);
  if (!release) {
    throw new Error(`Release ${tag} does not exist`);
  }
  await verifyPublishedRelease(tag, version, builtDirectory, release);
}

export async function publishRelease(
  rootDirectory: string,
  tag: string,
  builtDirectory: string,
): Promise<void> {
  const version = await packageVersion(rootDirectory);
  assertMatchingTag(tag, version);
  const existing = await releaseInfo(tag);
  if (existing) {
    await verifyPublishedRelease(tag, version, builtDirectory, existing);
    console.log(`Release ${tag} is public with byte-identical assets.`);
    return;
  }

  const assets = releaseAssetNames(version).map((name) =>
    path.join(builtDirectory, name),
  );
  await execFileAsync("gh", [
    "release",
    "create",
    tag,
    ...assets,
    "--verify-tag",
    "--generate-notes",
    "--title",
    tag,
  ]);
  const created = await releaseInfo(tag);
  if (!created) {
    throw new Error(`Release ${tag} was not visible after creation`);
  }
  await verifyPublishedRelease(tag, version, builtDirectory, created);
  console.log(`Created and verified public release ${tag}.`);
}

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const [command, first, second] = process.argv.slice(2);
    if (command === "build" && first && !second) {
      await buildReleaseAssets(rootDirectory, path.resolve(first));
    } else if (command === "verify" && first && second) {
      await verifyRelease(rootDirectory, first, path.resolve(second));
    } else if (command === "publish" && first && second) {
      await publishRelease(rootDirectory, first, path.resolve(second));
    } else {
      throw new Error(
        "Usage: release.ts build <directory> | verify|publish <tag> <directory>",
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
