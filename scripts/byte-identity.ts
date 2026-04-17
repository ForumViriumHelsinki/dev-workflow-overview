/**
 * Static-mode byte-identity guard.
 *
 * PRD-002 FR8.1 requires that a root-URL load (no query string) produce
 * byte-identical output to the pre-live-mode baseline. The aggregator
 * code paths are all guarded behind `_liveMode` so the built bundle
 * must only diverge in ways that do not affect the static landing.
 *
 * This script:
 *   1. Runs `bun run build` (already done by CI before this step).
 *   2. Hashes each emitted artifact in `dist/`.
 *   3. Compares the hash to a committed baseline at `.byte-identity.json`.
 *   4. Exits non-zero on mismatch.
 *
 * The baseline is updated deliberately by re-running with `--write`.
 * CI never writes the baseline.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
const BASELINE = ".byte-identity.json";

type Manifest = Record<string, string>;

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function hashFile(path: string): string {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function buildManifest(root: string): Manifest {
  const out: Manifest = {};
  for (const full of walk(root)) {
    out[relative(root, full).replaceAll("\\", "/")] = hashFile(full);
  }
  return out;
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`byte-identity: dist/ not found — run \`bun run build\` first`);
    process.exit(1);
  }
  const current = buildManifest(DIST);
  const write = process.argv.includes("--write");

  if (write || !existsSync(BASELINE)) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    console.log(`byte-identity: wrote baseline with ${Object.keys(current).length} files.`);
    return;
  }

  const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Manifest;
  const diffs: string[] = [];
  for (const [file, hash] of Object.entries(current)) {
    if (!(file in baseline)) {
      diffs.push(`+ ${file}`);
    } else if (baseline[file] !== hash) {
      diffs.push(`~ ${file}`);
    }
  }
  for (const file of Object.keys(baseline)) {
    if (!(file in current)) diffs.push(`- ${file}`);
  }
  if (diffs.length) {
    console.error("byte-identity: static bundle diverged from baseline:");
    for (const d of diffs) console.error(`  ${d}`);
    console.error(`\nRe-run with --write intentionally if the change is expected.`);
    process.exit(1);
  }
  console.log(`byte-identity: ${Object.keys(current).length} files match baseline.`);
}

main();
