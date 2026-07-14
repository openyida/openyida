<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i3/O1CN01SKWbWu1aPzGXh293W_!!6000000003323-2-tps-1672-941.png)

# OpenYida

**AI-native CLI for building DingTalk Yida low-code applications.**

OpenYida connects AI coding agents with Yida's low-code platform, so developers can create apps, forms, workflows, custom pages, reports, integrations, and deployment configuration from a normal chat-driven development workflow.

[Quick Start](#quick-start) · [Capabilities](#capabilities) · [Full Capability List](./docs/capabilities.md) · [CLI Reference](#cli-reference) · [Examples](#examples) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Documentation:** [English](https://openyida.ai/docs/en) · [简体中文](https://openyida.ai/docs) · [繁體中文](https://openyida.ai/docs/zh-Hant/) · [日本語](https://openyida.ai/docs/ja/) · [한국어](https://openyida.ai/docs/ko/) · [Français](https://openyida.ai/docs/fr/) · [Deutsch](https://openyida.ai/docs/de/) · [Español](https://openyida.ai/docs/es/) · [Português](https://openyida.ai/docs/pt/) · [Tiếng Việt](https://openyida.ai/docs/vi/) · [हिन्दी](https://openyida.ai/docs/hi/) · [العربية](https://openyida.ai/docs/ar/)

</div>

---

## What OpenYida Provides

OpenYida is a bridge between AI coding tools and Yida. It gives agents a stable command-line interface for the full application lifecycle:

| Area | What you can do |
|------|-----------------|
| Application delivery | Create, update, export, and import Yida applications |
| Form modeling | Create forms, update fields, inspect schemas, and manage permissions |
| Custom pages | Generate React-based pages, lint Yida runtime rules, compile, and publish |
| Workflow automation | Create process forms, configure approval flows, preview process instances |
| Data operations | Query form/process/task/subform data and run anomaly checks |
| Integrations | Manage HTTP connectors, connector actions, auth accounts, and automation flows |
| Operations | Diagnose environment issues, manage login state, configure sharing, upload CDN assets |

The result remains a native Yida application: teams can continue editing it in Yida, use existing enterprise security controls, and deploy through the Yida platform.

## Quick Start

### 1. Install

```bash
npm install -g openyida
```

OpenYida requires Node.js 18 or later. The package exposes both `openyida` and `yida` commands.

If Codex is already installed, OpenYida also imports a local Codex plugin during postinstall. Restart Codex after installation, then type `@宜搭` or `@openyida` in the composer to attach the OpenYida context.

### 2. Check Your Environment

Run this from the AI coding workspace where you want OpenYida to operate:

```bash
openyida agent-capabilities --summary-json
```

OpenYida returns a compact machine-readable summary with the version, login state, workspace/cache paths, and command manifest digest. `openyida agent-capabilities --json` is the full diagnostic snapshot, where compact `workdir` maps to `active.projectRoot` and `workdir_exists` maps to `active.projectRootExists`. `openyida commands --json` remains available when an agent only needs the command manifest.

### 3. Log In

```bash
openyida login
```

In Codex, QoderWork, Qoder, Wukong, Claude Code, MuleRun, OpenCode, Cursor, and other detected AI tools, OpenYida first tries local Chrome/Edge/Chromium CDP when no valid cached login exists. If local CDP is unavailable, it falls back to an AI-dialog QR handoff. The agent should render `qr_image_markdown` or paste `agent_response_markdown` directly in the conversation so the QR code is visible, then run `poll_command` after the user scans it with DingTalk. If image rendering is unavailable, fall back to `qr_url`. The explicit `openyida login --browser` command still prefers CDP first and uses Playwright as an optional browser fallback.

When the user names a target Yida entry URL, pass it to the login command so OpenYida can select the matching environment and cookie file. For example, Alibaba intranet Yida uses `cookies-alibaba.json`:

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
```

The explicit QR polling command remains available:

```bash
openyida login --agent-qr
```

For terminal QR login, use:

```bash
openyida login --qr
openyida login --qr --corp-id dingxxxxxxxx
openyida login --check-only --json
```

OpenYida does not install Playwright by default.

### 4. Build With an AI Agent

Ask your coding agent for a concrete Yida application or workflow:

```text
Create a CRM application in Yida with customer, contact, opportunity, and follow-up forms.
Build an IPD workflow for chip production, including approval nodes and dashboard pages.
Generate a public landing page and publish it to my Yida app.
```

The agent can then call OpenYida commands to create the application, generate source files, publish pages, and return the final Yida URLs. In Codex, QoderWork, Qoder, and Wukong environments, successful creation and publish commands also include a browser handoff so the agent can open the resulting Yida page in the in-app browser. Use `--open` to force this handoff or `--no-open` to suppress it.

## Wukong Installation

Wukong uses manual skill package installation instead of npm:

1. Download the latest `.zip` skill package from [GitHub Releases](https://github.com/openyida/openyida/releases).
2. Open Wukong.
3. Go to **Skill Center** > **Upload Skill** and select the downloaded package.

For Wukong terminal work, make sure its bundled Node.js path is active before running `node`, `npm`, or `npx` commands:

```bash
export PATH="$HOME/.real/.bin/node/bin:$PATH"
```

## Supported AI Coding Tools

| Tool | Support |
|------|---------|
| [Codex](https://openai.com/codex/) | Full support |
| [Claude Code](https://claude.ai/code) | Full support |
| [MuleRun](https://mulerun.com) | Full support |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | Full support |
| [OpenCode](https://opencode.ai) | Full support |
| [Cursor](https://cursor.com/) | Full support |
| [Visual Studio Code](https://code.visualstudio.com/) | Full support |
| [QoderWork](https://qoder.com) | Full support |
| [Qoder](https://qoder.com) | Full support |
| [Wukong](https://dingtalk.com/wukong) | Full support |

## How It Works

```mermaid
flowchart LR
  A["AI coding agent"] --> B["OpenYida CLI"]
  B --> C["Environment detection"]
  B --> D["Login and organization context"]
  B --> E["Yida API operations"]
  B --> F["Local page generation and compile"]
  E --> G["Native Yida app"]
  F --> G
```

OpenYida keeps platform-specific behavior inside the CLI, while agents interact with predictable commands and project files.

## Project Layout

```text
openyida/
├── bin/yida.js                 # CLI entry and command routing
├── lib/
│   ├── app/                    # Application, form, page, import/export commands
│   ├── auth/                   # Login, QR login, browser handoff, organization switch
│   ├── connector/              # HTTP connector lifecycle and smart creation
│   ├── core/                   # Environment detection, i18n, diagnostics, data commands
│   ├── process/                # Process form creation, configuration, preview
│   ├── report/                 # Yida report and chart generation
│   └── samples/                # Templates emitted by openyida sample
├── project/                    # Default workspace template for generated Yida projects
├── yida-skills/                # Source skill docs and Yida API references
└── scripts/                    # CI, packaging, and installation helpers
```

## Capabilities

For a user-facing list of supported features and matching CLI commands, see [OpenYida 功能完整列表](./docs/capabilities.md).

### Application and Form Management

```bash
openyida create-app "CRM"
openyida create-app --name "CRM" --desc "Customer management" --theme deepBlue
openyida app-list --size 20
openyida corp-efficiency
openyida create-form create APP_XXX "Customer" .cache/openyida/forms/customer-fields.json
openyida create-form update APP_XXX FORM_XXX .cache/openyida/forms/customer-changes.json
openyida get-schema APP_XXX FORM_XXX
openyida get-schema APP_XXX --all --output-dir .cache/schemas
```

### Custom Page Development

```bash
openyida create-page APP_XXX "Dashboard" --mode dashboard
openyida generate-page product-homepage --spec .cache/openyida/page-specs/home.json --output pages/src/home.oyd.jsx --compile
openyida generate-page todo-mvc --output pages/src/todo-mvc.oyd.jsx --compile
openyida check-page pages/src/home.oyd.jsx
openyida compile pages/src/home.oyd.jsx
openyida publish pages/src/home.oyd.jsx APP_XXX FORM_XXX
```

`generate-page` turns a structured spec into a Page IR, renders a curated React 16-compatible template, writes a `.openyida-page.json` manifest, and optionally compiles the result. The manifest makes follow-up AI edits safer because agents can update known blocks instead of rewriting a large JSX file by hand.
Built-in templates currently include `product-homepage` for product/portal pages and `todo-mvc` for a full interaction smoke page covering events, custom state, list rendering, editing, filtering, and localStorage persistence.

### Workflow, Data, and Permissions

```bash
openyida create-process APP_XXX "Purchase Request" .cache/openyida/process/fields.json .cache/openyida/process/process.json
openyida configure-process APP_XXX FORM_XXX .cache/openyida/process/process.json
openyida process preview APP_XXX PROC_INST_XXX --output .cache/openyida/process/process.html
openyida data query form APP_XXX FORM_XXX --page 1 --size 20
openyida data create form APP_XXX FORM_XXX --data-file .cache/openyida/data-import/record.json
openyida get-permission APP_XXX FORM_XXX
```

`configure-process` 的流程 JSON 中，审批人可配置为发起人、指定成员、指定角色、部门主管或直属主管，例如：

```json
{
  "nodes": [
    {
      "type": "approval",
      "name": "主管审批",
      "approver": {
        "type": "user",
        "users": [{ "id": "manager7350", "name": "九神" }],
        "multiApproverType": "all"
      }
    }
  ]
}
```

When creating or updating test data with `openyida data`, Yida date fields must use 13-digit millisecond timestamps, for example `"dateField_xxx": 1719705600000`. Do not submit `YYYY-MM-DD` strings for `DateField` or `CascadeDateField` values.
Temporary JSON, CSV, and one-off import scripts should live under `.cache/openyida/` so generated run artifacts do not clutter the repository root.

### Real Environment E2E

Most checks should stay offline, but OpenYida also includes an explicit real-environment smoke path for release and nightly validation:

```bash
OPENYIDA_E2E=1 npm run test:e2e:real
OPENYIDA_E2E=1 npm run test:e2e:real:full
OPENYIDA_E2E=1 OPENYIDA_E2E_FULL_STAGES=auth,app,form,process npm run test:e2e:real:full
npm run test:e2e:real:skills
```

The runner creates a disposable app, form, and custom page with an `OY_E2E_*` prefix, then verifies login, app listing, schema fetch, data query, and page publish. It writes a registry to `project/.cache/e2e-real/` so created resources can be audited later. To inject CI cookies without relying on a local login cache, pass `OPENYIDA_E2E_COOKIES_BASE64` as a base64 encoded cookie array or `{ "cookies": [...] }` object.

`test:e2e:real:full` extends the smoke path into a broad deterministic feature matrix: auth/env, app update, form update and option mutation, page build/compile/generate/publish, data create/get/update/query, permission read, page config and short URL check, report create/append, dashboard skill verification, export/import, batch, task-center, formula/doctor/sample/CDN config, and local connector parsing/template generation. AI-backed commands such as `flash-to-prd` are available as the optional `ai` stage because they depend on remote model availability. Workflow mutation is available as the opt-in `process` stage; it creates and republishes a workflow on the disposable E2E form and records advanced official-node fixtures for review.

`test:e2e:real:skills` enforces coverage for every directory under `yida-skills/skills/`. Each skill must be classified as real E2E, offline/unit, opt-in, or deprecated with an explicit reason. This prevents new skills from quietly bypassing the real-environment test plan.

Each successful full run leaves a human-inspectable result app in the target organization. The final step publishes a dedicated `Full E2E Dashboard` custom page, renames the app to `OY_E2E_*_PASSED` by default, and prints direct links for the app, form, dashboard page, and report; the same links are saved under `resultApp` in the registry JSON.

Useful options:

| Env var | Purpose |
|---------|---------|
| `OPENYIDA_E2E_PREFIX` | Override the disposable resource name prefix |
| `OPENYIDA_E2E_CORP_ID` | Switch to the dedicated test organization before creating resources |
| `OPENYIDA_E2E_RESULT_APP_NAME` | Override the final app name shown as the full-run result |
| `OPENYIDA_E2E_BASE_URL` | Override the Yida base URL for private deployments |
| `OPENYIDA_E2E_FIELDS_FILE` | Use a custom form fields fixture |
| `OPENYIDA_E2E_PAGE_SOURCE` | Use a custom page source for publish verification |
| `OPENYIDA_E2E_SKIP_PUBLISH=1` | Skip custom page creation and publish |
| `OPENYIDA_E2E_REGISTRY_DIR` | Write registries outside `project/.cache/e2e-real/` |
| `OPENYIDA_E2E_FULL_STAGES` | Comma-separated stage list for `test:e2e:real:full`; use `all` or omit for the default broad matrix |

Use `npm run test:e2e:real:cleanup` to list recorded disposable resources. OpenYida does not yet expose a safe app/form deletion command, so cleanup is intentionally a registry-backed audit step rather than an automatic destructive action.

### Skill Evaluation Harness

The E2E paths above prove the *CLI* works. The eval harness under `scripts/eval/` measures whether the *agent* still routes natural-language requests to the right sub-skill and produces good output after you edit `yida-skills/SKILL.md`. It is the feedback loop for harness engineering.

```bash
# Routing eval — "did it pick the right sub-skill?" No real resources, no login.
# Drives a headless `claude -p` agent with each scenario prompt and checks
# the selected sub-skill against the golden set.
npm run eval:routing

# Tool-pipeline baseline (end-to-end) — wraps the real-environment runner for one
# sub-skill, adds guardrail assertions, screenshots the published page, and writes a
# human scoring template. Runs deterministic CLI commands (no agent) so it serves as
# a control that proves the build→publish→screenshot→score plumbing itself works.
# Requires OPENYIDA_E2E=1 and a valid cookie cache.
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot

# Same, plus automatic screenshot scoring via the local multimodal `claude -p`.
OPENYIDA_E2E=1 npm run eval:e2e -- --skill yida-dashboard --screenshot --auto-score

# Real-generation eval — "can one sentence really build a usable app?" Feeds a
# natural-language request ("帮我创建一个订单管理系统") to a headless `claude -p`
# that actually reads the openyida skill and runs the CLI to build a real app, then
# reuses the screenshot + scoring + report pipeline. Creates real 宜搭 resources, so
# it needs OPENYIDA_E2E=1 + an authenticated agent. Unlike the deterministic baseline
# above, here the agent self-orchestrates.
OPENYIDA_E2E=1 npm run eval:generate -- --screenshot

# Run all three in one pass (routing + tool-pipeline baseline + real generation).
OPENYIDA_E2E=1 npm run eval:all -- --skill yida-dashboard --screenshot

# Optional: a zero-dependency local web console (buttons + live streamed output)
# that runs the tasks above on click. Binds to 127.0.0.1 only; tasks are a fixed
# whitelist. Use the Node version you start it with, so run `nvm use 20` first.
npm run eval:dashboard          # http://127.0.0.1:4500
```

Configuration precedence is `CLI flag > env (OPENYIDA_EVAL_*) > scripts/eval/eval.config.json > defaults`.

| Flag | Purpose |
|------|---------|
| `--mode e2e\|routing\|generate\|all` | Which evals to run (default `e2e`; `all` = routing + tool-pipeline baseline + real generation) |
| `--skill <name>` | Restrict the e2e run to one sub-skill; stages are reverse-looked-up from the `SKILL_COVERAGE` matrix |
| `--stages a,b` | Explicit stage list, overriding the skill reverse-lookup |
| `--screenshot` / `--no-screenshot` | Capture the published page (default on; skipped gracefully if Playwright is absent) |
| `--auto-score` / `--no-auto-score` | Score screenshots with the local `claude -p` agent (default off → human template only) |
| `--scenarios <dir>` | Routing golden-set directory (default `scripts/eval/scenarios`) |
| `--gen-scenarios <dir>` | Real-generation golden-set directory (default `scripts/eval/scenarios/generation`) |

Results are written back into the existing `acceptance-manifest.json` under a new `eval` section (guardrails, screenshots, scores) plus two sibling artifacts: a `scoring.md` human-scoring template and a self-contained `eval-report.html` visual report (screenshots inlined as base64, so the single file opens anywhere). Routing results land in `project/.cache/eval/routing-report.json`; generation results (with their own `scoring.md` + `eval-report.html`) land in `project/.cache/eval/generate/gen-<timestamp>/`. The harness degrades gracefully: a missing Playwright skips screenshots (enable with `npm install --no-save playwright && npx playwright install chromium`), and a missing `claude` CLI skips auto-scoring while keeping the human template. A guardrail failure (for example a resource-creating command issued before a successful `login --check-only`) fails the run.

A zero-dependency local dashboard (`npm run eval:dashboard`, then open `http://127.0.0.1:4500`) drives these runs from buttons and streams output live; its "📊 查看最新报告" button opens the most recent `eval-report.html`.

### Connectors, Integrations, and Reports

```bash
openyida connector smart-create --curl "curl https://api.example.com/users"
openyida connector list
openyida integration create APP_XXX FORM_XXX "Sync customer data"
openyida integration create APP_XXX FORM_XXX "Approval result notify" \
  --events processFinish --approval-actions agree,disagree --receivers 123456
openyida create-report APP_XXX "Sales Dashboard" .cache/openyida/reports/charts.json
openyida append-chart APP_XXX REPORT_XXX .cache/openyida/reports/chart.json
```

## CLI Reference

Run `openyida --help` or `openyida <command> --help` for detailed usage.

<!-- OPENYIDA_COMMANDS_START -->
<!-- This section is generated by `npm run docs:commands`. Do not edit command rows by hand. -->

### Auth & Environment

| Command | Description |
|---------|-------------|
| `openyida login [target-url] [--qr\|--agent-qr\|--codex\|--browser] [--env <name>\|--intl\|--overseas\|--global\|--yidaapps\|--alibaba] [--corp-id <corpId>]` | Login (cache first, --browser or --agent-qr when needed) |
| `openyida logout` | Logout / switch account |
| `openyida auth <status\|login\|refresh\|logout>` | Login state management |
| `openyida org <list\|switch>` | Organization management (list / switch) |
| `openyida env [--json\|setup\|list\|show\|switch\|add\|remove] [options]` | Detect AI tool environment & login state |

### App Management

| Command | Description |
|---------|-------------|
| `openyida app-list [--size N]` | List my Yida apps |
| `openyida corp-efficiency [overview\|details\|detail\|groups\|notify] [options] [--open\|--no-open]` | Query enterprise efficiency overview and detail reports |
| `openyida create-app "<name>"\|--name <name> [options] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | Create a Yida app |
| `openyida update-app <appType> [--name "..."] [--layout slide\|ver] [--theme deepBlue]` | Update app info |
| `openyida nav-group <list\|create\|rename\|delete\|move\|order\|hide\|show> <appType> ...` | Manage app sidebar navigation groups |
| `openyida app-permission <get\|set\|add\|remove\|search-user> ...` | Manage app primary, data, and developer admins |
| `openyida i18n <overview\|config\|languages\|list\|upsert\|delete\|translate\|translate-all\|upgrade> <appType> ...` | Manage app multilingual copy and language config |
| `openyida export <appType> [output]` | Export app (generate migration package) |
| `openyida import <file> [name]` | Import migration package, rebuild app |

### Forms & Pages

| Command | Description |
|---------|-------------|
| `openyida create-form create <appType> ... [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | Create a form page |
| `openyida create-form update <appType> ... [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | Update a form page |
| `openyida create-form patch <appType> <formUuid> <patchJsonOrFile> [--open\|--no-open]` | Update a form page |
| `openyida create-form rule <appType> <formUuid> <rulesJsonOrFile> [--open\|--no-open]` | Update a form page |
| `openyida create-form validation <appType> <formUuid> <validationsJsonOrFile> [--open\|--no-open]` | Update a form page |
| `openyida add-validation <appType> <formUuid> --field <labelOrId> --type <phone\|regex\|idCard\|email\|...> [--message <text>]` | Update a form page |
| `openyida create-form bind-datasource <appType> <formUuid> <fieldLabelOrId> <dataSourceJsonOrFile> [--open\|--no-open]` | Update a form page |
| `openyida create-form add-option <appType> <formUuid> <fieldLabel> <option1> [option2] ...` | Update a form page |
| `openyida list-forms <appType> [--keyword <text>]` | List forms/pages in an app |
| `openyida aggregate-table <list\|create-empty\|inspect\|preview\|save\|publish\|status> <appType> ...` | Manage aggregate tables (virtualView) |
| `openyida get-schema <appType> <formUuid\|--all> [--summary-json\|--field-map-json]` | Get one form Schema or all form Schemas |
| `openyida er <appType> [--format mermaid\|json] [--output file] [--include-system] [--include-pages]` | Export app entity relationship diagram |
| `openyida create-page <appType> "<name>" [--mode dashboard] [--locale zh_CN\|en_US\|ja_JP] [--open\|--no-open]` | Create a custom display page |
| `openyida generate-page <template>` | Generate page from curated template |
| `openyida build-page <sourceFile> [--output file\|--write]` | Build Yida-compatible page source |
| `openyida check-page <src> [--compat]` | Check custom page standards |
| `openyida compile <src>` | Compile custom page locally |
| `openyida publish <src> <appType> <formUuid> [--health-check] [--force] [--canvas] [--open\|--no-open]` | Compile and publish custom page |
| `openyida update-form-config <appType> ...` | Update form configuration |

### Data & Permissions

| Command | Description |
|---------|-------------|
| `openyida data <action> <resource> [args]` | Unified data management (form/process/task/subform) |
| `openyida task-center <type> [options]` | Global task center (todo/processed/cc etc.) |
| `openyida basic-info <overview\|commodity\|grant\|capacity\|quota\|abs-path\|dataflow\|i18n\|domain>` | Query organization basic info, capacity, quotas, and domain settings |
| `openyida get-permission <appType> <formUuid>` | Query form permission config |
| `openyida save-permission <appType> <formUuid> ...` | Save form permission config |
| `openyida corp-manager <search-user\|list\|add\|remove\|address-book> ...` | Manage platform admins and address book permissions |
| `openyida agent-center <list\|create\|update\|cancel\|range\|search-user> ...` | Manage process and departure delegation |

### Process

| Command | Description |
|---------|-------------|
| `openyida configure-process <appType> ...` | Configure and publish process rules |
| `openyida create-process <appType> ...` | Create process form (all-in-one) |
| `openyida ai-form-setting <get\|fields\|models\|enable\|disable\|save> <appType> ...` | Manage process form AI approval prompts |
| `openyida process preview <appType> ...` | Preview process instance (visual flowchart) |

### Page Config & Sharing

| Command | Description |
|---------|-------------|
| `openyida verify-short-url <appType> ...` | Verify short URL |
| `openyida save-share-config <appType> ...` | Save public access / share config |
| `openyida get-page-config <appType> <formUuid>` | Query page public access config |
| `openyida externalize-form <appType> <formUuid> [--schema-file file]` | Plan external access-safe mirror fields |

### Reports

| Command | Description |
|---------|-------------|
| `openyida create-report <appType> "<name>" ... [--open\|--no-open]` | Create a Yida report |
| `openyida append-chart <appType> <reportId> ... [--open\|--no-open]` | Append chart to existing report |

### Connectors

| Command | Description |
|---------|-------------|
| `openyida connector list` | List HTTP connectors |
| `openyida connector create "name" "domain" ...` | Create a connector |
| `openyida connector detail <id>` | View connector details |
| `openyida connector delete <id>` | Delete a connector |
| `openyida connector add-action --operations <file> --connector-id <id>` | Add an action |
| `openyida connector list-actions <id>` | List actions |
| `openyida connector delete-action <id> <operation-id>` | Delete an action |
| `openyida connector test --connector-id <id> --action <actionId>` | Test an action |
| `openyida connector list-connections <id>` | List auth connections |
| `openyida connector create-connection <id> <name>` | Create an auth connection |
| `openyida connector smart-create --curl "..."` | Smart create connector (from cURL) |
| `openyida connector parse-api [options]` | Parse API information |
| `openyida connector gen-template [output]` | Generate API document template |

### Integration & DingTalk

| Command | Description |
|---------|-------------|
| `openyida integration create <appType> ... [--spec file.json]` | Create integration automation flow |
| `openyida integration list <appType> [--form-uuid <uuid>] [--status y\|n] [--json]` | List integration automation flows |
| `openyida integration enable <appType> <formUuid> <processCode>` | Enable integration automation flow |
| `openyida integration disable <appType> <formUuid> <processCode>` | Disable integration automation flow |
| `openyida integration check <appType...>` | Check abnormal integration automation run logs |
| `openyida integration diagnose (--text <text>\|--file <path>\|--rules) [--json]` | Diagnose integration automation tickets and common pitfalls |
| `openyida dws <command> [args]` | DingTalk CLI (contacts/calendar/todo/approval etc.) |
| `openyida dws contact user search --keyword <text>` | DingTalk CLI (contacts/calendar/todo/approval etc.) |
| `openyida dingtalk-link <url> [--target fullScreen] [--legacy-scheme] [--json]` | Generate DingTalk AppLink / legacy dingtalk:// page links |

### Utility

| Command | Description |
|---------|-------------|
| `openyida commands [--json]` | Output machine-readable command manifest |
| `openyida agent-capabilities [--json] [--summary-json\|--compact]` | Output one-shot agent capability snapshot |
| `openyida a2a <serve\|agent-card> [options]` | Start local read-only A2A adapter or print Agent Card |
| `openyida bridge start [--token <pair-token>] [--port 6736] [--origin https://demo.aliwork.com] [--open\|--no-open]` | Start OpenYida local web bridge service |
| `openyida copy [--force]` | Copy project working directory |
| `openyida sample [--list]` | Output code samples/templates |
| `openyida doctor [--fix]` | Environment diagnostics & auto-fix |
| `openyida db-seq-fix [--fix]` | Detect and repair PostgreSQL sequence drift |
| `openyida formula evaluate <formula\|file> [--schema file]` | Static-check Yida formula syntax and field refs |
| `openyida update` | Check and update to latest version |
| `openyida export-conversation [options]` | Export AI conversation records |
| `openyida feedback <setup\|url\|dismiss\|status> [options]` | Configure experience feedback form and local reminder state |
| `openyida batch <file>\|--commands "cmd1 ; cmd2" [--stop-on-error] [--json]` | Run OpenYida commands in batch |
| `openyida flash-to-prd --file <path> --name "<project>"` | Convert flash notes or meeting notes to a PRD prompt |
| `openyida ai <text\|image> [options]` | Call Yida AI text and image recognition APIs |
| `openyida cdn-config [options]` | Configure CDN / OSS upload |
| `openyida cdn-upload <image-path>` | Upload image to CDN |
| `openyida cdn-refresh [options]` | Refresh CDN cache |

<!-- OPENYIDA_COMMANDS_END -->

### CLI Notes

#### Environment and Localization

Environment selectors such as `--env intl`, `--intl`, `--overseas`, `--global`, and `--yidaapps` can be used on login-required commands to choose the target Yida environment for that run. The `intl` preset uses `https://www.yidaapps.com` as the built-in Global YiDA entrypoint (not the bare `https://yidaapps.com` domain) and DingTalk International OAuth at `https://login.dingtalk.io`; business API requests still use the authenticated environment `baseUrl`, so customer custom subdomains are supported.

For overseas apps, pass `--locale en_US` or `--locale ja_JP` on creation commands, or set `OPENYIDA_CONTENT_LOCALE`. OpenYida writes YiDA resource names with `zh_CN`, `en_US`, and `ja_JP` values so Global YiDA does not fall back to Chinese-only metadata.

#### Forms and Pages

Form field definitions can include `alias` or `componentAlias` to populate Yida designer component aliases, stored as `pages[0].componentAlias.items`. Yida runtime resolves these aliases in page JS, so `this.$('phone')` can be used instead of `this.$('textField_xxx')`; OpenYida form rules, validations, and `openyida data ... --resolve-aliases` JSON inputs also accept aliases as field references. For server-side DingTalk OpenAPI calls, use `GET /v2.0/yida/forms/component/alias/{appType}/{formUuid}` to read the `{ fieldId, alias }` mapping, then translate aliases before sending form data/search JSON. That endpoint requires `systemToken`, `userId`, an access token, and the Yida form data read permission; grant that permission in DingTalk developer console API permissions and publish the DingTalk app. Yida app code and app secret are available under app settings > deployment/maintenance.

`openyida publish` preserves existing custom page data sources by default. Before saving the new compiled JSX Schema, it reads the current page Schema and merges the Page-level `dataSource` with the built-in `urlParams` and `timestamp` sources, so manually configured data sources are not deleted during republish.

#### Data, Permissions, and Sharing

`openyida externalize-form` is useful when a form contains fields such as `AssociationFormField`, `EmployeeField`, or `DepartmentSelectField` that depend on internal organization permissions. It produces a report plus optional `--mirror-fields-output` JSON that can be used with `openyida create-form create` to build a separate public intake form while keeping the internal form and its association fields private.

#### Workflow, Reports, and Integrations

`openyida integration create` supports form events (`insert`, `update`, `delete`, `comment`) and approval events (`processFinish`, `activityTask`; aliases: `approval`, `approvalNode`). Approval events require `--approval-actions agree,disagree,terminated`; `activityTask` also requires `--approval-node-ids <nodeId,...>`.

## Agent Skills

The `yida-skills/` directory is the source skill library used by OpenYida during development. Release assets for Wukong are generated by `npm run build:skills`: the expanded package is written to `dist/skills/openyida/`, and the upload-ready zip is written to `openyida-skills.zip`.

| Path | Purpose |
|------|---------|
| `yida-skills/SKILL.md` | Entry point and skill index |
| `yida-skills/skills/` | Self-contained sub-skills for app, form, process, page, data, and integration work |
| `yida-skills/references/` | Shared Yida API, model API, and query-condition references |
| `dist/skills/openyida/` | Generated Wukong upload package root; contains one root `SKILL.md` and reference-only subskill docs |
| `openyida-skills.zip` | Generated Wukong upload package; upload this file in Wukong |

When OpenYida is used inside a supported AI coding environment, these skills help the agent choose the right command sequence and file conventions.

For Wukong manual import, upload the generated `openyida-skills.zip`. The package follows Wukong's custom skill rules: folder name and `frontmatter.name` are both `openyida`, root frontmatter only contains `name` and `description`, and long references live under `references/`.

For Codex, `npm install -g openyida` additionally creates a local plugin marketplace under `~/.openyida/codex-plugin` and enables `openyida@openyida` in `~/.codex/config.toml` when Codex is detected. This makes OpenYida show up in Codex's `@` plugin menu as **宜搭** after Codex reloads.

## Examples

### Business Systems: IPD and CRM

Describe your requirements in one sentence; the agent can create a complete multi-form Yida application.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### Custom Pages and Utilities

![Salary Calculator](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

![Enterprise Collaboration](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### Interactive Campaigns

![Lantern Riddle Game](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

## Common Prompts

```text
Build a Yida application for [business scenario].
Generate an app from this requirements document.
Create a [name] form page with these fields.
Add a required [field type] field named [field name] to [form name].
Publish this custom page to the Yida app.
Make this page publicly accessible.
Export the application as a migration package.
```

## OpenClaw Integration

Use OpenYida through [yida-app](https://clawhub.ai/nicky1108/yida-app) in OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

## Development

```bash
git clone https://github.com/openyida/openyida.git
cd openyida
npm install
npm run check:ci
```

Useful checks:

| Command | Purpose |
|---------|---------|
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |
| `npm run check:quick` | Run structure, manifest, syntax, and lint checks |
| `npm run check:commands` | Validate router, command manifest, and README alignment |
| `npm run docs:commands` | Regenerate the README command index from the manifest |
| `npm run check:docs` | Verify generated README command docs are current |
| `npm run check:syntax` | Validate JavaScript syntax |
| `npm run check:structure` | Validate project structure |
| `npm run check:package-size` | Validate npm package size and file-count budget |
| `npm run check:package` | Validate npm package contents |

When adding new CLI commands, register the route in `bin/yida.js`, add it to `lib/core/command-manifest.js`, regenerate the README command index with `npm run docs:commands`, and keep agent skills in `yida-skills/` aligned when the workflow changes. `npm run check:commands` fails if the router, manifest, or README drift apart.

## Security and Configuration

- Login cookies are cached locally and should never be hard-coded into source files.
- Private deployment environments are managed through `lib/core/env-manager.js`.
- Yida API requests should use the active environment base URL and authenticated cookies.
- For multi-organization accounts, prefer explicit `--corp-id` values in non-interactive automation.

## Community

Scan the QR code to join the OpenYida DingTalk user group for updates and support.

![Join OpenYida Community](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

## Contributors

Thanks to everyone who has contributed to OpenYida. Read the [Contributing Guide](./CONTRIBUTING.md) to get involved.

Latest contributors: [DDlixin1](https://github.com/DDlixin1), [fcloud](https://github.com/fcloud).

<!-- openyida-contributors:start -->

<p>
  <a href="https://github.com/yize"><img src="https://github.com/yize.png?size=48" width="48" height="48" alt="九神" title="九神" /></a>
  <a href="https://github.com/alex-mm"><img src="https://github.com/alex-mm.png?size=48" width="48" height="48" alt="天晟" title="天晟" /></a>
  <a href="https://github.com/DDlixin1"><img src="https://github.com/DDlixin1.png?size=48" width="48" height="48" alt="DDlixin1" title="DDlixin1" /></a>
  <a href="https://github.com/fcloud"><img src="https://github.com/fcloud.png?size=48" width="48" height="48" alt="Aiden Wu (fcloud)" title="Aiden Wu (fcloud)" /></a>
  <a href="https://github.com/nicky1108"><img src="https://github.com/nicky1108.png?size=48" width="48" height="48" alt="nicky1108" title="nicky1108" /></a>
  <a href="https://github.com/angelinheys"><img src="https://github.com/angelinheys.png?size=48" width="48" height="48" alt="angelinheys" title="angelinheys" /></a>
  <a href="https://github.com/yipengmu"><img src="https://github.com/yipengmu.png?size=48" width="48" height="48" alt="yipengmu" title="yipengmu" /></a>
  <a href="https://github.com/Waawww"><img src="https://github.com/Waawww.png?size=48" width="48" height="48" alt="Waawww" title="Waawww" /></a>
  <a href="https://github.com/kangjiano"><img src="https://github.com/kangjiano.png?size=48" width="48" height="48" alt="kangjiano" title="kangjiano" /></a>
  <a href="https://github.com/ElZe98"><img src="https://github.com/ElZe98.png?size=48" width="48" height="48" alt="ElZe98" title="ElZe98" /></a>
  <a href="https://github.com/OAHyuhao"><img src="https://github.com/OAHyuhao.png?size=48" width="48" height="48" alt="OAHyuhao" title="OAHyuhao" /></a>
  <a href="https://github.com/xiaofu704"><img src="https://github.com/xiaofu704.png?size=48" width="48" height="48" alt="xiaofu704" title="xiaofu704" /></a>
  <a href="https://github.com/guchenglin111"><img src="https://github.com/guchenglin111.png?size=48" width="48" height="48" alt="guchenglin111" title="guchenglin111" /></a>
  <a href="https://github.com/liug0911"><img src="https://github.com/liug0911.png?size=48" width="48" height="48" alt="LIUG" title="LIUG" /></a>
  <a href="https://github.com/sunliz-xiuli"><img src="https://github.com/sunliz-xiuli.png?size=48" width="48" height="48" alt="sunliz-xiuli" title="sunliz-xiuli" /></a>
  <a href="https://github.com/M12REDX"><img src="https://github.com/M12REDX.png?size=48" width="48" height="48" alt="M12REDX" title="M12REDX" /></a>
  <a href="https://github.com/key-668"><img src="https://github.com/key-668.png?size=48" width="48" height="48" alt="再不喝汽水" title="再不喝汽水" /></a>
  <a href="https://github.com/dongbeixiaohuo"><img src="https://github.com/dongbeixiaohuo.png?size=48" width="48" height="48" alt="dongbeixiaohuo" title="dongbeixiaohuo" /></a>
  <a href="https://github.com/nandanadileep"><img src="https://github.com/nandanadileep.png?size=48" width="48" height="48" alt="nandanadileep" title="nandanadileep" /></a>
</p>

<!-- openyida-contributors:end -->

## License

[MIT](./LICENSE) © 2026 Alibaba Group Holding Limited
