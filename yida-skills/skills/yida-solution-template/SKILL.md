---
name: yida-solution-template
description: 仅在用户明确提到宜搭方案中心、方案模板、模板启用、模板 AI 搭，或继续该上下文时使用。查询模板与详情；定制需求交给平台原生 AI 搭建入口；原样使用模板时可在明确应用名称后直接启用，并以本地请求收据和应用列表回读防止超时重建。泛称“搭应用/系统”仍走 yida-app。
---

# 宜搭方案模板

本技能处理方案中心模板的发现、详情、原生 AI 搭建入口和直接启用。只有用户明确提到“方案中心”“方案模板”“模板启用”“模板 AI 搭”或延续已确认模板任务时加载；普通“搭应用/系统”必须继续使用 `yida-app`。

## 顺序

先核对登录环境，再查询模板和详情：

```bash
openyida login --check-only --json
openyida solution-template search --query '合同' --json
openyida solution-template detail TPL_XXX --json
```

- 需要修改业务范围、字段、页面或流程：执行 `ai-build` 获取平台原生搭建入口，把定制要求交给原生搭建器。返回的 `submissionAccepted=false`、`applicationVerified=false` 表示只完成入口交接，不能宣称应用已创建。
- 希望原样使用模板：只有用户明确目标应用名称并允许创建资源时，才执行 `enable`。`--with-data y|n` 决定是否带模板数据。

```bash
openyida solution-template ai-build TPL_XXX --json
openyida solution-template enable TPL_XXX --name '合同管理' --with-data y --json
```

## 超时、回读与完成口径

直接启用会先写本地请求收据，再只提交一次。命令超时、返回体不完整或应用尚不可见时，不得盲目重复 `enable`；使用返回的请求号查询：

```bash
openyida solution-template status st-xxxxxxxx --json
```

分别读取 `submissionAccepted` 与 `applicationVerified`。只有 `state=completed` 且 `applicationVerified=true` 才能确认应用存在；`uncertain` 或 `ambiguous` 必须人工核对，收据会阻止重复提交。平台当前没有可轮询的百分比进度，不能伪造进度或把等待描述成完成。

登录、组织权限、版本权益、AI 额度和模板可用性均由平台裁决。保留平台错误，不切换组织、不修改权益、不绕过限制。真实启用后还需按用户要求打开并验收应用；应用列表回读只证明资源身份，不证明页面效果、业务数据或运行时权限正确。
