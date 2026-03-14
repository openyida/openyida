## 快速开始

### 第一步：克隆仓库

```bash
git clone https://github.com/openyida/openyida.git
cd openyida
```

### 第二步：安装 Skills

脚本会**自动检测并安装**缺少的 Node.js / Python，国内网络自动切换阿里云加速源。

**Mac / Linux：**
```bash
bash install-skills.sh
```

**Windows（PowerShell）：**
```powershell
.\install-skills.ps1
```

> 💡 **国内网络访问 GitHub 较慢？** 可手动强制使用国内加速源：
> ```bash
> bash install-skills.sh --cn    # Mac / Linux
> .\install-skills.ps1 --cn      # Windows
> ```

### 第三步：开始使用

用 Cursor / VS Code 等编辑器打开项目，启动 AI 编程工具后直接对话：

- `帮我搭建一个生日祝福小游戏应用`
- `帮我搭建个人薪资计算器应用`

---

## 依赖环境

> 安装脚本会自动处理以下依赖，通常无需手动安装。

| 依赖 | 版本要求 | 用途 |
|------|----------|------|
| Git | 任意版本 | 克隆仓库、安装 Skills |
| Node.js | ≥ 16 | yida-publish、yida-create-* 系列脚本 |
| Python | ≥ 3.10 | yida-login、yida-logout |
| Playwright | latest | 登录态管理 |

### CLI 工具（可选）

如需在任意目录使用 `openyida` / `yida` 命令（如 `openyida doctor` 检查环境），可通过 npm 全局安装：

```bash
npm install -g openyida
```

> 💡 `login`、`publish` 等依赖 Skills 的命令，仍需在克隆的项目目录下运行。
---

## DEMO 展示

### 💰 小工具 - 个人薪资计算器

![薪资计算器](https://gw.alicdn.com/imgextra/i2/O1CN017TeJuE1reVH2Dj7b7_!!6000000005656-2-tps-5114-2468.png)

---

### 🌐  Landing Page - 智联协同

企业级产品介绍页，一句话生成完整 Landing Page。

![智联协同](https://gw.alicdn.com/imgextra/i1/O1CN01EZtvfs1cxXV00UaXi_!!6000000003667-2-tps-5118-2470.png)

---

### 🏮 运营场景 - 看图猜灯谜

AI 生成灯谜图片，用户猜答案，猜错了有 AI 幽默提示。

![看图猜灯谜-2](https://img.alicdn.com/imgextra/i3/O1CN01dCoscP25jSAtAB9o3_!!6000000007562-2-tps-2144-1156.png)

---

## 常用问法([yida-skills](https://github.com/openyida/yida-skills))

1. 帮我搭建一个 xxx 应用
2. 根据需求文档生成应用
3. 帮我创建一个 xxx 表单页面
4. 帮我给 xxx 页面添加一个 xxx 字段，字段名称：字段类型 xxx
5. 帮我给 xxx 页面 xxx 字段改为必填
6. 帮我发布 xxx 页面
7. 重新登录
8. 退出登录

---

## OpenClaw / Claude Code 集成

如需在 OpenClaw 或 Claude Code 中使用这些技能，可通过 ClawHub 安装 [openyida-openclaw-skill](https://github.com/openyida/openyida-openclaw-skill)：

```bash
npx playbooks add skill openyida/openyida-openclaw-skill
```

安装后可直接对话触发技能，如：
- "帮我搭建一个考勤应用"
- "帮我提一个需求：希望支持 xxx"

### 支持的技能

| 技能 | 用途 |
|------|------|
| yida-app | 完整应用开发流程 |
| yida-login | 扫码登录 |
| yida-logout | 退出登录 |
| yida-create-app | 创建应用 |
| yida-create-page | 创建自定义页面 |
| yida-create-form-page | 创建表单 |
| yida-custom-page | 编写页面代码 |
| yida-publish-page | 发布页面 |
| yida-get-schema | 获取表单 Schema |
| yida-issue | 一句话提需求 |

---

## 贡献者

感谢所有为 OpenYida 做出贡献的开发者！

### 贡献者
<p align="left">
  <a href="https://github.com/yize"><img src="https://avatars.githubusercontent.com/u/1011681?v=4&s=48" width="48" height="48" alt="yize" title="yize"/></a> <a href="https://github.com/alex-mm"><img src="https://avatars.githubusercontent.com/u/3302053?v=4&s=48" width="48" height="48" alt="alex-mm" title="alex-mm"/></a> <a href="https://github.com/nicky1108"><img src="https://avatars.githubusercontent.com/u/4279283?v=4&s=48" width="48" height="48" alt="nicky1108" title="nicky1108"/></a>
</p>

## License

[MIT](./LICENSE) © 2026 Alibaba Group
