# OpenYida 最小修复说明

目标：关闭 CRM PRO 诊断中已确认的 help、技能使用声明和首次参数规划问题。

范围：复用现有 command manifest、`skillsUsed` 解析和 agent capabilities；只修现有入口与技能示例，不新增框架。

完成条件：12 个目标 `--help` 退出 0；生成 prompt/final 明确包含 `skillsUsed`；5 类命令只有一个推荐参数形式；focused tests、skills 校验和全局 link smoke 通过。

非目标：不实现尚未证实的 i18n/角色权限能力，不新增自动化写协议，不操作真实宜搭资源。
