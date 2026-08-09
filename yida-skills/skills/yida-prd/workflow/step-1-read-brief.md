# Step 1：读取需求简报

## 输入

读取 `.cache/openyida/<项目名>/requirement-brief.json`。文件由 `yida-requirement-analysis` 生成。

## 操作

1. 读取行业、应用类型、核心用户、业务目标、核心功能和业务对象。
2. 读取页面场景候选、已有资源和交付约束。
3. 把品牌和色彩偏好保留为需求事实，不在 PRD 中展开视觉规则。
4. 需求简报缺失时，先加载 `yida-requirement-analysis` 生成该文件。

## 产出

- PRD 的业务范围和角色范围。
- 待规划的表单、流程、页面和报表范围。
- 需要保留的假设和待确认事项。

## Checklist

- [ ] 已读取共享需求简报。
- [ ] 没有重新判断主题 token、视觉 DNA 或页面样式。
- [ ] 没有编造真实资源 ID。
