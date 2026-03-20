/**
 * connector parse-api - 解析接口信息
 *
 * 支持 curl 命令、Markdown 文档等多种格式
 *
 * 用法：openyida connector parse-api [选项]
 *   --curl <command>       curl 命令（从浏览器开发者工具复制）
 *   --doc <path>           接口文档路径（支持 .md, .txt）
 *   --output <path>        输出配置文件路径（可选）
 *   --format <format>      输出格式: json, table（默认: table）
 */

"use strict";

const fs = require("fs");
const { parseCurl, detectAuthType } = require("./connector/curl-parser");
const { parseAPIDoc, convertToOperationConfig } = require("./connector/doc-parser");

function showUsage() {
  console.log(`
用法: openyida connector parse-api [选项]

选项:
  --curl <command>       curl 命令（从浏览器开发者工具复制）
  --doc <path>           接口文档路径（支持 .md, .txt）
  --output <path>        输出配置文件路径（可选）
  --format <format>      输出格式: json, table（默认: table）

示例:
  # 解析 curl 命令
  openyida connector parse-api --curl "curl 'https://api.example.com/path' -H 'Authorization: Bearer xxx'"

  # 解析 Markdown 文档
  openyida connector parse-api --doc ./api-doc.md

  # 解析文档并输出配置文件
  openyida connector parse-api --doc ./api-doc.md --output ./operation.json
`);
}

function parseArgs(args) {
  const options = { format: "table" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help":
      case "-h":
        showUsage();
        process.exit(0);
        break;
      case "--curl":
        options.curl = args[++i];
        break;
      case "--doc":
        options.doc = args[++i];
        break;
      case "--output":
        options.output = args[++i];
        break;
      case "--format":
        options.format = args[++i];
        break;
    }
  }

  return options;
}

function printSchema(schema, indent = "") {
  if (schema.type === "object" && schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      const type = value.type || "any";
      const desc = value.description ? ` - ${value.description}` : "";
      console.log(`${indent}${key}: ${type}${desc}`);

      if (value.type === "object" && value.properties) {
        printSchema(value, indent + "  ");
      } else if (value.type === "array" && value.items) {
        console.log(`${indent}  []:`);
        if (value.items.type === "object") {
          printSchema(value.items, indent + "    ");
        } else {
          console.log(`${indent}    ${value.items.type}`);
        }
      }
    }
  }
}

function generateTableReport(curlData, docData, operationConfig) {
  console.log("\n📋 接口信息解析报告\n");
  console.log("═══════════════════════════════════════════════════\n");

  console.log("【基本信息】");
  if (docData?.basicInfo?.title) {
    console.log(`  接口名称: ${docData.basicInfo.title}`);
  }
  if (docData?.basicInfo?.description) {
    console.log(`  描述: ${docData.basicInfo.description.substring(0, 100)}...`);
  }
  console.log();

  console.log("【服务器信息】");
  const protocol = curlData?.protocol || docData?.serverInfo?.protocol || "https";
  const host = curlData?.host || docData?.serverInfo?.host || "（未识别）";
  const urlPath = curlData?.path || docData?.serverInfo?.path || "";
  const method = curlData?.method || docData?.serverInfo?.method || "GET";
  console.log(`  协议: ${protocol.toUpperCase()}`);
  console.log(`  Host: ${host}`);
  console.log(`  路径: ${urlPath}`);
  console.log(`  方法: ${method}`);
  console.log();

  console.log("【鉴权信息】");
  let authType = "无身份验证";
  if (curlData) {
    const auth = detectAuthType(curlData.headers);
    authType = auth.type;
  } else if (docData?.authInfo) {
    authType = docData.authInfo.type;
  }
  console.log(`  鉴权方式: ${authType}`);
  console.log();

  const headers = curlData?.headers || docData?.requestInfo?.headers || [];
  if (Object.keys(headers).length > 0 || (Array.isArray(headers) && headers.length > 0)) {
    console.log("【请求头】");
    if (Array.isArray(headers)) {
      headers.forEach(header => {
        const required = header.required ? " [必填]" : "";
        console.log(`  ${header.name}: ${header.type}${required}`);
      });
    } else {
      for (const [key, value] of Object.entries(headers)) {
        const maskedValue = key.toLowerCase().includes("auth") || key.toLowerCase().includes("token")
          ? value.substring(0, 20) + "..."
          : value;
        console.log(`  ${key}: ${maskedValue}`);
      }
    }
    console.log();
  }

  console.log("【响应格式】");
  if (docData?.responseInfo?.schema) {
    console.log("  已解析响应 Schema:");
    printSchema(docData.responseInfo.schema, "  ");
  } else if (operationConfig?.responses) {
    console.log("  响应类型:", operationConfig.responses.type || "object");
  } else {
    console.log("  未找到响应格式定义");
  }
  console.log();

  console.log("═══════════════════════════════════════════════════\n");
  console.log("💡 下一步建议:\n");
  console.log("  1. 确认以上信息是否正确");
  console.log("  2. 确认后，使用以下命令创建连接器:");
  console.log();
  console.log(`     openyida connector smart-create \\`);
  console.log(`       --curl "curl '${protocol}://${host}${urlPath}'" \\`);
  console.log(`       --name "${docData?.basicInfo?.title || "API连接器"}"`);
  console.log();
}

async function run(args) {
  if (!args || args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    showUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  let curlData = null;
  let docData = null;
  let operationConfig = null;

  if (options.curl) {
    console.log("🔍 正在解析 curl 命令...");
    curlData = parseCurl(options.curl);
  }

  if (options.doc) {
    console.log(`🔍 正在解析接口文档: ${options.doc}`);
    try {
      docData = parseAPIDoc(options.doc);
      operationConfig = convertToOperationConfig(docData);
    } catch (error) {
      console.error("❌ 文档解析失败:", error.message);
      process.exit(1);
    }
  }

  if (!curlData && !docData) {
    console.error("❌ 请提供 --curl 或 --doc 参数");
    showUsage();
    process.exit(1);
  }

  if (options.format === "json") {
    const report = {
      serverInfo: {
        protocol: curlData?.protocol || docData?.serverInfo?.protocol,
        host: curlData?.host || docData?.serverInfo?.host,
        path: curlData?.path || docData?.serverInfo?.path,
        method: curlData?.method || docData?.serverInfo?.method,
      },
      authInfo: docData?.authInfo || {},
      operationConfig,
    };
    console.log(JSON.stringify(report, null, 2));
  } else {
    generateTableReport(curlData, docData, operationConfig);
  }

  if (options.output && operationConfig) {
    fs.writeFileSync(options.output, JSON.stringify([operationConfig], null, 2));
    console.log(`💾 配置文件已保存到: ${options.output}`);
  }
}

module.exports = { run };
