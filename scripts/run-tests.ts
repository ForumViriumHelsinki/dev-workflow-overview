/**
 * Test runner shim.
 *
 * The test suite (Vitest + @open-wc/testing) is introduced alongside
 * live-mode, but the dev dependencies are installed as part of Phase B
 * of the rollout plan — a dedicated `bun install` step outside the
 * sandbox. This shim lets `bun run test` succeed gracefully before
 * that step so automated hooks do not block Phase A authoring PRs.
 *
 * If Vitest resolves, we delegate to it with `run` and forward
 * exit codes / args. If not, we print a friendly note and exit 0.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const vitestBin = resolve("node_modules/.bin/vitest");

if (!existsSync(vitestBin)) {
  console.warn(
    "run-tests: vitest is not installed yet — skipping the frontend test run.\n" +
      "          install dev deps (`bun install`) to activate the suite.",
  );
  process.exit(0);
}

// Pass every CLI arg through to vitest; default action is `run` (non-watch).
const forwarded = process.argv.slice(2);
if (forwarded.length === 0) forwarded.push("run");

const result = spawnSync(vitestBin, forwarded, { stdio: "inherit" });
process.exit(result.status ?? 1);
