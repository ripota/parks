import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI module imports", () => {
  for (const modulePath of ["./src/package.ts", "./src/update.ts"]) {
    it(`imports ${modulePath} when process.argv[1] is absent`, async () => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--input-type=module",
          "--eval",
          `await import(${JSON.stringify(modulePath)})`,
        ],
        { cwd: process.cwd() },
      );

      expect(stdout).toBe("");
      expect(stderr).toBe("");
    });
  }
});
