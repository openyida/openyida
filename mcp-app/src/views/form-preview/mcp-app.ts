/**
 * form-preview View — 表单 Schema 可视化预览
 *
 * 接收 yida_get_schema Tool 返回的表单 Schema，
 * 渲染为可视化的字段列表。
 */

import { App } from "@modelcontextprotocol/ext-apps";

interface FieldInfo {
  label: string;
  componentName: string;
  fieldId: string;
}

interface SchemaData {
  formUuid: string;
  appType: string;
  fields: FieldInfo[];
}

const FIELD_ICONS: Record<string, { emoji: string; color: string }> = {
  TextField: { emoji: "📝", color: "#E3F2FD" },
  TextareaField: { emoji: "📄", color: "#E8F5E9" },
  SelectField: { emoji: "📋", color: "#FFF3E0" },
  RadioField: { emoji: "🔘", color: "#FCE4EC" },
  CheckboxField: { emoji: "☑️", color: "#F3E5F5" },
  NumberField: { emoji: "🔢", color: "#E0F7FA" },
  DateField: { emoji: "📅", color: "#FFF8E1" },
  EmployeeField: { emoji: "👤", color: "#E8EAF6" },
  PhoneField: { emoji: "📱", color: "#E0F2F1" },
  EmailField: { emoji: "📧", color: "#EFEBE9" },
  ImageField: { emoji: "🖼️", color: "#FBE9E7" },
  AttachmentField: { emoji: "📎", color: "#ECEFF1" },
  TableField: { emoji: "📊", color: "#E1F5FE" },
  CascadeSelectField: { emoji: "🔗", color: "#F1F8E9" },
};

function getFieldVisual(componentName: string): { emoji: string; color: string } {
  return FIELD_ICONS[componentName] || { emoji: "📌", color: "#F5F5F5" };
}

function render(data: SchemaData): void {
  const root = document.getElementById("root")!;
  root.replaceChildren();

  if (!data.fields || data.fields.length === 0) {
    root.append(createMessage("loading", "No fields found in this form."));
    return;
  }

  const header = document.createElement("div");
  header.className = "header";

  const title = document.createElement("h2");
  title.textContent = "📋 Form Schema Preview";
  header.append(title);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${data.appType} / ${data.formUuid} · ${data.fields.length} fields`;

  const spacer = document.createElement("br");
  const fieldList = document.createElement("div");
  fieldList.className = "field-list";

  data.fields.forEach((field) => {
    fieldList.append(createFieldCard(field));
  });

  root.append(header, meta, spacer, fieldList);
}

function createFieldCard(field: FieldInfo): HTMLElement {
  const visual = getFieldVisual(field.componentName);
  const card = document.createElement("div");
  card.className = "field-card";

  const icon = document.createElement("div");
  icon.className = "field-icon";
  icon.style.background = visual.color;
  icon.textContent = visual.emoji;

  const info = document.createElement("div");
  info.className = "field-info";

  const label = document.createElement("div");
  label.className = "field-label";
  label.textContent = field.label || "(unnamed)";

  const meta = document.createElement("div");
  meta.className = "field-meta";
  meta.textContent = field.fieldId || "";

  const badge = document.createElement("span");
  badge.className = "field-type-badge";
  badge.textContent = field.componentName || "Unknown";

  info.append(label, meta);
  card.append(icon, info, badge);

  return card;
}

function createMessage(className: string, message: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.textContent = message;
  return element;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── MCP App 生命周期 ──

const app = new App({ name: "form-preview", version: "1.0.0" });

app.ontoolresult = (result) => {
  try {
    const textContent = result.content?.find(
      (c: { type: string }) => c.type === "text",
    );
    if (textContent && "text" in textContent) {
      const data: SchemaData = JSON.parse(textContent.text as string);
      render(data);
    }
  } catch (error) {
    const root = document.getElementById("root")!;
    root.replaceChildren(createMessage("loading", `Failed to parse schema: ${getErrorMessage(error)}`));
  }
};

app.ontoolinput = () => {
  const root = document.getElementById("root")!;
  root.replaceChildren(createMessage("loading", "Fetching form schema..."));
};

app.onteardown = async () => ({ state: {} });

app.connect();
