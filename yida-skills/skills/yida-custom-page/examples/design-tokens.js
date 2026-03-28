// 将以下代码复制到 renderJsx 函数顶部即可使用

// ── 色彩系统 ─────────────────────────────────────────
var colors = {
  // 主色（使用宜搭平台 CSS 变量）
  primary:      'var(--color-brand1-6)',
  primaryHover: 'var(--color-brand1-1)',
  hover:        'var(--color-brand1-9)',
  active:       'var(--color-brand1-9)',
  disabled:     'var(--color-brand1-8)',
  primaryLight: 'var(--color-brand1-2)',
  
  // 语义色
  success:        '#52C41A',
  successLight:   '#F6FFED',
  warning:        '#FAAD14',
  warningLight:   '#FFFBE6',
  error:          '#FF4D4F',
  errorLight:     '#FFF2F0',
  info:           '#1677FF',
  infoLight:      '#E6F4FF',
  
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
      info:    { color: '#1677FF', bg: '#E6F4FF', border: '#91CAFF' },
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
