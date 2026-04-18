import { defineConfig } from "vite";

// `bun run dev` relies on the status-aggregator being reachable at
// localhost:18080. Start the port-forward in another terminal:
//   just port-forward
// (which wraps `kubectl --context=kind-fvh-dev -n status-aggregator
//     port-forward svc/status-aggregator 18080:8080`).
const AGGREGATOR = "http://localhost:18080";

export default defineConfig({
  base: "/dev-workflow-overview/",
  server: {
    proxy: {
      "/api": {
        target: AGGREGATOR,
        changeOrigin: false,
      },
      "/healthz": {
        target: AGGREGATOR,
        changeOrigin: false,
      },
      "/metrics": {
        target: AGGREGATOR,
        changeOrigin: false,
      },
    },
  },
});
