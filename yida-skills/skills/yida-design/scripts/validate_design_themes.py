#!/usr/bin/env python3
"""Validate the shared V2 theme catalog and design.md templates (Python 3.9+)."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REQUIRED_HEADINGS = (
    "1. 风格摘要",
    "2. 页面视觉系统",
    "3. 基础组件表达",
    "4. 特色表达配方",
    "5. 项目应用与调整规则",
)
REQUIRED_PLACEHOLDERS = {"PROJECT_NAME", "PRIMARY_COLOR", "COLOR_SOURCE", "PAGE_APPLICATIONS"}
CANDIDATE_RULE_FILES = (
    "../yida-app/workflow/plan/step-2-confirm.md",
    "sub_skill/yida-design-plan/references/visual-theme-selection.md",
    "sub_skill/yida-design-plan/references/build-plan-schema.md",
)
TOKEN_NAME = re.compile(r"--[a-z][a-zA-Z0-9-]*\Z")
TOKEN_REFERENCE = re.compile(r"--[a-z][a-zA-Z0-9-]*")
TOKEN_SUFFIX_SHORTHAND = re.compile(r"--[a-z0-9-]+/(?!\s*--)")
TOKEN_WILDCARD = re.compile(r"--[a-z0-9-]*\*")


def parse_scalar(raw: str) -> str | dict:
    """Read the template's YAML mapping subset without a PyYAML dependency.

    Quoted strings, plain CSS scalars and empty maps are supported; sequences,
    aliases, tags and block strings are rejected instead of silently ignored.
    """
    if raw.startswith('"'):
        value, end = json.JSONDecoder().raw_decode(raw)
        if raw[end:].strip() and not raw[end:].lstrip().startswith("#"):
            raise ValueError("字符串后含无效内容")
        return value
    if raw.startswith("'"):
        match = re.fullmatch(r"'((?:[^']|'')*)'\s*(?:#.*)?", raw)
        if not match:
            raise ValueError("单引号字符串未闭合")
        return match.group(1).replace("''", "'")
    value = re.split(r"\s+#", raw, maxsplit=1)[0].strip()
    if value == "{}":
        return {}
    if not value or value[0] in "[{&*!|>" or value in ("null", "~", "true", "false"):
        raise ValueError("仅支持映射和非空 CSS 标量")
    return value


def parse_frontmatter(text: str) -> dict:
    match = re.match(r"\A---\n([\s\S]*?)\n---(?:\n|$)", text)
    if not match:
        raise ValueError("缺少合法 YAML frontmatter")
    root: dict = {}
    stack = [(-2, root)]
    for number, line in enumerate(match.group(1).splitlines(), start=2):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.fullmatch(r'([ ]*)("[^"\n]+"|\'[^\'\n]+\'|[a-zA-Z_][\w-]*):(?:\s+(.*))?', line)
        if not item:
            raise ValueError(f"第 {number} 行不是受支持的 YAML 映射")
        indent = len(item.group(1))
        key = item.group(2).strip('"\'')
        raw = (item.group(3) or "").strip()
        while stack[-1][0] >= indent:
            stack.pop()
        parent_indent, parent = stack[-1]
        if indent != parent_indent + 2:
            raise ValueError(f"第 {number} 行缩进应逐级增加两个空格")
        if key in parent:
            raise ValueError(f"第 {number} 行重复定义 {key}")
        value = {} if not raw or raw.startswith("#") else parse_scalar(raw)
        parent[key] = value
        if isinstance(value, dict):
            stack.append((indent, value))
    return root


def collect_tokens(node: object, label: str, errors: list[str]) -> dict[str, str]:
    tokens: dict[str, str] = {}
    if not isinstance(node, dict):
        errors.append(f"{label} 必须是映射")
        return tokens
    for key, value in node.items():
        if key.startswith("--"):
            if not TOKEN_NAME.fullmatch(key) or not isinstance(value, str) or not value:
                errors.append(f"{label} 含无效 Token 声明：{key}")
                continue
            nested = {key: value}
        elif isinstance(value, dict):
            nested = collect_tokens(value, f"{label}.{key}", errors)
        else:
            errors.append(f"{label} 标量必须使用完整 CSS 变量名：{key}")
            continue
        for name, token_value in nested.items():
            if name in tokens:
                errors.append(f"{label} 重复定义变量：{name}")
            tokens[name] = token_value
    return tokens


def validate_tokens(frontmatter: dict, text: str, label: str, contract: dict, errors: list[str]) -> None:
    groups = contract["groups"]
    basic_tokens = {name for names in groups.values() for name in names}
    tokens = frontmatter.get("tokens")
    if not isinstance(tokens, dict) or set(tokens) != {"application-global", "custom-page"}:
        errors.append(f"{label} tokens 必须包含 application-global 和 custom-page 两层")
        return
    global_tokens = collect_tokens(tokens["application-global"], f"{label} application-global", errors)
    custom_tokens = collect_tokens(tokens["custom-page"], f"{label} custom-page", errors)
    missing = sorted(basic_tokens - set(global_tokens))
    if missing:
        errors.append(f"{label} 全局变量集合缺少基础变量：{missing}")
    overlap = set(global_tokens) & set(custom_tokens)
    if overlap:
        errors.append(f"{label} 页面层重复定义全局变量：{', '.join(sorted(overlap))}")
    for name, value in contract["fixedValues"].items():
        if name in global_tokens and global_tokens[name] != str(value):
            errors.append(f"{label} {name} 应使用固定值 {value}")
    if global_tokens.get("--color-brand1-6") != "{{PRIMARY_COLOR}}":
        errors.append(f"{label} --color-brand1-6 必须使用项目主色占位符")
    if "--oyd-page-bg" in custom_tokens and custom_tokens["--oyd-page-bg"] != "var(--pod-page-bg-color)":
        errors.append(f"{label} --oyd-page-bg 必须单向继承 --pod-page-bg-color")

    declared = {**global_tokens, **custom_tokens}
    unsupported = set(declared) & {"--color-brand1-4", "--color-brand1-7", "--color-brand1-8"}
    if unsupported:
        errors.append(f"{label} 不支持的品牌色阶：{', '.join(sorted(unsupported))}")
    unknown = set(TOKEN_REFERENCE.findall(text)) - set(declared)
    if unknown:
        errors.append(f"{label} 引用了未声明变量：{', '.join(sorted(unknown))}")
    dependencies = {name: set(TOKEN_REFERENCE.findall(value)) for name, value in declared.items()}
    visited: set[str] = set()
    active: set[str] = set()

    def visit(name: str) -> None:
        if name in active:
            errors.append(f"{label} 变量循环引用：{name}")
            return
        if name in visited or name not in dependencies:
            return
        active.add(name)
        for dependency in dependencies[name]:
            visit(dependency)
        active.remove(name)
        visited.add(name)

    for name in declared:
        visit(name)
    for name in global_tokens:
        if name.startswith("--color-brand1-") and name != "--color-brand1-6" and "--color-brand1-6" not in dependencies[name]:
            errors.append(f"{label} {name} 必须与 --color-brand1-6 同源")


def validate(skill_root: Path) -> list[str]:
    errors: list[str] = []
    template_dir = skill_root / "templates" / "design-themes"
    try:
        index = json.loads((template_dir / "index.json").read_text(encoding="utf-8"))
        if not isinstance(index, dict) or index.get("schemaVersion") != "2.0":
            return ["主题索引 schemaVersion 必须为 2.0"]
        themes = index.get("themes")
        if not isinstance(themes, list) or not themes:
            return ["主题索引缺少非空 themes 数组"]
        contract = json.loads((template_dir / "basic-tokens.json").read_text(encoding="utf-8"))
        names = [name for group in contract["groups"].values() for name in group]
        if len(set(names)) != len(names) or not all(isinstance(name, str) and TOKEN_NAME.fullmatch(name) for name in names):
            return ["基础变量契约含重复或非法变量名"]
        if not isinstance(contract["fixedValues"], dict) or set(contract["fixedValues"]) - set(names):
            return ["基础变量契约 fixedValues 必须引用已登记变量"]
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as exc:
        return [f"无法读取主题索引或基础变量契约：{exc}"]

    seen = {field: set() for field in ("themeId", "label", "templatePath")}
    for position, theme in enumerate(themes):
        label = f"themes[{position}]"
        if not isinstance(theme, dict):
            errors.append(f"{label} 必须是对象")
            continue
        for field in (*seen, "styleSummary"):
            value = theme.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{label} 缺少非空字符串 {field}")
            elif field in seen:
                if value in seen[field]:
                    errors.append(f"重复 {field}: {value}")
                seen[field].add(value)
        theme_id = theme.get("themeId")
        template_path = theme.get("templatePath")
        if not isinstance(theme_id, str) or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", theme_id):
            errors.append(f"{label} themeId 格式非法")
            continue
        if template_path not in (f"templates/design-themes/{theme_id}.md", f"templates/design-themes/{theme_id}/design.md"):
            errors.append(f"{label} templatePath 必须指向公共主题目录中的同名模板")
            continue
        full_path = (skill_root / template_path).resolve()
        if full_path.parent not in (template_dir.resolve(), (template_dir / theme_id).resolve()):
            errors.append(f"{label} templatePath 不得越出公共主题目录")
            continue
        if theme.get("collection") == "application-styles":
            if theme.get("mode") not in ("template", "creative"):
                errors.append(f"{label} mode 必须是 template 或 creative")
            for field, filename in (("cssTemplatePath", "app_theme.css"), ("formLayoutPath", "form-layout.json")):
                expected = f"templates/design-themes/{theme_id}/{filename}"
                if theme.get(field) != expected or not (skill_root / expected).is_file():
                    errors.append(f"{label} 缺少配对资产 {field}: {expected}")
        try:
            text = full_path.read_text(encoding="utf-8")
            frontmatter = parse_frontmatter(text)
        except (OSError, ValueError) as exc:
            errors.append(f"{template_path}: {exc}")
            continue
        if frontmatter.get("themeId") != theme_id:
            errors.append(f"{template_path} 的 themeId 与索引不一致")
        validate_tokens(frontmatter, text, template_path, contract, errors)
        headings = re.findall(r"^## (.+)$", text, re.M)
        if headings != list(REQUIRED_HEADINGS):
            errors.append(f"{template_path} 必须依次包含 V2 五个章节")
        placeholders = set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", text))
        if placeholders != REQUIRED_PLACEHOLDERS:
            errors.append(f"{template_path} 项目占位符不符合 V2 契约：缺少 {sorted(REQUIRED_PLACEHOLDERS - placeholders)}，未知 {sorted(placeholders - REQUIRED_PLACEHOLDERS)}")
        if TOKEN_SUFFIX_SHORTHAND.search(text) or TOKEN_WILDCARD.search(text):
            errors.append(f"{template_path} 含未展开的 Token 后缀缩写或通配写法")

    actual_files = {f"templates/design-themes/{p.relative_to(template_dir)}" for p in template_dir.rglob("*.md") if p.name != "README.md"}
    for name in sorted(actual_files - seen["templatePath"]):
        errors.append(f"主题模板未登记到索引：{name}")
    for name in sorted(seen["templatePath"] - actual_files):
        errors.append(f"索引引用了不存在的主题模板：{name}")
    for relative_path in CANDIDATE_RULE_FILES:
        try:
            rule_text = (skill_root / relative_path).read_text(encoding="utf-8")
        except OSError as exc:
            errors.append(f"无法读取候选规则 {relative_path}: {exc}")
            continue
        for field in ("themeId", "label"):
            for value in seen[field] - {item.get(field) for item in themes if item.get("mode") == "creative"}:
                if value in rule_text:
                    errors.append(f"{relative_path} 硬编码了主题 {field}：{value}")
    return errors


def main() -> int:
    # Keep redirected Windows output readable even with inherited cp1252.
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skill-root", type=Path, default=Path(__file__).resolve().parents[1], help="shared yida-design skill root")
    errors = validate(parser.parse_args().skill_root.resolve())
    if errors:
        print("主题模板校验失败：")
        for error in errors:
            print(f"- {error}")
        return 1
    print("主题索引与完整 design.md 模板校验通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
