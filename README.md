<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Build Yida low-code apps with AI — zero config, instant deploy.**

[Get Started](#get-started) · [CLI Commands](#cli-commands) · [Demo](#demo) · [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**Languages:**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## Get Started

```bash
npm install -g openyida
```

**Zero config, works out of the box.** After installation, just chat in Claude Code / OpenCode / Aone Copilot:

```
Build me an IPD system on Yida to manage the full chip production workflow
Help me set up a CRM
Create a personal salary calculator app
```

---

## Supported AI Coding Tools

| Tool | Status |
|------|--------|
| [Claude Code](https://claude.ai/code) | ✅ Full support |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ Full support |
| [OpenCode](https://opencode.ai) | ✅ Full support |
| [Cursor](https://cursor.com/) | ✅ Full support |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ Full support |
| [Qoder](https://qoder.com) | ✅ Full support |
| [Wukong](https://dingtalk.com/wukong) | ✅ Full support |

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
openyida auth                 # Login status management (status/login/refresh/logout)
openyida cdn-config           # Configure CDN image upload (Aliyun OSS + CDN)
openyida cdn-refresh          # Refresh CDN cache
openyida cdn-upload           # Upload images to CDN
openyida configure-process    # Configure and publish process rules
openyida connector            # HTTP connector management
openyida copy                 # Initialize project working directory for current AI tool
openyida create-app           # Create a Yida application
openyida create-form          # Create / update a form page
openyida create-page          # Create a custom display page
openyida create-process       # Create a process form (integrated)
openyida create-report        # Create a Yida report
openyida data                 # Unified data management (form/process/task/subform)
openyida doctor               # Environment diagnostics and auto-repair
openyida env                  # Detect current AI tool environment and login status
openyida export               # Export application migration package
openyida get-page-config      # Query page public access / sharing config
openyida get-permission       # Query form permission configuration
openyida get-schema           # Fetch form schema
openyida import               # Import migration package to rebuild application
openyida login                # Log in to Yida (uses cache, falls back to QR code)
openyida logout               # Log out / switch account
openyida org                  # Organization management (list/switch)
openyida publish              # Compile and publish a custom page
openyida query-data           # Query form instance data
openyida save-permission      # Save form permission configuration
openyida save-share-config    # Save public access / sharing config
openyida update-form-config   # Update form configuration
openyida verify-short-url     # Verify if a short URL is accessible
```

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
  <a href="https://github.com/yize"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="九神" title="九神"/></a>
  <a href="https://github.com/alex-mm"><img src="https://avatars.githubusercontent.com/u/3302053?v=4&s=48" width="48" height="48" alt="天晟" title="天晟"/></a>
  <a href="https://github.com/nicky1108"><img src="https://avatars.githubusercontent.com/u/4279283?v=4&s=48" width="48" height="48" alt="nicky1108" title="nicky1108"/></a>
  <a href="https://github.com/angelinheys"><img src="https://avatars.githubusercontent.com/u/49426983?v=4&s=48" width="48" height="48" alt="angelinheys" title="angelinheys"/></a>
  <a href="https://github.com/yipengmu"><img src="https://avatars.githubusercontent.com/u/3232735?v=4&s=48" width="48" height="48" alt="yipengmu" title="yipengmu"/></a>
  <a href="https://github.com/Waawww"><img src="https://avatars.githubusercontent.com/u/31886449?v=4&s=48" width="48" height="48" alt="Waawww" title="Waawww"/></a>
  <a href="https://github.com/kangjiano"><img src="https://avatars.githubusercontent.com/u/54129385?v=4&s=48" width="48" height="48" alt="kangjiano" title="kangjiano"/></a>
  <a href="https://github.com/ElZe98"><img src="https://avatars.githubusercontent.com/u/35736727?v=4&s=48" width="48" height="48" alt="ElZe98" title="ElZe98"/></a>
  <a href="https://github.com/OAHyuhao"><img src="https://avatars.githubusercontent.com/u/99954323?v=4&s=48" width="48" height="48" alt="OAHyuhao" title="OAHyuhao"/></a>
  <a href="https://github.com/xiaofu704"><img src="https://avatars.githubusercontent.com/u/209416122?v=4&s=48" width="48" height="48" alt="xiaofu704" title="xiaofu704"/></a>
  <a href="https://github.com/guchenglin111"><img src="https://avatars.githubusercontent.com/u/10860875?v=4&s=48" width="48" height="48" alt="guchenglin111" title="guchenglin111"/></a>
  <a href="https://github.com/liug0911"><img src="https://avatars.githubusercontent.com/u/1578814?v=4&s=48" width="48" height="48" alt="LIUG" title="LIUG"/></a>
  <a href="https://github.com/sunliz-xiuli"><img src="https://avatars.githubusercontent.com/u/76982855?v=4&s=48" width="48" height="48" alt="sunliz-xiuli" title="sunliz-xiuli"/></a>
  <a href="https://github.com/M12REDX"><img src="https://avatars.githubusercontent.com/u/22703542?v=4&s=48" width="48" height="48" alt="M12REDX" title="M12REDX"/></a>
</p>

---

## License

[MIT](./LICENSE) © 2026 Alibaba Group
