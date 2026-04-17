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

# Build + push the aggregator image to the local registry.
[group: "k8s"]
image-build:
    #!/usr/bin/env bash
    set -euo pipefail
    cd aggregator
    docker build \
        --build-arg VERSION={{ TAG }} \
        --build-arg COMMIT="$(git rev-parse --short HEAD)" \
        --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
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
