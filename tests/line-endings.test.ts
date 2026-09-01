import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("stable generated-file line endings", () => {
  it("forces LF for generated data, checksums, and shell tasks", async () => {
    const paths = [
      "data/references.json",
      "data/boundaries/us-0513.geojson",
      "dist/catalog.json",
      "dist/all.geojson",
      "dist/checksums.sha256",
      "mise/tasks/check",
    ];
    const { stdout } = await execFileAsync(
      "git",
      ["check-attr", "text", "eol", "--", ...paths],
      { cwd: process.cwd() },
    );

    for (const filePath of paths) {
      expect(stdout).toContain(`${filePath}: text: set`);
      expect(stdout).toContain(`${filePath}: eol: lf`);
    }
  });
});
