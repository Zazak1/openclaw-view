import type { IconName } from "./icons.js";

export type Tab =
  | "agents"
  | "overview"
  | "ops"
  | "channels"
  | "instances"
  | "sessions"
  | "usage"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs";

export type Surface = "customer" | "console";

export const NAV_SURFACES = [
  {
    id: "customer",
    label: "客户使用场景",
    subtitle: "沟通、推送、任务安排",
    defaultTab: "chat",
  },
  {
    id: "console",
    label: "控制台",
    subtitle: "运维、配置、诊断",
    defaultTab: "overview",
  },
] as const satisfies ReadonlyArray<{
  id: Surface;
  label: string;
  subtitle: string;
  defaultTab: Tab;
}>;

export const TAB_GROUPS = [
  {
    surface: "customer",
    label: "客户使用场景",
    tabs: ["chat", "channels", "sessions", "cron"],
  },
  {
    surface: "console",
    label: "控制台",
    tabs: ["overview", "ops", "usage", "instances", "agents", "skills", "nodes", "config", "debug", "logs"],
  },
] as const satisfies ReadonlyArray<{ surface: Surface; label: string; tabs: readonly Tab[] }>;

const TAB_PATHS: Record<Tab, string> = {
  agents: "/agents",
  overview: "/overview",
  ops: "/ops",
  channels: "/channels",
  instances: "/instances",
  sessions: "/sessions",
  usage: "/usage",
  cron: "/cron",
  skills: "/skills",
  nodes: "/nodes",
  chat: "/chat",
  config: "/config",
  debug: "/debug",
  logs: "/logs",
};

const PATH_TO_TAB = new Map(Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as Tab]));
const TAB_TO_SURFACE = new Map<Tab, Surface>(
  TAB_GROUPS.flatMap((group) => {
    return group.tabs.map((tab) => [tab, group.surface] as const);
  }),
);

export function normalizeBasePath(basePath: string): string {
  if (!basePath) {
    return "";
  }
  let base = basePath.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (base === "/") {
    return "";
  }
  if (base.endsWith("/")) {
    base = base.slice(0, -1);
  }
  return base;
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export function pathForTab(tab: Tab, basePath = ""): string {
  const base = normalizeBasePath(basePath);
  const path = TAB_PATHS[tab];
  return base ? `${base}${path}` : path;
}

export function tabFromPath(pathname: string, basePath = ""): Tab | null {
  const base = normalizeBasePath(basePath);
  let path = pathname || "/";
  if (base) {
    if (path === base) {
      path = "/";
    } else if (path.startsWith(`${base}/`)) {
      path = path.slice(base.length);
    }
  }
  let normalized = normalizePath(path).toLowerCase();
  if (normalized.endsWith("/index.html")) {
    normalized = "/";
  }
  if (normalized === "/") {
    return "chat";
  }
  return PATH_TO_TAB.get(normalized) ?? null;
}

export function inferBasePathFromPathname(pathname: string): string {
  let normalized = normalizePath(pathname);
  if (normalized.endsWith("/index.html")) {
    normalized = normalizePath(normalized.slice(0, -"/index.html".length));
  }
  if (normalized === "/") {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }
  for (let i = 0; i < segments.length; i++) {
    const candidate = `/${segments.slice(i).join("/")}`.toLowerCase();
    if (PATH_TO_TAB.has(candidate)) {
      const prefix = segments.slice(0, i);
      return prefix.length ? `/${prefix.join("/")}` : "";
    }
  }
  return `/${segments.join("/")}`;
}

export function iconForTab(tab: Tab): IconName {
  switch (tab) {
    case "agents":
      return "folder";
    case "chat":
      return "messageSquare";
    case "overview":
      return "barChart";
    case "ops":
      return "globe";
    case "channels":
      return "link";
    case "instances":
      return "radio";
    case "sessions":
      return "fileText";
    case "usage":
      return "barChart";
    case "cron":
      return "loader";
    case "skills":
      return "zap";
    case "nodes":
      return "monitor";
    case "config":
      return "settings";
    case "debug":
      return "bug";
    case "logs":
      return "scrollText";
    default:
      return "folder";
  }
}

export function titleForTab(tab: Tab) {
  switch (tab) {
    case "agents":
      return "Agent 工作区";
    case "overview":
      return "服务概览";
    case "ops":
      return "运行态";
    case "channels":
      return "推送通道";
    case "instances":
      return "在线实例";
    case "sessions":
      return "会话与联系人";
    case "usage":
      return "用量分析";
    case "cron":
      return "任务计划";
    case "skills":
      return "技能中心";
    case "nodes":
      return "设备节点";
    case "chat":
      return "消息与沟通";
    case "config":
      return "系统配置";
    case "debug":
      return "调试工具";
    case "logs":
      return "日志中心";
    default:
      return "OpenClaw";
  }
}

export function subtitleForTab(tab: Tab) {
  switch (tab) {
    case "agents":
      return "管理 Agent 身份、文件、技能和通道策略。";
    case "overview":
      return "查看 OpenClaw 网关状态与关键健康指标。";
    case "ops":
      return "聚合运行信号与快速排障入口。";
    case "channels":
      return "像 Telegram 一样统一管理消息通道与推送可达性。";
    case "instances":
      return "查看客户端与节点在线状态、心跳与连接信息。";
    case "sessions":
      return "管理客户会话、上下文与会话级默认策略。";
    case "usage":
      return "查看消息、token 与成本趋势，辅助运营决策。";
    case "cron":
      return "安排周期任务、提醒和自动执行计划。";
    case "skills":
      return "管理技能可用性与 API Key 注入。";
    case "nodes":
      return "管理配对设备能力与执行入口。";
    case "chat":
      return "客户沟通主界面，支持即时消息和任务协同。";
    case "config":
      return "安全编辑 ~/.openclaw/openclaw.json 配置。";
    case "debug":
      return "查看事件、快照并手动调用调试 RPC。";
    case "logs":
      return "实时查看 Gateway 日志与错误上下文。";
    default:
      return "";
  }
}

export function sectionForTab(tab: Tab): Surface {
  return TAB_TO_SURFACE.get(tab) ?? "console";
}

export function defaultTabForSurface(surface: Surface): Tab {
  return NAV_SURFACES.find((entry) => entry.id === surface)?.defaultTab ?? "chat";
}
