# OpenYida 搭建计划

这份计划把「钉钉 AI 解决方案中心」从原型推进到可运行宜搭样板应用。当前文件不直接创建真实资源；拿到目标组织登录态后，按下面命令执行即可。

## 1. 创建应用

```bash
openyida create-app --name "钉钉 AI 解决方案中心" --desc "面向钉钉 SA 的 AI 方案生产、客户拜访经营和主管大盘样板应用" --theme deepBlue
```

记录输出中的 `appType`，后续命令用 `APP_XXX` 替换。

## 2. 创建核心表单

推荐使用辅助脚本先做 dry-run，确认命令和路径：

```bash
node project/prd/demo-dingtalk-ai-solution-center/build-solution-center.js --app-type APP_XXX
```

确认无误后执行真实创建：

```bash
node project/prd/demo-dingtalk-ai-solution-center/build-solution-center.js --app-type APP_XXX --execute
```

脚本会创建 7 张核心表单，并输出：

- `created-forms.local.json`：真实 `formUuid` 汇总
- `created-field-map.local.json`：待填 `fieldId` 的字段映射骨架

这两个 `*.local.json` 文件包含真实组织资源 ID，已被 `.gitignore` 忽略。

也可以手动逐条执行：

```bash
openyida create-form create APP_XXX "客户档案" project/prd/demo-dingtalk-ai-solution-center/fields/customer-fields.json --no-open
openyida create-form create APP_XXX "客户拜访" project/prd/demo-dingtalk-ai-solution-center/fields/visit-fields.json --no-open
openyida create-form create APP_XXX "方案包" project/prd/demo-dingtalk-ai-solution-center/fields/solution-package-fields.json --no-open
openyida create-form create APP_XXX "Demo 实例" project/prd/demo-dingtalk-ai-solution-center/fields/demo-instance-fields.json --no-open
openyida create-form create APP_XXX "拜访纪要" project/prd/demo-dingtalk-ai-solution-center/fields/meeting-note-fields.json --no-open
openyida create-form create APP_XXX "SA 周报" project/prd/demo-dingtalk-ai-solution-center/fields/sa-weekly-report-fields.json --no-open
openyida create-form create APP_XXX "风险客户" project/prd/demo-dingtalk-ai-solution-center/fields/risk-customer-fields.json --no-open
```

建议把每条命令返回的 `formUuid` 写入本目录下的 `created-forms.local.json`，不要提交真实组织的资源 ID。

## 3. 创建自定义首页

```bash
openyida create-page APP_XXX "AI 解决方案中心首页"
```

记录输出中的首页 `formUuid`，然后发布页面：

```bash
openyida check-page project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx
openyida compile project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx
openyida publish project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx APP_XXX FORM_HOME_XXX
```

## 4. 表单关联增强

第一版字段定义为了可直接创建，客户和方案引用先使用文本字段。真实搭建后建议做二次增强：

| 表单 | 字段 | 增强方向 |
| --- | --- | --- |
| 客户拜访 | 客户名称 | 改为关联「客户档案」 |
| 客户拜访 | 推荐方案 | 改为关联「方案包」 |
| Demo 实例 | 客户名称 | 改为关联「客户档案」 |
| Demo 实例 | 关联方案 | 改为关联「方案包」 |
| 拜访纪要 | 客户名称 | 改为关联「客户档案」 |
| 风险客户 | 客户名称 | 改为关联「客户档案」 |

关联字段需要先拿到真实 `formUuid` 和主字段 `fieldId`，再用 `openyida get-schema APP_XXX FORM_XXX` 确认。

## 5. 配置首页数据读取

首页源码已经内置 `FORM_CONFIG`，默认使用示例数据。创建表单后按下面流程接入真实数据：

```bash
openyida get-schema APP_XXX FORM_CUSTOMER_XXX > .cache/solution-center/customer-schema.json
openyida get-schema APP_XXX FORM_VISIT_XXX > .cache/solution-center/visit-schema.json
openyida get-schema APP_XXX FORM_DEMO_XXX > .cache/solution-center/demo-schema.json
openyida get-schema APP_XXX FORM_RISK_XXX > .cache/solution-center/risk-schema.json
openyida get-schema APP_XXX FORM_WEEKLY_XXX > .cache/solution-center/weekly-schema.json
```

参考 `field-map.template.json`，把真实 `formUuid` 和 `fieldId` 填入：

```text
project/pages/src/demo-dingtalk-ai-solution-center.oyd.jsx
```

也可以用脚本从 schema 自动生成页面配置片段：

```bash
node project/prd/demo-dingtalk-ai-solution-center/generate-form-config.js \
  --schemas-dir .cache/solution-center \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json
```

输出的 `form-config.local.js` 已被 `.gitignore` 忽略，可以直接复制其中的 `FORM_CONFIG` 到页面源码。

详细说明见 `data-binding-guide.md`。

## 6. 初始数据建议

首批建议导入 8-12 条样例数据：

- 3 个制造客户
- 2 个零售客户
- 1 个政企客户
- 1 个物流客户
- 6 个方案包
- 6-10 条客户拜访
- 3 条 Demo 实例
- 3 条风险客户

这些样例数据要覆盖主管看板的核心状态：高价值客户、停滞客户、已创建未演示 Demo、需要主管陪访客户。

可以用样例数据脚本先 dry-run：

```bash
node project/prd/demo-dingtalk-ai-solution-center/seed-solution-center.js \
  --app-type APP_XXX \
  --form-config project/prd/demo-dingtalk-ai-solution-center/form-config.local.js \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json \
  --user-map project/prd/demo-dingtalk-ai-solution-center/user-map.local.json
```

确认命令无误后执行真实导入：

```bash
node project/prd/demo-dingtalk-ai-solution-center/seed-solution-center.js \
  --app-type APP_XXX \
  --form-config project/prd/demo-dingtalk-ai-solution-center/form-config.local.js \
  --created-forms project/prd/demo-dingtalk-ai-solution-center/created-forms.local.json \
  --user-map project/prd/demo-dingtalk-ai-solution-center/user-map.local.json \
  --execute
```

`user-map.local.json` 示例：

```json
{
  "林晨": "manager123",
  "周岚": "sales456",
  "陈越": "sa789"
}
```

如果只是演示同一个账号，也可以用 `--default-user-id <userId>` 兜底。

## 7. 后续自动化

优先做三条自动化：

1. 拜访完成后生成 AI 纪要和下一步动作。
2. Demo 创建 7 天未演示自动提醒。
3. 高风险客户自动进入主管看板并通知主管。
