#!/usr/bin/env python3
"""Render OpenYida build-plan.json to build-plan.html."""

from __future__ import annotations

import argparse
import base64
import html
import json
import math
import re
import sys
from pathlib import Path
from typing import Any, Iterable


SECTIONS = [
    ("overview", "需求总览", "应用概述、业务全景图", "overview.png"),
    ("data-models", "数据模型", "表单、字段、属性", "data-models.png"),
    ("business-flows", "业务流程", "审批流、自动化流", "business-flows.png"),
    ("pages", "页面规划", "页面总览与自定义页详情", "pages.png"),
]

GRAPH_ACTION_ICONS = {
    "zoom_out": "graph-zoom-out.svg",
    "zoom_in": "graph-zoom-in.svg",
    "fit": "graph-fit.svg",
    "relations": "graph-relations.svg",
}

FORM_TYPE_ICONS = {
    "normal": "form-normal.svg",
    "process": "form-process.svg",
}

ICON_DIR = Path(__file__).resolve().parent.parent / "assets" / "icons"
ICON_CACHE: dict[str, str] = {}


def esc(value: Any) -> str:
    if value is None or value == "":
        return "-"
    if isinstance(value, bool):
        return "是" if value else "否"
    return html.escape(str(value), quote=True)


def safe_css_color(value: Any) -> str:
    """Return a safe hexadecimal CSS color or an empty string."""
    if not isinstance(value, str):
        return ""
    color = value.strip()
    if re.fullmatch(
        r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})",
        color,
    ):
        return color.upper()
    return ""


def list_items(items: Iterable[Any]) -> str:
    values = [item for item in items if item not in (None, "")]
    if not values:
        return '<p class="muted">-</p>'
    return "<ul>" + "".join(f"<li>{esc(item)}</li>" for item in values) + "</ul>"


def table(headers: list[str], rows: list[list[Any]]) -> str:
    head = "".join(f"<th>{esc(header)}</th>" for header in headers)
    body_rows = []
    for row in rows:
        cells = "".join(f"<td>{esc(cell)}</td>" for cell in row)
        body_rows.append(f"<tr>{cells}</tr>")
    body = "".join(body_rows) or (
        '<tr><td colspan="{0}" class="muted">-</td></tr>'.format(len(headers))
    )
    return f'<div class="table-wrap"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def icon_data_uri(icon_file: str) -> str:
    if icon_file in ICON_CACHE:
        return ICON_CACHE[icon_file]
    icon_path = ICON_DIR / icon_file
    if not icon_path.exists():
        return ""
    encoded = base64.b64encode(icon_path.read_bytes()).decode("ascii")
    mime_type = "image/svg+xml" if icon_path.suffix.lower() == ".svg" else "image/png"
    uri = f"data:{mime_type};base64,{encoded}"
    ICON_CACHE[icon_file] = uri
    return uri


def render_action_icon(action: str) -> str:
    icon_src = icon_data_uri(GRAPH_ACTION_ICONS[action])
    return (
        f'<img class="object-graph-action-icon" src="{esc(icon_src)}" '
        'alt="" aria-hidden="true" />'
    )


def form_type_icon(source: Any) -> str:
    form_type = "process" if "流程" in str(source or "") else "normal"
    return icon_data_uri(FORM_TYPE_ICONS[form_type])


def user_facing_copy(value: Any) -> Any:
    """Hide internal planning terminology from user-facing artifacts."""
    if not isinstance(value, str):
        return value
    text = value
    replacements = (
        ("没有强匹配的浏览或表单预设", "采用更符合当前浏览任务的分类信息结构"),
        ("基于预设改造", "业务优化结构"),
        ("直接采用预设", "标准页面结构"),
        ("预设", "标准结构"),
        ("模板", "方案"),
    )
    for source, target in replacements:
        text = text.replace(source, target)
    return text


def render_section_heading(anchor: str, title: Any = None) -> str:
    section = next((item for item in SECTIONS if item[0] == anchor), None)
    if section is None:
        return f'<h2 class="section-heading">{esc(title)}</h2>'
    _, default_title, _, icon = section
    icon_src = icon_data_uri(icon)
    icon_html = (
        f'<img src="{esc(icon_src)}" alt="" aria-hidden="true" />'
        if icon_src
        else '<span class="nav-icon-fallback" aria-hidden="true"></span>'
    )
    return (
        '<h2 class="section-heading">'
        f'<span class="section-heading-icon">{icon_html}</span>'
        f'<span>{esc(title or default_title)}</span>'
        '</h2>'
    )


def render_nav() -> str:
    items = []
    for anchor, title, subtitle, icon in SECTIONS:
        icon_src = icon_data_uri(icon)
        icon_html = (
            f'<img class="nav-icon-img" src="{esc(icon_src)}" alt="" aria-hidden="true" />'
            if icon_src
            else '<span class="nav-icon-fallback" aria-hidden="true"></span>'
        )
        items.append(
            f'<a class="nav-item" href="#{anchor}" data-section-id="{anchor}">'
            f'<span class="nav-icon">{icon_html}</span>'
            f'<span class="nav-copy"><span class="nav-title">{esc(title)}</span>'
            f'<span class="nav-subtitle">{esc(subtitle)}</span></span></a>'
        )
    return "".join(items)


def parse_mermaid_edges(content: str) -> list[tuple[str, str, str]]:
    edges: list[tuple[str, str, str]] = []
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("graph "):
            continue
        match = re.match(r"^(.+?)\s*[-=]+>\s*(.+)$", stripped)
        if not match:
            continue
        left = match.group(1).strip().strip('"')
        right = match.group(2).strip().strip('"')
        if left and right:
            edges.append((left, right, "关联"))
    return edges


def node_id(value: Any) -> str:
    text = str(value or "").strip()
    return re.sub(r"\s+", "_", text)


def truncate_text(value: Any, length: int = 12) -> str:
    text = str(value or "")
    return text if len(text) <= length else text[: length - 1] + "…"


def collect_graph_data(
    graph: dict[str, Any], data_models: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    model_by_name = {str(model.get("name")): model for model in data_models if model.get("name")}
    nodes: dict[str, dict[str, Any]] = {}

    def add_node(raw: Any, fallback_source: str = "宜搭表单") -> str:
        if isinstance(raw, dict):
            name = raw.get("name") or raw.get("label") or raw.get("id")
            source = raw.get("source") or raw.get("formType") or fallback_source
            group = raw.get("group") or raw.get("category") or ""
            color = raw.get("color") or ""
        else:
            name = raw
            source = fallback_source
            group = ""
            color = ""
        identifier = node_id(name)
        if not identifier:
            return ""
        model = model_by_name.get(str(name))
        if model:
            source = model.get("formType") or source
        nodes.setdefault(
            identifier,
            {
                "id": identifier,
                "name": str(name),
                "source": source,
                "group": group,
                "color": color,
            },
        )
        return identifier

    for raw_node in graph.get("nodes") or graph.get("tables") or []:
        add_node(raw_node)
    for model in data_models:
        add_node({"name": model.get("name"), "formType": model.get("formType")})

    relations: list[dict[str, str]] = []
    seen_relations: set[tuple[str, str, str]] = set()
    seen_pairs: set[tuple[str, str]] = set()

    def add_relation(source: Any, target: Any, label: Any = "关联") -> None:
        source_id = add_node(source)
        target_id = add_node(target)
        relation_label = str(label or "关联")
        if not source_id or not target_id or source_id == target_id:
            return
        pair = (source_id, target_id)
        if pair in seen_pairs:
            return
        key = (source_id, target_id, relation_label)
        if key in seen_relations:
            return
        seen_pairs.add(pair)
        seen_relations.add(key)
        relations.append({"from": source_id, "to": target_id, "label": relation_label})

    explicit_relations = graph.get("relations") or graph.get("edges") or []
    for raw_relation in explicit_relations:
        if not isinstance(raw_relation, dict):
            continue
        add_relation(
            raw_relation.get("from") or raw_relation.get("source"),
            raw_relation.get("to") or raw_relation.get("target"),
            raw_relation.get("label") or raw_relation.get("relation") or raw_relation.get("type"),
        )

    for source, target, label in parse_mermaid_edges(str(graph.get("content") or "")):
        add_relation(source, target, label)

    # Explicit business-graph relations are the confirmed fact source. Field
    # relations are only a fallback; merging both creates duplicate or reverse
    # edges and makes a correct business overview look like a dependency graph.
    if not explicit_relations and not relations:
        model_names = set(model_by_name)
        for model in data_models:
            model_name = model.get("name")
            for field in model.get("fields") or []:
                relation = field.get("relation")
                if relation in (None, "", "-") or relation not in model_names:
                    continue
                label = field.get("name") or "关联"
                add_relation(relation, model_name, label)

    return list(nodes.values()), relations


def graph_levels(nodes: list[dict[str, Any]], relations: list[dict[str, str]]) -> dict[str, int]:
    node_ids = [node["id"] for node in nodes]
    adjacency = {node_id: [] for node_id in node_ids}
    indegree = {node_id: 0 for node_id in node_ids}
    for relation in relations:
        source = relation["from"]
        target = relation["to"]
        if source not in adjacency or target not in adjacency:
            continue
        adjacency[source].append(target)
        indegree[target] += 1

    # Use first-visit breadth-first levels instead of longest-path relaxation.
    # Business forms often reference each other in both directions; longest-path
    # relaxation makes those cycles grow a very wide graph on every pass.
    levels: dict[str, int] = {}
    roots = [node_id for node_id in node_ids if indegree[node_id] == 0]
    start_nodes = roots + [node_id for node_id in node_ids if node_id not in roots]
    for start in start_nodes:
        if start in levels:
            continue
        levels[start] = 0
        queue = [start]
        cursor = 0
        while cursor < len(queue):
            source = queue[cursor]
            cursor += 1
            for target in adjacency[source]:
                if target in levels:
                    continue
                levels[target] = levels[source] + 1
                queue.append(target)

    # Keep the default overview readable inside a 16:9 viewport. Long chains are
    # proportionally folded into at most four columns; zoom remains available.
    max_level = max(levels.values(), default=0)
    max_columns = min(4, max(len(nodes), 1))
    if max_level >= max_columns:
        levels = {
            node_id: round(level * (max_columns - 1) / max_level)
            for node_id, level in levels.items()
        }
    return levels


def rounded_orthogonal_path(
    points: list[tuple[float, float]], radius: float = 12
) -> str:
    """Build an SVG path with rounded corners through orthogonal points."""
    compact: list[tuple[float, float]] = []
    for point in points:
        if compact and point == compact[-1]:
            continue
        compact.append(point)

    index = 1
    while index < len(compact) - 1:
        previous, current, following = compact[index - 1 : index + 2]
        same_x = previous[0] == current[0] == following[0]
        same_y = previous[1] == current[1] == following[1]
        if same_x or same_y:
            compact.pop(index)
            continue
        index += 1

    if len(compact) < 2:
        return ""

    def toward(
        origin: tuple[float, float], target: tuple[float, float], distance: float
    ) -> tuple[float, float]:
        delta_x = target[0] - origin[0]
        delta_y = target[1] - origin[1]
        length = math.hypot(delta_x, delta_y)
        if not length:
            return origin
        scale = distance / length
        return (origin[0] + delta_x * scale, origin[1] + delta_y * scale)

    def number(value: float) -> str:
        return f"{value:.2f}".rstrip("0").rstrip(".")

    commands = [f"M {number(compact[0][0])} {number(compact[0][1])}"]
    for point_index in range(1, len(compact) - 1):
        previous = compact[point_index - 1]
        current = compact[point_index]
        following = compact[point_index + 1]
        incoming = math.hypot(current[0] - previous[0], current[1] - previous[1])
        outgoing = math.hypot(following[0] - current[0], following[1] - current[1])
        corner_radius = min(radius, incoming / 2, outgoing / 2)
        before = toward(current, previous, corner_radius)
        after = toward(current, following, corner_radius)
        commands.append(f"L {number(before[0])} {number(before[1])}")
        commands.append(
            f"Q {number(current[0])} {number(current[1])} "
            f"{number(after[0])} {number(after[1])}"
        )
    commands.append(f"L {number(compact[-1][0])} {number(compact[-1][1])}")
    return " ".join(commands)


def render_business_graph(graph: dict[str, Any], data_models: list[dict[str, Any]]) -> str:
    content = graph.get("content") or ""
    nodes, relations = collect_graph_data(graph, data_models)
    if not nodes:
        return f'<div class="graph graph-fallback">{esc(content or "-")}</div>'

    levels = graph_levels(nodes, relations)
    level_groups: dict[int, list[dict[str, Any]]] = {}
    for node in nodes:
        level_groups.setdefault(levels.get(node["id"], 0), []).append(node)

    # A hub table can put many related forms into one semantic level, creating
    # a very tall column. Rebalance those crowded graphs into a compact grid
    # using the fact-source order, which should follow the business lifecycle.
    if max((len(items) for items in level_groups.values()), default=0) > 3:
        ordered_nodes = nodes
        column_count = min(4, max(1, math.ceil(math.sqrt(len(nodes)))))
        row_count = math.ceil(len(nodes) / column_count)
        level_groups = {
            column: ordered_nodes[column * row_count : (column + 1) * row_count]
            for column in range(column_count)
            if ordered_nodes[column * row_count : (column + 1) * row_count]
        }

    max_level = max(level_groups) if level_groups else 0
    max_rows = max((len(items) for items in level_groups.values()), default=1)
    card_width = 154
    card_height = 36
    gap_x = 58
    gap_y = 24
    margin = 44
    width = margin * 2 + (max_level + 1) * card_width + max_level * gap_x
    height = margin * 2 + max_rows * card_height + (max_rows - 1) * gap_y

    positions: dict[str, tuple[float, float]] = {}
    node_svg = []
    for level in sorted(level_groups):
        items = level_groups[level]
        column_height = len(items) * card_height + (len(items) - 1) * gap_y
        start_y = margin + max((height - margin * 2 - column_height) / 2, 0)
        x = margin + level * (card_width + gap_x)
        for index, node in enumerate(items):
            y = start_y + index * (card_height + gap_y)
            positions[node["id"]] = (x, y)
            source = node.get("source") or "宜搭表单"
            type_icon = form_type_icon(source)
            node_svg.append(
                f'''
<g class="object-node" data-node-id="{esc(node['id'])}" data-node-name="{esc(node.get('name'))}" role="button" tabindex="0" aria-label="表：{esc(node.get('name'))}，类型：{esc(source)}" transform="translate({x},{y})">
  <rect class="object-card" width="{card_width}" height="{card_height}" rx="10"></rect>
  <image class="object-node-icon" href="{esc(type_icon)}" x="12" y="10" width="16" height="16" aria-hidden="true"></image>
  <text class="object-title" x="36" y="23">{esc(truncate_text(node.get("name"), 8))}</text>
</g>'''
            )

    edge_svg = []
    edge_routes: dict[int, list[tuple[float, float]]] = {}
    same_column_slots: dict[float, int] = {}
    for edge_index, relation in enumerate(relations):
        if relation["from"] not in positions or relation["to"] not in positions:
            continue
        source_x, source_y = positions[relation["from"]]
        target_x, target_y = positions[relation["to"]]
        start_y = source_y + card_height / 2
        end_y = target_y + card_height / 2

        if target_x > source_x:
            start_x = source_x + card_width
            end_x = target_x
            trunk_x = start_x + min(32, max(24, (end_x - start_x) / 2))
            control_points = [] if start_y == end_y else [(trunk_x, start_y), (trunk_x, end_y)]
        elif target_x < source_x:
            start_x = source_x
            end_x = target_x + card_width
            trunk_x = start_x - min(32, max(24, (start_x - end_x) / 2))
            control_points = [] if start_y == end_y else [(trunk_x, start_y), (trunk_x, end_y)]
        else:
            slot_index = same_column_slots.get(source_x, 0)
            same_column_slots[source_x] = slot_index + 1
            lane_x = source_x + card_width + 24 + (slot_index % 3) * 10
            start_x = source_x + card_width
            end_x = target_x + card_width
            control_points = [(lane_x, start_y), (lane_x, end_y)]

        edge_routes[edge_index] = control_points
        path = rounded_orthogonal_path(
            [(start_x, start_y), *control_points, (end_x, end_y)], radius=12
        )

        edge_svg.append(
            f'''
<path class="object-edge" data-edge-id="edge-{edge_index}" data-source="{esc(relation['from'])}" data-target="{esc(relation['to'])}" data-label="{esc(relation.get('label'))}" d="{path}" marker-end="url(#relationArrow)"><title>{esc(relation.get('label'))}</title></path>'''
        )

    node_names = {node["id"]: node.get("name") or node["id"] for node in nodes}
    g6_data = {
        "nodes": [
            {
                "id": node["id"],
                "data": {
                    "name": node.get("name") or node["id"],
                    "source": node.get("source") or "宜搭表单",
                    "iconSrc": form_type_icon(node.get("source") or "宜搭表单"),
                    "group": node.get("group") or "",
                },
                "style": {
                    "x": positions[node["id"]][0] + card_width / 2,
                    "y": positions[node["id"]][1] + card_height / 2,
                },
            }
            for node in nodes
        ],
        "edges": [
            {
                "id": f"edge-{edge_index}",
                "source": relation["from"],
                "target": relation["to"],
                "data": {"label": relation.get("label") or "关联"},
                "controlPoints": [list(point) for point in edge_routes[edge_index]],
            }
            for edge_index, relation in enumerate(relations)
            if edge_index in edge_routes
        ],
    }
    g6_data_json = json.dumps(g6_data, ensure_ascii=False).replace("</", "<\\/")
    relation_items = []
    for edge_index, relation in enumerate(relations):
        relation_items.append(
            '<button class="object-relation-item" type="button" '
            f'data-edge-id="edge-{edge_index}" data-source="{esc(relation["from"])}" data-target="{esc(relation["to"])}">'
            f'<span class="object-relation-source">{esc(node_names.get(relation["from"], relation["from"]))}</span>'
            f'<span class="object-relation-label">{esc(relation.get("label"))}</span>'
            f'<span class="object-relation-target">{esc(node_names.get(relation["to"], relation["to"]))}</span>'
            '</button>'
        )

    return (
        '<div class="object-graph-component" data-business-graph>'
        '<div class="object-graph" data-graph-zoom>'
        '<div class="object-graph-toolbar" role="group" aria-label="业务全景图缩放控制">'
        '<span class="object-graph-status" data-graph-status>选择一张表，可聚焦查看关联关系</span>'
        '<div class="object-graph-actions">'
        '<button class="object-graph-zoom-button is-icon-only" type="button" data-graph-zoom-out aria-label="缩小业务全景图" title="缩小">'
        + render_action_icon("zoom_out")
        + '</button>'
        '<span class="object-graph-zoom-value" aria-live="polite">100%</span>'
        '<button class="object-graph-zoom-button is-icon-only" type="button" data-graph-zoom-in aria-label="放大业务全景图" title="放大">'
        + render_action_icon("zoom_in")
        + '</button>'
        '<button class="object-graph-zoom-button is-icon-only" type="button" data-graph-zoom-fit aria-label="完整显示业务全景图" title="适应画布">'
        + render_action_icon("fit")
        + '</button>'
        '<button class="object-graph-zoom-button has-label" type="button" data-graph-clear aria-label="显示全部业务关系">'
        + render_action_icon("relations")
        + '<span>全部关系</span></button>'
        '</div></div>'
        '<div class="object-graph-viewport" role="img" tabindex="0" '
        'aria-label="业务全景图：全部表以及表之间的关系。可使用加号、减号和数字 0 调整缩放。">'
        '<div class="object-graph-g6" data-g6-mount aria-hidden="true"></div>'
        '<div class="object-graph-fallback"><div class="object-graph-stage">'
        f'<svg class="object-graph-svg" viewBox="0 0 {width} {height}" '
        'preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'
        '<defs><filter id="cardShadow" x="-10%" y="-10%" width="120%" height="130%">'
        '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#181c1f" flood-opacity="0.08"/>'
        '</filter><marker id="relationArrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse" markerUnits="strokeWidth"><path d="M 1 1.5 L 6.5 4 L 1 6.5" fill="none" stroke="context-stroke" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"></path></marker></defs>'
        + "".join(edge_svg)
        + "".join(node_svg)
        + "</svg></div></div></div></div>"
        + f'<script class="object-graph-data" type="application/json">{g6_data_json}</script>'
        + '<div class="object-graph-relations"><div class="object-graph-relations-head"><strong>关系清单</strong><span>点击一条关系可在图中定位</span></div>'
        + '<div class="object-relation-list">'
        + "".join(relation_items)
        + "</div></div></div>"
    )


def render_overview(data: dict[str, Any]) -> str:
    overview = data.get("overview", {})
    raw_visual = data.get("visualStyle") or {}
    visual_for_user = raw_visual.get("forUser") or {}
    color_strategy = visual_for_user.get("colorStrategy") or {}
    graph = overview.get("businessGraph") or {}
    graph_note = graph.get("description") or graph.get("summary") or graph.get("content") or ""
    if isinstance(graph_note, str) and graph_note.strip().startswith("graph "):
        graph_note = ""
    sections = [
        ("数据模型", "核心表单与数据职责", overview.get("dataModelSummary", [])),
        ("业务流程", "关键流转与自动化规则", overview.get("flowSummary", [])),
        ("权限", "角色范围与数据边界", overview.get("rolePermissionSummary", [])),
        ("导航菜单", "主要入口与使用路径", overview.get("navigationSummary") or overview.get("pageSummary", [])),
    ]
    section_html = "".join(
        f"""
  <section class="overview-subsection">
    <h3>{esc(title)}</h3>
    <p class="overview-kicker">{esc(description)}</p>
    {list_items(items)}
  </section>
"""
        for title, description, items in sections
    )
    visual = overview.get("visualSummary") or visual_for_user.get("styleSummary") or "-"
    primary_color = safe_css_color(color_strategy.get("primaryColor"))
    primary_color_name = color_strategy.get("primaryColorName") or ""
    if primary_color or primary_color_name:
        swatch = (
            f'<span class="theme-color-swatch" style="background-color: {primary_color}" '
            'aria-hidden="true"></span>'
            if primary_color
            else ""
        )
        color_name = (
            f'<strong class="theme-color-name">{esc(primary_color_name)}</strong>'
            if primary_color_name
            else ""
        )
        color_value = (
            f'<code class="theme-color-value">{esc(primary_color)}</code>'
            if primary_color
            else ""
        )
        theme_color_html = f"""
    <div class="theme-color-row" aria-label="主题色 {esc(primary_color_name)} {esc(primary_color)}">
      {swatch}
      <span class="theme-color-label">主题色</span>
      {color_name}
      {color_value}
    </div>"""
    else:
        theme_color_html = '<p class="muted">主题色：-</p>'
    return f"""
<section id="overview" class="page-section">
  {render_section_heading("overview", overview.get("title") or "需求总览")}
  <p class="section-desc">确认应用定位、业务结构与整体方案</p>
  <section class="overview-subsection first">
    <h3>应用概述</h3>
    <p class="overview-kicker">产品定位、核心用户与待解决问题</p>
    <p class="summary">{esc(overview.get("summary"))}</p>
  </section>
  <section class="overview-subsection">
    <h3>业务全景图</h3>
    <p class="overview-kicker">业务对象及其关联关系</p>
    {f'<p class="summary">{esc(graph_note)}</p>' if graph_note else ''}
  {render_business_graph(graph, data.get("dataModels") or [])}
  </section>
  {section_html}
  <section class="overview-subsection">
    <h3>视觉设计</h3>
    <p class="overview-kicker">整体风格与主题色策略</p>
    <p class="summary">{esc(visual)}</p>
    {theme_color_html}
  </section>
</section>
"""


def render_data_models(data: dict[str, Any]) -> str:
    models = data.get("dataModels") or []
    parts = [
        f'<section id="data-models" class="page-section">{render_section_heading("data-models")}',
        '<p class="section-desc">表单、字段、属性</p>',
    ]
    for model in models:
        fields = model.get("fields") or []
        rows = [
            [
                field.get("name"),
                field.get("type"),
                field.get("required"),
                field.get("defaultOrOptions"),
                field.get("relation"),
                field.get("group"),
                field.get("description"),
            ]
            for field in fields
        ]
        parts.append(f'<h3>{esc(model.get("name", "表名称"))}</h3>')
        parts.append(f'<p class="muted">{esc(model.get("description", "一句话描述"))}</p>')
        if model.get("formType") or model.get("views"):
            views = "、".join(str(item) for item in model.get("views", []) if item)
            parts.append(
                f'<p class="muted">表单类型：{esc(model.get("formType"))}　视图：{esc(views)}</p>'
            )
        parts.append(
            table(
                ["字段", "字段类型", "必填", "默认值/选项", "关联关系", "分组", "说明"],
                rows,
            )
        )
    if not models:
        parts.append('<p class="muted">-</p>')
    parts.append("</section>")
    return "".join(parts)


def flow_tag(flow_type: str) -> str:
    if flow_type == "自动化":
        return "auto"
    if flow_type == "审批流":
        return "approval"
    return "business"


def render_business_flows(data: dict[str, Any]) -> str:
    flows = data.get("businessFlows") or []
    parts = [
        f'<section id="business-flows" class="page-section">{render_section_heading("business-flows")}',
        '<p class="section-desc">审批流、自动化流</p>',
    ]
    for flow in flows:
        flow_type = flow.get("type") or "业务流"
        nodes = [node for node in flow.get("nodes", []) if node]
        node_html = ""
        for index, node in enumerate(nodes):
            if index:
                node_html += '<span class="arrow">-></span>'
            node_html += f'<span class="node">{esc(node)}</span>'
        rules = flow.get("rules") or []
        parts.append(
            f"""
<div class="flow-card">
  <div class="flow-head">
    <div class="flow-title"><span class="tag {flow_tag(flow_type)}">{esc(flow_type)}</span>{esc(flow.get("name"))}</div>
    <div class="trigger">触发：{esc(flow.get("trigger"))}</div>
  </div>
  <div class="nodes">{node_html or '<span class="muted">-</span>'}</div>
  <p>{esc(flow.get("description"))}</p>
  <div class="soft-card">{list_items(rules)}</div>
</div>
"""
        )
    if not flows:
        parts.append('<p class="muted">-</p>')
    parts.append("</section>")
    return "".join(parts)


def render_pages(data: dict[str, Any]) -> str:
    pages = data.get("pages") or {}
    overview = pages.get("overview") or []
    details = pages.get("customPageDetails") or []

    rows = [[page.get("name"), page.get("type"), page.get("purpose")] for page in overview]
    parts = [
        f'<section id="pages" class="page-section">{render_section_heading("pages")}',
        '<p class="section-desc">页面总览与自定义页详情</p>',
        "<h3>页面总览</h3>",
        table(["页面名称", "类型", "用途"], rows),
        "<h3>自定义页面详情</h3>",
    ]
    for detail in details:
        primary_users = detail.get("primaryUsers") or []
        content_priority = detail.get("contentPriority") or []
        blocks = detail.get("blocks") or detail.get("functionalSections") or []
        first_screen = detail.get("firstScreenStructure") or detail.get("firstScreen")
        signature = detail.get("signatureInteraction") or detail.get("signatureMoment")
        layout_pattern = detail.get("layoutPattern") or {}
        pattern_adaptations: list[Any] = []
        if isinstance(layout_pattern, dict):
            pattern_id = str(layout_pattern.get("id") or "")
            pattern_names = {
                "form-focused": "聚焦填报页",
                "list-detail": "列表与详情页",
                "compact-workbench": "紧凑工作台",
                "custom-page-pattern": "分类信息页",
            }
            pattern_text = pattern_names.get(pattern_id)
            pattern_mode = layout_pattern.get("mode")
            mode_labels = {
                "preset": "标准页面结构",
                "adapted": "业务优化结构",
                "custom": "业务定制结构",
            }
            if not pattern_text:
                pattern_text = mode_labels.get(str(pattern_mode), "业务任务结构")
            pattern_reason = layout_pattern.get("reason")
            if pattern_reason:
                pattern_text = f"{pattern_text or '-'}；{user_facing_copy(pattern_reason)}"
            pattern_adaptations = layout_pattern.get("adaptations") or []
        else:
            pattern_text = layout_pattern
        content_richness = detail.get("contentRichness") or {}
        if isinstance(content_richness, dict):
            richness_requirement = content_richness.get("requirement")
            richness_layers = content_richness.get("contentLayers") or []
            richness_anti_filler = content_richness.get("antiFiller") or []
        else:
            richness_requirement = content_richness
            richness_layers = []
            richness_anti_filler = []
        richness_labels = {
            "rich-but-relevant": "信息充分，突出关键内容",
            "focused": "聚焦核心任务",
            "minimal": "精简必要信息",
        }
        richness_requirement = richness_labels.get(
            str(richness_requirement), user_facing_copy(richness_requirement)
        )
        density_labels = {"compact": "紧凑", "comfortable": "适中", "spacious": "宽松"}
        raw_density = detail.get("density")
        density = density_labels.get(str(raw_density), user_facing_copy(raw_density))
        permission = detail.get("permissionSummary") or detail.get("permission")
        is_new_page_schema = any(
            key in detail
            for key in (
                "primaryUsers",
                "primaryTask",
                "contentPriority",
                "firstScreenStructure",
                "signatureInteraction",
                "layoutPattern",
                "contentRichness",
                "density",
                "permissionSummary",
            )
        )
        planning_context = ""
        if is_new_page_schema:
            planning_context = f"""
  <p><strong>核心用户：</strong>{esc("、".join(str(item) for item in primary_users if item))}</p>
  <p><strong>核心任务：</strong>{esc(detail.get("primaryTask"))}</p>
  <p><strong>内容优先级：</strong></p>{list_items(content_priority)}
"""
        pattern_context = ""
        if is_new_page_schema:
            pattern_context = f"""
  <p><strong>页面结构：</strong>{esc(pattern_text)}</p>
  {('<p><strong>结构优化：</strong></p>' + list_items(pattern_adaptations)) if pattern_adaptations else ''}
  <p><strong>信息密度：</strong>{esc(density)}</p>
"""
        richness_context = ""
        if content_richness:
            richness_context = f"""
  <p><strong>内容丰富度：</strong>{esc(richness_requirement)}</p>
  <p><strong>内容层次：</strong></p>{list_items(richness_layers)}
  <p><strong>避免填充：</strong></p>{list_items(richness_anti_filler)}
"""
        first_screen_label = "首屏结构" if is_new_page_schema else "首屏印象"
        signature_label = "标志性交互" if is_new_page_schema else "标志性时刻"
        parts.append(
            f"""
<div class="card page-detail">
  <h4>{esc(detail.get("name"))} <span class="tag approval">{esc(detail.get("type", "自定义页面"))}</span></h4>
  <p><strong>页面定位：</strong>{esc(detail.get("positioning"))}</p>
  {planning_context}
  <p><strong>功能区块：</strong></p>{list_items(blocks)}
  <p><strong>{first_screen_label}：</strong>{esc(first_screen)}</p>
  <p><strong>{signature_label}：</strong>{esc(signature)}</p>
  {richness_context}
  {pattern_context}
  <p><strong>权限说明：</strong>{esc(permission)}</p>
</div>
"""
        )
    if not details:
        parts.append('<p class="muted">-</p>')
    parts.append("</section>")
    return "".join(parts)


def render_visual_style(data: dict[str, Any]) -> str:
    raw_visual = data.get("visualStyle") or {}
    visual = raw_visual.get("forUser") or {}
    asset_strategy = visual.get("assetStrategy") or {}
    selected_theme = visual.get("selectedTheme") or {}
    legacy_option = visual.get("selectedStyleOption") or {}
    color_strategy = visual.get("colorStrategy") or {}
    legacy_theme_color = legacy_option.get("themeColorIntent") or {}
    theme_profile = visual.get("themeProfile") or {}
    visual_memories = visual.get("visualMemories") or []
    page_applications = visual.get("pageApplications") or raw_visual.get("pageApplications") or []
    legacy_page_planning = visual.get("pageVisualPlanning") or []

    def value_list(value: Any) -> str:
        if isinstance(value, list):
            return esc("、".join(str(item) for item in value if item) or "-")
        if isinstance(value, dict):
            parts = []
            for key, item in value.items():
                if isinstance(item, list):
                    display = "、".join(str(i) for i in item if i) or "-"
                else:
                    display = str(item) if item not in (None, "") else "-"
                parts.append(f"{key}: {display}")
            return esc("；".join(parts) or "-")
        return esc(value)

    def key_value_card(title: str, rows: list[tuple[str, Any]]) -> str:
        body = "".join(
            f"<tr><th>{esc(label)}</th><td>{value_list(value)}</td></tr>"
            for label, value in rows
        )
        return f'<div class="table-wrap"><table><tbody>{body}</tbody></table></div>'

    if isinstance(visual_memories, str):
        memories_html = f'<div class="card"><h4>{esc(visual_memories)}</h4></div>'
    else:
        memory_cards = []
        for memory in visual_memories:
            if isinstance(memory, dict):
                memory_cards.append(
                    f"""
<div class="card">
  <h4>{esc(memory.get("name"))}</h4>
  <p><strong>规则：</strong>{esc(memory.get("rule"))}</p>
  <p><strong>用户价值：</strong>{esc(memory.get("userValue"))}</p>
  <p><strong>失败表现：</strong>{esc(memory.get("failureMode"))}</p>
</div>
"""
                )
            else:
                memory_cards.append(f'<div class="card"><h4>{esc(memory)}</h4></div>')
        memories_html = "".join(memory_cards) or '<p class="muted">-</p>'

    if page_applications:
        def memory_names(item: dict[str, Any]) -> str:
            applications = item.get("visualMemoryApplications") or []
            names = [
                application.get("name")
                for application in applications
                if isinstance(application, dict) and application.get("name")
            ]
            if not names:
                legacy_names = item.get("visualMemories") or []
                if isinstance(legacy_names, list):
                    names = [str(name) for name in legacy_names if name]
                elif legacy_names:
                    names = [str(legacy_names)]
            return "、".join(names) or "-"

        page_rows = [
            [
                item.get("pageName"),
                item.get("visualApplication"),
                item.get("surface"),
                item.get("primaryAction"),
                item.get("states"),
                memory_names(item),
            ]
            for item in page_applications
            if isinstance(item, dict)
        ]
        page_plan_html = table(
            ["页面", "视觉应用", "表面层次", "主操作", "状态表达", "视觉记忆点"],
            page_rows,
        )
        page_section_title = "页面视觉应用"
    elif legacy_page_planning:
        page_rows = [
            [
                item.get("pageName"),
                item.get("layoutRhythm"),
                item.get("density"),
                item.get("firstScreenFocus"),
                item.get("experience"),
            ]
            for item in legacy_page_planning
            if isinstance(item, dict)
        ]
        page_plan_html = table(
            ["页面", "布局节奏", "信息密度", "首屏重点", "使用感受"],
            page_rows,
        )
        page_section_title = "页面视觉规划"
    else:
        page_plan_html = '<p class="muted">-</p>'
        page_section_title = "页面视觉应用"

    selected_label = selected_theme.get("label") or legacy_option.get("label")
    selected_summary = selected_theme.get("summary") or selected_label
    selected_source = selected_theme.get("source") or legacy_option.get("source")
    primary_color = (
        color_strategy.get("primaryColorName")
        or color_strategy.get("primaryColor")
        or visual.get("primaryColorIntent")
        or legacy_theme_color.get("name")
    )
    recommendation_reasons = (
        selected_theme.get("recommendationReasons")
        or legacy_theme_color.get("reason")
    )
    theme_profile_html = ""
    if theme_profile:
        theme_profile_html = f"""
  <h3>主题画像</h3>
  {key_value_card("主题画像", [
      ("整体气质", theme_profile.get("tone")),
      ("表面语言", theme_profile.get("surfaceStyle")),
      ("对比强度", theme_profile.get("contrastLevel")),
      ("品牌表达", theme_profile.get("brandIntensity")),
      ("圆角", theme_profile.get("radiusScale")),
      ("阴影", theme_profile.get("shadowLevel")),
      ("图标", theme_profile.get("iconStyle")),
      ("动效", theme_profile.get("motionLevel")),
  ])}
"""

    return f"""
<section id="visual-style" class="page-section">
  <h2>视觉风格</h2>
  <p class="section-desc">视觉主题、色彩策略</p>
  <div class="card">
    <p><strong>一句话主题：</strong>{esc(visual.get("styleSummary") or selected_summary)}</p>
    <p><strong>视觉主题：</strong>{esc(selected_label or visual.get("userVisualIntent") or legacy_option.get("visualDirection"))}</p>
    <p><strong>主题色：</strong>{esc(primary_color)}</p>
    <p><strong>风格来源：</strong>{esc(visual.get("styleSource"))}</p>
  </div>
  <h3>主题与色彩</h3>
  {key_value_card("主题与色彩", [
      ("主题来源", visual.get("styleSource") or selected_source),
      ("色彩来源", color_strategy.get("source") or visual.get("styleSource") or selected_source),
      ("色彩用法", color_strategy.get("usage") or visual.get("themeRelationSummary")),
      ("推荐理由", recommendation_reasons),
  ])}
  {theme_profile_html}
  <h3>{page_section_title}</h3>
  {page_plan_html}
  <h3>视觉记忆点</h3>
  {memories_html}
  <h3>层次与组件</h3>
  {key_value_card("层次与组件", [
      ("层次摘要", visual.get("hierarchySummary")),
      ("组件基调", visual.get("componentToneSummary")),
      ("状态反馈", visual.get("stateSummary")),
      ("响应式摘要", visual.get("responsiveSummary")),
  ])}
  <h3>图标与素材</h3>
  {key_value_card("图标与素材", [
      ("图标风格", visual.get("iconSummary")),
      ("素材状态", asset_strategy.get("materialStatus")),
      ("Hero 图", asset_strategy.get("heroImage")),
      ("产品 / 案例图", asset_strategy.get("productImages")),
      ("素材缺口", asset_strategy.get("missingAssets")),
      ("说明", asset_strategy.get("notes")),
  ])}
  <h3>应用生成准备</h3>
  <div class="soft-card">{esc(visual.get("designMdReady") or "已同步生成 design.md，后续 AI 开发读取完整设计契约。")}</div>
</section>
"""


def validate_plan(data: dict[str, Any]) -> None:
    errors = []
    if not isinstance(data, dict):
        errors.append("根节点必须是 JSON object")
    meta = data.get("meta") if isinstance(data, dict) else None
    if not isinstance(meta, dict):
        errors.append("缺少 meta")
    elif not meta.get("projectName"):
        errors.append("缺少 meta.projectName")
    if not isinstance(data.get("overview"), dict):
        errors.append("缺少 overview object")
    if not isinstance(data.get("dataModels"), list):
        errors.append("缺少 dataModels array")
    if not isinstance(data.get("businessFlows"), list):
        errors.append("缺少 businessFlows array")
    if not isinstance(data.get("pages"), dict):
        errors.append("缺少 pages object")
    else:
        details = (data.get("pages") or {}).get("customPageDetails") or []
        for index, detail in enumerate(details):
            if not isinstance(detail, dict):
                errors.append(f"pages.customPageDetails[{index}] 必须是 object")
                continue
            uses_new_schema = any(
                key in detail
                for key in (
                    "pageId",
                    "primaryTask",
                    "contentPriority",
                    "firstScreenStructure",
                    "signatureInteraction",
                    "layoutPattern",
                    "density",
                )
            )
            if uses_new_schema:
                required_page_fields = (
                    "pageId",
                    "primaryTask",
                    "contentPriority",
                    "firstScreenStructure",
                    "layoutPattern",
                    "density",
                )
                for field in required_page_fields:
                    if detail.get(field) in (None, "", []):
                        errors.append(
                            f"pages.customPageDetails[{index}] 缺少 {field}"
                        )
                layout_pattern = detail.get("layoutPattern")
                if isinstance(layout_pattern, dict) and layout_pattern.get("mode"):
                    pattern_mode = layout_pattern.get("mode")
                    if pattern_mode not in ("preset", "adapted", "custom"):
                        errors.append(
                            f"pages.customPageDetails[{index}].layoutPattern.mode 必须是 preset、adapted 或 custom"
                        )
                    if pattern_mode == "adapted" and not layout_pattern.get("adaptations"):
                        errors.append(
                            f"pages.customPageDetails[{index}] 使用 adapted 模式但缺少 adaptations"
                        )
                    if pattern_mode == "custom" and layout_pattern.get("id") != "custom-page-pattern":
                        errors.append(
                            f"pages.customPageDetails[{index}] 使用 custom 模式时 id 必须是 custom-page-pattern"
                        )
                    content_richness = detail.get("contentRichness")
                    if not isinstance(content_richness, dict):
                        errors.append(
                            f"pages.customPageDetails[{index}] 缺少 contentRichness object"
                        )
                    else:
                        if content_richness.get("requirement") != "rich-but-relevant":
                            errors.append(
                                f"pages.customPageDetails[{index}].contentRichness.requirement 必须是 rich-but-relevant"
                            )
                        if not isinstance(content_richness.get("contentLayers"), list) or not content_richness.get("contentLayers"):
                            errors.append(
                                f"pages.customPageDetails[{index}].contentRichness.contentLayers 必须是非空数组"
                            )
                        if not isinstance(content_richness.get("antiFiller"), list) or not content_richness.get("antiFiller"):
                            errors.append(
                                f"pages.customPageDetails[{index}].contentRichness.antiFiller 必须是非空数组"
                            )
    visual = data.get("visualStyle")
    if not isinstance(visual, dict) or not isinstance(visual.get("forUser"), dict):
        errors.append("缺少 visualStyle.forUser object")
    else:
        for_user = visual.get("forUser") or {}
        if str(data.get("schemaVersion") or "").startswith("2"):
            visual_direction = for_user.get("visualDirection") or {}
            navigation_style = for_user.get("navigationStyle") or {}
            internal_theme = (visual.get("internal") or {}).get("selectedTheme") or {}
            if not visual_direction.get("label") or not visual_direction.get("description"):
                errors.append("schemaVersion 2.0 缺少 visualStyle.forUser.visualDirection")
            if navigation_style.get("structure") not in ("top", "side"):
                errors.append("visualStyle.forUser.navigationStyle.structure 必须是 top 或 side")
            if navigation_style.get("tone") not in ("light", "dark"):
                errors.append("visualStyle.forUser.navigationStyle.tone 必须是 light 或 dark")
            if not internal_theme.get("themeId") or not internal_theme.get("templatePath"):
                errors.append("schemaVersion 2.0 缺少有效的 visualStyle.internal.selectedTheme")
        if for_user.get("selectedTheme"):
            selected_theme = for_user.get("selectedTheme") or {}
            if not (meta or {}).get("experienceTopology"):
                errors.append("selectedTheme 已存在，但缺少 meta.experienceTopology")
            if not (meta or {}).get("businessDomain"):
                errors.append("selectedTheme 已存在，但缺少 meta.businessDomain")
            if not selected_theme.get("themeId"):
                errors.append("selectedTheme 已存在，但缺少 themeId")
            if not selected_theme.get("templatePath"):
                errors.append("selectedTheme 已存在，但缺少 templatePath")
            if not isinstance(for_user.get("themeProfile"), dict):
                errors.append("selectedTheme 已存在，但缺少 visualStyle.forUser.themeProfile")
            if not isinstance(for_user.get("pageApplications"), list):
                errors.append("selectedTheme 已存在，但缺少 visualStyle.forUser.pageApplications array")
            else:
                for index, application in enumerate(for_user.get("pageApplications") or []):
                    if not isinstance(application, dict):
                        errors.append(
                            f"visualStyle.forUser.pageApplications[{index}] 必须是对象"
                        )
                    elif not isinstance(application.get("visualMemoryApplications"), list):
                        errors.append(
                            f"visualStyle.forUser.pageApplications[{index}] 缺少 visualMemoryApplications array"
                        )
            for_design_md = visual.get("forDesignMd")
            if not isinstance(for_design_md, dict):
                errors.append("selectedTheme 已存在，但缺少 visualStyle.forDesignMd object")
            elif not for_design_md.get("productTopologyApplication"):
                errors.append(
                    "selectedTheme 已存在，但缺少 visualStyle.forDesignMd.productTopologyApplication"
                )
    if errors:
        message = "build-plan.json 结构不完整：\n- " + "\n- ".join(errors)
        raise ValueError(message)


def render(data: dict[str, Any], template: str) -> str:
    meta = data.get("meta") or {}
    title = meta.get("projectName") or "OpenYida 应用"
    content = "\n".join(
        [
            render_overview(data),
            render_data_models(data),
            render_business_flows(data),
            render_pages(data),
        ]
    )
    return (
        template.replace("{{title}}", esc(title))
        .replace("{{nav_items}}", render_nav())
        .replace("{{content}}", content)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to build-plan.json")
    parser.add_argument("--output", required=True, help="Path to build-plan.html")
    parser.add_argument(
        "--template",
        help="Optional template path. Defaults to ../assets/build-plan-template.html",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    template_path = (
        Path(args.template)
        if args.template
        else script_dir.parent / "assets" / "build-plan-template.html"
    )
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    validate_plan(data)
    template = template_path.read_text(encoding="utf-8")
    output = render(data, template)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
