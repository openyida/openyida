import React from 'react';
import { ConfigProvider } from 'antd';

const CANVAS_THEME_SOURCE = __CANVAS_THEME_SOURCE__;
const CanvasThemeContext = React.createContext(null);
const CANVAS_THEME_ROLES = {
  colorPrimary: ['--color-brand1-6'], colorLink: ['--color-brand1-6'],
  colorPrimaryHover: ['--color-brand1-5'], colorPrimaryActive: ['--color-brand1-9'],
  colorLinkHover: ['--color-brand1-5'], colorLinkActive: ['--color-brand1-9'],
  colorBgLayout: ['--pod-page-bg-color', '--color-white'],
  colorBgContainer: ['--pod-card-bg-color', '--color-white'],
  colorBgElevated: ['--pod-card-bg-color', '--color-white'],
  colorText: ['--color-text1-4'], colorTextHeading: ['--color-text1-4'],
  colorTextSecondary: ['--color-text1-3'], colorTextDescription: ['--color-text1-3'],
  colorTextPlaceholder: ['--color-text1-10'],
  colorTextDisabled: ['--color-text1-2'], colorBgContainerDisabled: ['--color-fill1-1'],
  colorBorder: ['--color-line1-2'], colorBorderSecondary: ['--color-line1-1'],
  colorFillAlter: ['--color-fill1-1'], colorFillSecondary: ['--color-fill1-2'],
};

function resolveCanvasTheme(root, roles = CANVAS_THEME_ROLES) {
  const view = root.ownerDocument.defaultView;
  const scope = view.getComputedStyle(root);
  const probe = root.ownerDocument.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
  root.appendChild(probe);
  const token = {};
  try {
    Object.entries(roles).forEach(([role, names]) => {
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

// Computed sRGB colors only. Unknown color spaces retain the library defaults.
function canvasRgb(value) {
  const match = typeof value === 'string' && value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  if (!match) return null;
  const result = match.slice(1, 4).map(Number);
  return result.every(channel => channel >= 0 && channel <= 255) && (match[4] === undefined || Number(match[4]) === 1) ? result : null;
}

function canvasContrast(foreground, background) {
  const luminance = value => {
    const rgb = canvasRgb(value);
    if (!rgb) return null;
    const linear = rgb.map(channel => channel / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return a === null || b === null ? null : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function resolveCanvasControls(token) {
  const primary = token.colorPrimary;
  const surface = token.colorBgContainer || token.colorBgLayout || 'rgb(255, 255, 255)';
  if (!canvasRgb(primary) || !canvasRgb(surface)) return null;
  const readable = (background, preferred) => preferred.concat(['rgb(0, 0, 0)', 'rgb(255, 255, 255)'])
    .find(color => canvasContrast(color, background) >= 4.5);
  const mix = amount => 'rgb(' + canvasRgb(primary).map((channel, index) => Math.round(channel * amount + canvasRgb(surface)[index] * (1 - amount))).join(', ') + ')';
  const selectedBg = mix(0.10);
  const primaryText = readable(primary, ['rgb(255, 255, 255)', token.colorText]);
  return {
    surface, text: readable(surface, [token.colorText]),
    selectedBg, selectedColor: readable(selectedBg, [primary, token.colorText]),
    hoverBg: mix(0.06), activeBg: mix(0.14),
    emphasis: readable(surface, [primary, token.colorText]),
    primaryText,
    primaryHover: canvasContrast(primaryText, token.colorPrimaryHover) >= 4.5 ? token.colorPrimaryHover : primary,
    primaryActive: canvasContrast(primaryText, token.colorPrimaryActive) >= 4.5 ? token.colorPrimaryActive : primary,
  };
}

function resolveCanvasControlComponents(token, controls) {
  if (!controls) return {};
  const { surface, text, selectedBg, selectedColor, hoverBg, activeBg, emphasis, primaryText, primaryHover, primaryActive } = controls;
  return {
    Tabs: { itemColor: text, itemSelectedColor: emphasis, itemHoverColor: emphasis, itemActiveColor: emphasis, inkBarColor: token.colorPrimary },
    Segmented: { trackBg: surface, itemColor: text, itemHoverColor: text, itemHoverBg: hoverBg, itemActiveBg: activeBg, itemSelectedBg: selectedBg, itemSelectedColor: selectedColor },
    Button: { defaultColor: text, defaultHoverColor: emphasis, defaultActiveColor: emphasis,
      primaryColor: primaryText, colorPrimaryHover: primaryHover, colorPrimaryActive: primaryActive },
    Radio: { buttonColor: text, buttonBg: surface, buttonCheckedBg: selectedBg, colorPrimary: selectedColor, colorPrimaryHover: selectedColor, colorPrimaryActive: selectedColor,
      buttonSolidCheckedBg: token.colorPrimary, buttonSolidCheckedColor: primaryText, buttonSolidCheckedHoverBg: primaryHover, buttonSolidCheckedActiveBg: primaryActive },
  };
}

// preview=true is explicit: the local snapshot is scoped to this page only.
function CanvasThemeProvider({ children, preview = false, getPopupContainer }) {
  const rootRef = React.useRef(null);
  const [theme, setTheme] = React.useState({ token: {}, components: {}, controls: null, status: 'loading' });
  React.useLayoutEffect(() => {
    const root = rootRef.current;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    let frame;
    const refresh = () => {
      let next;
      try {
        const token = resolveCanvasTheme(root);
        const controls = resolveCanvasControls(token);
        const components = { ...resolveCanvasControlComponents(token, controls), Drawer: resolveCanvasTheme(root, { colorBgElevated: ['--pod-shell-theme-bg-color', '--color-white'] }) };
        next = { token, components, controls, status: token.colorPrimary ? (preview ? 'preview' : 'ready') : 'missing' };
      } catch (_error) {
        next = { token: {}, components: {}, controls: null, status: 'error' };
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
        <ConfigProvider theme={{ token: theme.token, components: theme.components }} getPopupContainer={getPopupContainer}>{children}</ConfigProvider>
      </CanvasThemeContext.Provider>
    </div>
  );
}

function useCanvasThemeContext() {
  const theme = React.useContext(CanvasThemeContext);
  if (!theme) throw new Error('useCanvasThemeContext requires CanvasThemeProvider');
  return theme;
}
