<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Build Yida low-code apps with AI — zero config, instant deploy.**

[Get Started](#get-started) · [Codex Support](#codex-support) · [CLI Commands](#cli-commands) · [Demo](https://www.aliwork.com/o/OpenYidaAppShowcase) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Languages:**
[English](https://openyida.ai/docs/en) · [简体中文](https://openyida.ai/docs) · [繁體中文（香港）](https://openyida.ai/docs/zh-Hant/) · [日本語](https://openyida.ai/docs/ja/) · [한국어](https://openyida.ai/docs/ko/) · [Français](https://openyida.ai/docs/fr/) · [Deutsch](https://openyida.ai/docs/de/) · [Español](https://openyida.ai/docs/es/) · [Português (BR)](https://openyida.ai/docs/pt/) · [Tiếng Việt](https://openyida.ai/docs/vi/) · [हिन्दी](https://openyida.ai/docs/hi/) · [العربية](https://openyida.ai/docs/ar/)

</div>

---

## Get Started

```bash
npm install -g openyida
```

**Zero config, works out of the box.** After installation, just chat in Codex / Claude Code / OpenCode / Aone Copilot:

### Wukong Installation

Wukong uses manual skill package installation instead of npm:

1. Download the latest skill package (`.zip`) from [GitHub Releases](https://github.com/openyida/openyida/releases)
2. Open Wukong → **Skill Center** → **Upload Skill**, then select the downloaded package



```
Build me an IPD system on Yida to manage the full chip production workflow
Help me set up a CRM
Create a personal salary calculator app
```

---

## Supported AI Coding Tools

| Tool | Status |
|------|--------|
| [Codex](https://openai.com/codex/) | ✅ Full support |
| [Claude Code](https://claude.ai/code) | ✅ Full support |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Full support |
| [OpenCode](https://opencode.ai) | ✅ Full support |
| [Cursor](https://cursor.com/) | ✅ Full support |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Full support |
| [Qoder](https://qoder.com) | ✅ Full support |
| [Wukong](https://dingtalk.com/wukong) | ✅ Full support |

---

## Codex Support

OpenYida runs directly in Codex. It detects the Codex environment and uses Codex-friendly login behavior by default:

```bash
openyida env
openyida login
```

In Codex, `openyida login` first reuses cached credentials. If no valid cache exists, it enters Codex browser login mode, so you can sign in with the Codex in-app browser without installing Playwright or a separate Chromium.

```bash
openyida login --codex
```

If you specifically want terminal QR login, use `--qr`. For accounts with multiple DingTalk/Yida organizations, pass `--corp-id` to choose the organization explicitly instead of relying on an interactive prompt:

```bash
openyida login --qr
openyida login --qr --corp-id dingxxxxxxxx
```

After login, continue using normal OpenYida commands from the Codex terminal, for example `openyida create-app`, `openyida generate-page`, `openyida compile`, and `openyida publish`.

---

## How OpenYida Differs from Other AI App Builders

| Dimension | OpenYida | Other AI App Builders |
|-----------|----------|-----------------------|
| Target users | Developers (code-savvy) | Business users (non-developers) |
| Interaction | Natural language + AI chat | Visual drag-and-drop + config panels |
| Output | Yida app (editable, full low-code capabilities) | Config (black-box execution) |
| Deployment | Yida platform | Locked to SaaS platform |
| AI model | Choose the best model for the job | Platform-specified, not swappable |
| Security & compliance | Yida's enterprise-grade security | Platform-dependent |

---

## Requirements

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥ 18 | CLI runtime & page publishing |

---

## CLI Commands

```bash
openyida append-chart         # Append chart to an existing report
openyida app-list             # List my Yida applications
openyida auth                 # Login status management (status/login/refresh/logout)
openyida cdn-config           # Configure CDN image upload (Aliyun OSS + CDN)
openyida cdn-refresh          # Refresh CDN cache
openyida cdn-upload           # Upload images to CDN
openyida check-page           # Check a custom page against Yida runtime rules
openyida configure-process    # Configure and publish process rules
openyida connector            # HTTP connector management
openyida compile              # Compile a custom page locally without publishing
openyida copy                 # Initialize project working directory for current AI tool
openyida create-app           # Create a Yida application
openyida create-form          # Create / update a form page
openyida create-page          # Create a custom display page
openyida create-process       # Create a process form (integrated)
openyida create-report        # Create a Yida report
openyida process preview      # Preview process instance (generate visual flowchart)
openyida data                 # Unified data management (form/process/task/subform)
openyida data check <appType> <formUuid> <rules.json> [options]  # Detect anomalous records in process forms based on custom rules
openyida doctor               # Environment diagnostics and auto-repair
openyida dws <command> [args]                              # DingTalk CLI (Contacts/Calendar/Todo/Approval, etc.)
openyida env                  # Detect current AI tool environment and login status
openyida export               # Export application migration package
openyida export-conversation [format]                      # Export AI conversation history
openyida flash-to-prd <appType> [options]                  # Flash note to PRD (supports meeting recognition)
openyida get-page-config      # Query page public access / sharing config
openyida get-permission       # Query form permission configuration
openyida get-schema           # Fetch form schema
openyida generate-page        # Generate a custom page from curated templates
openyida import               # Import migration package to rebuild application
openyida integration create <appType> [options]             # Create integration & automation flow
openyida login                # Log in to Yida (Codex uses in-app browser when needed)
openyida login --codex        # Force Codex in-app browser login (no Playwright)
openyida login --qr           # Force terminal QR login
openyida login --qr --corp-id <corpId>  # Terminal QR login with explicit organization
openyida logout               # Log out / switch account
openyida org                  # Organization management (list/switch)
openyida publish              # Compile and publish a custom page
openyida query-data           # Query form instance data
openyida sample               # Output code samples/templates
openyida save-permission      # Save form permission configuration
openyida save-share-config    # Save public access / sharing config
openyida task-center [filter]                              # Global task center (Todo/Created/Processed/CC/Submit)
openyida update-form-config   # Update form configuration
openyida verify-short-url     # Verify if a short URL is accessible
```

---

## AI Page Generation

For custom pages, prefer structured specs over hand-written JSX when possible. `generate-page` normalizes a small spec into a Page IR, renders a curated React 16-compatible `.jsx` template, writes a `.openyida-page.json` manifest next to the source, then runs the Yida page linter and optional local compile.

```bash
openyida generate-page product-homepage --spec page.json --output pages/src/home.jsx --compile
```

The manifest makes follow-up edits faster: AI agents can update blocks such as `hero`, `feature-grid`, `metric-strip`, `roadmap`, and `cta`, then regenerate instead of rewriting a large JSX file by hand.

---

## Demo

### 🏢 Business Systems — IPD / CRM

Describe your requirements in one sentence — AI generates a complete multi-form business system.

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 Utilities — Personal Salary Calculator

![Salary Calculator](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — Enterprise Collaboration

Generate a complete enterprise product landing page from a single sentence.

![Enterprise Collaboration](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 Campaigns — Lantern Riddle Game

AI generates riddle images; users guess answers with humorous AI feedback on wrong guesses.

![Lantern Riddle Game](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## Common Prompts

```
Build me a [xxx] application
Generate an app from this requirements document
Create a [xxx] form page
Add a [xxx] field to [xxx] page, field name: [name], type: [type]
Make the [xxx] field on [xxx] page required
Publish the [xxx] page
Make the page publicly accessible
Re-login / log out
```

---

## OpenClaw Integration

Use via [yida-app](https://clawhub.ai/nicky1108/yida-app) in OpenClaw:

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## Community

Scan the QR code to join the OpenYida user group on DingTalk for the latest updates and support.

![Join OpenYida Community](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## Contributors

Thanks to everyone who has contributed to OpenYida! Read the [Contributing Guide](./CONTRIBUTING.md) to get involved.

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

---

## License

[MIT](./LICENSE) © 2026 Alibaba Group
