// ============================================================
// 状态管理
// ============================================================

const FORM_UUID = 'FORM-XXX';
const APP_TYPE = 'APP_XXX';

// 报名动态数据
const REGISTRATION_NOTICES = [
  '刚刚：张总来自字节跳动完成报名',
  '1分钟前：李经理来自腾讯完成报名',
  '2分钟前：王总来自华为完成报名',
  '3分钟前：陈总来自阿里巴巴完成报名',
  '4分钟前：刘总来自百度完成报名',
  '5分钟前：赵经理来自小米完成报名',
  '刚刚：孙总来自蔚来汽车完成报名',
  '1分钟前：周总来自理想汽车完成报名',
];

const _customState = {
  // 倒计时
  countdownDays: 0,
  countdownHours: 0,
  countdownMinutes: 0,
  countdownSeconds: 0,
  // 报名动态
  currentNoticeIndex: 0,
  noticeVisible: true,
  // 报名人数
  registeredCount: 3847,
  // 表单状态
  isSubmitting: false,
  isSubmitted: false,
  submitError: '',
  // 表单字段（非受控，仅静默存储）
  formName: '',
  formCompany: '',
  formPosition: '',
  formEmail: '',
  // 进度条
  totalSeats: 5000,
};

export function getCustomState(key) {
  if (key) return _customState[key];
  return { ..._customState };
}

export function setCustomState(newState) {
  Object.keys(newState).forEach(function(key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

// ============================================================
// 生命周期
// ============================================================

export function didMount() {
  // 启动倒计时
  this.updateCountdown();
  _customState._countdownTimer = setInterval(function() {
    this.updateCountdown();
  }.bind(this), 1000);

  // 启动报名动态轮播
  _customState._noticeTimer = setInterval(function() {
    var nextIndex = (_customState.currentNoticeIndex + 1) % REGISTRATION_NOTICES.length;
    this.setCustomState({ currentNoticeIndex: nextIndex, noticeVisible: true });
  }.bind(this), 4000);

  // 数字跳动效果：报名人数随机小幅增加
  _customState._countTimer = setInterval(function() {
    if (Math.random() > 0.7) {
      this.setCustomState({ registeredCount: _customState.registeredCount + 1 });
    }
  }.bind(this), 8000);
}

export function didUnmount() {
  clearInterval(_customState._countdownTimer);
  clearInterval(_customState._noticeTimer);
  clearInterval(_customState._countTimer);
}

export function updateCountdown() {
  // 目标时间：2026年3月15日 14:00 GMT+8
  var targetTime = new Date('2026-03-15T14:00:00+08:00').getTime();
  var now = new Date().getTime();
  var diff = targetTime - now;

  if (diff <= 0) {
    this.setCustomState({ countdownDays: 0, countdownHours: 0, countdownMinutes: 0, countdownSeconds: 0 });
    return;
  }

  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  var seconds = Math.floor((diff % (1000 * 60)) / 1000);

  this.setCustomState({ countdownDays: days, countdownHours: hours, countdownMinutes: minutes, countdownSeconds: seconds });
}

/**
 * 滚动到报名表单
 */
export function scrollToForm() {
  var formEl = document.getElementById('registration-form');
  if (formEl) {
    formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * 处理表单提交
 */
export function handleSubmit(e) {
  e.preventDefault();

  // 获取表单值
  var name = _customState.formName || '';
  var company = _customState.formCompany || '';
  var position = _customState.formPosition || '';
  var email = _customState.formEmail || '';

  // 表单验证
  if (!name.trim()) {
    this.setCustomState({ submitError: '请输入您的姓名' });
    return;
  }
  if (!company.trim()) {
    this.setCustomState({ submitError: '请输入您的公司名称' });
    return;
  }
  if (!position || position === '请选择') {
    this.setCustomState({ submitError: '请选择您的职位' });
    return;
  }
  if (!email.trim()) {
    this.setCustomState({ submitError: '请输入工作邮箱' });
    return;
  }
  // 简单邮箱格式验证
  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    this.setCustomState({ submitError: '请输入有效的邮箱地址' });
    return;
  }

  // 清除错误，设置提交中状态
  this.setCustomState({ isSubmitting: true, submitError: '' });

  // 保存到宜搭表单
  var appType = window.pageConfig && window.pageConfig.appType;
  var formUuid = 'FORM-76402507C605423DA55BB8C934E2B31509D5';

  this.utils.yida.saveFormData({
    formUuid: formUuid,
    appType: appType,
    formDataJson: JSON.stringify({
      textField_8904dr89: name,
      textField_8904s2zw: company,
      textField_8904xumu: position,
      textField_8904fybo: email,
      textField_8904e54g: '未来视野2026发布会',
      dateField_8904yv3d: new Date().getTime(),
    }),
  }).then(function(res) {
    // 提交成功
    this.setCustomState({ isSubmitting: false, isSubmitted: true });
    this.utils.toast({ title: '报名成功！', type: 'success' });
    
    // 清空表单
    _customState.formName = '';
    _customState.formCompany = '';
    _customState.formPosition = '';
    _customState.formEmail = '';
    var nameInput = document.getElementById('field-name');
    var companyInput = document.getElementById('field-company');
    var positionInput = document.getElementById('field-position');
    var emailInput = document.getElementById('field-email');
    if (nameInput) nameInput.value = '';
    if (companyInput) companyInput.value = '';
    if (positionInput) positionInput.value = '请选择';
    if (emailInput) emailInput.value = '';
  }.bind(this)).catch(function(err) {
    // 提交失败
    this.setCustomState({ isSubmitting: false, submitError: err.message || '提交失败，请稍后重试' });
    this.utils.toast({ title: err.message || '提交失败', type: 'error' });
  }.bind(this));
}

// ============================================================
// 渲染
// ============================================================

export function renderJsx() {
  var state = _customState;
  var { timestamp } = this.state;

  var remainingSeats = state.totalSeats - state.registeredCount;
  var progressPercent = Math.round((state.registeredCount / state.totalSeats) * 100);

  // ---- 颜色 & 样式常量 ----
  var colors = {
    bgDeep: '#0B0F19',
    bgCard: 'rgba(255,255,255,0.05)',
    bgCardHover: 'rgba(255,255,255,0.08)',
    neonBlue: '#3B82F6',
    electricPurple: '#8B5CF6',
    cyberPink: '#EC4899',
    energyOrange: '#F59E0B',
    white: '#FFFFFF',
    whiteAlpha60: 'rgba(255,255,255,0.6)',
    whiteAlpha30: 'rgba(255,255,255,0.3)',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.12)',
  };

  var styles = {
    page: {
      background: colors.bgDeep,
      minHeight: '100vh',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
      color: colors.white,
      overflowX: 'hidden',
      position: 'relative',
    },
    // 固定顶部栏
    topBar: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'linear-gradient(135deg, rgba(11,15,25,0.95) 0%, rgba(124,58,237,0.15) 50%, rgba(236,72,153,0.1) 100%)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid ' + colors.glassBorder,
      padding: '0 24px',
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topBarLogo: {
      fontSize: '18px',
      fontWeight: '700',
      background: 'linear-gradient(135deg, #3B82F6, #8B5CF6, #EC4899)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    topBarRight: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    countdownWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '13px',
      color: colors.whiteAlpha60,
    },
    countdownUnit: {
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '6px',
      padding: '4px 8px',
      fontFamily: "'DIN Alternate', monospace",
      fontWeight: '700',
      fontSize: '16px',
      color: colors.white,
      minWidth: '36px',
      textAlign: 'center',
    },
    topBarCta: {
      background: 'linear-gradient(135deg, #EC4899, #F59E0B)',
      border: 'none',
      borderRadius: '8px',
      padding: '8px 18px',
      color: colors.white,
      fontWeight: '600',
      fontSize: '14px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    },
    // Hero 区
    hero: {
      paddingTop: '64px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      textAlign: 'center',
      padding: '120px 24px 80px',
      background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.2) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(59,130,246,0.15) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 20% 80%, rgba(236,72,153,0.1) 0%, transparent 60%)',
    },
    heroBadge: {
      display: 'inline-block',
      background: 'rgba(139,92,246,0.2)',
      border: '1px solid rgba(139,92,246,0.4)',
      borderRadius: '20px',
      padding: '6px 16px',
      fontSize: '13px',
      color: '#A78BFA',
      marginBottom: '24px',
      letterSpacing: '0.05em',
    },
    heroTitle: {
      fontSize: '56px',
      fontWeight: '800',
      lineHeight: '1.1',
      marginBottom: '20px',
      background: 'linear-gradient(135deg, #FFFFFF 0%, #A78BFA 50%, #EC4899 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      maxWidth: '800px',
    },
    heroSubtitle: {
      fontSize: '18px',
      color: colors.whiteAlpha60,
      marginBottom: '32px',
      maxWidth: '560px',
    },
    heroInfoCard: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '24px',
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '12px',
      padding: '14px 28px',
      marginBottom: '36px',
      fontSize: '14px',
      color: colors.whiteAlpha60,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    heroInfoItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    },
    heroInfoDot: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: '#8B5CF6',
      flexShrink: 0,
    },
    heroBtnGroup: {
      display: 'flex',
      gap: '16px',
      justifyContent: 'center',
      marginBottom: '40px',
      flexWrap: 'wrap',
    },
    btnPrimary: {
      background: 'linear-gradient(135deg, #EC4899, #F59E0B)',
      border: 'none',
      borderRadius: '12px',
      padding: '14px 32px',
      color: colors.white,
      fontWeight: '700',
      fontSize: '16px',
      cursor: 'pointer',
      boxShadow: '0 0 30px rgba(236,72,153,0.4)',
    },
    btnSecondary: {
      background: 'transparent',
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '12px',
      padding: '14px 32px',
      color: colors.white,
      fontWeight: '600',
      fontSize: '16px',
      cursor: 'pointer',
    },
    // 报名动态
    noticeBanner: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      background: 'rgba(59,130,246,0.1)',
      border: '1px solid rgba(59,130,246,0.2)',
      borderRadius: '24px',
      padding: '8px 20px',
      fontSize: '13px',
      color: colors.whiteAlpha60,
    },
    noticeDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#3B82F6',
      flexShrink: 0,
      boxShadow: '0 0 8px #3B82F6',
    },
    // 通用 section
    section: {
      padding: '80px 24px',
      maxWidth: '1100px',
      margin: '0 auto',
    },
    sectionTitle: {
      fontSize: '36px',
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: '12px',
      background: 'linear-gradient(135deg, #FFFFFF, #A78BFA)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    sectionSubtitle: {
      fontSize: '16px',
      color: colors.whiteAlpha60,
      textAlign: 'center',
      marginBottom: '48px',
    },
    // 价值主张卡片
    valueGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '20px',
    },
    valueCard: {
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '16px',
      padding: '28px 24px',
    },
    valueIcon: {
      fontSize: '32px',
      marginBottom: '16px',
    },
    valueCardTitle: {
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '8px',
      color: colors.white,
    },
    valueCardDesc: {
      fontSize: '14px',
      color: colors.whiteAlpha60,
      lineHeight: '1.6',
    },
    valueBadge: {
      display: 'inline-block',
      background: 'rgba(245,158,11,0.15)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '12px',
      color: '#F59E0B',
      marginTop: '10px',
    },
    // 议程时间轴
    agendaList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0',
      position: 'relative',
    },
    agendaItem: {
      display: 'flex',
      gap: '20px',
      paddingBottom: '28px',
      position: 'relative',
    },
    agendaTimeCol: {
      width: '120px',
      flexShrink: 0,
      textAlign: 'right',
    },
    agendaTime: {
      fontSize: '13px',
      color: '#8B5CF6',
      fontFamily: 'monospace',
      fontWeight: '600',
    },
    agendaLine: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '24px',
      flexShrink: 0,
    },
    agendaDot: {
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
      boxShadow: '0 0 12px rgba(139,92,246,0.6)',
      flexShrink: 0,
    },
    agendaConnector: {
      flex: 1,
      width: '2px',
      background: 'linear-gradient(to bottom, rgba(139,92,246,0.4), rgba(139,92,246,0.1))',
      marginTop: '4px',
    },
    agendaContent: {
      flex: 1,
      paddingBottom: '8px',
    },
    agendaTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: colors.white,
      marginBottom: '4px',
    },
    agendaDesc: {
      fontSize: '13px',
      color: colors.whiteAlpha60,
    },
    // 嘉宾
    speakerGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '20px',
    },
    speakerCard: {
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '16px',
      padding: '24px 20px',
      textAlign: 'center',
    },
    speakerAvatar: {
      width: '72px',
      height: '72px',
      borderRadius: '50%',
      margin: '0 auto 14px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px',
      background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.3))',
      border: '2px solid rgba(139,92,246,0.4)',
    },
    speakerName: {
      fontSize: '16px',
      fontWeight: '700',
      color: colors.white,
      marginBottom: '4px',
    },
    speakerTitle: {
      fontSize: '12px',
      color: colors.whiteAlpha60,
      marginBottom: '10px',
    },
    speakerTag: {
      display: 'inline-block',
      background: 'rgba(139,92,246,0.15)',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: '6px',
      padding: '2px 8px',
      fontSize: '11px',
      color: '#A78BFA',
    },
    speakerMystery: {
      background: 'rgba(255,255,255,0.03)',
      border: '1px dashed rgba(255,255,255,0.15)',
    },
    // 社交证明
    logoWall: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      justifyContent: 'center',
      marginBottom: '48px',
    },
    logoItem: {
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '10px',
      padding: '12px 24px',
      fontSize: '15px',
      fontWeight: '600',
      color: colors.whiteAlpha60,
    },
    statsRow: {
      display: 'flex',
      justifyContent: 'center',
      gap: '48px',
      flexWrap: 'wrap',
      marginBottom: '48px',
    },
    statItem: {
      textAlign: 'center',
    },
    statNumber: {
      fontSize: '40px',
      fontWeight: '800',
      background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      display: 'block',
    },
    statLabel: {
      fontSize: '14px',
      color: colors.whiteAlpha60,
      marginTop: '4px',
    },
    // 报名表单区
    formSection: {
      padding: '80px 24px',
      background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)',
    },
    formCard: {
      maxWidth: '560px',
      margin: '0 auto',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '24px',
      padding: '40px',
      backdropFilter: 'blur(20px)',
    },
    formHeader: {
      textAlign: 'center',
      marginBottom: '32px',
    },
    formTitle: {
      fontSize: '28px',
      fontWeight: '800',
      color: colors.white,
      marginBottom: '8px',
    },
    formSubtitle: {
      fontSize: '14px',
      color: colors.whiteAlpha60,
      marginBottom: '16px',
    },
    progressBar: {
      background: 'rgba(255,255,255,0.1)',
      borderRadius: '4px',
      height: '6px',
      overflow: 'hidden',
      marginBottom: '8px',
    },
    progressFill: {
      height: '100%',
      background: 'linear-gradient(90deg, #8B5CF6, #EC4899)',
      borderRadius: '4px',
      width: progressPercent + '%',
      transition: 'width 0.5s ease',
    },
    progressLabel: {
      fontSize: '12px',
      color: '#EC4899',
      textAlign: 'right',
    },
    formGroup: {
      marginBottom: '16px',
    },
    formLabel: {
      display: 'block',
      fontSize: '13px',
      color: colors.whiteAlpha60,
      marginBottom: '6px',
      fontWeight: '500',
    },
    formInput: {
      width: '100%',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      color: colors.white,
      fontSize: '15px',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    formSelect: {
      width: '100%',
      background: 'rgba(20,20,35,0.9)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '12px 16px',
      color: colors.white,
      fontSize: '15px',
      outline: 'none',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
      cursor: 'pointer',
    },
    submitBtn: {
      width: '100%',
      background: 'linear-gradient(135deg, #EC4899, #F59E0B)',
      border: 'none',
      borderRadius: '12px',
      padding: '16px',
      color: colors.white,
      fontWeight: '700',
      fontSize: '16px',
      cursor: state.isSubmitting ? 'not-allowed' : 'pointer',
      marginTop: '8px',
      opacity: state.isSubmitting ? 0.7 : 1,
      boxShadow: '0 0 30px rgba(236,72,153,0.3)',
    },
    securityNote: {
      textAlign: 'center',
      fontSize: '12px',
      color: colors.whiteAlpha30,
      marginTop: '12px',
    },
    errorMsg: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px',
      color: '#FCA5A5',
      marginBottom: '12px',
    },
    // 成功状态
    successCard: {
      textAlign: 'center',
      padding: '20px 0',
    },
    successIcon: {
      fontSize: '64px',
      marginBottom: '16px',
      display: 'block',
    },
    successTitle: {
      fontSize: '24px',
      fontWeight: '800',
      color: colors.white,
      marginBottom: '8px',
    },
    successDesc: {
      fontSize: '14px',
      color: colors.whiteAlpha60,
      marginBottom: '24px',
      lineHeight: '1.6',
    },
    successActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    successBtn: {
      background: colors.glass,
      border: '1px solid ' + colors.glassBorder,
      borderRadius: '10px',
      padding: '10px 20px',
      color: colors.white,
      fontSize: '14px',
      cursor: 'pointer',
      fontWeight: '500',
    },
    // 分隔线
    divider: {
      height: '1px',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
      margin: '0 24px',
    },
    // 底部
    footer: {
      textAlign: 'center',
      padding: '40px 24px',
      color: colors.whiteAlpha30,
      fontSize: '13px',
    },
  };

  var padZero = function(num) {
    return num < 10 ? '0' + num : '' + num;
  };

  var agendaItems = [
    { time: '14:00 - 14:10', title: '开场致辞', desc: '主持人开场，发布会正式启动' },
    { time: '14:10 - 14:50', title: 'AI 重构商业逻辑', desc: '深度解析 AI 如何颠覆传统商业模式，2026 年的机遇与挑战' },
    { time: '14:50 - 15:30', title: '碳中和圆桌论坛', desc: '行业领袖共话绿色科技与可持续发展路径' },
    { time: '15:30 - 15:45', title: '中场休息 & VR 抽奖', desc: '互动抽奖，赢取价值万元科技礼品' },
    { time: '15:45 - 16:30', title: '神秘新品发布', desc: '重磅产品首发，引领行业新风向' },
    { time: '16:30 - 17:00', title: '互动问答 & 资料包', desc: '与嘉宾实时互动，领取独家白皮书资料包' },
  ];

  var speakers = [
    { emoji: '👨‍💼', name: '张明远', title: 'CEO · 科技领袖', tag: 'AI战略', bio: '前谷歌中国区总裁，连续创业者' },
    { emoji: '👩‍🔬', name: '李晓雯', title: 'CTO · 技术先锋', tag: '深度学习', bio: '斯坦福AI实验室博士，10年AI研究' },
    { emoji: '🧑‍💻', name: '王浩然', title: '创始人 · 投资人', tag: '碳中和', bio: '绿色科技基金创始人，ESG专家' },
    { emoji: '👨‍🎤', name: '神秘嘉宾', title: '3月10日揭晓', tag: '敬请期待', bio: '来自全球顶尖科技公司的重磅嘉宾', mystery: true },
    { emoji: '🎭', name: '神秘嘉宾', title: '3月10日揭晓', tag: '敬请期待', bio: '颠覆性创新领域的行业引领者', mystery: true },
  ];

  var logos = ['华为', '腾讯', '阿里巴巴', '蔚来汽车', '理想汽车', '小米', '字节跳动', '百度'];

  return (
    <div style={styles.page}>
      {/* 隐藏 timestamp，触发重渲染 */}
      <div style={{ display: 'none' }}>{timestamp}</div>

      {/* ===== 固定顶部栏 ===== */}
      <div style={styles.topBar}>
        <div style={styles.topBarLogo}>未来视野 2026</div>
        <div style={styles.topBarRight}>
          <div style={styles.countdownWrap}>
            <span>距开播</span>
            <span style={styles.countdownUnit}>{padZero(state.countdownDays)}</span>
            <span>天</span>
            <span style={styles.countdownUnit}>{padZero(state.countdownHours)}</span>
            <span>时</span>
            <span style={styles.countdownUnit}>{padZero(state.countdownMinutes)}</span>
            <span>分</span>
            <span style={styles.countdownUnit}>{padZero(state.countdownSeconds)}</span>
            <span>秒</span>
          </div>
          <button style={styles.topBarCta} onClick={(e) => { this.scrollToForm(); }}>立即锁定席位</button>
        </div>
      </div>

      {/* ===== Hero 区 ===== */}
      <div style={styles.hero}>
        <div style={styles.heroBadge}>🚀 2026年度科技趋势发布会 · 线上直播</div>
        <div style={styles.heroTitle}>未来视野 2026</div>
        <div style={styles.heroSubtitle}>与全球 5000+ 创新者共同预见下一个十年</div>

        <div style={styles.heroInfoCard}>
          <div style={styles.heroInfoItem}>
            <div style={styles.heroInfoDot}></div>
            <span>📅 2026年3月15日</span>
          </div>
          <div style={styles.heroInfoItem}>
            <div style={styles.heroInfoDot}></div>
            <span>⏰ 14:00 - 17:00 GMT+8</span>
          </div>
          <div style={styles.heroInfoItem}>
            <div style={styles.heroInfoDot}></div>
            <span>💻 线上直播 + 互动问答</span>
          </div>
        </div>

        <div style={styles.heroBtnGroup}>
          <button style={styles.btnPrimary} onClick={(e) => { this.scrollToForm(); }}>🎟 免费报名</button>
          <button style={styles.btnSecondary} onClick={(e) => {
            var el = document.getElementById('agenda-section');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}>查看议程 →</button>
        </div>

        <div style={styles.noticeBanner}>
          <div style={styles.noticeDot}></div>
          <span>{REGISTRATION_NOTICES[state.currentNoticeIndex]}</span>
        </div>
      </div>

      <div style={styles.divider}></div>

      {/* ===== 价值主张 ===== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>为什么要参加？</div>
        <div style={styles.sectionSubtitle}>四大核心价值，让这场发布会与众不同</div>
        <div style={styles.valueGrid}>
          <div style={styles.valueCard}>
            <div style={styles.valueIcon}>📊</div>
            <div style={styles.valueCardTitle}>趋势首发</div>
            <div style={styles.valueCardDesc}>2026年度科技趋势白皮书独家首发，深度解析未来三年的行业变革方向。</div>
            <div style={styles.valueBadge}>价值 ¥1,999</div>
          </div>
          <div style={styles.valueCard}>
            <div style={styles.valueIcon}>🎤</div>
            <div style={styles.valueCardTitle}>顶级嘉宾</div>
            <div style={styles.valueCardDesc}>3位行业领袖 + 2位神秘大咖，汇聚全球最具影响力的科技思想者。</div>
            <div style={styles.valueBadge}>3月10日揭晓</div>
          </div>
          <div style={styles.valueCard}>
            <div style={styles.valueIcon}>🌐</div>
            <div style={styles.valueCardTitle}>资源网络</div>
            <div style={styles.valueCardDesc}>加入 5000+ 创新者社群，与全球顶尖创业者、投资人建立深度连接。</div>
            <div style={styles.valueBadge}>终身会员</div>
          </div>
          <div style={styles.valueCard}>
            <div style={styles.valueIcon}>⭐</div>
            <div style={styles.valueCardTitle}>口碑保证</div>
            <div style={styles.valueCardDesc}>往届参会者 92% 满意度，平均观看时长 2.5 小时，内容价值有目共睹。</div>
            <div style={styles.valueBadge}>92% 满意度</div>
          </div>
        </div>
      </div>

      <div style={styles.divider}></div>

      {/* ===== 议程时间轴 ===== */}
      <div style={Object.assign({}, styles.section, { paddingTop: '80px' })} id="agenda-section">
        <div style={styles.sectionTitle}>发布会议程</div>
        <div style={styles.sectionSubtitle}>精心策划的3小时，每分钟都有价值</div>
        <div style={styles.agendaList}>
          {agendaItems.map(function(item, index) {
            return (
              <div key={index} style={styles.agendaItem}>
                <div style={styles.agendaTimeCol}>
                  <div style={styles.agendaTime}>{item.time}</div>
                </div>
                <div style={styles.agendaLine}>
                  <div style={styles.agendaDot}></div>
                  {index < agendaItems.length - 1 && <div style={styles.agendaConnector}></div>}
                </div>
                <div style={styles.agendaContent}>
                  <div style={styles.agendaTitle}>{item.title}</div>
                  <div style={styles.agendaDesc}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.divider}></div>

      {/* ===== 嘉宾阵容 ===== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>嘉宾阵容</div>
        <div style={styles.sectionSubtitle}>汇聚全球最具影响力的科技思想领袖</div>
        <div style={styles.speakerGrid}>
          {speakers.map(function(speaker, index) {
            return (
              <div key={index} style={Object.assign({}, styles.speakerCard, speaker.mystery ? styles.speakerMystery : {})}>
                <div style={styles.speakerAvatar}>
                  {speaker.mystery ? '❓' : speaker.emoji}
                </div>
                <div style={styles.speakerName}>{speaker.name}</div>
                <div style={styles.speakerTitle}>{speaker.title}</div>
                <div style={styles.speakerTag}>{speaker.tag}</div>
                <div style={Object.assign({}, styles.agendaDesc, { marginTop: '10px', fontSize: '12px' })}>{speaker.bio}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.divider}></div>

      {/* ===== 社交证明 ===== */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>他们都在参加</div>
        <div style={styles.sectionSubtitle}>来自全球顶尖企业的创新者共同见证</div>

        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>{state.registeredCount.toLocaleString()}</span>
            <div style={styles.statLabel}>已报名人数</div>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>92%</span>
            <div style={styles.statLabel}>往届满意度</div>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>2.5h</span>
            <div style={styles.statLabel}>平均观看时长</div>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statNumber}>5000+</span>
            <div style={styles.statLabel}>创新者社群</div>
          </div>
        </div>

        <div style={styles.logoWall}>
          {logos.map(function(logo, index) {
            return (
              <div key={index} style={styles.logoItem}>{logo}</div>
            );
          })}
        </div>
      </div>

      <div style={styles.divider}></div>

      {/* ===== 报名表单 ===== */}
      <div style={styles.formSection} id="registration-form">
        <div style={styles.formCard}>
          {state.isSubmitted ? (
            <div style={styles.successCard}>
              <span style={styles.successIcon}>🎉</span>
              <div style={styles.successTitle}>报名成功！</div>
              <div style={styles.successDesc}>
                确认邮件已发送至您的邮箱<br/>
                请查收并添加日历提醒
              </div>
              <div style={styles.successActions}>
                <button 
                  style={styles.successBtn}
                  onClick={(e) => { this.utils.toast({ title: '白皮书预览将在活动前发送', type: 'info' }); }}
                >
                  📄 下载白皮书预览
                </button>
                <button 
                  style={styles.successBtn}
                  onClick={(e) => { this.utils.toast({ title: '已复制分享链接', type: 'success' }); }}
                >
                  🔗 分享给好友
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={styles.formHeader}>
                <div style={styles.formTitle}>🔒 锁定您的席位</div>
                <div style={styles.formSubtitle}>免费报名 · 仅限 5,000 人</div>
                <div style={styles.progressBar}>
                  <div style={styles.progressFill}></div>
                </div>
                <div style={styles.progressLabel}>剩余 {remainingSeats.toLocaleString()} 个席位</div>
              </div>

              {state.submitError ? (
                <div style={styles.errorMsg}>⚠️ {state.submitError}</div>
              ) : null}

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>姓名 *</label>
                <input
                  id="field-name"
                  style={styles.formInput}
                  type="text"
                  placeholder="请输入您的姓名"
                  defaultValue=""
                  onChange={(e) => { _customState.formName = e.target.value; }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>公司 *</label>
                <input
                  id="field-company"
                  style={styles.formInput}
                  type="text"
                  placeholder="请输入您的公司名称"
                  defaultValue=""
                  onChange={(e) => { _customState.formCompany = e.target.value; }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>职位 *</label>
                <select
                  id="field-position"
                  style={styles.formSelect}
                  defaultValue="请选择"
                  onChange={(e) => { _customState.formPosition = e.target.value; }}
                >
                  <option value="请选择" disabled>请选择您的职位</option>
                  <option value="CEO/创始人">CEO / 创始人</option>
                  <option value="CTO/技术负责人">CTO / 技术负责人</option>
                  <option value="产品经理">产品经理</option>
                  <option value="市场营销">市场营销</option>
                  <option value="投资人">投资人</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>工作邮箱 *</label>
                <input
                  id="field-email"
                  style={styles.formInput}
                  type="email"
                  placeholder="请输入企业邮箱"
                  defaultValue=""
                  onChange={(e) => { _customState.formEmail = e.target.value; }}
                />
              </div>

              <button
                style={styles.submitBtn}
                onClick={(e) => { this.handleSubmit(e); }}
                disabled={state.isSubmitting}
              >
                {state.isSubmitting ? '⏳ 提交中...' : '🚀 立即报名，获取专属席位'}
              </button>

              <div style={styles.securityNote}>🔐 信息严格保密，不会用于任何商业推广</div>
            </div>
          )}
        </div>
      </div>

      {/* ===== 底部 ===== */}
      <div style={styles.footer}>
        <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: '600', color: 'rgba(255,255,255,0.4)' }}>未来视野 2026</div>
        <div>© 2026 Future Vision Conference. All rights reserved.</div>
        <div style={{ marginTop: '8px' }}>2026年3月15日 14:00 - 17:00 GMT+8 · 线上直播</div>
      </div>
    </div>
  );
}
