/**
 * app-dashboard View — 应用列表卡片仪表盘
 *
 * 接收 yida_list_apps Tool 返回的应用列表数据，
 * 渲染为可交互的卡片网格。
 */

import { App } from "@modelcontextprotocol/ext-apps";

interface AppInfo {
  appName: string;
  appType: string;
  systemLink: string;
  icon?: string;
  iconColor?: string;
}

const COLORS = [
  "#3870EA", "#F5A623", "#7B68EE", "#E74C3C",
  "#2ECC71", "#E67E22", "#9B59B6", "#1ABC9C",
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

function getIconEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("crm") || lower.includes("客户")) return "👥";
  if (lower.includes("hr") || lower.includes("人事") || lower.includes("员工")) return "🧑‍💼";
  if (lower.includes("报表") || lower.includes("report")) return "📊";
  if (lower.includes("审批") || lower.includes("流程")) return "✅";
  if (lower.includes("项目") || lower.includes("project")) return "📋";
  if (lower.includes("财务") || lower.includes("费用")) return "💰";
  return "📱";
}

function render(apps: AppInfo[]): void {
  const root = document.getElementById("root")!;
  root.replaceChildren();

  if (!apps || apps.length === 0) {
    root.append(createMessage("empty", "No applications found."));
    return;
  }

  const header = document.createElement("div");
  header.className = "header";

  const title = document.createElement("h2");
  title.textContent = "🚀 Yida Applications";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = String(apps.length);

  header.append(title, badge);

  const grid = document.createElement("div");
  grid.className = "grid";

  apps.forEach((app, index) => {
    grid.append(createAppCard(app, index));
  });

  root.append(header, grid);
}

function createAppCard(app: AppInfo, index: number): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";

  const safeUrl = getSafeHttpUrl(app.systemLink);
  if (safeUrl) {
    card.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a")) {
        return;
      }
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    });
  }

  const cardHeader = document.createElement("div");
  cardHeader.className = "card-header";

  const iconCircle = document.createElement("div");
  iconCircle.className = "icon-circle";
  iconCircle.style.background = getSafeColor(app.iconColor) || getColor(index);
  iconCircle.textContent = getIconEmoji(app.appName || "");

  const textWrap = document.createElement("div");

  const appName = document.createElement("div");
  appName.className = "app-name";
  appName.textContent = app.appName || "(unnamed)";

  const appType = document.createElement("div");
  appType.className = "app-type";
  appType.textContent = app.appType || "";

  textWrap.append(appName, appType);
  cardHeader.append(iconCircle, textWrap);
  card.append(cardHeader);

  if (safeUrl) {
    const link = document.createElement("a");
    link.className = "app-link";
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open →";
    card.append(link);
  }

  return card;
}

function createMessage(className: string, message: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = message;
  return element;
}

function getSafeHttpUrl(value: string): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function getSafeColor(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── MCP App 生命周期 ──

const app = new App({ name: "app-dashboard", version: "1.0.0" });

app.ontoolresult = (result) => {
  try {
    const textContent = result.content?.find(
      (c: { type: string }) => c.type === "text",
    );
    if (textContent && "text" in textContent) {
      const apps: AppInfo[] = JSON.parse(textContent.text as string);
      render(apps);
    }
  } catch (error) {
    const root = document.getElementById("root")!;
    root.replaceChildren(createMessage("empty", `Failed to parse app data: ${getErrorMessage(error)}`));
  }
};

app.ontoolinput = () => {
  const root = document.getElementById("root")!;
  root.replaceChildren(createMessage("loading", "Fetching applications..."));
};

app.onteardown = async () => ({ state: {} });

app.connect();
