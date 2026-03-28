<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**用 AI 驅動宜搭低代碼平台，零配置，即裝即用。**

[快速開始](#快速開始) · [CLI 指令](#cli-指令一覽) · [Demo](#demo-展示) · [貢獻指南](./CONTRIBUTING.md) · [更新日誌](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**語言：**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## 快速開始

```bash
npm install -g openyida
```

**即裝即用，零配置。** 安裝後喺 Claude Code / OpenCode / Aone Copilot 入面直接傾偈：

```
幫我用宜搭建立一個 IPD 系統，需要管理晶片生產全流程
幫我搭建一個 CRM
幫我搭建個人薪酬計算器應用
```

---

## 支援嘅 AI 編程工具

| 工具 | 支援狀態 |
|------|----------|
| [Claude Code](https://claude.ai/code) | ✅ 完整支援 |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ 完整支援 |
| [OpenCode](https://opencode.ai) | ✅ 完整支援 |
| [Cursor](https://cursor.com/) | ✅ 完整支援 |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ 完整支援 |
| [Qoder](https://qoder.com) | ✅ 完整支援 |
| [悟空](https://dingtalk.com/wukong) | ✅ 完整支援 |

---

## 同其他 AI 搭建平台嘅分別

| 維度 | OpenYida | 其他 AI 搭建平台 |
|------|----------|------------------|
| 目標用戶 | 開發者（識寫代碼嘅人） | 業務人員（非開發者） |
| 互動方式 | 自然語言 + AI 對話 | 可視化拖拽 + 配置面板 |
| 產出物 | 宜搭應用（可二次編輯，支援完備低代碼能力） | 配置（黑盒運行） |
| 部署方式 | 宜搭平台 | SaaS 平台綁定 |
| AI 模型 | 按需選擇，揀最適合嘅模型 | 平台指定，唔可以更換 |
| 安全合規 | 宜搭具備完善嘅安全同合規能力 | 依賴平台能力（純代碼應用需重新審查） |

---

## 環境需求

| 依賴 | 版本需求 | 用途 |
|------|----------|------|
| Node.js | ≥ 18 | CLI 運行、頁面發布 |

---

## CLI 指令一覽

```bash
openyida append-chart         # 向已有報表追加圖表
openyida auth                 # 登入狀態管理（status/login/refresh/logout）
openyida cdn-config           # 設定 CDN 圖片上傳（阿里雲 OSS + CDN）
openyida cdn-refresh          # 重新整理 CDN 快取
openyida cdn-upload           # 上傳圖片到 CDN
openyida configure-process    # 設定並發布流程規則
openyida connector            # HTTP 連接器管理
openyida copy                 # 初始化 project 工作目錄到目前 AI 工具環境
openyida create-app           # 建立宜搭應用
openyida create-form          # 建立 / 更新表單頁面
openyida create-page          # 建立自訂展示頁面
openyida create-process       # 建立流程表單（一體化）
openyida create-report        # 建立宜搭報表
openyida data                 # 統一資料管理（表單/流程/任務/子表單）
openyida doctor               # 環境診斷與自動修復
openyida env                  # 偵測目前 AI 工具環境同登入狀態
openyida export               # 匯出應用遷移包
openyida get-page-config      # 查詢頁面公開存取 / 分享設定
openyida get-permission       # 查詢表單權限設定
openyida get-schema           # 攞表單 Schema
openyida import               # 匯入遷移包，重建應用
openyida login                # 登入宜搭（優先快取，否則掃碼）
openyida logout               # 登出 / 切換帳號
openyida org                  # 組織管理（list/switch）
openyida publish              # 編譯並發布自訂頁面
openyida query-data           # 查詢表單實例資料
openyida save-permission      # 儲存表單權限設定
openyida save-share-config    # 儲存公開存取 / 分享設定
openyida update-form-config   # 更新表單設定
openyida verify-short-url     # 驗證短網址係咪可用
```

---

## Demo 展示

### 🏢 業務系統 — IPD / CRM

一句話描述需求，AI 自動生成完整嘅多表單業務系統。

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 小工具 — 個人薪酬計算器

![薪酬計算器](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — 智聯協同

企業級產品介紹頁，一句話生成完整 Landing Page。

![智聯協同](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 營銷場景 — 睇圖猜燈謎

AI 生成燈謎圖片，用戶猜答案，猜錯咗有 AI 幽默提示。

![睇圖猜燈謎](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## 常用問法

```
幫我搭建一個 xxx 應用
根據需求文件生成應用
幫我建立一個 xxx 表單頁面
幫我喺 xxx 頁面加一個 xxx 欄位，欄位名稱：欄位類型 xxx
幫我將 xxx 頁面 xxx 欄位改為必填
幫我發布 xxx 頁面
幫我將頁面發布為公開存取
重新登入 / 登出
```

---

## OpenClaw 整合

透過 [yida-app](https://clawhub.ai/nicky1108/yida-app) 喺 OpenClaw 入面使用：

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## 社群

釘釘掃碼加入 OpenYida 用戶群，獲取最新動態同技術支援。

![掃描加入 OpenYida 社群](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## 貢獻者

多謝所有為 OpenYida 做出貢獻嘅開發者！歡迎閱讀 [貢獻指南](./CONTRIBUTING.md) 參與共建。

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
