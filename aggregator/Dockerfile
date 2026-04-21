## Multi-stage distroless build for status-aggregator.
##
## Stage 1 — build the frontend bundle with Bun. The Go binary embeds
## it at compile time (see internal/web/web.go) so the aggregator
## serves the UI and the API from a single origin (PRD-002 §4.2,
## D-static.a).
##
## Build context is the repository root, not aggregator/. CI has to
## pass `-f aggregator/Dockerfile .` for this to resolve.

FROM oven/bun:1.1-alpine AS web
WORKDIR /web
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY aggregator/api ./aggregator/api
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json vite.config.ts ./
COPY index.html ./
RUN bun run build

FROM golang:1.23-alpine AS build
WORKDIR /src

RUN apk add --no-cache git ca-certificates

COPY aggregator/go.mod aggregator/go.sum ./
RUN go mod download

COPY aggregator/ ./
# Replace the placeholder bundle with the freshly-built one.
RUN rm -rf internal/web/dist
COPY --from=web /web/dist ./internal/web/dist

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath \
    -ldflags "-s -w \
      -X main.version=${VERSION} \
      -X main.commit=${COMMIT} \
      -X main.buildDate=${BUILD_DATE}" \
    -o /out/aggregator ./cmd/aggregator

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/aggregator /aggregator
USER 65532:65532
EXPOSE 8080
ENTRYPOINT ["/aggregator"]
