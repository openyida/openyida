"use strict";

const fs = require("fs");
const path = require("path");

const CREATE_FORM_PATH = path.join(__dirname, "..", "lib", "app", "create-form.js");
const sourceCode = fs.readFileSync(CREATE_FORM_PATH, "utf-8");

// ── Bug #1: isLoginExpired / isCsrfTokenExpired 必须从 utils.js 引入 ──

describe("create-form.js imports", () => {
  test("imports isLoginExpired from utils.js", () => {
    const requireLine = sourceCode
      .split("\n")
      .find((line) => line.includes('require("../core/utils")') || line.includes("require('../core/utils')"));
    expect(requireLine).toBeDefined();
    expect(requireLine).toContain("isLoginExpired");
  });

  test("imports isCsrfTokenExpired from utils.js", () => {
    const requireLine = sourceCode
      .split("\n")
      .find((line) => line.includes('require("../core/utils")') || line.includes("require('../core/utils')"));
    expect(requireLine).toBeDefined();
    expect(requireLine).toContain("isCsrfTokenExpired");
  });

  test("isLoginExpired is used in request handlers", () => {
    const usageCount = (sourceCode.match(/isLoginExpired\(/g) || []).length;
    expect(usageCount).toBeGreaterThanOrEqual(2);
  });

  test("isCsrfTokenExpired is used in request handlers", () => {
    const usageCount = (sourceCode.match(/isCsrfTokenExpired\(/g) || []).length;
    expect(usageCount).toBeGreaterThanOrEqual(2);
  });
});

// ── Bug #2: generateFieldId 必须使用递增计数器确保唯一性 ──

describe("generateFieldId uniqueness", () => {
  test("generateFieldId uses an incrementing counter variable", () => {
    expect(sourceCode).toContain("_fieldIdCounter");
  });

  test("generateFieldId increments the counter on each call", () => {
    const functionBody = extractFunctionBody(sourceCode, "generateFieldId");
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain("_fieldIdCounter++");
  });

  test("counter value is included in the generated suffix", () => {
    const functionBody = extractFunctionBody(sourceCode, "generateFieldId");
    expect(functionBody).toBeDefined();
    expect(functionBody).toContain("counterPart");
    expect(functionBody).toMatch(/suffix\s*=.*counterPart/);
  });
});

// ── Bug #3: buildFormSchema 不能有重复嵌套的 FormContainer ──

describe("buildFormSchema FormContainer structure", () => {
  test("FormContainer does not nest another FormContainer as direct child", () => {
    const formSchemaFunction = extractFunctionBody(sourceCode, "buildFormSchema");
    expect(formSchemaFunction).toBeDefined();

    const formContainerMatches = formSchemaFunction.match(/componentName:\s*['"]FormContainer['"]/g) || [];
    expect(formContainerMatches.length).toBe(1);
  });

  test("RootContent has exactly one FormContainer child", () => {
    const formSchemaFunction = extractFunctionBody(sourceCode, "buildFormSchema");
    expect(formSchemaFunction).toBeDefined();

    const rootContentIndex = formSchemaFunction.search(/['"]RootContent['"]/);
    expect(rootContentIndex).toBeGreaterThan(-1);

    const afterRootContent = formSchemaFunction.slice(rootContentIndex);
    const formContainerCount = (afterRootContent.match(/componentName:\s*['"]FormContainer['"]/g) || []).length;
    expect(formContainerCount).toBe(1);
  });
});

// ── JS 语法检查 ──

describe("create-form.js syntax", () => {
  test("passes Node.js syntax check", () => {
    const { execSync } = require("child_process");
    expect(() => {
      execSync("node --check " + CREATE_FORM_PATH, { stdio: "pipe" });
    }).not.toThrow();
  });
});

// ── 辅助函数：提取函数体 ──

function extractFunctionBody(source, functionName) {
  const pattern = new RegExp("function\\s+" + functionName + "\\s*\\(");
  const match = pattern.exec(source);
  if (!match) return null;

  let braceCount = 0;
  let started = false;
  let startIndex = match.index;

  for (let charIndex = match.index; charIndex < source.length; charIndex++) {
    if (source[charIndex] === "{") {
      braceCount++;
      started = true;
    } else if (source[charIndex] === "}") {
      braceCount--;
      if (started && braceCount === 0) {
        return source.slice(startIndex, charIndex + 1);
      }
    }
  }
  return null;
}
