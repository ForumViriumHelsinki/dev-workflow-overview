# dev-workflow-overview — developer task runner.
# Run `just` or `just --list` to see available recipes.

set positional-arguments

# Shared defaults for the local kind cluster and registry.
CTX := "kind-fvh-dev"
NS := "status-aggregator"
REG := "localhost:5001"
IMG := REG / "status-aggregator"
TAG := "dev"
HOST := "dev-overview.orb.local"

# Default recipe — show grouped list.
default:
    @just --list

##########
# Frontend
##########

# Install JS/TS dependencies.
[group: "frontend"]
install:
    bun install

# Start Vite dev server with HMR.
[group: "frontend"]
dev:
    bun run dev

# Production build to dist/.
[group: "frontend"]
build:
    bun run build

# Run Vitest unit tests.
[group: "frontend"]
test:
    bun run test

# Regenerate TypeScript types from the OpenAPI spec.
[group: "frontend"]
openapi:
    bun run openapi:types

# Refresh the byte-identity baseline after an intentional dist change.
[group: "frontend"]
byte-identity-refresh:
    bun run byte-identity --write

##########
# Aggregator
##########

# Run all Go tests.
[group: "aggregator"]
go-test:
    cd aggregator && go test ./...

# Run the aggregator binary locally (fake source, LOG_LEVEL=debug).
[group: "aggregator"]
go-run:
    cd aggregator && LOG_LEVEL=debug ENABLE_FAKE=true go run ./cmd/aggregator

##########
# Local K8s (kind-fvh-dev)
##########

# Build + push the aggregator image to the local registry. The build
# context is the repo root because the multi-stage Dockerfile also
# builds the embedded frontend bundle (D-static.a).
[group: "k8s"]
image-build:
    #!/usr/bin/env bash
    set -euo pipefail
    docker build \
        --build-arg VERSION={{ TAG }} \
        --build-arg COMMIT="$(git rev-parse --short HEAD)" \
        --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        -f aggregator/Dockerfile \
        -t {{ IMG }}:{{ TAG }} .
    docker push {{ IMG }}:{{ TAG }}

# Apply manifests to the fvh-dev cluster.
[group: "k8s"]
deploy:
    kubectl --context={{ CTX }} apply -f k8s/

# Build, push, apply, and wait for the pod to become ready.
[group: "k8s"]
up: image-build deploy
    kubectl --context={{ CTX }} -n {{ NS }} rollout restart deploy/status-aggregator
    kubectl --context={{ CTX }} -n {{ NS }} rollout status deploy/status-aggregator --timeout=90s

# Tear down the aggregator (leaves the namespace).
[confirm("Remove the status-aggregator Deployment, Service, and HTTPRoute. Continue?")]
[group: "k8s"]
down:
    kubectl --context={{ CTX }} delete -f k8s/deployment.yaml -f k8s/service.yaml -f k8s/httproute.yaml --ignore-not-found

# Tail the aggregator pod logs.
[group: "k8s"]
logs:
    kubectl --context={{ CTX }} -n {{ NS }} logs deploy/status-aggregator -f --tail=100

# Show pod status.
[group: "k8s"]
status:
    kubectl --context={{ CTX }} -n {{ NS }} get pods,svc,httproute

# Port-forward the aggregator service to localhost:8080 (fallback when
# the Gateway is not reachable, e.g. cloud-provider-kind not running).
[group: "k8s"]
port-forward:
    kubectl --context={{ CTX }} -n {{ NS }} port-forward svc/status-aggregator 8080:8080

# Run the cloud-provider-kind daemon so LoadBalancer-type services get
# an external IP on kind clusters. Install via `go install sigs.k8s.io/
# cloud-provider-kind@latest` or `brew install cloud-provider-kind`.
# Runs in the foreground — leave it open in a spare terminal.
[group: "k8s"]
cloud-provider-kind:
    cloud-provider-kind

# Ensure /etc/hosts maps the Gateway hostname to 127.0.0.1 so
# `http://dev-overview.orb.local` resolves locally. Idempotent.
[group: "k8s"]
hosts-setup:
    #!/usr/bin/env bash
    set -euo pipefail
    line="127.0.0.1 {{ HOST }}"
    if grep -qE "^127\.0\.0\.1[[:space:]]+{{ HOST }}(\$|[[:space:]])" /etc/hosts; then
        echo "{{ HOST }} already mapped in /etc/hosts"
    else
        echo "Adding '${line}' to /etc/hosts — sudo required"
        echo "${line}" | sudo tee -a /etc/hosts >/dev/null
    fi

##########
# Smoke tests
##########

# Hit /healthz, /api/v1/apps, and a single SSE frame via the Gateway.
[group: "smoke"]
smoke:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "GET http://{{ HOST }}/healthz"
    curl -sS "http://{{ HOST }}/healthz" | jq .
    echo ""
    echo "GET http://{{ HOST }}/api/v1/apps"
    curl -sS "http://{{ HOST }}/api/v1/apps" | jq .
    echo ""
    echo "GET http://{{ HOST }}/api/v1/apps/fake/status"
    curl -sS "http://{{ HOST }}/api/v1/apps/fake/status" | jq '.app, .overall, (.stages | length)'
    echo ""
    echo "SSE first frame from /api/v1/apps/fake/events (5s budget)"
    curl -sSN --max-time 5 -H 'Accept: text/event-stream' \
        "http://{{ HOST }}/api/v1/apps/fake/events" | head -20 || true

# Smoke test against port-forwarded localhost:8080 (bypasses Gateway).
[group: "smoke"]
smoke-local:
    #!/usr/bin/env bash
    set -euo pipefail
    for path in /healthz /api/v1/apps /api/v1/apps/fake/status; do
        echo "GET http://localhost:8080$path"
        curl -sS "http://localhost:8080$path" | jq . | head -20
        echo ""
    done

##########
# Load / profiling
##########

# 100 concurrent SSE connections held open for 10 minutes against the
# port-forwarded aggregator. Targets PRP-002 NFR4 (<256Mi RSS, stable
# goroutine count). Run `just port-forward` in another terminal first.
# Start the aggregator with ENABLE_PPROF=true to enable `pprof-snapshot`.
[group: "load"]
sse-load duration="10m" n="100" url="http://localhost:8080/api/v1/apps/fake/events":
    cd aggregator && go run ./cmd/sse-loadtest \
        -url {{ url }} \
        -n {{ n }} \
        -duration {{ duration }}

# Snapshot memory + goroutine counts from the aggregator's pprof while
# the load test runs. Requires ENABLE_PPROF=true at aggregator startup.
# Produces heap + goroutine profiles under tmp/pprof/ — inspect with
# `go tool pprof`.
[group: "load"]
pprof-snapshot:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p tmp/pprof
    ts="$(date +%Y%m%dT%H%M%S)"
    curl -sSf "http://localhost:8080/debug/pprof/heap" > "tmp/pprof/heap-${ts}.pb.gz"
    curl -sSf "http://localhost:8080/debug/pprof/goroutine?debug=0" > "tmp/pprof/goroutine-${ts}.pb.gz"
    echo "wrote tmp/pprof/heap-${ts}.pb.gz tmp/pprof/goroutine-${ts}.pb.gz"

##########
# E2E tests
##########

# Playwright live-mode smoke. Pre-reqs (run in separate terminals):
#   just port-forward        # aggregator on :8080
#   bun run dev              # Vite dev server on :5173 proxies /api/*
#   kubectl apply -f k8s/examples/podinfo-application.yaml
[group: "e2e"]
playwright-live:
    bunx playwright test --config=playwright.config.ts tests/playwright/live-mode.spec.ts

# Variant that also triggers a rollout restart mid-test so the SSE
# reconnect assertion has something to observe. Run `just playwright-live`
# first to confirm the happy path works in isolation.
[group: "e2e"]
playwright-live-reconnect:
    #!/usr/bin/env bash
    set -euo pipefail
    ( sleep 8 && kubectl --context={{ CTX }} -n {{ NS }} rollout restart deploy/status-aggregator ) &
    bunx playwright test --config=playwright.config.ts tests/playwright/live-mode.spec.ts -g "SSE reconnects"
