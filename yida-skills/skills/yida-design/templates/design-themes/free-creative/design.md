---
name: "{{PROJECT_NAME}}"
description: "从任务频率和内容拓扑推导工作区；从品牌与使用环境自主决定材质。不从命名模板选择，必须提交独立推演依据。"
themeId: "free-creative"
tokens:
  application-global:
    appearance:
      surfaces:
        "--pod-app-root-bg-color": "#f6f6f6"
        "--pod-app-root-bg-image": "none"
        "--pod-page-bg-color": "#f6f6f6"
        "--pod-card-bg-color": "#ffffff"
        "--pod-table-cell-color": "var(--pod-card-bg-color)"
      navigation:
        "--pod-shell-theme-bg-color": "#ffffff"
        "--pod-nav-item-text-color": "#242424"
        "--pod-nav-item-text-hover-color": "#242424"
        "--pod-nav-item-text-selected-color": "#242424"
        "--pod-nav-menu-bg-hover-color": "#f6f6f6"
        "--pod-nav-menu-bg-selected-color": "#f6f6f6"
      native-form:
        "--form-element-medium-corner": "4px"
        "--form-element-medium-height": "36px"
        "--form-element-medium-font-size": "14px"
        "--input-bg-color": "#ffffff"
        "--input-border-width": "1px"
        "--input-border-color": "#cccccc"
        "--input-hover-border-color": "var(--color-brand1-6)"
        "--input-focus-border-color": "var(--color-brand1-6)"
        "--input-hover-bg-color": "#ffffff"
        "--input-focus-bg-color": "#ffffff"
        "--pod-form-label-color": "#242424"
        "--form-top-label-margin-b": "8px"
        "--yida-form-content-bgcolor": "#ffffff"
        "--pod-page-content-max-width": "1000px"
        "--pod-page-border-radius": "4px"
        "--pod-page-footer-bg-color": "#ffffff"
        "--pod-page-footer-border-radius": "4px"
        "--pod-sticky-footer-box-shadow": "none"
        "--pod-formView-stickyFooter-bg-color": "#f6f6f6"
        "--pod-formView-stickyFooter-box-shadow": "none"
        "--pod-formView-stickyFooter-border": "none"
        "--pod-formView-stickyFooter-border-top": "1px solid #cccccc"
        "--pod-formView-stickyFooter-height": "56px"
        "--pod-formView-stickyFooter-bottom": "8px"
        "--pod-field-preview-text-color": "#242424"
        "--pod-field-preview-bg-color": "#ffffff"
        "--pod-field-preview-border-radius": "4px"
        "--pod-field-preview-padding": "8px 12px"
        "--pod-field-preview-shadow": "none"
    colors:
      "--color-white": "var(--pod-card-bg-color)"
      "--color-brand1-1": "<生成实际色值：--color-brand1-6 88% + #FFFFFF 12%，sRGB 逐通道混合>"
      "--color-brand1-2": "<生成实际色值：--color-brand1-6 12% + #FFFFFF 88%，sRGB 逐通道混合>"
      "--color-brand1-3": "<生成实际色值：--color-brand1-6 4% + #FFFFFF 96%，sRGB 逐通道混合>"
      "--color-brand1-5": "<生成实际色值：--color-brand1-6 38% + #171717 62%，sRGB 逐通道混合>"
      "--color-brand1-6": "{{PRIMARY_COLOR}}"
      "--color-brand1-9": "<生成实际色值：--color-brand1-6 76% + #000000 24%，sRGB 逐通道混合>"
      "--color-brand1-10": "<生成实际色值：--color-brand1-6 26% + #202020 74%，sRGB 逐通道混合>"
      "--color-line1-1": "#cccccc"
      "--color-line1-2": "#cccccc"
      "--color-fill1-1": "#f6f6f6"
      "--color-fill1-2": "#f6f6f6"
      "--color-fill1-3": "#cccccc"
      "--color-fill1-5": "#ffffff"
      "--color-fill1-10": "#262626"
      "--color-text1-5": "#FFFFFF"
      "--color-text1-4": "#242424"
      "--color-text1-10": "#242424"
      "--color-text1-3": "#242424"
      "--color-text1-2": "#858781"
      "--color-text1-1": "#cccccc"
    typography:
      "--font-family-base": "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      "--font-size-subhead": "18px"
      "--font-weight-subhead": "500"
      "--font-lineheight-subhead": "1.3"
      "--font-size-body-2": "16px"
      "--font-weight-body-2": "500"
      "--font-lineheight-body-2": "1.45"
      "--font-size-body-1": "14px"
      "--font-weight-body-1": "400"
      "--font-lineheight-body-1": "1.5"
      "--font-size-table": "13px"
      "--font-weight-table": "400"
      "--font-lineheight-table": "1.45"
      "--font-size-caption": "12px"
      "--font-weight-caption": "400"
      "--font-lineheight-caption": "1.4"
    spacing:
      "--s-1": "4px"
      "--s-2": "8px"
      "--s-3": "12px"
      "--s-4": "16px"
      "--s-5": "20px"
      "--s-6": "24px"
      "--s-7": "28px"
      "--s-8": "32px"
      "--s-9": "36px"
      "--s-10": "40px"
    rounded:
      "--corner-zero": "0px"
      "--corner-1": "4px"
      "--corner-2": "6px"
      "--corner-3": "8px"
      "--corner-4": "10px"
      "--corner-5": "12px"
      "--corner-circle": "50%"
      "--corner-semicircle": "500px"
    shadow:
      "--shadow-1": "0px 2px 4px 0px rgba(0, 0, 0, 0.12)"
      "--shadow-2": "0px 4px 20px -1px rgba(0, 0, 0, 0.16)"
      "--shadow-3": "0px 10px 28px -2px rgba(0, 0, 0, 0.24)"
  custom-page:
    "--oyd-page-bg": "var(--pod-page-bg-color)"
    "--oyd-surface": "var(--pod-card-bg-color)"
    "--oyd-canvas-image": "var(--pod-app-root-bg-image)"
    "--oyd-ink": "var(--color-text1-4)"
    "--oyd-border": "var(--color-line1-2)"
    "--oyd-accent": "var(--color-brand1-6)"
    "--oyd-radius": "4px"
    "--oyd-content-width": "1000px"
    "--oyd-content-padding": "24px"
    "--oyd-field-gap": "20px"
    "--oyd-section-gap": "40px"
    "--oyd-heading-font": "var(--font-family-base)"
    "--oyd-heading-size": "32px"
    "--oyd-rule-style": "solid"
    "--oyd-layout-columns": "minmax(0, 12fr)"
    "--oyd-surface-shadow": "none"
applicationStyle:
  recipe: "application-style-v1"
  mode: "creative"
---
# {{PROJECT_NAME}} design.md

## 1. 风格摘要

自由创意：从业务任务、用户、品牌和内容结构独立推演，不选择命名模板。此文件仅提供平台 Token 契约，最终设计必须由 creativeDirection 与项目 Token 决定。

## 2. 页面视觉系统

### 2.2 应用导航

按业务确定导航、标题、内容构图、材质和密度。主色 {{PRIMARY_COLOR}}；色彩来源 {{COLOR_SOURCE}}。

## 3. 基础组件表达

应用、Canvas、自定义页面、原生表单与详情共用字体、材质、状态和间距体系。表单结构使用原生 Schema，禁止加载代码注入。

## 4. 特色表达配方

由真实任务推导介绍区、章节、图表和记录集合，不复用命名模板配方。不添加无业务意义的指标或装饰文案。

## 5. 项目应用与调整规则

逐页记录布局、表单列比例、字段间距、响应式与验收。原生 Schema 与设计分别交付并核对，footer 背景和阴影必须是显式决策。

{{PAGE_APPLICATIONS}}
