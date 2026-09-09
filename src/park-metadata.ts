import { readFile } from "node:fs/promises";
import path from "node:path";
import { Ajv } from "ajv";
import metadataSchema from "../schemas/park-metadata.schema.json" with { type: "json" };
import type { Park, PotaReference } from "./public-types.ts";

type ParkMetadata = Omit<Park, keyof PotaReference>;

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
const validate = ajv.compile<Record<string, ParkMetadata>>(metadataSchema);

/** Validate the complete authoring inventory before combining it with identity. */
export function buildParks(
  references: readonly PotaReference[],
  metadata: unknown,
): readonly Park[] {
  if (!validate(metadata)) {
    throw new Error(
      `Invalid park metadata: ${ajv.errorsText(validate.errors)}`,
    );
  }
  const expected = new Set(references.map(({ reference }) => reference));
  if (expected.size !== references.length) {
    throw new Error("Duplicate references in park identity inventory");
  }
  const missing = [...expected].filter((reference) => !(reference in metadata));
  const extra = Object.keys(metadata).filter(
    (reference) => !expected.has(reference),
  );
  if (missing.length || extra.length) {
    throw new Error(
      `Park metadata inventory mismatch; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
    );
  }
  return references.map((reference) => ({
    ...reference,
    ...metadata[reference.reference],
  }));
}

export async function readParks(
  rootDirectory: string,
  references: readonly PotaReference[],
): Promise<readonly Park[]> {
  const metadata: unknown = JSON.parse(
    await readFile(
      path.join(rootDirectory, "config/park-metadata.json"),
      "utf8",
    ),
  );
  return buildParks(references, metadata);
}
