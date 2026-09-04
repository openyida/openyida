import React from 'react';

// CLI 仅将这段公共代码与选定布局合并。颜色直接消费当前应用导航 token。
// 这是可选实现示例；导航外观按 design.md 设计，已有 UI 无需替换成示例默认样式。
// 选中菜单标识当前页面，main 用 aria-label 命名，children 直接承载业务内容。
const CANVAS_NAV_CSS = `
  .oy-canvas-nav { display: flow-root; min-width: 0; min-height: 100vh; background: var(--oyd-page-background, var(--pod-page-bg-color, var(--color-white, #fff))); }
  .oy-canvas-nav .oy-nav-surface {
    background: var(--pod-shell-theme-bg-color, var(--pod-nav-popup-bg-color, var(--color-white, #fff)));
    color: var(--pod-nav-item-text-color, var(--color-text1-4, #1f2329));
  }
  .oy-canvas-nav .oy-nav-brand { display: flex; align-items: center; gap: var(--pod-nav-logo-gap, 8px); min-width: 0; padding: var(--pod-nav-logo-padding, 4px 8px); color: var(--pod-nav-logo-text, inherit); font-weight: 600; }
  .oy-canvas-nav .oy-nav-brand > img { max-width: var(--pod-nav-custom-logo-max-width, 160px); max-height: var(--pod-nav-logo-size, 32px); }
  .oy-canvas-nav .oy-nav-brand > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .oy-canvas-nav .oy-nav-item {
    box-sizing: border-box; display: flex; flex-shrink: 0; align-items: center; gap: var(--pod-nav-logo-gap, 8px);
    min-height: var(--pod-nav-menu-item-height, 40px); padding: var(--pod-nav-top-tab-item-padding, 0 12px);
    border: 0; border-radius: var(--pod-nav-menu-item-radius, 8px); background: transparent;
    color: var(--pod-nav-item-text-color, var(--color-text1-4, #1f2329)); font: inherit; font-size: var(--pod-nav-menu-font-size, 14px); text-decoration: none; text-align: start; cursor: pointer;
  }
  .oy-canvas-nav .oy-nav-item:hover:not(:disabled) { background: var(--pod-nav-menu-bg-hover-color, var(--color-fill1-2, #f2f3f5)); color: var(--pod-nav-item-text-hover-color, inherit); }
  .oy-canvas-nav .oy-nav-item[aria-current="page"] { background: var(--pod-nav-menu-bg-selected-color, var(--color-brand1-1, #e8f2ff)); color: var(--pod-nav-item-text-selected-color, var(--color-brand1-6, #1677ff)); font-weight: var(--pod-nav-menu-item-selected-font-weight, 600); }
  .oy-canvas-nav .oy-nav-item:disabled { color: var(--pod-nav-item-text-disabled-color, var(--color-text1-1, #999)); cursor: not-allowed; }
  .oy-canvas-nav .oy-nav-item:focus-visible { outline: 2px solid var(--pod-nav-tab-line-selected-color, var(--color-brand1-6, #1677ff)); outline-offset: -2px; }
  .oy-canvas-nav .oy-nav-item svg { flex-shrink: 0; width: var(--pod-nav-platform-action-icon-size, 18px); height: var(--pod-nav-platform-action-icon-size, 18px); }
  .oy-canvas-nav .oy-nav-content { min-width: 0; padding: var(--pod-nav-page-padding, 16px); color: var(--color-text1-4, #1f2329); }
`;

/** 菜单项由页面提供 href 或 onSelect；保留链接的新窗口及修饰键行为。 */
function CanvasNavItem({ item, activeKey, onSelect }) {
  const Icon = item.icon;
  const content = <>{Icon ? <Icon aria-hidden="true" /> : null}<span>{item.label}</span></>;
  const props = { className: 'oy-nav-item', title: item.label, 'aria-label': item.label, 'data-has-icon': !!Icon, 'aria-current': item.key === activeKey ? 'page' : undefined };
  if (item.href && !item.disabled) {
    return <a {...props} href={item.href} target={item.targetNew ? '_blank' : undefined} rel={item.targetNew ? 'noopener noreferrer' : undefined} onClick={(event) => {
      if (onSelect && !item.targetNew && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault();
        onSelect(item);
      }
    }}>{content}</a>;
  }
  return <button {...props} type="button" disabled={item.disabled || !onSelect} onClick={() => onSelect(item)}>{content}</button>;
}
