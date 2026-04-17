## Multi-stage distroless build for status-aggregator.

FROM golang:1.23-alpine AS build
WORKDIR /src

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

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
