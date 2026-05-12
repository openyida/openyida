# DWS / 钉钉 CLI 集成相关 PR

## 改动概述

<!-- 请说明本 PR 对 `openyida dws`、钉钉 CLI 集成、相关文档或测试做了什么调整，以及为什么需要该调整。 -->

## 改动类型

- [ ] ✨ 新增 DWS 能力
- [ ] 🐛 修复 DWS 集成问题
- [ ] ♻️ 重构 DWS 包装器或命令转发逻辑
- [ ] 📝 更新 DWS 使用文档
- [ ] 🧪 补充或调整 DWS 测试
- [ ] 🔧 调整安装检测、依赖或 CI 配置
- [ ] 🌐 更新用户可见文案或 i18n

## 影响范围

<!-- 请勾选本 PR 涉及的模块。 -->

- [ ] `lib/dws/dws-wrapper.js`
- [ ] `bin/yida.js` 命令路由或帮助信息
- [ ] `lib/core/command-manifest.js` 命令清单
- [ ] `lib/core/locales/` 国际化文案
- [ ] `docs/dws-*` 文档
- [ ] `tests/dws-integration.test.js` 或相关测试
- [ ] `scripts/demo-dws.sh` 或演示脚本
- [ ] `README.md` / `CHANGELOG.md`
- [ ] 其他：

## 功能与行为说明

<!-- 如涉及命令行为变化，请写清楚命令、参数、输出格式、错误处理和兼容策略。 -->

```bash
openyida dws ...
```

## DWS 安装与运行环境

- [ ] 已验证系统未安装 DWS 时的提示或安装引导
- [ ] 已验证系统已安装 DWS 时的版本检测与命令透传
- [ ] 已验证 macOS / Linux / Windows 兼容性，或说明不适用原因
- [ ] 如涉及网络请求，已说明对钉钉开放平台、GitHub Releases 或代理环境的要求
- [ ] 如涉及企业数据访问，已说明授权、凭证和权限边界

## Agent 与 JSON 输出

- [ ] 面向 AI Agent 的输出保持结构化、稳定且可解析
- [ ] 涉及 `-f json` / `--json` 时，已验证成功与失败场景
- [ ] 错误信息可读且不泄露 Client Secret、Token、Cookie 等敏感信息
- [ ] 如命令适合 Agent 调用，已更新命令清单或相关技能说明

## 测试与验证

<!-- 请勾选已完成项，并在下方粘贴关键输出。 -->

- [ ] `npm run lint`
- [ ] `npm run test:unit -- tests/dws-integration.test.js --runInBand`
- [ ] `node --check lib/dws/dws-wrapper.js`
- [ ] `openyida dws --help`
- [ ] `openyida dws <service> <command> -f json`（如适用）
- [ ] 真实钉钉 CLI 环境验证（如适用）

```text
请粘贴关键验证输出，注意脱敏企业 ID、用户 ID、Token、Cookie 等敏感信息。
```

## 兼容性与风险

- [ ] 不影响非 DWS 命令
- [ ] 不引入新的 npm 运行时依赖，或已说明必要性
- [ ] 不改变既有 DWS 命令透传语义，或已提供兼容方案
- [ ] 对安装失败、权限不足、网络异常和 DWS 命令退出码有明确处理

## 文档更新

- [ ] 更新 `README.md` 中的命令说明（如适用）
- [ ] 更新 `docs/dws-cli-guide.md` / `docs/dws-quick-start.md`（如适用）
- [ ] 更新 `CHANGELOG.md`（如面向发布）
- [ ] 更新 Agent 技能或参考文档（如影响 Agent 使用方式）

## 关联 Issue / 背景

<!-- 如有关联 Issue，请填写：Closes #123；如来自内部讨论或需求，请补充链接。 -->

## Reviewer 关注点

<!-- 请列出需要重点 review 的地方，例如安装策略、跨平台路径、JSON 输出兼容性、权限边界等。 -->
