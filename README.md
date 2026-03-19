<div align="center">

![OpenYida](https://img.alicdn.com/imgextra/i4/O1CN017uyK3q1UUfbv7Z8oh_!!6000000002521-2-tps-2648-1382.png)

# 🚀 OpenYida

> *"We are on the verge of the Singularity"* — Vernor Vinge

**Build Yida low-code apps with AI — zero config, instant deploy.**

[快速开始](#快速开始) · [CLI 命令](#cli-命令一览) · [Demo](#demo-展示) · [贡献指南](./CONTRIBUTING.md) · [更新日志](./CHANGELOG.md)

[![npm version](https://img.shields.io/npm/v/openyida?color=brightgreen&label=npm)](https://www.npmjs.com/package/openyida)
[![npm downloads](https://img.shields.io/npm/dm/openyida?color=blue)](https://www.npmjs.com/package/openyida)
[![CI](https://github.com/openyida/openyida/actions/workflows/ci.yml/badge.svg)](https://github.com/openyida/openyida/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥18](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

</div>

---

## 快速开始

```bash
npm install -g openyida
```

**安装即用，零配置。** 安装后在 Claude Code / OpenCode / Aone Copilot 中直接对话：

```
帮我用宜搭创建一个 IPD 系统，需要管理芯片生产全流程
帮我搭建一个 CRM
帮我搭建个人薪资计算器应用
```

---

## 支持的 AI 编程工具

| 工具 | 支持状态 |
|------|----------|
| [Claude Code](https://claude.ai/code) | ✅ 完整支持 |
| [Aone Copilot](https://copilot.code.alibaba-inc.com) | ✅ 完整支持 |
| [OpenCode](https://opencode.ai) | ✅ 完整支持 |
| [Cursor](https://cursor.com/) | ✅ 完整支持 |
| [Visual Studio Code](https://code.visualstudio.com/) | ✅ 完整支持 |
| [Qoder](https://qoder.com) | ✅ 完整支持 |
| [悟空](https://dingtalk.com/wukong) | ✅ 完整支持 |

---

## 与其他 AI 搭建平台的区别

| 维度 | OpenYida | 其他 AI 搭建平台 |
|------|----------|------------------|
| 目标用户 | 开发者（懂代码的人） | 业务人员（非开发者） |
| 交互方式 | 自然语言 + AI 对话 | 可视化拖拽 + 配置面板 |
| 产出物 | 宜搭应用（可二次编辑，支持完备低代码能力） | 配置（黑盒运行） |
| 部署方式 | 宜搭平台 | SaaS 平台绑定 |
| AI 模型 | 按需选择，选择最适合的模型 | 平台指定，无法更换 |
| 安全合规 | 宜搭具备完善的安全和合规能力 | 依赖平台能力（纯代码应用需重新审查） |

---

## 依赖环境

| 依赖 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | ≥ 18 | CLI 运行、页面发布 |

---

## CLI 命令一览

```bash
openyida env                  # 检测当前 AI 工具环境和登录态
openyida login                # 登录宜搭（优先缓存，否则扫码）
openyida logout               # 退出登录 / 切换账号
openyida copy                 # 初始化 project 工作目录到当前 AI 工具环境
openyida create-app           # 创建宜搭应用
openyida create-page          # 创建自定义展示页面
openyida create-form          # 创建 / 更新表单页面
openyida get-schema           # 获取表单 Schema
openyida publish              # 编译并发布自定义页面
openyida verify-short-url     # 验证短链接 URL 是否可用
openyida save-share-config    # 保存公开访问 / 分享配置
openyida get-page-config      # 查询页面公开访问 / 分享配置
openyida update-form-config   # 更新表单配置
openyida cdn-config           # 配置 CDN 图片上传（阿里云 OSS + CDN）
openyida cdn-upload           # 上传图片到 CDN
openyida cdn-refresh          # 刷新 CDN 缓存
```

---

## Demo 展示

### 🏢 业务系统 — IPD / CRM

一句话描述需求，AI 自动生成完整的多表单业务系统。

![IPD](https://img.alicdn.com/imgextra/i2/O1CN01YBEMa929J7sD9v8U1_!!6000000008046-2-tps-3840-3366.png)

![CRM](https://img.alicdn.com/imgextra/i3/O1CN01kn0Vcn1H5OkbQaizA_!!6000000000706-2-tps-3840-2168.png)

### 💰 小工具 — 个人薪资计算器

![薪资计算器](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

### 🌐 Landing Page — 智联协同

企业级产品介绍页，一句话生成完整 Landing Page。

![智联协同](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

### 🏮 运营场景 — 看图猜灯谜

AI 生成灯谜图片，用户猜答案，猜错了有 AI 幽默提示。

![看图猜灯谜](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## 常用问法

```
帮我搭建一个 xxx 应用
根据需求文档生成应用
帮我创建一个 xxx 表单页面
帮我给 xxx 页面添加一个 xxx 字段，字段名称：字段类型 xxx
帮我给 xxx 页面 xxx 字段改为必填
帮我发布 xxx 页面
帮我把页面发布为公开访问
重新登录 / 退出登录
```

---

## OpenClaw 集成

通过 [yida-app](https://clawhub.ai/nicky1108/yida-app) 在 OpenClaw 中使用：

```bash
npx clawhub@latest install nicky1108/yida-app
```

---

## 社区

钉钉扫码加入 OpenYida 用户群，获取最新动态和技术支持。

![扫描加入 OpenYida 社区](https://img.alicdn.com/imgextra/i4/O1CN01RAlxmO1qF1cxRguyj_!!6000000005465-2-tps-350-356.png)

---

## 贡献者

感谢所有为 OpenYida 做出贡献的开发者！欢迎阅读 [贡献指南](./CONTRIBUTING.md) 参与共建。

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
</p>

---

## License

[MIT](./LICENSE) © 2026 Alibaba Group
