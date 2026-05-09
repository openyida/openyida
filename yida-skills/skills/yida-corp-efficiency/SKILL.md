---
name: yida-corp-efficiency
description: >
  宜搭平台管理企业效能技能。用于查询 https://www.aliwork.com/platformManage/corpEfficiency
  对应的企业效能概览、节省预算/时间、低代码学习与认证成果、效能指标、明细报表链接，以及搜索通知群并在明确确认后发送学习/认证通知。
  当用户提到"企业效能"、"corpEfficiency"、"效能数据"、"低代码学习成果"、"效能分析明细"时使用。
---

# 宜搭企业效能

通过 `openyida corp-efficiency` 封装平台管理的企业效能页面能力。不要通过浏览器点击页面来抓取数据；优先使用 CLI 的稳定接口输出。

## 前置检查

执行任何操作前先确认环境和登录态：

```bash
openyida env --json
openyida login --check-only --json
```

如果未登录，先执行 `openyida login` 并在登录成功后重试。

## 查询企业效能概览

```bash
openyida corp-efficiency
openyida corp-efficiency overview --locale zh_CN
openyida corp-efficiency overview --locale en_US --raw
```

输出为 JSON，核心字段：

| 字段 | 说明 |
|------|------|
| `corpId` / `corpName` | 当前组织 |
| `overview` | 企业效能概览、是否达参考标准、节省预算和开发天数 |
| `learning` | 低代码学习完成人数、开发者认证人数 |
| `performance.metrics` | 效能指标列表，含当前值、行业参考值、百分比、是否高于参考值 |
| `performance.metrics[].detailReportFullUrl` | 对应明细报表完整链接 |
| `commodity` | 组织版本和资源使用摘要，不包含敏感 token |

## 搜索通知群

```bash
openyida corp-efficiency groups --query "项目群" --page 1 --size 20
```

用于找到可接收学习/认证通知的钉钉群，返回 `cid` 和群名称。

## 发送学习/认证通知

发送通知会触达真实钉钉群，必须先向用户确认目标群和通知类型，再添加 `--yes`。

```bash
openyida corp-efficiency notify --cid <群ID> --type noticeStudy --yes
openyida corp-efficiency notify --cid <群ID> --type noticeCertify --yes
openyida corp-efficiency notify --cid <群ID> --type completeStudy --yes
```

支持的 `--type`：

| 类型 | 页面含义 |
|------|----------|
| `noticeStudy` | 通知学习 |
| `noticeCertify` | 通知认证 |
| `completeStudy` | 分享学习 |

## 注意事项

- 默认查询命令是只读操作，可以直接执行。
- `notify` 是外部可见动作；没有用户明确确认时不要执行。
- 页面中的“查看明细”对应输出里的 `detailReportFullUrl`，可直接返回给用户。
- 如需排查接口结果，使用 `--raw`，但不要要求用户打开 Chrome 页面人工复制数据。
