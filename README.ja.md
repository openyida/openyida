<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**AIでYida低コードプラットフォームを操作 — ゼロ設定、即時デプロイ。**

[はじめに](#はじめに) · [CLIコマンド](#cliコマンド一覧) · [デモ](#デモ) · [コントリビュート](./CONTRIBUTING.md) · [変更履歴](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

**言語：**
[English](./README.md) · [简体中文](./README.zh-CN.md) · [繁體中文（台灣）](./README.zh-TW.md) · [繁體中文（香港）](./README.zh-HK.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português (BR)](./README.pt-BR.md) · [Tiếng Việt](./README.vi.md) · [हिन्दी](./README.hi.md) · [العربية](./README.ar.md)

</div>

---

## はじめに

```bash
npm install -g openyida
```

**ゼロ設定、インストールしてすぐ使える。** インストール後、Claude Code / OpenCode / Aone Copilot で直接会話するだけ：

```
Yidaでチップ生産の全工程を管理するIPDシステムを作って
CRMシステムを構築して
個人給与計算アプリを作って
```

---

## 対応AIコーディングツール

| ツール | サポート状況 |
|--------|-------------|
| [Claude Code](https://claude.ai/code) | ✅ 完全対応 |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ 完全対応 |
| [OpenCode](https://opencode.ai) | ✅ 完全対応 |
| [Cursor](https://cursor.com/) | ✅ 完全対応 |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ 完全対応 |
| [Qoder](https://qoder.com) | ✅ 完全対応 |
| [Wukong](https://dingtalk.com/wukong) | ✅ 完全対応 |

---

## 他のAIアプリビルダーとの違い

| 項目 | OpenYida | 他のAIアプリビルダー |
|------|----------|---------------------|
| 対象ユーザー | 開発者（コードが書ける人） | ビジネスユーザー（非開発者） |
| インタラクション | 自然言語 + AIチャット | ビジュアルドラッグ＆ドロップ |
| 出力物 | Yidaアプリ（編集可能、完全な低コード機能） | 設定（ブラックボックス実行） |
| デプロイ | Yidaプラットフォーム | SaaSプラットフォーム固定 |
| AIモデル | 最適なモデルを自由に選択 | プラットフォーム指定、変更不可 |
| セキュリティ | Yidaのエンタープライズグレードセキュリティ | プラットフォーム依存 |

---

## 動作環境

| 依存関係 | バージョン | 用途 |
|----------|-----------|------|
| Node.js | ≥ 18 | CLI実行・ページ公開 |

---

## CLIコマンド一覧

```bash
openyida append-chart         # 既存レポートにチャートを追加
openyida auth                 # ログイン状態管理（status/login/refresh/logout）
openyida cdn-config           # CDN画像アップロードを設定（Aliyun OSS + CDN）
openyida cdn-refresh          # CDNキャッシュを更新
openyida cdn-upload           # CDNに画像をアップロード
openyida configure-process    # プロセスルールを設定・公開
openyida connector            # HTTPコネクタ管理
openyida copy                 # 現在のAIツール環境にprojectディレクトリを初期化
openyida create-app           # Yidaアプリを作成
openyida create-form          # フォームページを作成 / 更新
openyida create-page          # カスタム表示ページを作成
openyida create-process       # プロセスフォームを作成（統合型）
openyida create-report        # Yidaレポートを作成
openyida data                 # 統一データ管理（フォーム/プロセス/タスク/サブフォーム）
openyida doctor               # 環境診断と自動修復
openyida env                  # 現在のAIツール環境とログイン状態を確認
openyida export               # アプリ移行パッケージをエクスポート
openyida get-page-config      # ページの公開アクセス / 共有設定を照会
openyida get-permission       # フォーム権限設定を照会
openyida get-schema           # フォームスキーマを取得
openyida import               # 移行パッケージをインポートしてアプリを再構築
openyida login                # Yidaにログイン（キャッシュ優先、なければQRコード）
openyida logout               # ログアウト / アカウント切り替え
openyida org                  # 組織管理（list/switch）
openyida publish              # カスタムページをコンパイルして公開
openyida query-data           # フォームインスタンスデータを照会
openyida save-permission      # フォーム権限設定を保存
openyida save-share-config    # 公開アクセス / 共有設定を保存
openyida update-form-config   # フォーム設定を更新
openyida verify-short-url     # 短縮URLが利用可能か確認
```

---

## デモ

### 🏢 業務システム — IPD / CRM

一言で要件を伝えるだけで、AIが完全なマルチフォーム業務システムを自動生成。

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 ユーティリティ — 給与計算ツール

![給与計算ツール](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 ランディングページ — エンタープライズコラボレーション

一文でエンタープライズ製品の完全なランディングページを生成。

![エンタープライズコラボレーション](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 キャンペーン — 灯籠謎々ゲーム

AIが謎々画像を生成し、ユーザーが答えを推測。間違えるとAIがユーモラスなフィードバック。

![灯籠謎々ゲーム](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## よく使うプロンプト

```
[xxx]アプリを作って
この要件書からアプリを生成して
[xxx]フォームページを作って
[xxx]ページに[xxx]フィールドを追加して、フィールド名：[名前]、タイプ：[タイプ]
[xxx]ページの[xxx]フィールドを必須にして
[xxx]ページを公開して
ページを公開アクセス可能にして
再ログイン / ログアウト
```

---

## OpenClaw連携

OpenClawで [yida-app](https://clawhub.ai/nicky1108/yida-app) を使用：

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## コミュニティ

DingTalkのQRコードをスキャンしてOpenYidaユーザーグループに参加し、最新情報とサポートを受けましょう。

![OpenYidaコミュニティに参加](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## コントリビューター

OpenYidaに貢献してくださったすべての方に感謝します！[コントリビュートガイド](./CONTRIBUTING.md)をお読みください。

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

## ライセンス

[MIT](./LICENSE) © 2026 Alibaba Group
