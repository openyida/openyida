import React from 'react';
import { ConfigProvider } from 'antd';

const CANVAS_THEME_SOURCE = __CANVAS_THEME_SOURCE__;
const CanvasThemeContext = React.createContext(null);
const CANVAS_THEME_ROLES = {
  colorPrimary: ['--color-brand1-6'], colorLink: ['--color-brand1-6'],
  colorPrimaryHover: ['--color-brand1-5'], colorPrimaryActive: ['--color-brand1-9'],
  colorBgLayout: ['--pod-page-bg-color', '--color-white'],
  colorBgContainer: ['--pod-card-bg-color', '--color-white'],
  colorBgElevated: ['--pod-card-bg-color', '--color-white'],
  colorText: ['--color-text1-4'], colorTextHeading: ['--color-text1-4'],
  colorTextSecondary: ['--color-text1-3'], colorTextDescription: ['--color-text1-3'],
  colorTextPlaceholder: ['--color-text1-10'],
  colorBorder: ['--color-line1-2'], colorBorderSecondary: ['--color-line1-1'],
  colorFillAlter: ['--color-fill1-1'], colorFillSecondary: ['--color-fill1-2'],
};

function resolveCanvasTheme(root) {
  const view = root.ownerDocument.defaultView;
  const scope = view.getComputedStyle(root);
  const probe = root.ownerDocument.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  root.appendChild(probe);
  const token = {};
  try {
    Object.entries(CANVAS_THEME_ROLES).forEach(([role, names]) => {
      const value = names.map((name) => scope.getPropertyValue(name).trim()).find(Boolean);
      if (!value || !view.CSS.supports('color', value)) return;
      probe.style.color = value;
      const color = view.getComputedStyle(probe).color;
      if (color) token[role] = color;
    });
    return token;
  } finally {
    probe.remove();
  }
}

// preview=true is explicit: the local snapshot is scoped to this page only.
function CanvasThemeProvider({ children, preview = false, getPopupContainer }) {
  const rootRef = React.useRef(null);
  const [theme, setTheme] = React.useState({ token: {}, status: 'loading' });
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    let frame;
    const refresh = () => {
      let next;
      try {
        const token = resolveCanvasTheme(root);
        next = { token, status: token.colorPrimary ? (preview ? 'preview' : 'ready') : 'missing' };
      } catch (_error) {
        next = { token: {}, status: 'error' };
      }
      setTheme((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(refresh);
    };
    const stylesheetLoaded = (event) => {
      const target = event.target;
      if (target && target.tagName === 'LINK' &&
          (!CANVAS_THEME_SOURCE.url || target.href === CANVAS_THEME_SOURCE.url)) schedule();
    };
    refresh();
    const observer = new view.MutationObserver(schedule);
    for (let node = root; node; node = node.parentElement) observer.observe(node, { attributes: true });
    if (doc.head) observer.observe(doc.head, { subtree: true, attributes: true, childList: true, characterData: true });
    doc.addEventListener('load', stylesheetLoaded, true);
    view.addEventListener('openyida:theme-change', schedule);
    view.addEventListener('resize', schedule);
    return () => {
      observer.disconnect();
      view.cancelAnimationFrame(frame);
      doc.removeEventListener('load', stylesheetLoaded, true);
      view.removeEventListener('openyida:theme-change', schedule);
      view.removeEventListener('resize', schedule);
    };
  }, [preview]);
  const context = React.useMemo(() => ({ ...theme, source: CANVAS_THEME_SOURCE.url, revision: CANVAS_THEME_SOURCE.sha256 }), [theme]);
  return (
    <div ref={rootRef} data-canvas-theme-status={theme.status} style={{
      ...(preview ? CANVAS_THEME_SOURCE.tokens : {}),
      display: 'flow-root', minHeight: '100vh',
      background: 'var(--pod-page-bg-color, var(--color-white, #fff))',
      color: 'var(--color-text1-4, #1f2329)',
    }}>
      <CanvasThemeContext.Provider value={context}>
        <ConfigProvider theme={{ token: theme.token }} getPopupContainer={getPopupContainer}>{children}</ConfigProvider>
      </CanvasThemeContext.Provider>
    </div>
  );
}

function useCanvasThemeContext() {
  const theme = React.useContext(CanvasThemeContext);
  if (!theme) throw new Error('useCanvasThemeContext requires CanvasThemeProvider');
  return theme;
}
