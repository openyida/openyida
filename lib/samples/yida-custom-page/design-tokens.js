// 将以下代码复制到 renderJsx 函数顶部即可使用

// ── 色彩系统 ─────────────────────────────────────────
var colors = {
  // 示例主色（独立紫色主题，不继承 App 主题；业务页如需跟随 App 可自行换回平台变量）
  primary:       '#7C3AED',  // 主色：主按钮、链接、选中态高亮
  primaryHover:  '#8B5CF6',  // 主色 hover：填充按钮/链接 hover，比主色亮一档
  primaryActive: '#6D28D9',  // 主色按下：填充按钮 active，比主色深一档
  hover:         '#F5F3FF',  // 通用浅色 hover 底：列表行、菜单项 hover
  active:        '#EDE9FE',  // 通用浅色激活/按下底
  disabled:      '#DDD6FE',  // 禁用态：浅、去饱和
  primaryLight:  '#EDE9FE',  // 主色浅背景：选中行底、标签高亮底
  controlSelectedBg: 'var(--oyd-control-selected-bg, rgba(124,58,237,.08))', // native 控件选中浅底
  controlInfoBg:     'var(--oyd-control-info-bg, rgba(124,58,237,.08))',     // native 提示块浅底

  // 语义色（固定，不随主题变——保证成功/警告/错误语义稳定）
  success:        '#52C41A',
  successLight:   '#F6FFED',
  warning:        '#FAAD14',
  warningLight:   '#FFFBE6',
  error:          '#FF4D4F',
  errorLight:     '#FFF2F0',
  // info = 品牌信息色，跟随主题（不再固定蓝）
  info:           '#7C3AED',
  infoLight:      '#F5F3FF',
  
  // 中性色
  text:           '#1D2129',
  textSecondary:  '#4E5969',
  textTertiary:   '#86909C',
  textDisabled:   '#C9CDD4',
  border:         '#E5E6EB',
  borderLight:    '#F2F3F5',
  bg:             '#F7F8FA',
  bgCard:         '#FFFFFF',
};

// ── 视觉主题预设：按页面类型选择，不要所有页面都套同一套蓝灰卡片 ──
var visualPresets = {
  commandDark: {
    name: '深色数据指挥舱',
    bg: '#07111F',
    surface: '#1D2939',
    surfaceSoft: 'rgba(15, 23, 42, 0.68)',
    text: '#E6F1FF',
    textSecondary: '#94A3B8',
    accent: '#14B8A6',
    accent2: '#FACC15',
    border: 'rgba(148, 163, 184, 0.24)',
    shadow: '0 28px 70px rgba(2, 8, 23, 0.34)',
  },
  editorialWarm: {
    name: '暖色品牌叙事',
    bg: '#F9F5EF',
    surface: '#FFFFFF',
    surfaceSoft: 'rgba(255, 255, 255, 0.74)',
    text: '#24211D',
    textSecondary: '#706B64',
    accent: '#9A6A2F',
    accent2: '#2F261B',
    border: '#E4DDD2',
    shadow: '0 30px 80px rgba(47, 38, 27, 0.18)',
  },
  mintTaskflow: {
    name: '薄荷任务流',
    bg: '#ECFDF8',
    surface: '#FFFFFF',
    surfaceSoft: '#F8FBFF',
    text: '#10201D',
    textSecondary: '#58706B',
    accent: '#0F9F8E',
    accent2: '#6D5DF6',
    border: '#D8EEE8',
    shadow: '0 24px 60px rgba(16, 32, 29, 0.12)',
  },
};

// ── 字体规范 ─────────────────────────────────────────
var typography = {
  fontSize: {
    xs:   '12px',
    sm:   '13px',
    base: '14px',
    md:   '15px',
    lg:   '16px',
    xl:   '18px',
    xxl:  '20px',
    h1:   '24px',
  },
  fontWeight: {
    normal:   400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },
  lineHeight: {
    tight:  1.4,
    normal: 1.6,
    loose:  1.8,
  },
};

// ── 间距系统（基于 8px）──────────────────────────────
var spacing = {
  xs:   '4px',
  sm:   '8px',
  md:   '12px',
  lg:   '16px',
  xl:   '20px',
  xxl:  '24px',
  xxxl: '32px',
  page: '16px',
};

// ── 常用组件样式模板 ─────────────────────────────────
var isMobile = this.utils.isMobile();

var styles = {
  // 页面容器
  page: {
    minHeight: '100vh',
    background: colors.bg,
    padding: isMobile ? '12px' : '16px 24px',
    borderRadius: '0 !important',
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif',
    fontSize: typography.fontSize.base,
    color: colors.text,
    boxSizing: 'border-box',
  },
  
  // 卡片
  card: {
    background: colors.bgCard,
    borderRadius: '8px',
    border: '1px solid ' + colors.border,
    padding: isMobile ? '12px' : '16px',
    marginBottom: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  
  // 卡片标题
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginBottom: '12px',
    paddingBottom: '10px',
    borderBottom: '1px solid ' + colors.borderLight,
  },
  
  // 主按钮
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    height: '32px',
    background: colors.primary,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    outline: 'none',
  },
  
  // 次要按钮
  btnDefault: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    height: '32px',
    background: colors.bgCard,
    color: colors.text,
    border: '1px solid ' + colors.border,
    borderRadius: '6px',
    fontSize: typography.fontSize.base,
    cursor: 'pointer',
    outline: 'none',
  },
  
  // 危险按钮
  btnDanger: {
    background: colors.error,
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '6px',
    padding: '0 16px',
    height: '32px',
    cursor: 'pointer',
  },
  
  // 输入框
  input: {
    width: '100%',
    height: '32px',
    padding: '0 12px',
    border: '1px solid ' + colors.border,
    borderRadius: '6px',
    fontSize: typography.fontSize.base,
    color: colors.text,
    background: colors.bgCard,
    outline: 'none',
    boxSizing: 'border-box',
  },
  
  // 状态标签（函数）
  tag: function(type) {
    var colorMap = {
      success: { color: '#52C41A', bg: '#F6FFED', border: '#B7EB8F' },
      warning: { color: '#FAAD14', bg: '#FFFBE6', border: '#FFE58F' },
      error:   { color: '#FF4D4F', bg: '#FFF2F0', border: '#FFCCC7' },
      info:    { color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
      default: { color: '#4E5969', bg: '#F2F3F5', border: '#E5E6EB' },
    };
    var c = colorMap[type] || colorMap.default;
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.medium,
      color: c.color,
      background: c.bg,
      border: '1px solid ' + c.border,
    };
  },
  
  // 数据列表行
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid ' + colors.borderLight,
  },
  
  listLabel: {
    width: '100px',
    flexShrink: 0,
    fontSize: typography.fontSize.sm,
    color: colors.textTertiary,
  },
  
  listValue: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
  
  // 空状态
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 16px',
    color: colors.textDisabled,
    fontSize: typography.fontSize.base,
  },
};
