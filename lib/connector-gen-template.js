/**
 * connector gen-template - 生成接口文档模板
 *
 * 用法：openyida connector gen-template [输出路径]
 */

"use strict";

const fs = require("fs");
const path = require("path");

function showUsage() {
  console.log(`
用法: openyida connector gen-template [输出路径]

示例:
  openyida connector gen-template
  openyida connector gen-template ./my-api-doc.md
`);
}

function generateTemplate() {
  return `# 接口文档模板

> 请按照以下模板填写接口信息，帮助 AI 准确理解您的需求。

---

## 一、基本信息

| 项目 | 填写内容 | 说明 |
|-----|---------|------|
| 接口名称 | | 例如：钉钉花名册查询接口 |
| 接口提供方 | | 例如：钉钉开放平台、自建系统、第三方服务商 |
| 接口文档链接 | | 如有在线文档，请提供 URL |

---

## 二、服务器信息

| 项目 | 填写内容 | 示例 |
|-----|---------|------|
| 协议 | HTTP / HTTPS | HTTPS |
| Host（域名） | | api.dingtalk.com |
| BaseUrl（基础路径） | | /v1.0 或留空 |

---

## 三、鉴权方式

请选择并填写对应的鉴权信息：

### □ 方式1：无身份验证
无需填写

### □ 方式2：基本身份验证（Basic Auth）
| 项目 | 填写内容 |
|-----|---------|
| 用户名 | |
| 密码 | |

### □ 方式3：API 密钥
| 项目 | 填写内容 | 示例 |
|-----|---------|------|
| 参数标签（显示名称）| | Authorization |
| 参数名称 | | X-API-Key |
| 参数位置 | Header / Query | Header |
| 密钥值 | | sk-xxxxxxxx |

### □ 方式4：钉钉开放平台验证
| 项目 | 填写内容 |
|-----|---------|
| AppKey | |
| AppSecret | |

### □ 方式5：阿里云 API 网关
| 项目 | 填写内容 |
|-----|---------|
| AppCode | |

### □ 方式6：钉钉零信任网关
| 项目 | 填写内容 |
|-----|---------|
| AppKey | |
| AppSecret | |

---

## 四、执行动作列表

### 动作1：

| 项目 | 填写内容 | 示例 |
|-----|---------|------|
| 动作名称 | | 查询员工花名册 |
| 动作ID | | queryEmployeeRoster |
| 请求方法 | GET / POST / PUT / DELETE | POST |
| 请求路径 | | /hrm/rosters/lists/query |
| 功能描述 | | 根据员工ID查询花名册信息 |

#### 请求参数

**Header 参数：**
| 参数名 | 必填 | 类型 | 说明 |
|-------|------|------|------|
| | | | |

**Query 参数（GET请求）：**
| 参数名 | 必填 | 类型 | 说明 |
|-------|------|------|------|
| | | | |

**Body 参数（POST/PUT请求）：**
| 参数名 | 必填 | 类型 | 说明 |
|-------|------|------|------|
| | | | |

#### 响应数据
\`\`\`json
{
  // 请提供响应示例
}
\`\`\`

#### 请求示例（curl）
\`\`\`bash
curl 'https://api.example.com/path' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer xxx' \\
  --data '{}'
\`\`\`

---

### 动作2：（如有多个动作，请复制上面的模板继续填写）

...

---

## 五、补充说明

1. **特殊说明**：接口是否有特殊要求（如时间戳、签名等）
2. **错误码**：常见的错误码及含义
3. **限流策略**：是否有调用频率限制

---

**填写完成后，请将此文档发送给 AI，AI 将为您创建连接器。**
`;
}

async function run(args) {
  if (args && (args[0] === "--help" || args[0] === "-h")) {
    showUsage();
    process.exit(0);
  }

  const outputPath = (args && args[0]) || "./api-document-template.md";
  const template = generateTemplate();

  try {
    fs.writeFileSync(outputPath, template, "utf-8");
    console.log("✅ 接口文档模板已生成！");
    console.log(`📄 文件路径: ${path.resolve(outputPath)}`);
    console.log("\n💡 请将您的接口信息填写到模板中，然后发送给 AI。");
  } catch (error) {
    console.error("❌ 生成失败:", error.message);
    process.exit(1);
  }
}

module.exports = { run };
