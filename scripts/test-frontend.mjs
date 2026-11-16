import { build } from "esbuild";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "jobup-tests-"));
try {
  const tests = (await readdir("tests")).filter((name) => /\.test\.tsx?$/.test(name));
  if (tests.length === 0) throw new Error("No frontend tests found");
  await build({
    entryPoints: tests.map((name) => join("tests", name)),
    outdir: directory,
    bundle: true,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    outExtension: { ".js": ".cjs" },
  });
  const files = tests.map((name) => join(directory, name.replace(/\.tsx?$/, ".cjs")));
  const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
