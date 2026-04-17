import { describe, it, expect, vi } from "vitest";
import { StatusClient } from "./status-client.js";
import type { AppStatus, StageUpdate, Stage } from "./schemas.js";

function makeStage(kind: Stage["kind"], status: Stage["status"]): Stage {
  return {
    id: 1,
    kind,
    phase: "build",
    title: "test",
    status,
    fetchedAt: new Date().toISOString(),
    staleness: "fresh",
  };
}

describe("StatusClient.applyStageUpdate", () => {
  it("replaces the matching stage by kind without mutating the input", () => {
    const snap: AppStatus = {
      app: "x",
      mode: "deployed",
      source: { repo: "o/r" },
      overall: { status: "ok", summary: "ok" },
      fetchedAt: new Date().toISOString(),
      stages: [
        makeStage("deploy", "ok"),
        makeStage("run", "ok"),
      ],
    };
    const update: StageUpdate = {
      kind: "stage-update",
      app: "x",
      emittedAt: new Date().toISOString(),
      stage: makeStage("run", "fail"),
    };
    const next = StatusClient.applyStageUpdate(snap, update);
    expect(next.stages.find((s) => s.kind === "run")?.status).toBe("fail");
    expect(snap.stages.find((s) => s.kind === "run")?.status).toBe("ok");
  });
});

class MockEventSource {
  static last: MockEventSource | null = null;
  readonly url: string;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.last = this;
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  close() {
    this.closed = true;
  }
  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, { data: JSON.stringify(data) });
    for (const cb of this.listeners[type] || []) cb(event);
  }
  emitOpen() {
    for (const cb of this.listeners.open || []) cb(new MessageEvent("open"));
  }
  emitError() {
    for (const cb of this.listeners.error || []) cb(new MessageEvent("error"));
  }
}

describe("StatusClient.subscribe", () => {
  it("parses snapshot and stage-update events and tracks connection state", () => {
    const states: string[] = [];
    const snapshots: AppStatus[] = [];
    const updates: StageUpdate[] = [];

    const client = new StatusClient({
      eventSourceFactory: (url) => new MockEventSource(url) as unknown as EventSource,
    });
    const unsub = client.subscribe("fake", {
      onSnapshot: (s) => snapshots.push(s),
      onStageUpdate: (u) => updates.push(u),
      onConnectionChange: (s) => states.push(s),
    });

    const es = MockEventSource.last!;
    es.emitOpen();

    const snap: AppStatus = {
      app: "fake",
      mode: "deployed",
      source: { repo: "o/r" },
      overall: { status: "ok", summary: "ok" },
      fetchedAt: new Date().toISOString(),
      stages: [makeStage("deploy", "ok")],
    };
    es.emit("snapshot", { kind: "snapshot", payload: snap });
    const update: StageUpdate = {
      kind: "stage-update",
      app: "fake",
      emittedAt: new Date().toISOString(),
      stage: makeStage("deploy", "warn"),
    };
    es.emit("stage-update", update);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].app).toBe("fake");
    expect(updates[0].stage.status).toBe("warn");
    expect(states[0]).toBe("connecting");
    expect(states).toContain("open");

    unsub();
    expect(es.closed).toBe(true);
    expect(states).toContain("closed");
  });

  it("reconnects with backoff after a stream error", async () => {
    vi.useFakeTimers();
    const states: string[] = [];

    const factory = vi.fn((url: string) => new MockEventSource(url) as unknown as EventSource);
    const client = new StatusClient({
      eventSourceFactory: factory,
      initialReconnectMs: 10,
      maxReconnectMs: 10,
      jitter: 0,
    });
    const unsub = client.subscribe("fake", {
      onSnapshot: () => {},
      onStageUpdate: () => {},
      onConnectionChange: (s) => states.push(s),
    });

    MockEventSource.last!.emitError();
    expect(states).toContain("closed");

    await vi.advanceTimersByTimeAsync(15);
    expect(factory).toHaveBeenCalledTimes(2);

    unsub();
    vi.useRealTimers();
  });
});
