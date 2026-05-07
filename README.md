<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# OpenYida

**AI-native CLI for building DingTalk Yida low-code applications.**

OpenYida connects AI coding agents with Yida's low-code platform, so developers can create apps, forms, workflows, custom pages, reports, integrations, and deployment configuration from a normal chat-driven development workflow.

[Quick Start](#quick-start) · [Capabilities](#capabilities) · [CLI Reference](#cli-reference) · [Examples](#examples) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

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
openyida env
openyida env --json
openyida commands --json
```

OpenYida detects the active agent environment, workspace path, login state, and organization context. Use `--json` when an agent needs a stable machine-readable snapshot.
`openyida commands --json` emits the command manifest used by the CLI help, so agents can inspect available routes without scraping terminal output.

### 3. Log In

```bash
openyida login
```

In Codex, Qoder, and Wukong, OpenYida uses the built-in browser handoff when no valid cached login exists. For terminal QR login, use:

```bash
openyida login --qr
openyida login --qr --corp-id dingxxxxxxxx
```

OpenYida does not install Playwright by default. The default login paths are cached Cookie reuse, terminal QR login, and AI-tool browser handoff.

### 4. Build With an AI Agent

Ask your coding agent for a concrete Yida application or workflow:

```text
Create a CRM application in Yida with customer, contact, opportunity, and follow-up forms.
Build an IPD workflow for chip production, including approval nodes and dashboard pages.
Generate a public landing page and publish it to my Yida app.
```

The agent can then call OpenYida commands to create the application, generate source files, publish pages, and return the final Yida URLs.

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
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | Full support |
| [OpenCode](https://opencode.ai) | Full support |
| [Cursor](https://cursor.com/) | Full support |
| [Visual Studio Code](https://code.visualstudio.com/) | Full support |
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
├── yida-skills/                # Agent skills and Yida API references
└── scripts/                    # CI, packaging, and installation helpers
```

## Capabilities

### Application and Form Management

```bash
openyida create-app "CRM"
openyida app-list --size 20
openyida create-form create APP_XXX "Customer" fields.json
openyida create-form update APP_XXX FORM_XXX changes.json
openyida get-schema APP_XXX FORM_XXX
openyida get-schema APP_XXX --all --output-dir .cache/schemas
```

### Custom Page Development

```bash
openyida create-page APP_XXX "Dashboard"
openyida generate-page product-homepage --spec page.json --output pages/src/home.jsx --compile
openyida check-page pages/src/home.jsx
openyida compile pages/src/home.jsx
openyida publish pages/src/home.jsx APP_XXX FORM_XXX
```

`generate-page` turns a structured spec into a Page IR, renders a curated React 16-compatible template, writes a `.openyida-page.json` manifest, and optionally compiles the result. The manifest makes follow-up AI edits safer because agents can update known blocks instead of rewriting a large JSX file by hand.

### Workflow, Data, and Permissions

```bash
openyida create-process APP_XXX "Purchase Request" fields.json process.json
openyida configure-process APP_XXX FORM_XXX process.json
openyida process preview APP_XXX PROC_INST_XXX --output process.html
openyida data query form APP_XXX FORM_XXX --page 1 --size 20
openyida get-permission APP_XXX FORM_XXX
```

### Connectors, Integrations, and Reports

```bash
openyida connector smart-create --curl "curl https://api.example.com/users"
openyida connector list
openyida integration create APP_XXX FORM_XXX "Sync customer data"
openyida create-report APP_XXX "Sales Dashboard" charts.json
openyida append-chart APP_XXX REPORT_XXX chart.json
```

## CLI Reference

Run `openyida --help` or `openyida <command> --help` for detailed usage.

### Environment and Authentication

| Command | Description |
|---------|-------------|
| `openyida env [--json]` | Detect the active AI tool environment and login state |
| `openyida env <list\|show\|switch\|add\|remove>` | Manage public/private Yida environment profiles |
| `openyida commands [--json]` | Emit the machine-readable command manifest |
| `openyida login [--qr\|--browser] [--corp-id <corpId>]` | Log in to Yida |
| `openyida logout` | Log out or switch account |
| `openyida auth <status\|login\|refresh\|logout>` | Manage login status |
| `openyida org list` | List accessible organizations |
| `openyida org switch --corp-id <corpId>` | Switch organization without logging in again |

### Applications

| Command | Description |
|---------|-------------|
| `openyida app-list [--size N]` | List Yida applications |
| `openyida create-app "<name>" [options]` | Create an application and output `appType` |
| `openyida update-app <appType> --name "..."` | Update application metadata |
| `openyida export <appType> [output]` | Export an application migration package |
| `openyida import <file> [name]` | Import a migration package into a target environment |

### Forms and Pages

| Command | Description |
|---------|-------------|
| `openyida create-form create <appType> "<name>" <fields.json>` | Create a form page |
| `openyida create-form update <appType> <formUuid> <changes.json>` | Update a form page |
| `openyida list-forms <appType> [--keyword <text>]` | List forms in an application |
| `openyida get-schema <appType> <formUuid\|--all>` | Fetch one form schema or batch export all schemas |
| `openyida create-page <appType> "<name>"` | Create a custom display page |
| `openyida generate-page <template> [--spec file]` | Generate custom page source from templates |
| `openyida check-page <sourceFile> [--json]` | Check page compatibility with Yida runtime rules |
| `openyida compile <sourceFile>` | Compile a custom page locally |
| `openyida publish <sourceFile> <appType> <formUuid>` | Compile and publish a custom page |
| `openyida update-form-config <appType> <formUuid> <isRenderNav> <title>` | Update page/form display configuration |

### Data, Permissions, and Sharing

| Command | Description |
|---------|-------------|
| `openyida data <action> <resource> [args]` | Unified data management for forms, processes, tasks, and subforms |
| `openyida data check <appType> <formUuid> <rules.json>` | Detect anomalous process-form records |
| `openyida task-center <type> [options]` | Query todo, created, processed, CC, or proxy-submitted tasks |
| `openyida get-permission <appType> <formUuid>` | Query form permission configuration |
| `openyida save-permission <appType> <formUuid> [options]` | Save form permission configuration |
| `openyida verify-short-url <appType> <formUuid> <url>` | Verify a short URL |
| `openyida save-share-config <appType> <formUuid> <url> <isOpen> [openAuth]` | Save public access or sharing configuration |
| `openyida get-page-config <appType> <formUuid>` | Query public access or sharing configuration |

### Workflow, Reports, and Integrations

| Command | Description |
|---------|-------------|
| `openyida create-process <appType> ...` | Create a process form and configure workflow |
| `openyida configure-process <appType> ...` | Configure and publish process rules |
| `openyida process preview <appType> <processInstanceId> [--output <path>]` | Generate a visual process preview |
| `openyida create-report <appType> "<name>" <charts.json>` | Create a Yida report |
| `openyida append-chart <appType> <reportId> <charts.json>` | Append a chart to an existing report |
| `openyida connector <sub-command>` | Manage HTTP connectors, actions, tests, and auth accounts |
| `openyida integration create <appType> <formUuid> <flowName> [options]` | Create an integration automation flow |
| `openyida dws <command> [args]` | Access DingTalk CLI capabilities such as contacts, calendar, todo, and approval |

### Utilities

| Command | Description |
|---------|-------------|
| `openyida copy [--force]` | Initialize the local `project/` workspace |
| `openyida sample [--list]` | Emit sample templates |
| `openyida doctor [--fix]` | Diagnose and repair environment issues |
| `openyida formula evaluate <formula\|file> [--schema file]` | Static-check formula syntax and field references |
| `openyida update` | Update OpenYida through npm |
| `openyida export-conversation [options]` | Export AI conversation history |
| `openyida flash-to-prd --file <path> --name "<project>"` | Convert flash notes or meeting notes into a PRD prompt |
| `openyida cdn-config` | Configure image upload to Aliyun OSS/CDN |
| `openyida cdn-upload <image-path>` | Upload an image to CDN |
| `openyida cdn-refresh [options]` | Refresh CDN cache |

## Agent Skills

The `yida-skills/` directory contains agent-facing instructions and references for common Yida workflows. It is organized as a small skill library:

| Path | Purpose |
|------|---------|
| `yida-skills/SKILL.md` | Entry point and skill index |
| `yida-skills/skills/` | Self-contained sub-skills for app, form, process, page, data, and integration work |
| `yida-skills/references/` | Shared Yida API, model API, and query-condition references |

When OpenYida is used inside a supported AI coding environment, these skills help the agent choose the right command sequence and file conventions.

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
| `npm run check:syntax` | Validate JavaScript syntax |
| `npm run check:structure` | Validate project structure |
| `npm run check:package` | Validate npm package contents |

When adding new CLI commands, register the route in `bin/yida.js`, add it to `lib/core/command-manifest.js`, update user-facing documentation here, and keep agent skills in `yida-skills/` aligned when the workflow changes.

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

<p align="left">
<a href="https://github.com/yize"><img align="left" src="https://avatars.githubusercontent.com/u/1578814?v=4&s=40" width="40" height="40" alt="九神" title="九神"/></a>
<a href="https://github.com/alex-mm"><img align="left" src="https://avatars.githubusercontent.com/u/3302053?v=4&s=40" width="40" height="40" alt="天晟" title="天晟"/></a>
<a href="https://github.com/nicky1108"><img align="left" src="https://avatars.githubusercontent.com/u/4279283?v=4&s=40" width="40" height="40" alt="nicky1108" title="nicky1108"/></a>
<a href="https://github.com/angelinheys"><img align="left" src="https://avatars.githubusercontent.com/u/49426983?v=4&s=40" width="40" height="40" alt="angelinheys" title="angelinheys"/></a>
<a href="https://github.com/yipengmu"><img align="left" src="https://avatars.githubusercontent.com/u/3232735?v=4&s=40" width="40" height="40" alt="yipengmu" title="yipengmu"/></a>
<a href="https://github.com/Waawww"><img align="left" src="https://avatars.githubusercontent.com/u/31886449?v=4&s=40" width="40" height="40" alt="Waawww" title="Waawww"/></a>
<a href="https://github.com/kangjiano"><img align="left" src="https://avatars.githubusercontent.com/u/54129385?v=4&s=40" width="40" height="40" alt="kangjiano" title="kangjiano"/></a>
<a href="https://github.com/ElZe98"><img align="left" src="https://avatars.githubusercontent.com/u/35736727?v=4&s=40" width="40" height="40" alt="ElZe98" title="ElZe98"/></a>
<a href="https://github.com/OAHyuhao"><img align="left" src="https://avatars.githubusercontent.com/u/99954323?v=4&s=40" width="40" height="40" alt="OAHyuhao" title="OAHyuhao"/></a>
<a href="https://github.com/xiaofu704"><img align="left" src="https://avatars.githubusercontent.com/u/209416122?v=4&s=40" width="40" height="40" alt="xiaofu704" title="xiaofu704"/></a>
<a href="https://github.com/guchenglin111"><img align="left" src="https://avatars.githubusercontent.com/u/10860875?v=4&s=40" width="40" height="40" alt="guchenglin111" title="guchenglin111"/></a>
<a href="https://github.com/liug0911"><img align="left" src="https://avatars.githubusercontent.com/u/1578814?v=4&s=40" width="40" height="40" alt="LIUG" title="LIUG"/></a>
<a href="https://github.com/sunliz-xiuli"><img align="left" src="https://avatars.githubusercontent.com/u/76982855?v=4&s=40" width="40" height="40" alt="sunliz-xiuli" title="sunliz-xiuli"/></a>
<a href="https://github.com/M12REDX"><img align="left" src="https://avatars.githubusercontent.com/u/22703542?v=4&s=40" width="40" height="40" alt="M12REDX" title="M12REDX"/></a>
<a href="https://github.com/key-668"><img align="left" src="https://avatars.githubusercontent.com/u/270536058?v=4&s=40" width="40" height="40" alt="再不喝汽水" title="再不喝汽水"/></a>
<br clear="left" />
</p>

## License

[MIT](./LICENSE) © 2026 Alibaba Group Holding Limited
