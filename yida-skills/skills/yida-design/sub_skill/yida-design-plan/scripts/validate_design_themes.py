#!/usr/bin/env python3
"""Validate the design theme index and its full design.md templates."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


REQUIRED_HEADINGS = (
    "设计总览",
    "色彩",
    "字体与排版",
    "布局与间距",
    "表面与层级",
    "圆角与形状",
    "组件",
    "项目应用",
    "设计规范与禁忌",
)

ALLOWED_PLACEHOLDERS = {
    "PROJECT_NAME",
    "BUSINESS_DOMAIN",
    "EXPERIENCE_TOPOLOGY",
    "THEME_SOURCE",
    "PRIMARY_COLOR",
    "COLOR_SOURCE",
    "PROJECT_CONSTRAINTS",
    "PRODUCT_TOPOLOGY_APPLICATION",
    "PAGE_PATTERN_SUMMARY",
    "PAGE_APPLICATIONS",
    "BRAND_ASSETS",
    "ASSET_GAPS",
}

CANDIDATE_RULE_FILES = (
    "../../../yida-app/workflow/plan/step-2-confirm.md",
    "references/visual-theme-selection.md",
    "references/build-plan-schema.md",
)

LEGACY_TOKEN_KEY_RE = re.compile(
    r"(?m)^\s+[\"']?(?:"
    r"fontFamily|fontSize|fontWeight|lineHeight|letterSpacing|"
    r"xs|sm|md|lg|xl|2xl|"
    r"corner-(?:zero|circle|semicircle|\d+)"
    r")[\"']?:"
)
TOKEN_SUFFIX_SHORTHAND_RE = re.compile(r"--[a-z0-9-]+/(?!\s*--)")
TOKEN_WILDCARD_RE = re.compile(r"--[a-z0-9-]*\*")


def frontmatter_value(text: str, key: str) -> str | None:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*[\"']?([^\"'\n]+)[\"']?\s*$", text)
    return match.group(1).strip() if match else None


def validate(skill_root: Path) -> list[str]:
    errors: list[str] = []
    index_path = skill_root / "templates" / "design-themes" / "index.json"
    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"无法读取主题索引 {index_path}: {exc}"]

    themes = index.get("themes")
    if not isinstance(themes, list) or not themes:
        return ["templates/design-themes/index.json 缺少非空 themes 数组"]

    seen_ids: set[str] = set()
    seen_labels: set[str] = set()
    seen_paths: set[str] = set()
    for position, theme in enumerate(themes):
        prefix = f"themes[{position}]"
        if not isinstance(theme, dict):
            errors.append(f"{prefix} 必须是对象")
            continue

        required = (
            "themeId",
            "label",
            "description",
            "templatePath",
            "defaultProfile",
        )
        for field in required:
            if theme.get(field) in (None, "", [], {}):
                errors.append(f"{prefix} 缺少 {field}")

        theme_id = str(theme.get("themeId") or "")
        label = str(theme.get("label") or "")
        template_path = str(theme.get("templatePath") or "")
        if theme_id and theme_id in seen_ids:
            errors.append(f"重复 themeId: {theme_id}")
        if theme_id:
            seen_ids.add(theme_id)
        if label and label in seen_labels:
            errors.append(f"重复 label: {label}")
        if label:
            seen_labels.add(label)
        if template_path and template_path in seen_paths:
            errors.append(f"重复 templatePath: {template_path}")
        if template_path:
            seen_paths.add(template_path)

        full_path = skill_root / template_path
        if not full_path.is_file():
            errors.append(f"{prefix} 模板不存在: {template_path}")
            continue
        text = full_path.read_text(encoding="utf-8")
        if frontmatter_value(text, "themeId") != theme_id:
            errors.append(f"{template_path} 的 themeId 与索引不一致")

        frontmatter_match = re.match(r"\A---\n([\s\S]*?)\n---", text)
        if not frontmatter_match:
            errors.append(f"{template_path} 缺少合法 YAML frontmatter")
        else:
            legacy_keys = sorted(set(LEGACY_TOKEN_KEY_RE.findall(frontmatter_match.group(1))))
            if legacy_keys:
                errors.append(f"{template_path} 含旧式 Token 属性名")

        if TOKEN_SUFFIX_SHORTHAND_RE.search(text):
            errors.append(f"{template_path} 含未展开的 Token 后缀缩写")
        if TOKEN_WILDCARD_RE.search(text):
            errors.append(f"{template_path} 含未展开的 Token 通配写法")

        for heading in REQUIRED_HEADINGS:
            if f"## {heading}" not in text:
                errors.append(f"{template_path} 缺少章节：{heading}")

        placeholders = set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", text))
        unknown = placeholders - ALLOWED_PLACEHOLDERS
        missing = ALLOWED_PLACEHOLDERS - placeholders
        if unknown:
            errors.append(f"{template_path} 含未知占位符：{', '.join(sorted(unknown))}")
        if missing:
            errors.append(f"{template_path} 缺少标准占位符：{', '.join(sorted(missing))}")

    template_dir = skill_root / "templates" / "design-themes"
    indexed_files = {Path(path).name for path in seen_paths}
    actual_files = {path.name for path in template_dir.glob("*.md") if path.name != "README.md"}
    for filename in sorted(actual_files - indexed_files):
        errors.append(f"主题模板未登记到索引：templates/design-themes/{filename}")
    for filename in sorted(indexed_files - actual_files):
        errors.append(f"索引引用了不存在的主题模板：templates/design-themes/{filename}")

    for relative_path in CANDIDATE_RULE_FILES:
        rule_path = skill_root / relative_path
        try:
            rule_text = rule_path.read_text(encoding="utf-8")
        except OSError as exc:
            errors.append(f"无法读取候选规则 {relative_path}: {exc}")
            continue
        for theme in themes:
            if not isinstance(theme, dict):
                continue
            theme_id = str(theme.get("themeId") or "")
            label = str(theme.get("label") or "")
            if theme_id and theme_id in rule_text:
                errors.append(f"{relative_path} 硬编码了主题 ID：{theme_id}")
            if label and label in rule_text:
                errors.append(f"{relative_path} 硬编码了主题名称：{label}")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skill-root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="yida-build-plan skill root",
    )
    args = parser.parse_args()
    errors = validate(args.skill_root.resolve())
    if errors:
        print("主题模板校验失败：")
        for error in errors:
            print(f"- {error}")
        return 1
    print("主题索引与完整 design.md 模板校验通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
