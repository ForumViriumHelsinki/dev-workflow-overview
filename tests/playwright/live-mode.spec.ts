import { expect, test } from "@playwright/test";

// Pre-requisites (C.9 — see docs/prps/live-deployment-status.md):
//   1. `just port-forward` — exposes the aggregator on :8080
//   2. `bun run dev`       — Vite dev server on :5173 with /api proxy
//   3. `kubectl apply -f k8s/examples/podinfo-application.yaml` — seeds the
//      ArgoCD Application that wires stages 2 / 8 / 9 to live data.
//
// The test targets the Vite dev server so /api calls are proxied to the
// aggregator without CORS ceremony. Override via PLAYWRIGHT_BASE_URL if
// you have a different setup.

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";
const APP_NAME = process.env.PLAYWRIGHT_LIVE_APP ?? "podinfo";

test.describe("live mode", () => {
  test("renders status dots on the Provision / Deploy / Run stages", async ({
    page,
  }) => {
    await page.goto(
      `${BASE_URL}/dev-workflow-overview/?app=${encodeURIComponent(APP_NAME)}`,
    );

    // Wait for the live snapshot to hydrate. The status-dot is rendered
    // inside the stage's shadow root once .status is set; stages 2, 8,
    // 9 (Provision / Deploy / Run) are the three covered by the v1
    // cluster.Source partials.
    const titles = ["Provision", "Deploy", "Run"];
    for (const title of titles) {
      const dot = page.locator(
        `workflow-app workflow-stage[data-title='${title}'] >>> .status-dot`,
      );
      await expect(dot).toBeVisible({ timeout: 15_000 });
      const state = await dot.getAttribute("data-state");
      expect(state).not.toBeNull();
      expect(["ok", "warn", "fail", "unknown"]).toContain(state);
    }
  });

  test("SSE reconnects after the aggregator pod restarts", async ({
    page,
    request,
  }) => {
    await page.goto(
      `${BASE_URL}/dev-workflow-overview/?app=${encodeURIComponent(APP_NAME)}`,
    );

    // The StatusClient surfaces its state machine as a data-state
    // attribute on the .connection chip inside status-banner's shadow
    // root. States: "connecting" | "open" | "closed".
    const connection = page.locator(
      "workflow-app status-banner >>> .connection",
    );

    await expect(connection).toHaveAttribute("data-state", "open", {
      timeout: 15_000,
    });

    // Trigger the disconnect out-of-band. The shell wrapper driving this
    // test (see `just playwright:live-mode` or the CI runner) is expected
    // to run `kubectl -n status-aggregator rollout restart deploy/status-aggregator`
    // shortly after this assertion begins watching.
    await expect(connection).toHaveAttribute("data-state", /connecting|closed/, {
      timeout: 30_000,
    });
    await expect(connection).toHaveAttribute("data-state", "open", {
      timeout: 60_000,
    });

    // Sanity check — /healthz is still reachable via the dev-server proxy.
    const health = await request.get(`${BASE_URL}/healthz`);
    expect(health.ok()).toBe(true);
  });
});
