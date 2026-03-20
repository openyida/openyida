"use strict";

const https = require("https");
const http = require("http");
const querystring = require("querystring");

const {
  isLoginExpired,
  isCsrfTokenExpired,
} = require("../utils");

/**
 * 调用 saveFormSchemaInfo 创建空白报表
 */
async function createBlankReport(baseUrl, csrfToken, cookies, appType, reportTitle) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formType: "report",
    title: JSON.stringify({ zh_CN: reportTitle, en_US: reportTitle, type: "i18n" }),
  });

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const parsedUrl = new URL(baseUrl);
  const isHttps = parsedUrl.protocol === "https:";
  const requestModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `/dingtalk/web/${appType}/query/formdesign/saveFormSchemaInfo.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: baseUrl + "/",
        Cookie: cookieHeader,
      },
      timeout: 30000,
    };

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.error("[HTTP] 状态码:", res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: "HTTP " + res.statusCode + ": 响应非 JSON" });
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("请求超时")); });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

/**
 * 调用 saveFormSchema 保存报表 Schema
 */
async function saveReportSchema(baseUrl, csrfToken, cookies, appType, reportId, schema) {
  const postData = querystring.stringify({
    _csrf_token: csrfToken,
    formUuid: reportId,
    content: JSON.stringify(schema),
    schemaVersion: "V5",
    importSchema: "true",
  });

  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const parsedUrl = new URL(baseUrl);
  const isHttps = parsedUrl.protocol === "https:";
  const requestModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `/dingtalk/web/${appType}/_view/query/formdesign/saveFormSchema.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        Origin: baseUrl,
        Referer: baseUrl + "/",
        Cookie: cookieHeader,
      },
      timeout: 60000,
    };

    const req = requestModule.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        console.error("[HTTP] 状态码:", res.statusCode);
        try {
          const parsed = JSON.parse(data);
          if (isLoginExpired(parsed)) { resolve({ __needLogin: true }); return; }
          if (isCsrfTokenExpired(parsed)) { resolve({ __csrfExpired: true }); return; }
          resolve(parsed);
        } catch {
          resolve({ success: false, errorMsg: "HTTP " + res.statusCode + ": 响应非 JSON" });
        }
      });
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("请求超时")); });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

module.exports = {
  createBlankReport,
  saveReportSchema,
};
