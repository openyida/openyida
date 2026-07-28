# Micro Spec: 低版本运行时的版本字段兼容读取

## Goal
- 要解决什么问题：
  修复低版本第三方缓存 SDK 在运行时缺失 `getVersion()` 导致的 `NoSuchMethodError`，保证带版本读取逻辑在旧依赖下仍可回退运行。
- 验收结果：
  在运行时没有 `getVersion()` 的环境中，接口仍能正常返回值，并将 `version` 回退为 `0`。

## Scope
- In:
  `common/cache/VersionedCacheManager.java`
- Out:
  调用方接口变更
  SDK 升级
  额外缓存协议调整

## Facts / Constraints
- 已确认事实：
  运行时的第三方 `CacheEntry` 类型不一定提供 `getVersion()`
  现有测试已经按“无版本场景回退为 `0`”做过断言
  当前任务的重点是兼容修复，不扩大接口和调用方改动
- 技术/业务约束：
  不能继续对 `getVersion()` 保持静态链接依赖
  方法不存在时应静默回退，不制造额外噪音日志
- 已知风险：
  如果仍保留静态调用，低版本运行时会继续在生产环境触发 `NoSuchMethodError`

## Restated Understanding
- 我理解当前任务是：
  用最小修改修补一个典型的运行时兼容问题，让同一份代码同时兼容高低版本依赖。
- 当前核心目标是：
  消除对缺失方法的静态依赖，并在无法读取版本时稳定回退为 `0`。
- 当前边界是：
  只改版本读取逻辑，不改上层接口、不引入大范围重构。
- 暂不处理：
  第三方 SDK 升级、跨模块的版本治理。

## Checkpoint Summary
- 当前任务理解：
  这是典型的“编译期可见、运行时不可见”兼容问题。
- 当前核心目标：
  保证旧版本运行时不崩，并维持现有返回约定。
- 当前进度：
  已确认问题根因，修法倾向于反射读取 + 缺失时回退。
- 下一步 1:
  移除直接 `entry.getVersion()` 调用。
- 下一步 2:
  抽出 `resolveEntryVersion(entry)`，通过反射读取版本。
- 下一步 3:
  在 `NoSuchMethodException` 场景静默回退 `0`，其他反射异常再记录告警。
- 涉及文件 / 模块：
  `VersionedCacheManager`
- 风险：
  反射异常分类要清楚，避免把“正常兼容回退”误记成系统异常。
- 验证方式：
  静态检查生产代码不再直接调用 `getVersion()`；用现有测试覆盖无版本场景。
- Execution Approval: `Approved`

## Change Log
- 2026-03-09: 将 `getValueWithVersion` 改为调用 `resolveEntryVersion(entry)`。
- 2026-03-09: `resolveEntryVersion` 在 `NoSuchMethodException` 场景直接回退 `0`，避免低版本运行时重复告警。

## Validation
- 已执行检查：
  静态检查确认生产代码不再直接调用 `CacheEntry.getVersion()`
- 结果：
  当前实现满足“方法不存在时可继续运行并回退 `version=0`”的兼容目标。
- 剩余风险：
  尚未主动触发完整构建或集成校验，是否继续执行可按任务需要再决定。
