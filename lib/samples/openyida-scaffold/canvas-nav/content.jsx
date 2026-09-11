import React from 'react';

// 顶部导航与内容的高度链；侧栏布局可在侧栏右侧已分配高度的区域使用 height="100%"。
// 只管理布局：菜单权限、URL/hash、离开未保存表单的确认由调用方处理。
// 合并到页面时保留组件，合并重复 import；不要额外包裹滚动卡片。
function CanvasNavigationContent({
  navigation,
  children,
  iframeSrc,
  title = '页面内容',
  contentKey,
  height = '100dvh',
  maxWidth = 1280,
  gutter = 'clamp(12px, 2vw, 24px)',
  radius = 16,
  background = 'transparent',
}) {
  const embedded = Boolean(iframeSrc);
  return (
    <div className="openyida-nav-layout" style={{
      height, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background,
    }}>
      {navigation != null && <div style={{ flexShrink: 0 }}>{navigation}</div>}
      <main className="openyida-nav-main" aria-label={title} style={{
        display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0,
        minWidth: 0, overflow: 'hidden', padding: gutter, boxSizing: 'border-box',
      }}>
        <div key={contentKey} className="openyida-nav-content" style={{
          position: 'relative', flex: '1 1 0', minHeight: 0, minWidth: 0,
          width: '100%', maxWidth, margin: '0 auto', borderRadius: radius,
          overflow: embedded ? 'hidden' : 'auto',
        }}>
          {embedded ? <iframe title={title} src={iframeSrc} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            display: 'block', border: 0,
          }} /> : children}
        </div>
      </main>
    </div>
  );
}
