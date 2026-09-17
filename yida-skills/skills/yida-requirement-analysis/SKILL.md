---
name: yida-requirement-analysis
description: OpenYida 应用生成前的需求分析。从简短需求推导核心功能候选，尽早确认关键范围和实际用法，再推导入口建议，整合 requirement-brief.json 供 PRD、视觉设计与搭建规划使用。
---

# 首轮需求分析与简报交接

本技能负责来源识别、内容读取、需求理解与澄清，由 `yida-app` 调度。

按 [首轮需求分析](workflow/prepare-brief.md) 执行：**理解需求 → 提出核心功能候选 → 用户选择或补充 → 推导使用关系与入口建议 → 整合输出**。已有信息充分时跳过相应提问；首次搭建包括新应用和已有但无业务页面的应用，已有业务应用只澄清本次变化。

用户确认核心功能和实际用法，AI 形成入口建议。将结果保存到内部记录 `requirement-brief.json`，交给下游规划页面、导航和视觉。对用户统一称“需求分析”。

用户指定单个资源时，保留 `explicitScope` 和 `allowInferredResources:false`；已有 Fast/Plan 选择及 `constraints.prohibitedActions` 随 brief 交接。

## 按阶段读取

- 收到回答后，需要判断或修正入口建议时：读 [使用关系与入口](references/experience-groups.md)。
- 保存或更新同一份 `.cache/openyida/<项目名>/requirement-brief.json` 时：读 [交接契约](references/handoff.md)。
- 下游规划准备时：由 `yida-app` 读取 [平台导航与自定义导航决策](../yida-design/references/navigation-decision.md)，补齐规划输入。
