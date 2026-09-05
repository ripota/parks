import { readFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync } from "node:zlib";

import { build } from "esbuild";

export type PayloadMeasurement = {
  minifiedBytes: number;
  brotliBytes: number;
};

export type PackagePayloadMeasurements = {
  root: PayloadMeasurement;
  display: PayloadMeasurement;
  catalog: PayloadMeasurement;
  rootInputs: string[];
};

function measure(content: Uint8Array): PayloadMeasurement {
  return {
    minifiedBytes: content.byteLength,
    brotliBytes: brotliCompressSync(content).byteLength,
  };
}

export async function measurePackagePayloads(
  packageRoot: string,
): Promise<PackagePayloadMeasurements> {
  const bundle = await build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: ["./dist/index.js"],
    format: "esm",
    logLevel: "silent",
    metafile: true,
    minify: true,
    platform: "neutral",
    write: false,
  });
  const rootContent = bundle.outputFiles[0]?.contents;
  if (!rootContent) {
    throw new Error("Root runtime bundle did not produce an output file");
  }
  const catalog = JSON.parse(
    await readFile(path.join(packageRoot, "dist/catalog.json"), "utf8"),
  ) as unknown;
  const catalogContent = Buffer.from(JSON.stringify(catalog));

  const display = await build({
    absWorkingDir: packageRoot,
    bundle: true,
    entryPoints: ["./dist/display.js"],
    minify: true,
    write: false,
    logLevel: "silent",
  });
  return {
    display: measure(display.outputFiles[0].contents),
    root: measure(rootContent),
    catalog: measure(catalogContent),
    rootInputs: Object.keys(bundle.metafile.inputs).sort(),
  };
}

export function formatPackagePayloadMeasurements(
  measurements: PackagePayloadMeasurements,
): string {
  return [
    `Display runtime: ${measurements.display.minifiedBytes} bytes minified; ${measurements.display.brotliBytes} bytes Brotli`,
    `Root runtime: ${measurements.root.minifiedBytes} bytes minified; ${measurements.root.brotliBytes} bytes Brotli`,
    `Full catalog: ${measurements.catalog.minifiedBytes} bytes minified; ${measurements.catalog.brotliBytes} bytes Brotli`,
  ].join("\n");
}
