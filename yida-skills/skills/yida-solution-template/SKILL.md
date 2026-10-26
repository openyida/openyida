---
name: yida-solution-template
description: 仅供独立本地 Agent 在用户明确要求查询、AI 定制或启用宜搭方案中心模板时使用。提供模板详情、云端 AI 搭建入口、启用摘要和状态恢复；云端原生模板 AI 搭与普通应用创建继续走原流程，受管本地任务不使用本技能。
---

# 宜搭方案模板

## 选择技能

本技能和 CLI 仅供已识别的独立本地 Agent 使用；云端、网页关联的受管本地任务及未知环境不执行。CLI 先检查环境，再鉴权、请求和写记录。环境不明先看 `openyida env --json`，不通过切换目录、清除绑定或伪造变量绕过检查。

云端已注入 `templateReference` 或 `.resources/template-reference.md` 时，保留模板与用户需求，按原生任务读取参考 PRD，在当前绑定应用内继续搭建；不重新搜索模板、跳回首页或复制另一应用。

| 用户需求 | 使用技能 |
| --- | --- |
| 明确要求查询、AI 定制或启用宜搭方案中心模板，或继续已明确的模板任务 | 本技能，按用户要求的操作推进 |
| 未指定方案中心或模板的完整应用搭建 | `yida-app` |

普通应用创建沿用 `yida-app`，不默认搜索、推荐或启用方案模板，也不将模板作为创建失败的兜底。泛称“创建应用”“用个模板”“你决定”、引用模板作参考或只提供模板链接，都不等于要求操作方案中心模板；目标不明时先确认意图。

仅查询就止于查询；明确要求模板 AI 定制才提供 AI 搭建入口。启用、拒绝后的重试或另建一份，分别取得用户对该操作的明确授权。继续已有任务只沿用已确认的操作范围，不把查询或查看 AI 入口升级为启用授权。

## 查询并选择模板

先检查登录环境，再搜索模板、读取详情。将 `TPL_XXX` 替换为查询得到的模板 ID：

```bash
openyida login --check-only --json
openyida solution-template search --query '合同' --json
openyida solution-template detail TPL_XXX --json
```

用户明确要求使用方案模板搭建时，按其选择推进；使用方式不明时先确认：

| 使用方式 | 下一步 |
| --- | --- |
| 明确要求基于模板调整业务范围、字段、页面或流程 | 执行 `ai-build`，交付原生搭建链接，引导用户在该页补充定制需求并提交 |
| 明确要求原样启用所选模板 | 按下节展示摘要并启用 |

```bash
openyida solution-template ai-build TPL_XXX --json
```

`ai-build` 返回 `submissionAccepted=false`、`applicationVerified=false`，交付时说明“云端模板 AI 搭建入口已准备好”。本地命令只准备链接，由用户进入平台云端搭建页提交，不表示由本地 Agent 完成模板 AI 搭建。

## 展示摘要并启用

用户明确要求启用或复制所选方案模板，且允许创建应用、名称已明确时，先用 `prepare` 读取摘要，说明目标组织/环境、模板版本、名称、数据选择、当前账号创建的同名应用和已有请求。模板启用授权和参数齐全时继续执行；普通建应用授权、查询请求或模板详情中的复制源不代替启用授权。

```bash
openyida solution-template prepare TPL_XXX --name '合同管理' --with-data n --json
openyida solution-template enable TPL_XXX --name '合同管理' --with-data n --json
```

`--with-data n` 跳过示例数据，`y` 保留示例数据；按用户需求选择，同一次操作保持名称和数据选择一致。`prepare` 只读信息；`enable` 先保存本地请求记录，再提交一次复制请求。

摘要中的 `directEnableSupported` 表示模板有复制源；`enableEligibility=platform-decides-on-submit` 表示启用资格由平台在提交时判断。

`enable` 默认等待 10 秒，`status` 默认查询一次。用 `--wait 0-60` 设置只读等待预算，`--wait 0` 查询一次；等待期间按递增间隔查应用列表，超时或响应不完整也先尝试查询恢复。进度只描述已受理、待确认和已查到应用等事实；命令结束后停止查询。

## 根据结果继续操作

`submissionAccepted` 表示平台已受理；`applicationVerified` 表示本次查询已确认应用存在。`previouslyVerified` 和 `lastVerifiedAt` 保存历史创建证据。

| 返回结果 | 下一步 |
| --- | --- |
| `applicationVerified=true` | 返回原应用入口，按用户要求打开并验收 |
| `accepted`，应用尚未出现 | 保留已受理状态，使用原请求号继续查询 |
| `uncertain`，提交结果未知 | 保留原请求，使用 `status` 查询；`--retry` 对此状态也只查询 |
| `ambiguous`，出现多个候选应用 | 保留原请求，列出候选并核对应用身份 |
| `failed-before-submit`，平台明确拒绝 | 展示平台原因并结束本次尝试；`status` 和普通重复 `enable` 仅返回原拒绝原因，不认领后来出现的同名应用 |
| 应用查询失败 | 保留已受理状态与平台原因，按 `nextAction` 继续查询 |
| 历史 `completed`，本次 `applicationVerified=false` | 说明曾确认创建、本次可见性待确认，保留历史证据并继续查询 |

将以下命令的 `st-xxxxxxxx` 替换为启用结果中的 `requestId`：

```bash
openyida solution-template status st-xxxxxxxx --wait 10 --json
```

平台明确拒绝后，用户再次明确要求提交时，使用原模板、名称、数据选择和请求号，加 `--retry` 发起一次新尝试：

```bash
openyida solution-template enable TPL_XXX --name '合同管理' --with-data n --request-id st-xxxxxxxx --retry --json
```

已完成请求重复执行会返回原应用。用户明确要求另建一份时，使用新的 `--request-id`。

## 执行边界与完成标准

- 使用当前登录组织提交。登录、组织权限、版本权益、AI 额度和模板可用性由平台判断；本技能展示平台结果，保持当前组织及权限、权益设置。
- 模板搜索当前仅查询非 SaaS 模板；未查到不代表方案中心不存在其他类型的方案。
- 未知或歧义结果仅通过原请求继续查询或核对应用身份，保留该次请求号。
- 应用列表确认资源身份；页面效果、业务数据和运行时权限通过实际打开应用验收。只有本次 `applicationVerified=true` 才报告“已查到应用”；AI 入口或历史记录分别按其实际状态交付。

## 相关技能

- `yida-app`：完整应用的需求分析与搭建，通过 `use_skill` 加载。
