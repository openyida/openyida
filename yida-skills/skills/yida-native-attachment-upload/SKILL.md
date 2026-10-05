---
name: yida-native-attachment-upload
description: 通过 OpenYida OAuth 登录态将本地文件上传到已有普通表单实例的 AttachmentField 原生附件存储。适用于附件迁移、后台直传、批量上传合同、追加或替换附件，以及验证 fileUuid/downloadUrl/previewUrl。
---

# 宜搭原生附件上传

使用 `openyida data upload-attachment form` 完成 `ossSign → OSS multipart 上传 → uploadCallBack → updateFormData → getFormDataById 验收`。不要打开浏览器，不要要求用户导出 Cookie、CSRF、accessToken 或长期 OSS 密钥。

## 执行门槛

1. 在目标 OpenYida 项目目录运行 `openyida agent-capabilities --summary-json`，确认 OAuth 登录、目标环境和组织正确。
2. 运行 `openyida get-schema <appType> <formUuid> --compact --resolve-fields "<附件字段标签>"`，取得真实 `attachmentField_xxx`；禁止猜测 fieldId。
3. 确认目标是已有的普通表单实例。本命令不支持新建记录、流程表单、ImageField 或删除附件。
4. 正式写入前先加 `--dry-run`，核对文件、应用、表单、实例、附件字段、替换/追加模式和并发数。

## 命令

替换已有实例的附件字段：

```bash
openyida data upload-attachment form APP_XXX FORM_XXX \
  --inst-id FINST_XXX \
  --attachment-field attachmentField_xxx \
  --file /absolute/path/contract.pdf
```

保留旧附件并追加多个文件：

```bash
openyida data upload-attachment form APP_XXX FORM_XXX \
  --inst-id FINST_XXX \
  --attachment-field attachmentField_xxx \
  --append \
  --file /absolute/path/a.pdf \
  --file /absolute/path/b.docx \
  --concurrency 3
```

预检：

```bash
openyida data upload-attachment form APP_XXX FORM_XXX \
  --inst-id FINST_XXX \
  --attachment-field attachmentField_xxx \
  --file /absolute/path/contract.pdf \
  --dry-run
```

## 强制规则

- 默认替换附件字段；只有用户明确要求保留旧附件时才使用 `--append`。
- `--append` 是读后合并再写入的非原子操作；禁止对同一表单实例并发执行多个追加命令，避免后写请求覆盖先写结果。
- `--file` 可重复；默认并发 3，允许 1～5，禁止无界并发。
- `/ossSign` 返回的 `accessid`、`policy`、`signature` 只在进程内使用，不写日志、不落盘。
- 必须从签名 policy 解析并原样提交 `Content-Disposition`；解析不到时停止，不自行拼接中文文件名。
- 每个文件 OSS 上传成功后必须调用 `/query/attach/uploadCallBack.json`。
- `AttachmentField` 必须写附件对象数组，不得写 `File`、单个对象或普通 URL。
- 任一文件失败时不更新表单；报告可能存在的 OSS 孤儿对象，不得宣称完成。
- 不删除旧记录或旧附件；删除是额外破坏性操作，必须另行确认。

## 验收闭环

命令成功前会自动回读目标实例并验证：

- 目标附件字段是数组，数量符合替换或追加预期；
- 每个对象包含 `name`、`size`、`fileUuid`、`downloadUrl`、`previewUrl`；
- 本次上传的全部 `fileUuid` 均已持久化。

需要高保证时，再执行 `openyida data get form <appType> --inst-id <formInstId>` 并验证下载内容或文件哈希。协议字段和失败语义见 [协议参考](references/protocol.md)。
