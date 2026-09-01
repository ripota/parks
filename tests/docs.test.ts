import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const documents = [
  "README.md",
  "CONTRIBUTING.md",
  "DATA_SOURCES.md",
  "DATA_LICENSE.md",
];

describe("top-level documentation", () => {
  it("keeps every local Markdown link valid", async () => {
    for (const document of documents) {
      const content = await readFile(
        path.join(rootDirectory, document),
        "utf8",
      );
      const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(
        (match) => match[1],
      );
      for (const target of links) {
        if (/^[a-z]+:/i.test(target) || target.startsWith("#")) {
          continue;
        }
        const filePath = target.split("#")[0];
        await expect(
          access(path.resolve(rootDirectory, path.dirname(document), filePath)),
          `${document} links to missing ${target}`,
        ).resolves.toBeUndefined();
      }
    }
  });

  it("keeps the consumer README compact", async () => {
    const readme = await readFile(
      path.join(rootDirectory, "README.md"),
      "utf8",
    );
    const prose = readme
      .replace(/```[\s\S]*?```/g, "")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("|"))
      .join(" ");
    const words = prose.match(/[\p{L}\p{N}`$@./<>-]+/gu) ?? [];
    expect(words.length).toBeLessThanOrEqual(500);
  });
});
