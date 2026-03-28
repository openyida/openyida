# 宜搭 AI 浮窗助手 — 注入指南

## 概述

本技能提供 AI 对话浮窗组件，支持**独立使用**和**注入到已有自定义页面**两种模式。浮窗悬浮在页面右下角，支持 12 种 AI 模型、流式输出、Markdown 渲染、代码高亮、拖动定位等功能。

**源码参考文件**：`project/pages/src/yida-chatbot.js`

---

## 使用模式

### 模式 A：独立自定义页面

直接将 `yida-chatbot.js` 发布为独立的自定义页面。

```bash
openyida create-page <appType> "AI 助手"
openyida publish project/pages/src/yida-chatbot.js <appType> <formUuid>
```

### 模式 B：注入到已有自定义页面（融合模式）

将 AI 浮窗注入到已有的自定义页面代码中，使浮窗和原有页面功能共存。

---

## 模式 B 融合注入步骤（重要）

### Step 1：在目标文件顶部追加模型配置和工具函数

在目标文件的顶部常量区域（其他 `var` 声明之后）追加以下代码：

```javascript
// ============================================================
// AI 浮窗 - 模型配置
// ============================================================
var MODEL_LIST = [
  { id: 'qwen-turbo', name: 'Qwen Turbo', provider: '阿里云', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', desc: '免费，速度快' },
  { id: 'qwen-plus', name: 'Qwen Plus', provider: '阿里云', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', desc: '效果更好' },
  { id: 'qwen-max', name: 'Qwen Max', provider: '阿里云', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', desc: '最强能力' },
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1/chat/completions', desc: '高性价比' },
  { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1/chat/completions', desc: '深度推理' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', apiUrl: 'https://api.openai.com/v1/chat/completions', desc: '轻量高效' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', apiUrl: 'https://api.openai.com/v1/chat/completions', desc: '多模态旗舰' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', apiUrl: 'https://api.anthropic.com/v1/messages', desc: '编程能力强' },
  { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'MiniMax', apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2', desc: '递归自改进，全能旗舰' },
  { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'MiniMax', apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2', desc: '代码生成优化' },
  { id: 'qwen3.5-coder', name: 'Qwen3.5 Coder', provider: 'Coding Plan', apiUrl: 'https://coding.dashscope.aliyuncs.com/v1/chat/completions', desc: '百炼订阅，编程专用' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Coding Plan', apiUrl: 'https://coding.dashscope.aliyuncs.com/v1/chat/completions', desc: '百炼订阅，Claude 最新' },
];

var AI_COLORS = {
  bg: '#0a0e1a', chatBg: 'rgba(15, 20, 40, 0.95)', panelBg: 'rgba(12, 16, 32, 0.92)',
  userBubble: 'linear-gradient(135deg, #6366f1, #8b5cf6)', userBubbleSolid: '#7c3aed', userBubbleText: '#ffffff',
  aiBubble: 'rgba(30, 40, 70, 0.8)', aiBubbleText: '#e2e8f0',
  border: 'rgba(99, 102, 241, 0.15)', borderGlow: 'rgba(99, 102, 241, 0.3)',
  inputBg: 'rgba(20, 25, 50, 0.8)', inputBorder: 'rgba(99, 102, 241, 0.25)',
  text: '#e2e8f0', textSecondary: '#94a3b8', textMuted: '#64748b',
  codeBg: 'rgba(15, 20, 40, 0.9)', codeBorder: 'rgba(99, 102, 241, 0.2)',
  success: '#34d399', accent: '#818cf8', accentGlow: '0 0 20px rgba(99, 102, 241, 0.3)',
  gradientPrimary: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
  gradientDark: 'linear-gradient(180deg, rgba(15,20,40,0.98), rgba(10,14,26,0.98))',
};

var STORAGE_KEY = 'yida_chatbot_api_key';
var STORAGE_MODEL_KEY = 'yida_chatbot_model_id';

function getApiKey() { try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; } }
function saveApiKey(key) { try { localStorage.setItem(STORAGE_KEY, key); } catch (e) {} }
function getSelectedModelId() { try { return localStorage.getItem(STORAGE_MODEL_KEY) || 'qwen-turbo'; } catch (e) { return 'qwen-turbo'; } }
function saveSelectedModelId(modelId) { try { localStorage.setItem(STORAGE_MODEL_KEY, modelId); } catch (e) {} }
function getSelectedModel() {
  var modelId = getSelectedModelId();
  for (var i = 0; i < MODEL_LIST.length; i++) { if (MODEL_LIST[i].id === modelId) return MODEL_LIST[i]; }
  return MODEL_LIST[0];
}
```

### Step 2：在 `_customState` 中追加浮窗状态字段

在已有的 `_customState` 对象中追加以下字段（使用 `chat` 前缀避免命名冲突）：

```javascript
  // AI 浮窗状态（chat 前缀避免冲突）
  chatMessages: [],
  chatInputValue: '',
  chatIsLoading: false,
  chatIsComposing: false,
  chatMarkedLoaded: false,
  chatHighlightLoaded: false,
  chatShowSettings: false,
  chatOpen: false,
  chatCopySuccess: false,
  chatPosX: null,
  chatPosY: null,
  chatDragging: false,
  chatDragOffsetX: 0,
  chatDragOffsetY: 0,
```

### Step 3：在 `didMount` 中追加 CDN 加载

```javascript
  // AI 浮窗 - 加载 marked.js
  this.utils.loadScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js').then(function() {
    _customState.chatMarkedLoaded = true;
    self.forceUpdate();
  }).catch(function(err) { console.error('marked.js 加载失败:', err); });

  // AI 浮窗 - 加载 highlight.js
  this.utils.loadScript('https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/lib/core.min.js').then(function() {
    _customState.chatHighlightLoaded = true;
    self.forceUpdate();
  }).catch(function(err) { console.error('highlight.js 加载失败:', err); });
```

### Step 4：追加所有浮窗 export function

从 `yida-chatbot.js` 中复制所有事件处理、AI 服务、Markdown 渲染、浮窗 JSX 渲染函数，**全部加 `chat` 前缀**：

| 原函数名 | 融合后函数名 |
|---------|------------|
| `handleInputChange` | `chatHandleInputChange` |
| `handleCompositionStart` | `chatHandleCompositionStart` |
| `handleCompositionEnd` | `chatHandleCompositionEnd` |
| `handleKeyDown` | `chatHandleKeyDown` |
| `handleSendMessage` | `chatHandleSendMessage` |
| `handleNewChat` | `chatHandleNewChat` |
| `handleToggleChat` | `chatHandleToggleChat` |
| `handleToggleSettings` | `chatHandleToggleSettings` |
| `handleSaveApiKey` | `chatHandleSaveApiKey` |
| `handleClearApiKey` | `chatHandleClearApiKey` |
| `handleSelectModel` | `chatHandleSelectModel` |
| `handleCopyCode` | `chatHandleCopyCode` |
| `sendToAI` | `chatSendToAI` |
| `renderMarkdown` | `chatRenderMarkdown` |
| （新增）`chatHandleDragStart` | 拖动功能 |
| （新增）`chatRenderFloatingWidget` | 浮窗 JSX 渲染入口 |

### Step 5：在 `renderJsx` 中注入浮窗

在 `renderJsx` 的 return 中，**最外层 `<div>` 内部、其他内容之后**追加：

```jsx
      {this.chatRenderFloatingWidget()}
```

---

## ⚠️ 融合注入关键注意事项

### 1. 禁止使用的语法（宜搭 Babel 编译限制）

- ❌ `const` / `let` → 必须用 `var`
- ❌ `import` / `export default`
- ❌ `{ ...obj }` 对象展开 → 用 `Object.assign()` 或 `Object.keys` 遍历
- ❌ `obj?.prop` 可选链 → 用 `obj && obj.prop`
- ❌ `a ?? b` 空值合并 → 用 `a !== null && a !== undefined ? a : b`

### 2. 必须在 renderJsx 中引用 `state.timestamp`

**这是最关键的一点**：`forceUpdate()` 通过 `this.setState({ timestamp: ... })` 触发重新渲染。如果 JSX 中没有引用 `state.timestamp`，React 会跳过重新渲染，导致所有交互失效。

```jsx
// ✅ 正确：在 renderJsx 的 return 中必须包含
<div style={{ display: 'none' }}>{state.timestamp}</div>

// ❌ 错误：遗漏 state.timestamp 引用
```

### 3. 命名空间隔离

所有浮窗相关的：
- **状态字段**：使用 `chat` 前缀（如 `chatMessages`、`chatOpen`）
- **函数名**：使用 `chat` 前缀（如 `chatHandleToggleChat`）
- **DOM id**：使用 `chatbot-` 前缀（如 `chatbot-input`、`chatbot-apikey-input`）
- **颜色常量**：使用 `AI_COLORS` 而非 `COLORS`（避免与原页面冲突）

### 4. 光晕 div 必须加 `pointerEvents: 'none'`

浮窗按钮外层的光晕 div 会遮挡按钮点击，必须添加：

```javascript
pointerEvents: 'none',
```

### 5. `getCustomState` 不要用 spread 语法

```javascript
// ❌ 错误
return { ..._customState };

// ✅ 正确
var result = {};
Object.keys(_customState).forEach(function(k) { result[k] = _customState[k]; });
return result;
```

---

## 功能特性

- ✅ **12 种 AI 模型**：Qwen、DeepSeek、GPT-4o、Claude、MiniMax 等
- ✅ **流式输出**：打字机效果实时显示 AI 回复
- ✅ **Markdown 渲染**：自动解析 Markdown 格式
- ✅ **代码高亮**：代码块语法高亮
- ✅ **API Key 本地存储**：仅保存在浏览器 localStorage，不上传服务器
- ✅ **模型切换**：运行时切换不同 AI 模型
- ✅ **拖动定位**：面板可拖动到任意位置
- ✅ **深色未来感主题**：科技感 UI 设计
- ✅ **多 API 格式适配**：OpenAI 兼容格式 / Anthropic Messages 格式

---

## 常见问题

### Q: 浮窗按钮点击无响应？

检查以下几点：
1. `renderJsx` 中是否引用了 `{state.timestamp}`
2. 光晕 div 是否添加了 `pointerEvents: 'none'`
3. `_customState` 是否用了 `var` 而非 `const`

### Q: 如何获取 API Key？

- **阿里云 Qwen**：访问 [DashScope 控制台](https://dashscope.console.aliyun.com/)
- **DeepSeek**：访问 [DeepSeek 平台](https://platform.deepseek.com/)
- **OpenAI**：访问 [OpenAI API](https://platform.openai.com/)

### Q: qwen-turbo 是免费的吗？

是的，qwen-turbo 提供免费额度，适合开发测试。

### Q: 支持在表单页面中使用吗？

表单页面不支持 `renderJsx`，需要使用 DOM 注入方案（在 `didMount` 中通过 `document.createElement` 动态创建浮窗 DOM 并 `appendChild` 到 `document.body`）。
