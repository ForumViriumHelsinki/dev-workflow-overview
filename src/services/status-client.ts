import type {
  AppList,
  AppStatus,
  AppSummary,
  OverallStatus,
  Stage,
  StageUpdate,
} from "./schemas.js";

export type ConnectionState = "connecting" | "open" | "closed";

export interface SubscribeHandlers {
  onSnapshot(snapshot: AppStatus): void;
  onStageUpdate(update: StageUpdate): void;
  onOverallUpdate?(overall: OverallStatus): void;
  onConnectionChange(state: ConnectionState): void;
  onError?(err: Error): void;
}

export interface StatusClientOptions {
  baseUrl?: string;
  // Test hook — swap EventSource for a deterministic mock.
  eventSourceFactory?: (url: string) => EventSource;
  // Test hook — swap fetch.
  fetchImpl?: typeof fetch;
  // Initial reconnect delay (ms); doubles each retry up to maxReconnectMs.
  initialReconnectMs?: number;
  maxReconnectMs?: number;
  // Jitter fraction (0..1) added to each backoff interval.
  jitter?: number;
}

const DEFAULT_OPTIONS: Required<
  Omit<StatusClientOptions, "baseUrl" | "eventSourceFactory" | "fetchImpl">
> = {
  initialReconnectMs: 500,
  maxReconnectMs: 30_000,
  jitter: 0.3,
};

/**
 * StatusClient wraps the aggregator HTTP + SSE API. It is framework-agnostic
 * so it can be unit-tested without the DOM.
 */
export class StatusClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly esFactory: (url: string) => EventSource;
  private readonly opts: Required<
    Omit<StatusClientOptions, "baseUrl" | "eventSourceFactory" | "fetchImpl">
  >;

  constructor(options: StatusClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.esFactory =
      options.eventSourceFactory ?? ((url: string) => new EventSource(url));
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  async list(params: { repo?: string; project?: string } = {}): Promise<AppSummary[]> {
    const url = new URL(`${this.baseUrl}/api/v1/apps`, this.windowOrigin());
    if (params.repo) url.searchParams.set("repo", params.repo);
    if (params.project) url.searchParams.set("project", params.project);
    const body = (await this.json(url.toString())) as AppList;
    return body.apps;
  }

  snapshot(app: string): Promise<AppStatus> {
    const url = this.url(`/api/v1/apps/${encodeURIComponent(app)}/status`);
    return this.json(url) as Promise<AppStatus>;
  }

  async refresh(app: string): Promise<void> {
    const url = this.url(`/api/v1/apps/${encodeURIComponent(app)}/refresh`);
    const resp = await this.fetchImpl(url, { method: "POST" });
    if (!resp.ok && resp.status !== 429) {
      throw new Error(`refresh: HTTP ${resp.status}`);
    }
  }

  subscribe(app: string, handlers: SubscribeHandlers): () => void {
    let es: EventSource | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const open = () => {
      handlers.onConnectionChange("connecting");
      const url = this.url(`/api/v1/apps/${encodeURIComponent(app)}/events`);
      es = this.esFactory(url);
      es.addEventListener("open", () => {
        retry = 0;
        handlers.onConnectionChange("open");
      });
      es.addEventListener("snapshot", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { payload: AppStatus };
          handlers.onSnapshot(data.payload);
        } catch (err) {
          handlers.onError?.(err as Error);
        }
      });
      es.addEventListener("stage-update", (e: MessageEvent) => {
        try {
          handlers.onStageUpdate(JSON.parse(e.data) as StageUpdate);
        } catch (err) {
          handlers.onError?.(err as Error);
        }
      });
      es.addEventListener("overall-update", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { overall: OverallStatus };
          handlers.onOverallUpdate?.(data.overall);
        } catch (err) {
          handlers.onError?.(err as Error);
        }
      });
      es.addEventListener("ping", () => {
        /* keep-alive; no-op */
      });
      es.addEventListener("error", () => {
        if (closed) return;
        handlers.onConnectionChange("closed");
        es?.close();
        es = null;
        scheduleReconnect();
      });
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const base = Math.min(
        this.opts.initialReconnectMs * 2 ** retry,
        this.opts.maxReconnectMs,
      );
      const j = base * this.opts.jitter * Math.random();
      retry += 1;
      reconnectTimer = setTimeout(open, base + j);
    };

    open();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      handlers.onConnectionChange("closed");
    };
  }

  /** Merge a stage update into the matching stage of an existing snapshot. */
  static applyStageUpdate(snapshot: AppStatus, update: StageUpdate): AppStatus {
    const stages = snapshot.stages.map((s: Stage): Stage =>
      s.kind === update.stage.kind ? update.stage : s,
    );
    return { ...snapshot, stages };
  }

  private windowOrigin(): string {
    return typeof window !== "undefined" && window.location
      ? window.location.origin
      : "http://localhost";
  }

  private url(path: string): string {
    if (this.baseUrl) return `${this.baseUrl}${path}`;
    return path;
  }

  private async json(url: string): Promise<unknown> {
    const resp = await this.fetchImpl(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    return resp.json();
  }
}
