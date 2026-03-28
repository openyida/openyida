# 宜搭自定义页面 API 参考与素材资源

> 本文档从 SKILL.md 拆分而来，包含完整的 API 参考、工具链说明和素材资源指南。

## API 参考

### 表单数据操作

通过 `this.utils.yida.<方法名>(params)` 调用，所有接口返回 Promise。

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `saveFormData` | 新建表单实例 | `formUuid`, `appType`, `formDataJson` |
| `updateFormData` | 更新表单实例 | `formInstId`, `updateFormDataJson` |
| `deleteFormData` | 删除表单实例 | `formUuid` |
| `getFormDataById` | 根据实例 ID 查询详情 | `formInstId` |
| `searchFormDatas` | 按条件搜索表单实例详情列表 | `formUuid` |
| `searchFormDataIds` | 按条件搜索表单实例 ID 列表 | `formUuid` |
| `getFormComponentDefinationList` | 获取表单定义 | `formUuid` |

完整参数说明和调用示例请参考 [yida-api.md](../../reference/yida-api.md) 的「表单数据操作」章节。

### 流程操作

| 方法 | 说明 | 必填参数 |
| --- | --- | --- |
| `startProcessInstance` | 发起流程 | `formUuid`, `processCode`, `formDataJson` |
| `updateProcessInstance` | 更新流程实例 | `processInstanceId`, `updateFormDataJson` |
| `deleteProcessInstance` | 删除流程实例 | `processInstanceId` |
| `getProcessInstanceById` | 根据实例 ID 查询流程详情 | `processInstanceId` |
| `getProcessInstances` | 按条件搜索流程实例详情列表 | — |
| `getProcessInstanceIds` | 按条件搜索流程实例 ID 列表 | — |

### 表单设计类 API

以下接口用于表单页面的创建和配置，通过 HTTP 请求调用：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `saveFormSchemaInfo` | 创建空白表单 | `POST /dingtalk/web/{appType}/query/formdesign/saveFormSchemaInfo.json` |
| `getFormSchema` | 获取表单 Schema | `GET /alibaba/web/{appType}/_view/query/formdesign/getFormSchema.json` |
| `saveFormSchema` | 保存表单 Schema | `POST /dingtalk/web/{appType}/_view/query/formdesign/saveFormSchema.json` |
| `updateFormConfig` | 更新表单配置 | `POST /dingtalk/web/{appType}/query/formdesign/updateFormConfig.json` |

完整参数说明请参考 [yida-api.md](../../reference/yida-api.md) 的「表单设计类 API」章节。

### 大模型 AI 接口

以下接口用于调用大模型 AI 文本生成能力：

| 方法 | 说明 | 调用方式 |
| --- | --- | --- |
| `txtFromAI` | AI 文本生成 | `POST /query/intelligent/txtFromAI.json` |

**主要参数**：`_csrf_token`（CSRF 令牌）、`prompt`（提示词）、`skill`（技能类型，如 `ToText`）、`maxTokens`（最大返回 token 数）

完整参数说明和示例请参考 [model-api.md](../../reference/model-api.md)。

---

### 工具类 API 速查

以下工具函数通过 `this.utils.<方法名>()` 调用，无需 `yida` 命名空间：

| 方法 | 用途 | 典型场景 |
| --- | --- | --- |
| `toast` | 轻提示 | 操作成功/失败提示、loading 状态 |
| `dialog` | 对话框 | 确认操作、复杂内容展示 |
| `formatter` | 格式化 | 日期、金额、手机号格式化 |
| `getDateTimeRange` | 获取时间范围 | 按日/月/周筛选数据 |
| `getLoginUserId` / `getLoginUserName` | 获取当前用户 | 记录操作人、数据权限控制 |
| `getLocale` | 获取语言环境 | 多语言适配 |
| `isMobile` | 判断移动端 | 响应式布局适配 |
| `isSubmissionPage` | 判断是否提交页面 | 页面逻辑区分 |
| `isViewPage` | 判断是否查看页面 | 页面逻辑区分 |
| `openPage` | 打开新页面 | 页面跳转、外链打开 |
| `router.push` | 页面路由跳转工具 | 页面路由跳转、避免新开页面 |
| `previewImage` | 图片预览 | 图片查看、多图轮播 |
| `loadScript` | 动态加载脚本 | 引入第三方库（如二维码生成） |

完整参数说明和示例请参考 [yida-api.md](../../reference/yida-api.md) 的「工具类 API」章节。

## 工具链

| Skill | 说明 | 用法 |
| --- | --- | --- |
| **yida-login** | 登录态管理（Cookie 持久化 + 扫码登录） | `openyida login` |
| **yida-publish-page** | 编译源码 + 构建 Schema + 发布到宜搭 | `openyida publish <源文件路径> <appType> <formUuid>` |
| **yida-page-config** | 页面配置（URL 验证、公开访问/分享配置） | 详见 `yida-page-config` 技能文档 |

### 编译 + 发布（一键完成）

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

**处理流程**：
1. 通过 `@babel/standalone` 将 JSX 转换为 ES5 + UglifyJS 压缩
2. 通过代码动态构建完整的 Schema JSON，将 `source` 和 `compiled` 填入 `actions.module`
3. 调用 `yida-login` 获取登录态（Cookie 持久化，首次需扫码登录）
4. 通过 HTTP POST 调用 `saveFormSchema` 接口保存 Schema

### 仅编译（不发布）

```bash
openyida publish <源文件路径> <appType> <formUuid>
```

输入 JSX 源文件，通过 Babel 编译 + UglifyJS 压缩后输出到 `pages/dist/` 目录。

---
## 素材资源指南

在自定义页面开发中，经常需要使用图片、音乐/音效、Icon 等素材资源。以下是推荐的素材获取方案，确保素材来源稳定、合规、风格一致。

### 图片素材

| 素材库 | API | 授权方式 | 推荐场景 |
| --- | --- | --- | --- |
| [Unsplash](https://unsplash.com) | ✅ | 免费商用，无需署名 | 高质量背景图、Banner、配图 |
| [Pexels](https://pexels.com) | ✅ | 免费商用，无需署名 | 人物、场景、商务类配图 |
| [Pixabay](https://pixabay.com) | ✅ | 免费商用，无需署名 | 插画、矢量图、通用配图 |
| [Lorem Picsum](https://picsum.photos) | ✅ | 免费 | 开发阶段占位图 |
| [Wikimedia Commons](https://commons.wikimedia.org) | ⚠️ | 授权类型多样，需按条目核对 | 知识类/历史类配图 |

### 音乐/音效素材

| 素材库 | 授权方式 | 署名要求 | 推荐场景 |
| --- | --- | --- | --- |
| [Pixabay Music](https://pixabay.com/music/) | 免费商用 | 无需 | 背景音乐、氛围音效 |
| [Mixkit](https://mixkit.co/free-sound-effects/) | 免费商用 | 无需 | 短音效、UI 交互音 |
| [Freesound](https://freesound.org) | CC0 / CC BY | ⚠️ 部分需署名 | 按钮音效、提示音、环境音 |
| [Incompetech](https://incompetech.com/music/) | CC BY 4.0 | ⚠️ 需署名 Kevin MacLeod | 游戏、活动页背景音乐 |
| [Free Music Archive](https://freemusicarchive.org) | 多种 CC | ⚠️ 需按条目核对 | 曲库大，适合按分类批量拉取 |

- 优先使用 Pixabay Music 和 Mixkit（无署名要求）
- 使用 CC BY 素材时，需在页面底部添加署名，格式：`Music: "曲名" by 作者 — Licensed under CC BY 4.0`
- 音频文件建议上传到 CDN，移动端使用压缩后的 MP3 格式

### Icon 素材

> 优先使用 `this.utils.loadStyleSheet(url)` 加载 CSS 图标库，详见 [yida-api.md](../../reference/yida-api.md) 的「loadStyleSheet」章节。

| 图标库 | 授权方式 | 推荐场景 |
| --- | --- | --- |
| [iconfont（阿里）](https://www.iconfont.cn) | 免费 | **首选**，国内访问最稳定，支持自定义图标集 |
| [Remix Icon](https://remixicon.com) | Apache 2.0 | 开源免费，风格现代，无需注册 |
| [Font Awesome](https://fontawesome.com) | MIT（免费版） | 覆盖面广，通用 UI 图标 |
| [Material Icons](https://fonts.google.com/icons) | Apache 2.0 | 数量大，适合中后台工具类产品 |
| [Bootstrap Icons](https://icons.getbootstrap.com) | MIT | 轻量，SVG 为主 |
| [Heroicons](https://heroicons.com) | MIT | 线性/实心两套，现代极简风 |

**SVG 内联**（少量图标，无外部依赖）：

```javascript
function renderIcon(iconPath, size, color) {
  return (
    <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke={color || 'currentColor'} strokeWidth="2">
      <path d={iconPath} />
    </svg>
  );
}
```

### 素材使用通用建议

**稳定性**
- 生产环境的图片/音频应上传到自有 CDN，避免第三方外链失效
- 图片/音频优先使用有官方 API 的站点（Unsplash / Pexels / Pixabay / Freesound），避免爬虫方式
- 同一关键词可并行查 2-3 个库，失败自动切换；对外链下载做本地缓存

**合规性**
- 优先使用无署名要求的素材库（Unsplash、Pexels、Pixabay、Mixkit）
- 使用 CC BY 素材时必须添加署名，至少记录以下字段：`source`（来源站点）、`author`（作者）、`license`（许可证类型）、`requiredAttribution`（是否需要署名）、`sourceUrl`（原始链接）
- Wikimedia Commons / Freesound / FMA 等站点授权类型多样，务必按条目核对 License

**一致性**
- 同一项目中统一使用一个图标库，避免混用多个图标库导致风格不一致
- 准备「语义→图标名」映射表（如 `search → ri-search-line`、`settings → ri-settings-3-line`），避免随机挑选

**性能**
- 图片使用合适尺寸（避免加载 4K 大图）；音频使用压缩后的 MP3 格式
- 图标优先使用 CDN 字体方案（iconfont / Remix Icon），少量图标可用 SVG 内联

> ⚠️ **安全风险警告：禁止引用未知或不可信的 CDN 地址**
>
> 引用来源不明的第三方 CDN 链接（如随意从搜索结果或论坛复制的 JS/CSS 链接）存在严重安全隐患：
>
> - **网络劫持风险**：不可信 CDN 可能被中间人攻击，注入恶意脚本，导致用户数据泄露或页面被篡改
> - **供应链攻击**：第三方 CDN 资源随时可能被替换为恶意内容，且难以察觉（2024年曾发生木马化 jQuery 通过知名免费 CDN 传播的真实案例）
> - **服务不稳定**：免费 CDN 可能随时宕机或 SSL 证书过期，导致页面资源加载失败
>
> **安全规范：**
> - ✅ 仅使用以下经过验证的可信 CDN：
>   - `cdnjs.cloudflare.com` — Cloudflare 官方维护，支持 SRI 完整性校验，国内可访问，**首选**
>   - `unpkg.com` — npm 官方镜像，适合加载 npm 包资源，国内可访问
>   - 阿里云 CDN（`alicdn.com`）— 国内访问最稳定，适合生产环境
> - ✅ 引用第三方 CDN 资源时，建议添加 `integrity` 属性（SRI 校验），防止资源被篡改
> - ❌ **禁止使用 `cdn.jsdelivr.net`**：2024年发生过木马化 jQuery 供应链攻击事件，且有 SSL 证书过期记录，存在安全风险
> - ❌ **禁止使用 `fonts.googleapis.com`**：国内大陆无法访问，字体资源需下载到本地后上传自有 CDN
> - ❌ 禁止引用来源不明的 CDN 地址，即使该链接当前可以正常访问
> - ❌ 禁止直接使用从搜索引擎、论坛、博客中复制的 CDN 链接，需先核实来源

---