# Dashboard 组件契约

| 原子 | 必备槽位 | 规则 |
| --- | --- | --- |
| KPI Primitive | title / value / unit / delta / footer | 核心 KPI 有主次，不裸数字 |
| Chart Panel | title / subtitle / chart / insight / action | 每张图回答一个业务问题 |
| Insight Callout | conclusion / evidence / suggestion | 至少一处全局结论 |
| Rank List | rank / name / value / progress / status | 排行要有业务含义 |
| Freshness Badge | source / updatedAt / refresh | 数据来源和更新时间可见 |
| Alert Feed | level / subject / reason / action | 告警色只给真实异常 |

## 洞察格式

```text
数字 + 业务含义 + 建议/风险
```

示例：`华东区贡献 43%，环比 +5.2pp，是本周增长主因，建议优先保障补货。`
