var DENSITY_CONFIG = {
  compact: {
    pagePadding: '14px',
    cardPadding: '10px 12px',
    fontSize: '12px',
    lineHeight: '1.45',
    rowHeight: '42px',
    buttonHeight: '28px',
    sectionGap: '10px',
  },
  comfortable: {
    pagePadding: '20px',
    cardPadding: '16px 18px',
    fontSize: '14px',
    lineHeight: '1.6',
    rowHeight: '56px',
    buttonHeight: '34px',
    sectionGap: '16px',
  },
  spacious: {
    pagePadding: '28px',
    cardPadding: '22px 24px',
    fontSize: '16px',
    lineHeight: '1.75',
    rowHeight: '70px',
    buttonHeight: '40px',
    sectionGap: '22px',
  },
};

var THEME = {
  primary: '#2563EB',
  primaryDeep: '#1E3A8A',
  primarySoft: '#EFF6FF',
  line: '#D8E4F5',
  lineStrong: '#AFC6EF',
  text: '#18243A',
  muted: '#60708A',
  subtle: '#8B9AB1',
  surface: '#FFFFFF',
  surfaceSoft: '#F7FAFF',
  bg: '#F3F7FF',
  success: '#047857',
  warning: '#B7791F',
  danger: '#D14343',
};

var DEMO_LIST = [
  { formInstId: 'demo-1', title: '合同归档核验', owner: '沈岚', status: '待补件', priority: '高', progress: '78%', desc: '缺少一份盖章附件，需在 16:00 前完成补齐。' },
  { formInstId: 'demo-2', title: '渠道返利复核', owner: '顾川', status: '财务确认', priority: '中', progress: '64%', desc: '返利口径已同步，等待财务二次核对。' },
  { formInstId: 'demo-3', title: '客户回访排期', owner: '叶澜', status: '今日执行', priority: '高', progress: '92%', desc: '重点客户回访已分配到华东与华南团队。' },
  { formInstId: 'demo-4', title: '供应链异常跟进', owner: '陈序', status: '跨组协同', priority: '高', progress: '51%', desc: '华东仓库存预警，需要调整补货与发运节奏。' },
];

var _customState = {
  density: 'comfortable',
  dataList: DEMO_LIST.slice(0),
  selectedId: 'demo-1',
  lastAction: '已加载运营数据',
  loading: false,
};

export function getCustomState(key) {
  if (key) return _customState[key];
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState || {}).forEach((key) => {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function didMount() {
  if (this.utils.isMobile()) {
    _customState.density = 'spacious';
  }
  this.loadData();
}

export function loadData() {
  var self = this;
  self.setCustomState({ loading: true, lastAction: '正在刷新数据' });
  self.utils.yida.searchFormDatas({
    formUuid: 'FORM-XXX',
    currentPage: 1,
    pageSize: 20,
  }).then(function (res) {
    var list = (res && res.data) || (res && res.content && res.content.data) || [];
    if (list && list.length) {
      var normalized = list.map((item, index) => {
        var formData = item.formData || {};
        return {
          formInstId: item.formInstId || ('row-' + index),
          title: formData.titleField_xxx || formData.textField_xxx || ('业务记录 ' + (index + 1)),
          owner: formData.ownerField_xxx || '负责人待定',
          status: formData.statusField_xxx || '处理中',
          priority: formData.priorityField_xxx || '中',
          progress: formData.progressField_xxx || '68%',
          desc: formData.descField_xxx || '来自宜搭表单的业务记录。',
        };
      });
      self.setCustomState({
        dataList: normalized,
        selectedId: normalized[0].formInstId,
        loading: false,
        lastAction: '已刷新 ' + normalized.length + ' 条真实数据',
      });
      return;
    }
    self.setCustomState({ loading: false, lastAction: '暂无真实数据，保留演示队列' });
  }).catch(function () {
    self.setCustomState({ loading: false, lastAction: '接口不可用，已保留演示队列' });
  });
}

export function switchDensity(densityKey) {
  this.setCustomState({
    density: densityKey,
    lastAction: '已切换为' + densityKey + '密度',
  });
}

export function selectRecord(rowId) {
  this.setCustomState({
    selectedId: rowId,
    lastAction: '已选中记录',
  });
}

export function resetDemoData() {
  this.setCustomState({
    dataList: DEMO_LIST.slice(0),
    selectedId: 'demo-1',
    lastAction: '已恢复演示数据',
  });
}

export function getSelectedRecord() {
  var state = this.getCustomState();
  var list = state.dataList || [];
  var matched = list.filter((item) => item.formInstId === state.selectedId);
  return matched[0] || list[0] || null;
}

export function renderDensityToggle(d) {
  var self = this;
  var options = [
    { key: 'compact', label: '紧凑' },
    { key: 'comfortable', label: '舒适' },
    { key: 'spacious', label: '宽松' },
  ];

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      {options.map((option) => {
        var isActive = _customState.density === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={(e) => { self.switchDensity(option.key); }}
            style={{
              height: d.buttonHeight,
              padding: '0 12px',
              fontSize: '12px',
              border: '1px solid ' + (isActive ? THEME.primary : THEME.line),
              borderRadius: '999px',
              background: isActive ? THEME.primary : THEME.surface,
              color: isActive ? '#FFFFFF' : THEME.text,
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function renderDataCard(item, d) {
  var self = this;
  var active = item.formInstId === _customState.selectedId;
  var priorityColor = item.priority === '高' ? THEME.danger : item.priority === '中' ? THEME.warning : THEME.success;
  return (
    <button
      key={item.formInstId}
      type="button"
      onClick={(e) => { self.selectRecord(item.formInstId); }}
      style={{
        width: '100%',
        minHeight: d.rowHeight,
        padding: d.cardPadding,
        marginBottom: d.sectionGap,
        background: active ? THEME.primarySoft : THEME.surface,
        borderRadius: '8px',
        border: '1px solid ' + (active ? THEME.primary : THEME.line),
        boxShadow: active ? '0 16px 34px rgba(37,99,235,0.14)' : '0 8px 18px rgba(24,36,58,0.06)',
        fontSize: d.fontSize,
        lineHeight: d.lineHeight,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 900, color: THEME.text }}>{item.title}</div>
          <div style={{ color: THEME.muted, marginTop: '4px' }}>{item.owner} / {item.status}</div>
        </div>
        <span style={{ color: priorityColor, fontWeight: 900 }}>{item.priority}</span>
      </div>
      <div style={{ marginTop: '10px', height: '6px', borderRadius: '999px', background: '#E6EEFB', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: item.progress, background: THEME.primary }}></span>
      </div>
    </button>
  );
}

export function renderJsx() {
  var self = this;
  var state = self.getCustomState();
  var d = DENSITY_CONFIG[state.density] || DENSITY_CONFIG.comfortable;
  var selected = self.getSelectedRecord();
  var isMobile = self.utils && self.utils.isMobile ? self.utils.isMobile() : false;

  return (
    <div style={{ padding: d.pagePadding, background: 'linear-gradient(135deg, #F3F7FF 0%, #FFFFFF 54%, #EAF2FF 100%)', minHeight: '100vh', color: THEME.text }}>
      <div style={{ display: 'none' }}>{this.state && this.state.timestamp}</div>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'center',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '14px',
          marginBottom: d.sectionGap,
          padding: d.cardPadding,
          background: THEME.surface,
          borderRadius: '8px',
          border: '1px solid ' + THEME.line,
          boxShadow: '0 18px 42px rgba(37,99,235,0.10)',
        }}>
          <div>
            <div style={{ fontSize: '12px', color: THEME.primary, fontWeight: 900 }}>数据密度工作台</div>
            <div style={{ marginTop: '4px', fontSize: isMobile ? '22px' : '28px', lineHeight: '34px', fontWeight: 900 }}>运营记录管理</div>
            <div style={{ marginTop: '6px', color: THEME.muted, fontSize: d.fontSize }}>同一批数据可在紧凑、舒适、宽松三种密度下查看与操作。</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
            {self.renderDensityToggle.call(self, d)}
            <button type="button" onClick={(e) => { self.loadData(e); }} style={{ height: d.buttonHeight, border: '1px solid ' + THEME.lineStrong, borderRadius: '999px', background: THEME.surface, color: THEME.primary, padding: '0 12px', cursor: 'pointer', fontWeight: 800 }}>
              {state.loading ? '刷新中' : '刷新数据'}
            </button>
            <button type="button" onClick={(e) => { self.resetDemoData(e); }} style={{ height: d.buttonHeight, border: '0', borderRadius: '999px', background: THEME.primary, color: '#FFFFFF', padding: '0 14px', cursor: 'pointer', fontWeight: 900 }}>
              恢复演示
            </button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr',
          gap: d.sectionGap,
          marginBottom: d.sectionGap,
        }}>
          <section style={{ background: THEME.surface, border: '1px solid ' + THEME.line, borderRadius: '8px', padding: d.cardPadding, boxShadow: '0 12px 30px rgba(37,99,235,0.08)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {['全部数据', '看板', '单选分组', '已逾期', '我的负责'].map((view, index) => (
                <button key={view} type="button" onClick={(e) => { self.switchDensity(index === 0 ? 'comfortable' : index === 1 ? 'spacious' : 'compact'); }} style={{ height: d.buttonHeight, border: '1px solid ' + (index === 0 ? THEME.primary : THEME.line), borderRadius: '999px', background: index === 0 ? THEME.primarySoft : THEME.surface, color: index === 0 ? THEME.primary : THEME.text, padding: '0 12px', cursor: 'pointer', fontWeight: 800 }}>
                  {view}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.7fr 0.7fr 0.8fr', border: '1px solid ' + THEME.line, borderRadius: '8px', overflow: 'hidden' }}>
              {['待办内容', '任务进度', '重要程度', '备注'].map((head) => (
                <div key={head} style={{ padding: '10px 12px', background: THEME.surfaceSoft, color: THEME.text, fontWeight: 900, fontSize: d.fontSize, borderBottom: '1px solid ' + THEME.line }}>{head}</div>
              ))}
              {(state.dataList || []).slice(0, 3).map((item) => [
                <div key={item.formInstId + '-title'} style={{ padding: d.cardPadding, borderTop: '1px solid ' + THEME.lineSoft, fontSize: d.fontSize, fontWeight: 800 }}>{item.title}</div>,
                <div key={item.formInstId + '-progress'} style={{ padding: d.cardPadding, borderTop: '1px solid ' + THEME.lineSoft, color: THEME.primary, fontSize: d.fontSize, fontWeight: 900 }}>{item.progress}</div>,
                <div key={item.formInstId + '-priority'} style={{ padding: d.cardPadding, borderTop: '1px solid ' + THEME.lineSoft, color: item.priority === '高' ? THEME.danger : THEME.warning, fontSize: d.fontSize, fontWeight: 900 }}>{item.priority}</div>,
                <div key={item.formInstId + '-desc'} style={{ padding: d.cardPadding, borderTop: '1px solid ' + THEME.lineSoft, color: THEME.muted, fontSize: d.fontSize }}>{item.status}</div>,
              ])}
            </div>
          </section>
          <aside style={{ background: THEME.surface, border: '1px solid ' + THEME.line, borderRadius: '8px', padding: d.cardPadding }}>
            <div style={{ fontSize: '12px', color: THEME.primary, fontWeight: 900 }}>字段与视图设置</div>
            {[
              { label: '冻结首列', value: '已开启' },
              { label: '分组字段', value: '重要程度' },
              { label: '行高策略', value: state.density },
              { label: '填色规则', value: '优先级' },
            ].map((item) => (
              <button key={item.label} type="button" onClick={(e) => { self.switchDensity(state.density === 'compact' ? 'comfortable' : 'compact'); }} style={{ width: '100%', minHeight: d.rowHeight, border: 0, borderBottom: '1px solid ' + THEME.lineSoft, background: 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', color: THEME.text, fontSize: d.fontSize }}>
                <span>{item.label}</span><strong>{item.value}</strong>
              </button>
            ))}
          </aside>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1.25fr 0.75fr',
          gap: d.sectionGap,
        }}>
          <section style={{ background: THEME.surface, border: '1px solid ' + THEME.line, borderRadius: '8px', padding: d.cardPadding }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', marginBottom: d.sectionGap }}>
              <div style={{ background: THEME.surfaceSoft, borderRadius: '8px', padding: '12px' }}><div style={{ fontSize: '22px', fontWeight: 900 }}>4</div><div style={{ color: THEME.muted, fontSize: '12px' }}>活跃记录</div></div>
              <div style={{ background: THEME.surfaceSoft, borderRadius: '8px', padding: '12px' }}><div style={{ fontSize: '22px', fontWeight: 900 }}>3</div><div style={{ color: THEME.muted, fontSize: '12px' }}>高优先级</div></div>
              <div style={{ background: THEME.surfaceSoft, borderRadius: '8px', padding: '12px' }}><div style={{ fontSize: '22px', fontWeight: 900 }}>71%</div><div style={{ color: THEME.muted, fontSize: '12px' }}>平均进度</div></div>
            </div>
            {(state.dataList || []).map((item) => self.renderDataCard.call(self, item, d))}
          </section>

          <aside style={{ background: THEME.primaryDeep, color: '#FFFFFF', borderRadius: '8px', padding: d.cardPadding, minHeight: '260px', boxShadow: '0 24px 60px rgba(30,58,138,0.22)' }}>
            <div style={{ fontSize: '12px', opacity: 0.68, fontWeight: 800 }}>当前选中</div>
            <div style={{ marginTop: '10px', fontSize: isMobile ? '20px' : '24px', lineHeight: '32px', fontWeight: 900 }}>{selected ? selected.title : '暂无记录'}</div>
            <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.72)', fontSize: d.fontSize, lineHeight: d.lineHeight }}>{selected ? selected.desc : '请先选择一条记录。'}</div>
            <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>负责人</span><strong>{selected ? selected.owner : '-'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>状态</span><strong>{selected ? selected.status : '-'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>进度</span><strong>{selected ? selected.progress : '-'}</strong></div>
            </div>
            <div style={{ marginTop: '20px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.80)', fontSize: '12px' }}>{state.lastAction}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
