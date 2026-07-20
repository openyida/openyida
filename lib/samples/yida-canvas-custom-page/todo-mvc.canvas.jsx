/**
 * TodoMVC Code Canvas template
 * @openyida-template {{OPENYIDA_TEMPLATE}}
 * @openyida-ir-version {{OPENYIDA_IR_VERSION}}
 * @openyida-scene {{OPENYIDA_SCENE}}
 * @openyida-visual-profile {{OPENYIDA_VISUAL_PROFILE}}
 * @openyida-theme-profile {{OPENYIDA_THEME_PROFILE}}
 * @openyida-theme-scope {{OPENYIDA_THEME_SCOPE}}
 * @openyida-blocks {{OPENYIDA_BLOCKS}}
 */

import React, { useMemo, useState } from 'react';
import { ConfigProvider, Button, Input, Segmented, Tag, Typography } from 'antd';
import { useMemoizedFn } from 'ahooks';

const { Text, Title } = Typography;

const CONFIG = {
  title: '{{TODO_TITLE}}',
  subtitle: '{{TODO_SUBTITLE}}',
  placeholder: '{{TODO_PLACEHOLDER}}',
  storageKey: '{{TODO_STORAGE_KEY}}',
  allLabel: '{{TODO_ALL_LABEL}}',
  activeLabel: '{{TODO_ACTIVE_LABEL}}',
  completedLabel: '{{TODO_COMPLETED_LABEL}}',
  clearCompletedLabel: '{{TODO_CLEAR_COMPLETED_LABEL}}',
};

const TOKENS = {
  title: '{' + '{TODO_TITLE}' + '}',
  subtitle: '{' + '{TODO_SUBTITLE}' + '}',
  placeholder: '{' + '{TODO_PLACEHOLDER}' + '}',
  storageKey: '{' + '{TODO_STORAGE_KEY}' + '}',
  allLabel: '{' + '{TODO_ALL_LABEL}' + '}',
  activeLabel: '{' + '{TODO_ACTIVE_LABEL}' + '}',
  completedLabel: '{' + '{TODO_COMPLETED_LABEL}' + '}',
  clearCompletedLabel: '{' + '{TODO_CLEAR_COMPLETED_LABEL}' + '}',
};

function isTemplateToken(value) {
  return typeof value === 'string' && /^\{\{[A-Z0-9_]+\}\}$/.test(value);
}

function parseTemplateJson(raw, fallback) {
  if (!raw || isTemplateToken(raw)) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (err) {
    return fallback;
  }
}

function withFallback(value, token, fallback) {
  return value && value !== token && !isTemplateToken(value) ? value : fallback;
}

CONFIG.title = withFallback(CONFIG.title, TOKENS.title, '今日任务');
CONFIG.subtitle = withFallback(CONFIG.subtitle, TOKENS.subtitle, '把待办、日历和目标进度放进一个轻量工作台。');
CONFIG.placeholder = withFallback(CONFIG.placeholder, TOKENS.placeholder, '添加一项任务');
CONFIG.storageKey = withFallback(CONFIG.storageKey, TOKENS.storageKey, 'openyida-canvas-todo-sample');
CONFIG.allLabel = withFallback(CONFIG.allLabel, TOKENS.allLabel, '全部');
CONFIG.activeLabel = withFallback(CONFIG.activeLabel, TOKENS.activeLabel, '未完成');
CONFIG.completedLabel = withFallback(CONFIG.completedLabel, TOKENS.completedLabel, '已完成');
CONFIG.clearCompletedLabel = withFallback(CONFIG.clearCompletedLabel, TOKENS.clearCompletedLabel, '清除已完成');

const DEFAULT_ITEMS = parseTemplateJson('{{TODO_ITEMS_JSON}}', [
  { id: 1, content: '整理今日业务清单', done: false },
  { id: 2, content: '复核客户跟进记录', done: true },
  { id: 3, content: '同步项目风险事项', done: false },
]);
const THEME_PROFILE = parseTemplateJson('{{OPENYIDA_THEME_PROFILE_JSON}}', { followRuntimeTheme: false, name: 'lemon-planner', themeColor: '#D97706', themeColorDeep: '#92400E', themeColorSoft: '#FFF8E7', themeColorTint: 'rgba(217, 119, 6, 0.18)', palette: ['#D97706', '#14B8A6', '#8B5CF6', '#F472B6', '#22C55E'] });
const THEME_SCOPE = withFallback('{{OPENYIDA_THEME_SCOPE}}', '{{OPENYIDA_THEME_SCOPE}}', 'page');
const THEME_COLOR_LEVELS = {
  themeColor: 6,
  themeColorSoft: 2,
  themeColorTint: 3,
  themeColorDeep: 9,
};

const NAV_ITEMS = ['首页', '日常', '日历', '目标', '复盘', '追踪', '灵感'];
const DAY_STRIP = [
  { week: 'MON', day: '23' },
  { week: 'TUE', day: '24' },
  { week: 'WED', day: '25', active: true },
  { week: 'THU', day: '26' },
  { week: 'FRI', day: '27' },
  { week: 'SAT', day: '28' },
  { week: 'SUN', day: '29' },
];
const CATEGORY_STYLES = [
  { name: '工作', tone: 'amber', gradient: 'linear-gradient(135deg, #ffe3ae 0%, #ffc86e 100%)' },
  { name: '健康', tone: 'blue', gradient: 'linear-gradient(135deg, #d8f2ff 0%, #9fcef4 100%)' },
  { name: '学习', tone: 'violet', gradient: 'linear-gradient(135deg, #eadcff 0%, #c9b1f4 100%)' },
  { name: '其他', tone: 'pink', gradient: 'linear-gradient(135deg, #ffd9ec 0%, #eda5ce 100%)' },
];
const SCHEDULE_ITEMS = [
  { time: '11:00-12:00', tag: '健康', title: '公园散步' },
  { time: '17:00-18:00', tag: '工作', title: '数据周报' },
  { time: '21:00-22:00', tag: '学习', title: '复盘今日任务' },
];

function readBrandColor(level, fallback) {
  try {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-brand1-' + (level || 6))
      .trim();
    return value || fallback;
  } catch (err) {
    return fallback;
  }
}

function getThemeColor(profile, key, fallback) {
  if (profile && profile.followRuntimeTheme && THEME_COLOR_LEVELS[key]) {
    return readBrandColor(THEME_COLOR_LEVELS[key], fallback);
  }
  return (profile && profile[key]) || fallback;
}

function buildScopedThemeVars(scope, profile) {
  if (scope !== 'page' || (profile && profile.followRuntimeTheme)) {
    return {};
  }
  return {
    '--color-brand1-6': getThemeColor(profile, 'themeColor', '#6B7CAB'),
    '--color-brand1-2': getThemeColor(profile, 'themeColorSoft', '#F3F5FB'),
    '--color-brand1-3': getThemeColor(profile, 'themeColorTint', 'rgba(107, 124, 171, 0.2)'),
    '--color-brand1-9': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-4': getThemeColor(profile, 'themeColorDeep', '#435480'),
    '--color-brand-3': getThemeColor(profile, 'themeColor', '#6B7CAB'),
  };
}

function applyShellTheme(scope, profile) {
  if (scope !== 'app') {
    return;
  }
  try {
    const updateShellConfig = window && window.__YIDA__ && window.__YIDA__.updateShellConfig;
    if (typeof updateShellConfig !== 'function') {
      return;
    }
    updateShellConfig({
      themeConfig: {
        theme: getThemeColor(profile, 'navTheme', 'light'),
        colorMode: getThemeColor(profile, 'colorMode', 'gradient'),
        mode: getThemeColor(profile, 'mode', 'color_color'),
        themeColor: getThemeColor(profile, 'themeColor', readBrandColor(6, '#6B7CAB')),
        mobileNavStyle: getThemeColor(profile, 'mobileNavStyle', 'top'),
      },
    });
  } catch (err) {
    // Optional shell bridge; local page variables still provide a stable fallback.
  }
}

function normalizeTodo(item, index) {
  return {
    id: item.id || Date.now() + index,
    content: item.content || item.title || '未命名任务',
    done: Boolean(item.done),
  };
}

function loadInitialTodos() {
  try {
    const raw = window.localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(normalizeTodo);
      }
    }
  } catch (err) {
    return DEFAULT_ITEMS.map(normalizeTodo);
  }
  return DEFAULT_ITEMS.map(normalizeTodo);
}

function TodoLine({ item, onToggle }) {
  return (
    <button
      type="button"
      className={`oy-todo-line ${item.done ? 'is-done' : ''}`}
      onClick={() => onToggle(item.id)}
    >
      <span className="oy-check-dot" />
      <span>{item.content}</span>
    </button>
  );
}

function CategoryCard({ category, items, onToggle }) {
  return (
    <article className={`oy-category-card is-${category.tone}`} style={{ '--oy-card-gradient': category.gradient }}>
      <div className="oy-card-head">
        <strong>{category.name}</strong>
        <span>{items.filter((item) => item.done).length}/{Math.max(items.length, 4)}</span>
      </div>
      <div className="oy-card-list">
        {items.length ? items.map((item) => (
          <TodoLine key={item.id} item={item} onToggle={onToggle} />
        )) : (
          <Text className="oy-empty-tip">暂无任务，添加后会自动进入清单。</Text>
        )}
      </div>
    </article>
  );
}

function GoalCard({ label, value, total, tone }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`oy-goal-card is-${tone}`}>
      <div>
        <strong>{label}</strong>
        <Text>{percent}%</Text>
      </div>
      <span>
        <i style={{ width: `${Math.min(percent, 100)}%` }} />
      </span>
    </div>
  );
}

function CalendarPreview({ items }) {
  const cells = Array.from({ length: 35 }).map((_, index) => {
    const item = items.length ? items[index % items.length] : null;
    return {
      day: index + 1,
      item,
    };
  });
  return (
    <section className="oy-calendar-panel">
      <div className="oy-section-title">
        <div>
          <Text>JUNE FOCUS</Text>
          <h2>月视图</h2>
        </div>
        <Button shape="round">本月目标</Button>
      </div>
      <div className="oy-calendar-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <span key={day} className="oy-week-name">{day}</span>
        ))}
        {cells.map((cell) => (
          <div key={cell.day} className={`oy-calendar-cell ${cell.item && cell.item.done ? 'is-done' : ''}`}>
            <strong>{cell.day}</strong>
            {cell.item ? <span>{cell.item.content}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function YidaComp() {
  React.useEffect(() => {
    applyShellTheme(THEME_SCOPE, THEME_PROFILE);
  }, []);

  const themeVars = buildScopedThemeVars(THEME_SCOPE, THEME_PROFILE);
  const brand = getThemeColor(THEME_PROFILE, 'themeColor', readBrandColor(6, '#6b7cab'));
  const brandSoft = getThemeColor(THEME_PROFILE, 'themeColorSoft', readBrandColor(2, '#f3f5fb'));
  const brandDeep = getThemeColor(THEME_PROFILE, 'themeColorDeep', readBrandColor(9, '#435480'));
  const [todos, setTodos] = useState(loadInitialTodos);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState(CONFIG.allLabel);

  const persist = useMemoizedFn((nextTodos) => {
    setTodos(nextTodos);
    try {
      window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(nextTodos));
    } catch (err) {
      // localStorage may be blocked in embedded preview; UI state still works.
    }
  });

  const addTodo = useMemoizedFn(() => {
    const content = draft.trim();
    if (!content) {
      return;
    }
    persist([{ id: Date.now(), content, done: false }].concat(todos));
    setDraft('');
  });

  const toggleTodo = useMemoizedFn((id) => {
    persist(todos.map((item) => item.id === id ? { ...item, done: !item.done } : item));
  });

  const clearCompleted = useMemoizedFn(() => {
    persist(todos.filter((item) => !item.done));
  });

  const visibleTodos = useMemo(() => {
    if (filter === CONFIG.activeLabel) {
      return todos.filter((item) => !item.done);
    }
    if (filter === CONFIG.completedLabel) {
      return todos.filter((item) => item.done);
    }
    return todos;
  }, [filter, todos]);

  const completedCount = todos.filter((item) => item.done).length;
  const activeCount = todos.length - completedCount;
  const completionRate = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;
  const categoryGroups = useMemo(() => CATEGORY_STYLES.map((category, categoryIndex) => ({
    ...category,
    items: visibleTodos.filter((_, todoIndex) => todoIndex % CATEGORY_STYLES.length === categoryIndex).slice(0, 4),
  })), [visibleTodos]);

  return (
    <ConfigProvider getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body} theme={{ token: { colorPrimary: brand, borderRadius: 10 } }}>
      <div
        className="oy-todo-os"
        style={{
          ...themeVars,
          '--oy-brand': brand,
          '--oy-brand-soft': brandSoft,
          '--oy-brand-deep': brandDeep,
        }}
        data-theme-scope={THEME_SCOPE}
      >
        <style>{`
          {{OPENYIDA_CANVAS_CONTROL_CSS}}
          .oy-todo-os {
            min-height: 100vh;
            color: #171a1d;
            background:
              radial-gradient(circle at 22% 12%, rgba(255, 225, 184, .72), transparent 26%),
              radial-gradient(circle at 76% 18%, rgba(190, 219, 255, .72), transparent 28%),
              linear-gradient(135deg, #f8f7f4 0%, #f0eef6 54%, var(--oy-brand-soft) 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .oy-todo-shell { min-height: 100vh; display: grid; grid-template-columns: 184px minmax(0, 1fr); }
          .oy-sidebar {
            padding: 28px 16px 22px;
            background: rgba(255,255,255,.68);
            border-right: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8);
            backdrop-filter: blur(18px);
            display: flex;
            flex-direction: column;
          }
          .oy-logo strong { display: block; font-size: 24px; letter-spacing: 6px; }
          .oy-logo span { display: block; margin-top: 6px; color: #8a8f99; font-size: 12px; }
          .oy-nav { display: grid; gap: 8px; margin-top: 36px; }
          .oy-nav button {
            border: 0;
            border-radius: 9px;
            padding: 11px 13px;
            background: transparent;
            text-align: left;
            color: #6d7380;
            font-weight: 700;
            cursor: default;
          }
          .oy-nav button.is-active { color: var(--oy-brand-deep); background: color-mix(in srgb, var(--oy-brand) 16%, #fff); }
          .oy-user-foot { margin-top: auto; padding-top: 18px; border-top: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8); color: #8a8f99; font-size: 12px; }
          .oy-avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; margin-bottom: 8px; background: #a788e8; color: #fff; font-weight: 800; }
          .oy-main { padding: 28px 30px 34px; min-width: 0; }
          .oy-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
          .oy-topbar small { color: #8a8f99; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          .oy-topbar h1 { margin: 4px 0 0; font-size: 28px; line-height: 1.15; letter-spacing: 3px; }
          .oy-top-actions { display: flex; align-items: center; gap: 10px; }
          .oy-round-btn { width: 36px; height: 36px; border-radius: 50%; border: 0; background: #fff; box-shadow: 0 10px 24px rgba(67,84,128,.10); font-weight: 900; }
          .oy-add-btn { width: 38px; height: 38px; border-radius: 50%; border: 0; background: var(--oy-brand); color: #fff; font-size: 22px; box-shadow: 0 12px 28px rgba(67,84,128,.18); }
          .oy-workspace { display: grid; grid-template-columns: 220px minmax(360px, 1fr) 240px; gap: 18px; align-items: start; }
          .oy-goal-panel, .oy-board, .oy-right-panel, .oy-calendar-panel {
            border: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8);
            border-radius: 18px;
            background: rgba(255,255,255,.78);
            box-shadow: 0 18px 40px rgba(51,56,74,.08);
            backdrop-filter: blur(18px);
          }
          .oy-goal-panel { padding: 18px; }
          .oy-panel-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
          .oy-panel-title h2 { margin: 0; font-size: 17px; }
          .oy-panel-title span { color: #8a8f99; font-size: 12px; line-height: 1.5; }
          .oy-mini-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 14px 0; }
          .oy-mini-stat { border-radius: 13px; padding: 12px; background: #f7f4ef; }
          .oy-mini-stat strong { display: block; font-size: 22px; line-height: 1; }
          .oy-mini-stat span { color: #8a8f99; font-size: 12px; }
          .oy-goal-list { display: grid; gap: 10px; }
          .oy-goal-card { padding: 11px; border-radius: 13px; background: #fff4d9; }
          .oy-goal-card.is-blue { background: #e4f1ff; }
          .oy-goal-card.is-pink { background: #ffe2ef; }
          .oy-goal-card div { display: flex; justify-content: space-between; gap: 10px; }
          .oy-goal-card strong { font-size: 13px; }
          .oy-goal-card .ant-typography { color: #8a6d2d; font-size: 12px; }
          .oy-goal-card > span { display: block; height: 5px; border-radius: 99px; background: color-mix(in srgb, var(--oy-brand) 12%, #fff); overflow: hidden; margin-top: 10px; }
          .oy-goal-card i { display: block; height: 100%; border-radius: inherit; background: var(--oy-brand); }
          .oy-board { padding: 18px; }
          .oy-board-head { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
          .oy-board-head h2 { margin: 0 0 4px; font-size: 18px; }
          .oy-board-head p { margin: 0; color: #7b818d; font-size: 13px; }
          .oy-day-strip { display: grid; grid-template-columns: repeat(7, minmax(44px, 1fr)); gap: 8px; margin: 14px 0 18px; }
          .oy-day { border-radius: 15px; padding: 8px 4px; text-align: center; color: #737986; }
          .oy-day strong { display: block; color: #222630; font-size: 17px; }
          .oy-day.is-active { background: var(--oy-brand); color: #fff; box-shadow: 0 14px 28px rgba(67,84,128,.18); }
          .oy-day.is-active strong { color: #fff; }
          .oy-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; margin-bottom: 16px; }
          .oy-category-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .oy-category-card {
            min-height: 174px;
            padding: 15px;
            border-radius: 17px;
            background: var(--oy-card-gradient);
            box-shadow: inset 0 1px 0 rgba(255,255,255,.44), 0 16px 26px rgba(70,58,44,.08);
          }
          .oy-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
          .oy-card-head strong { font-size: 15px; }
          .oy-card-head span { padding: 3px 8px; border-radius: 999px; background: rgba(255,255,255,.48); color: #6c6570; font-size: 12px; font-weight: 800; }
          .oy-card-list { display: grid; gap: 7px; }
          .oy-todo-line {
            display: grid;
            grid-template-columns: 16px minmax(0, 1fr);
            gap: 8px;
            align-items: center;
            width: 100%;
            border: 0;
            padding: 3px 0;
            background: transparent;
            text-align: left;
            color: #373b45;
            cursor: pointer;
          }
          .oy-todo-line span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .oy-check-dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--oy-brand) 24%, #fff); background: rgba(255,255,255,.32); }
          .oy-todo-line.is-done { color: rgba(55,59,69,.52); text-decoration: line-through; }
          .oy-todo-line.is-done .oy-check-dot { border-color: #31b37d; background: #31b37d; box-shadow: inset 0 0 0 3px rgba(255,255,255,.8); }
          .oy-empty-tip { color: rgba(55,59,69,.62); font-size: 12px; }
          .oy-right-panel { padding: 16px; display: grid; gap: 14px; }
          .oy-schedule h3, .oy-sticky h3 { margin: 0 0 12px; font-size: 15px; }
          .oy-schedule-list { display: grid; gap: 10px; }
          .oy-schedule-item {
            display: grid;
            grid-template-columns: 4px 1fr 14px;
            gap: 9px;
            align-items: center;
            padding: 10px;
            border-radius: 13px;
            background: #f8f7fb;
          }
          .oy-schedule-item:before { content: ""; width: 4px; height: 38px; border-radius: 999px; background: #f2be65; }
          .oy-schedule-item strong { display: block; font-size: 13px; }
          .oy-schedule-item span { color: #8a8f99; font-size: 11px; }
          .oy-schedule-item i { width: 12px; height: 12px; border: 1.5px solid #9da3ad; border-radius: 50%; }
          .oy-sticky { padding: 14px; border-radius: 17px; background: linear-gradient(135deg, #fff3a8 0%, #ffd56d 100%); }
          .oy-sticky p { margin: 0 0 14px; color: #6d5930; line-height: 1.6; }
          .oy-sticky .ant-btn { float: right; background: #e56565; color: #fff; border: 0; }
          .oy-calendar-panel { margin-top: 18px; padding: 18px; }
          .oy-section-title { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 14px; }
          .oy-section-title .ant-typography { color: #8a8f99; letter-spacing: .12em; font-size: 11px; }
          .oy-section-title h2 { margin: 0; font-size: 22px; }
          .oy-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
          .oy-week-name { text-align: center; color: #858b96; font-weight: 800; font-size: 12px; }
          .oy-calendar-cell { min-height: 68px; border-radius: 11px; padding: 8px; background: rgba(255,255,255,.74); border: 1px solid color-mix(in srgb, var(--oy-brand) 10%, #E8F0F8); overflow: hidden; }
          .oy-calendar-cell strong { display: block; margin-bottom: 6px; }
          .oy-calendar-cell span { display: block; padding: 3px 6px; border-radius: 6px; background: color-mix(in srgb, var(--oy-brand) 16%, #fff); color: #454b56; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
          .oy-calendar-cell.is-done span { background: #d8f6e9; }
          @media (max-width: 1180px) {
            .oy-workspace { grid-template-columns: 1fr; }
            .oy-goal-panel, .oy-right-panel { display: none; }
          }
          @media (max-width: 760px) {
            .oy-todo-shell { grid-template-columns: 1fr; }
            .oy-sidebar { display: none; }
            .oy-main { padding: 18px; }
            .oy-topbar, .oy-board-head, .oy-section-title { display: block; }
            .oy-top-actions { margin-top: 12px; }
            .oy-input-row, .oy-category-grid { grid-template-columns: 1fr; }
            .oy-day-strip, .oy-calendar-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .oy-week-name { display: none; }
          }
        `}</style>
        <main className="oy-todo-shell">
          <aside className="oy-sidebar">
            <div className="oy-logo">
              <strong>达到</strong>
              <span>任务与节奏处理系统</span>
            </div>
            <nav className="oy-nav">
              {NAV_ITEMS.map((item, index) => (
                <button key={item} type="button" className={index === 1 ? 'is-active' : ''}>{item}</button>
              ))}
            </nav>
            <div className="oy-user-foot">
              <span className="oy-avatar">S</span>
              <strong>Sandra</strong>
              <div>v0.2 · desktop</div>
            </div>
          </aside>

          <section className="oy-main">
            <header className="oy-topbar">
              <div>
                <small>桌面端 · 今日任务 UI</small>
                <h1>2026年6月9日 · 周二</h1>
              </div>
              <div className="oy-top-actions">
                <button className="oy-round-btn" type="button">‹</button>
                <Button shape="round">今天</Button>
                <button className="oy-round-btn" type="button">›</button>
                <button className="oy-add-btn" type="button" onClick={addTodo}>+</button>
              </div>
            </header>

            <div className="oy-workspace">
              <aside className="oy-goal-panel">
                <div className="oy-panel-title">
                  <div>
                    <h2>周目标 6/2-6/8</h2>
                    <span>把任务拆成可执行清单，聚焦本周关键推进。</span>
                  </div>
                </div>
                <div className="oy-mini-stats">
                  <div className="oy-mini-stat">
                    <strong>{completedCount}</strong>
                    <span>已完成</span>
                  </div>
                  <div className="oy-mini-stat">
                    <strong>{activeCount}</strong>
                    <span>待办事项</span>
                  </div>
                </div>
                <div className="oy-goal-list">
                  <GoalCard label="整理本周待办" value={completedCount} total={todos.length || 1} tone="amber" />
                  <GoalCard label="每周运动 3 次" value={Math.min(completedCount + 1, 3)} total={3} tone="blue" />
                  <GoalCard label="复盘关键事项" value={completionRate} total={100} tone="pink" />
                </div>
              </aside>

              <section className="oy-board">
                <div className="oy-board-head">
                  <div>
                    <Tag color="processing">健康打卡</Tag>
                    <Title level={2}>{CONFIG.title}</Title>
                    <p>{CONFIG.subtitle}</p>
                  </div>
                  <Segmented
                    value={filter}
                    onChange={setFilter}
                    options={[CONFIG.allLabel, CONFIG.activeLabel, CONFIG.completedLabel]}
                  />
                </div>

                <div className="oy-day-strip">
                  {DAY_STRIP.map((item) => (
                    <div key={item.week} className={`oy-day ${item.active ? 'is-active' : ''}`}>
                      <span>{item.week}</span>
                      <strong>{item.day}</strong>
                    </div>
                  ))}
                </div>

                <div className="oy-input-row">
                  <Input
                    value={draft}
                    placeholder={CONFIG.placeholder}
                    onChange={(event) => setDraft(event.target.value)}
                    onPressEnter={addTodo}
                  />
                  <Button type="primary" onClick={addTodo}>新增任务</Button>
                  <Button onClick={clearCompleted}>{CONFIG.clearCompletedLabel}</Button>
                </div>

                <div className="oy-category-grid">
                  {categoryGroups.map((category) => (
                    <CategoryCard key={category.name} category={category} items={category.items} onToggle={toggleTodo} />
                  ))}
                </div>
              </section>

              <aside className="oy-right-panel">
                <div className="oy-schedule">
                  <h3>今日安排</h3>
                  <div className="oy-schedule-list">
                    {SCHEDULE_ITEMS.map((item) => (
                      <div className="oy-schedule-item" key={`${item.time}-${item.title}`}>
                        <div>
                          <span>{item.time} · {item.tag}</span>
                          <strong>{item.title}</strong>
                        </div>
                        <i />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="oy-sticky">
                  <h3>随手便利贴</h3>
                  <p>把零散想法先记下来，再决定是否进入正式清单。</p>
                  <Button shape="round">记下</Button>
                </div>
              </aside>
            </div>

            <CalendarPreview items={todos} />
          </section>
        </main>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
