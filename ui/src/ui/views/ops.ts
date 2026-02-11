import { html, nothing } from "lit";
import type { GatewayHelloOk } from "../gateway.ts";
import { formatDurationHuman, formatRelativeTimestamp } from "../format.ts";
import { formatNextRun } from "../presenter.ts";
import type {
  ChannelsStatusSnapshot,
  CronStatus,
  HealthSnapshot,
  PresenceEntry,
  SessionsListResult,
} from "../types.ts";

type OpsTab = "channels" | "sessions" | "cron" | "logs" | "debug";

export type OpsProps = {
  connected: boolean;
  hello: GatewayHelloOk | null;
  lastError: string | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  presenceLoading: boolean;
  presenceEntries: PresenceEntry[];
  presenceError: string | null;
  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  cronStatus: CronStatus | null;
  cronError: string | null;
  debugLoading: boolean;
  debugHealth: HealthSnapshot | null;
  onRefreshAll: () => void;
  onProbeChannels: () => void;
  onOpenTab: (tab: OpsTab) => void;
};

type ChannelHealthSummary = {
  total: number;
  configured: number;
  healthy: number;
  degraded: number;
  unknown: number;
  unconfigured: number;
  degradedLabels: string[];
};

type AlertEntry = {
  level: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const boolFrom = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

function summarizeChannels(snapshot: ChannelsStatusSnapshot | null): ChannelHealthSummary {
  if (!snapshot) {
    return {
      total: 0,
      configured: 0,
      healthy: 0,
      degraded: 0,
      unknown: 0,
      unconfigured: 0,
      degradedLabels: [],
    };
  }

  const channelIds = new Set<string>([
    ...(snapshot.channelOrder ?? []),
    ...Object.keys(snapshot.channelAccounts ?? {}),
  ]);
  let total = 0;
  let configured = 0;
  let healthy = 0;
  let degraded = 0;
  let unknown = 0;
  let unconfigured = 0;
  const degradedLabels: string[] = [];

  for (const channelId of channelIds) {
    const accounts = snapshot.channelAccounts[channelId] ?? [];
    for (const account of accounts) {
      total += 1;

      const configuredValue = boolFrom(account.configured);
      const isConfigured = configuredValue === null ? true : configuredValue;
      if (!isConfigured) {
        unconfigured += 1;
        continue;
      }
      configured += 1;

      const running = boolFrom(account.running);
      const connected = boolFrom(account.connected);
      const linked = boolFrom(account.linked);
      const probe = isRecord(account.probe) ? account.probe : null;
      const probeOk = probe ? boolFrom(probe.ok) : null;
      const lastError = asString(account.lastError);

      const hasHardFailure =
        running === false || connected === false || linked === false || probeOk === false;

      if (hasHardFailure || lastError) {
        degraded += 1;
        if (degradedLabels.length < 4) {
          const channelLabel = snapshot.channelLabels[channelId] ?? channelId;
          const accountLabel = account.accountId || "default";
          const reason =
            lastError ??
            (probeOk === false ? "probe failed" : connected === false ? "disconnected" : "degraded");
          degradedLabels.push(`${channelLabel}/${accountLabel}: ${reason}`);
        }
        continue;
      }

      if (running === true || connected === true || linked === true || probeOk === true) {
        healthy += 1;
      } else {
        unknown += 1;
      }
    }
  }

  return { total, configured, healthy, degraded, unknown, unconfigured, degradedLabels };
}

function countNodeEntries(entries: PresenceEntry[]): number {
  let nodes = 0;
  for (const entry of entries) {
    const roles = Array.isArray(entry.roles) ? entry.roles : [];
    if (roles.includes("node") || entry.mode === "node") {
      nodes += 1;
    }
  }
  return nodes;
}

function buildAlerts(props: OpsProps, channels: ChannelHealthSummary): AlertEntry[] {
  const alerts: AlertEntry[] = [];

  if (!props.connected && props.lastError) {
    alerts.push({
      level: "critical",
      title: "Gateway disconnected",
      detail: props.lastError,
    });
  }
  if (props.channelsError) {
    alerts.push({
      level: "warning",
      title: "Channel status refresh failed",
      detail: props.channelsError,
    });
  }
  if (channels.degraded > 0) {
    alerts.push({
      level: "warning",
      title: `${channels.degraded} channel account(s) degraded`,
      detail: channels.degradedLabels[0] ?? "One or more channel accounts are unhealthy.",
    });
  }
  if (props.presenceError) {
    alerts.push({
      level: "warning",
      title: "Presence refresh failed",
      detail: props.presenceError,
    });
  }
  if (props.sessionsError) {
    alerts.push({
      level: "warning",
      title: "Session refresh failed",
      detail: props.sessionsError,
    });
  }
  if (props.cronError) {
    alerts.push({
      level: "warning",
      title: "Cron status refresh failed",
      detail: props.cronError,
    });
  }
  if (props.cronStatus?.enabled && !props.cronStatus.nextWakeAtMs) {
    alerts.push({
      level: "info",
      title: "Cron enabled without next run",
      detail: "Check cron jobs and scheduler state.",
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      title: "No active incidents",
      detail: "Gateway and core control-plane probes look healthy.",
    });
  }
  return alerts.slice(0, 5);
}

function resolveUptime(hello: GatewayHelloOk | null): string {
  const snapshot = hello?.snapshot as { uptimeMs?: number } | undefined;
  if (!snapshot?.uptimeMs) {
    return "n/a";
  }
  return formatDurationHuman(snapshot.uptimeMs);
}

function resolveTickInterval(hello: GatewayHelloOk | null): string {
  const tickMs = hello?.policy?.tickIntervalMs;
  return tickMs ? `${tickMs}ms` : "n/a";
}

function healthMeta(health: HealthSnapshot | null) {
  const payload = isRecord(health) ? health : null;
  if (!payload) {
    return { sampledAt: null as number | null, durationMs: null as number | null };
  }
  return {
    sampledAt: asNumber(payload.ts),
    durationMs: asNumber(payload.durationMs),
  };
}

export function renderOps(props: OpsProps) {
  const channels = summarizeChannels(props.channelsSnapshot);
  const nodeCount = countNodeEntries(props.presenceEntries);
  const sessionCount = props.sessionsResult?.count ?? null;
  const alerts = buildAlerts(props, channels);
  const health = healthMeta(props.debugHealth);

  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">Linux Gateway Overview</div>
        <div class="card-sub">Single-screen status for server operations from phone or desktop.</div>
        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="stat-label">Gateway</div>
            <div class="stat-value ${props.connected ? "ok" : "warn"}">
              ${props.connected ? "Connected" : "Disconnected"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Uptime</div>
            <div class="stat-value">${resolveUptime(props.hello)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tick</div>
            <div class="stat-value">${resolveTickInterval(props.hello)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Sessions</div>
            <div class="stat-value">${sessionCount ?? "n/a"}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Presence</div>
            <div class="stat-value">${props.presenceEntries.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Nodes</div>
            <div class="stat-value">${nodeCount}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Cron</div>
            <div class="stat-value">
              ${props.cronStatus == null ? "n/a" : props.cronStatus.enabled ? "Enabled" : "Disabled"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Next Wake</div>
            <div class="stat-value">${formatNextRun(props.cronStatus?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        ${
          props.lastError
            ? html`<div class="callout danger" style="margin-top: 12px">${props.lastError}</div>`
            : nothing
        }
      </div>

      <div class="card">
        <div class="card-title">Channel Health</div>
        <div class="card-sub">Account-level signal quality for messaging channels.</div>
        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="stat-label">Total Accounts</div>
            <div class="stat-value">${channels.total}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Configured</div>
            <div class="stat-value">${channels.configured}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Healthy</div>
            <div class="stat-value ok">${channels.healthy}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Degraded</div>
            <div class="stat-value ${channels.degraded > 0 ? "warn" : ""}">
              ${channels.degraded}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Unknown</div>
            <div class="stat-value">${channels.unknown}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Unconfigured</div>
            <div class="stat-value">${channels.unconfigured}</div>
          </div>
        </div>
        <div class="muted" style="margin-top: 10px">
          Last refresh:
          ${props.channelsLastSuccess ? formatRelativeTimestamp(props.channelsLastSuccess) : "n/a"}
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="card-title">Quick Actions</div>
      <div class="card-sub">Fast recovery and investigation entry points.</div>
      <div class="row" style="margin-top: 12px; gap: 8px; flex-wrap: wrap;">
        <button
          class="btn"
          @click=${() => props.onRefreshAll()}
          ?disabled=${props.channelsLoading || props.sessionsLoading || props.presenceLoading}
        >
          Refresh Overview
        </button>
        <button class="btn" @click=${() => props.onProbeChannels()} ?disabled=${props.channelsLoading}>
          Probe Channels
        </button>
        <button class="btn" @click=${() => props.onOpenTab("channels")}>Open Channels</button>
        <button class="btn" @click=${() => props.onOpenTab("sessions")}>Open Sessions</button>
        <button class="btn" @click=${() => props.onOpenTab("cron")}>Open Cron</button>
        <button class="btn" @click=${() => props.onOpenTab("logs")}>Open Logs</button>
        <button class="btn" @click=${() => props.onOpenTab("debug")}>Open Debug</button>
      </div>
    </section>

    <section class="grid grid-cols-2" style="margin-top: 16px">
      <div class="card">
        <div class="card-title">Incident Feed</div>
        <div class="card-sub">Current warnings surfaced from gateway and channel telemetry.</div>
        <div style="margin-top: 12px; display: grid; gap: 10px;">
          ${alerts.map(
            (entry) => html`
              <div class="callout ${entry.level === "critical" ? "danger" : ""}">
                <div class="mono" style="font-size: 12px; margin-bottom: 4px;">
                  ${entry.level.toUpperCase()}
                </div>
                <div>${entry.title}</div>
                <div class="muted" style="margin-top: 4px">${entry.detail}</div>
              </div>
            `,
          )}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Gateway Probe Snapshot</div>
        <div class="card-sub">Last health payload captured by the dashboard.</div>
        <div class="stat-grid" style="margin-top: 14px">
          <div class="stat">
            <div class="stat-label">Health Loaded</div>
            <div class="stat-value ${props.debugHealth ? "ok" : "warn"}">
              ${props.debugHealth ? "Yes" : "No"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Sampled</div>
            <div class="stat-value">
              ${health.sampledAt ? formatRelativeTimestamp(health.sampledAt) : "n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Probe Duration</div>
            <div class="stat-value">
              ${health.durationMs != null ? `${Math.round(health.durationMs)}ms` : "n/a"}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">Loading</div>
            <div class="stat-value">${props.debugLoading ? "In progress" : "Idle"}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 16px">
      <div class="card-title">Linux Runbook</div>
      <div class="card-sub">Common server commands for remote operations.</div>
      <pre class="code-block" style="margin-top: 12px"><code># Gateway health/status
openclaw status --deep
openclaw health --json

# Tail logs (gateway host)
openclaw logs --follow

# Docker users (if running in container)
docker compose logs -f openclaw-gateway
docker compose exec openclaw-gateway node dist/index.js health --token "$OPENCLAW_GATEWAY_TOKEN"</code></pre>
    </section>
  `;
}
