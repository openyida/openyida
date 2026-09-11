import React from 'react';

/** 页面内标签；children 渲染当前视图，支持方向键、Home、End 和禁用项。 */
function CanvasTabs({ items = [], activeKey, onSelect, label = '视图切换', children }) {
  const id = React.useId();
  const selected = items.find(item => item.key === activeKey && !item.disabled);
  const focusable = selected || items.find(item => !item.disabled);
  return <div className="oy-canvas-tabs">
    <style>{`
      .oy-canvas-tabs .oy-tabs-list { display: flex; gap: 8px; overflow-x: auto; border-bottom: 1px solid var(--color-line1-1, #ddd); }
      .oy-canvas-tabs .oy-tab { flex-shrink: 0; min-height: var(--pod-nav-top-tab-height, 44px); padding: var(--pod-nav-top-tab-item-padding, 0 12px); border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--tab-pure-text-color-normal, var(--color-text1-3, #666)); font: inherit; cursor: pointer; }
      .oy-canvas-tabs .oy-tab:hover:not(:disabled) { color: var(--tab-pure-text-color-hover, var(--color-brand1-6, #1677ff)); }
      .oy-canvas-tabs .oy-tab[aria-selected="true"] { color: var(--tab-pure-text-color-selected, var(--color-brand1-6, #1677ff)); border-bottom-color: var(--tab-pure-ink-bar-color, var(--color-brand1-6, #1677ff)); font-weight: 600; }
      .oy-canvas-tabs .oy-tab:disabled { color: var(--tab-pure-text-color-disabled, var(--color-text1-1, #999)); cursor: not-allowed; }
      .oy-canvas-tabs :focus-visible { outline: 2px solid var(--tab-pure-ink-bar-color, var(--color-brand1-6, #1677ff)); outline-offset: -2px; }
    `}</style>
    <div className="oy-tabs-list" role="tablist" aria-label={label} onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)'));
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(event.target);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      buttons[next].click();
    }}>
      {items.map((item, index) => <button key={item.key} id={id + '-tab-' + index} className="oy-tab" type="button" role="tab" aria-selected={item === selected} aria-controls={id + '-panel'} tabIndex={item === focusable ? 0 : -1} disabled={item.disabled || !onSelect} onClick={() => onSelect(item)}>{item.label}</button>)}
    </div>
    <div role="tabpanel" id={id + '-panel'} aria-labelledby={selected ? id + '-tab-' + items.indexOf(selected) : undefined} tabIndex={0}>{children}</div>
  </div>;
}
