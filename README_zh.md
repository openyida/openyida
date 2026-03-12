# 通过 Open Code / ClaudeCode 等 AI 工具 + 宜搭快速生成应用

> 非常稳定、支持数据存储、生成后可二次加工 🚀

## 快速开始

```bash
# 1.克隆仓库

  git clone https://github.com/openyida/openyida.git

# 2. 使用代码编辑器打开项目，打开 AI Coding 工具，输入：执行安装脚本，等待 Skills 安装完成
# 3. 一句话生成应用：帮我搭建一个生日祝福小游戏应用
# 4. 根据需求文档生成应用：帮我搭建个人薪资计算器应用

```

> **Windows 用户**：请使用 PowerShell 执行安装脚本：
> ```powershell
> # 如提示执行策略限制，先运行以下命令（仅当前会话生效）
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
> .\install-skills.ps1
> ```


## 依赖环境

| 依赖 | 版本要求 | 用途 |
|------|----------|------|
| Node.js | ≥ 16 | yida-publish、yida-create-* 系列脚本 |
| Python | ≥ 3.8 | yida-login、yida-logout |
| Playwright | latest | 登录态管理 |
| zbar | latest | 二维码解码（yida-login-qr 需要） |
| qrencode | latest | 终端二维码渲染（yida-login-qr 需要） |

```bash
# 安装额外依赖（yida-login-qr 需要）
pip3 install playwright pillow qrcode pyzbar --break-system-packages
brew install zbar qrencode
```

---

## 登录方式

### 方式一：yida-login（默认）

适合本地有桌面环境的用户。浏览器窗口扫码登录。

### 方式二：yida-login-qr（推荐远程服务器使用）

适合在云服务器（ECS）等远程SSH环境下使用：
- 后台运行脚本，日志输出到文件
- 日志中显示二维码
- 检测到组织选择时，通过 OpenCode 交互让用户选择
- 自动完成登录

**使用方式：**

```bash
# 首次登录（清除旧 Cookie）
echo -n "" > .cookies.json

# 后台运行登录脚本
nohup python3 .claude/skills/yida-login-qr/scripts/login.py > /dev/null 2>&1 &

# 监控日志（可选）
tail -f .cache/login.log
```

**工作流程：**
1. 脚本检查 Cookie 有效性，无效则打开浏览器
2. 在日志中渲染二维码（通过 qrencode）
3. 用户扫码后检测到组织选择
4. 通过 OpenCode 交互让用户选择组织
5. 自动完成登录，保存 Cookie

**切换默认登录方式：**

如需将默认的 yida-login 替换为 yida-login-qr，可修改相关技能的调用逻辑，或直接使用：
```bash
# 直接调用 yida-login-qr
python3 .claude/skills/yida-login-qr/scripts/login.py
```

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

## 常用问法
1. 帮我搭建一个 xxx 应用
2. 根据需求文档生成应用
3. 帮我创建一个 xxx 表单页面
4. 帮我给 xxx 页面添加一个 xxx 字段，字段名称：字段类型 xxx
5. 帮我给 xxx 页面 xxx 字段改为必填
6. 帮我发布 xxx 页面
7. 重新登录
8. 退出登录

## License

[MIT](./LICENSE) © 2026 天晟
