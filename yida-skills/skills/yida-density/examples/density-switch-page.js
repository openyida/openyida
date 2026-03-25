var DENSITY_CONFIG = {
  compact: {
    cardPadding: '8px 12px',
    cardMarginBottom: '8px',
    fontSize: '12px',
    lineHeight: '1.4',
    tableRowHeight: '32px',
    buttonHeight: '24px',
    buttonPadding: '0 8px',
    inputHeight: '24px',
    iconSize: '14px',
    sectionGap: '8px',
  },
  comfortable: {
    cardPadding: '16px 20px',
    cardMarginBottom: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
    tableRowHeight: '48px',
    buttonHeight: '32px',
    buttonPadding: '0 16px',
    inputHeight: '32px',
    iconSize: '16px',
    sectionGap: '16px',
  },
  spacious: {
    cardPadding: '24px 28px',
    cardMarginBottom: '24px',
    fontSize: '16px',
    lineHeight: '1.8',
    tableRowHeight: '64px',
    buttonHeight: '40px',
    buttonPadding: '0 24px',
    inputHeight: '40px',
    iconSize: '20px',
    sectionGap: '24px',
  },
};

var _customState = {
  // 默认舒适模式；移动端自动降级为 spacious
  density: 'comfortable',
  dataList: [],
};

export function getCustomState(key) {
  if (key) return _customState[key];
  return Object.assign({}, _customState);
}

export function setCustomState(newState) {
  Object.keys(newState).forEach(function (key) {
    _customState[key] = newState[key];
  });
  this.forceUpdate();
}

export function forceUpdate() {
  this.setState({ timestamp: new Date().getTime() });
}

export function didMount() {
  // 移动端自动降级为宽松模式
  if (this.utils.isMobile()) {
    _customState.density = 'spacious';
  }
  this.loadData();
}

export function loadData() {
  var self = this;
  this.utils.yida.searchFormDatas({
    formUuid: 'FORM-XXX',
    currentPage: 1,
    pageSize: 20,
  }).then(function (res) {
    _customState.dataList = res.data || [];
    self.forceUpdate();
  });
}

export function switchDensity(densityKey) {
  _customState.density = densityKey;
  this.forceUpdate();
}

export function renderDensityToggle(d) {
  var self = this;
  var options = [
    { key: 'compact', label: '紧凑' },
    { key: 'comfortable', label: '舒适' },
    { key: 'spacious', label: '宽松' },
  ];

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#999', marginRight: '4px' }}>密度：</span>
      {options.map(function (option) {
        var isActive = _customState.density === option.key;
        return (
          <button
            key={option.key}
            onClick={self.switchDensity.bind(self, option.key)}
            style={{
              height: '24px',
              padding: '0 10px',
              fontSize: '12px',
              border: '1px solid ' + (isActive ? '#1890ff' : '#d9d9d9'),
              borderRadius: '4px',
              background: isActive ? '#e6f7ff' : '#fff',
              color: isActive ? '#1890ff' : '#595959',
              cursor: 'pointer',
              transition: 'all 0.2s',
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
  return (
    <div
      key={item.formInstId}
      style={{
        padding: d.cardPadding,
        marginBottom: d.cardMarginBottom,
        background: '#fff',
        borderRadius: '6px',
        border: '1px solid #f0f0f0',
        fontSize: d.fontSize,
        lineHeight: d.lineHeight,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: d.sectionGap }}>
        {item.formData.titleField_xxx || '无标题'}
      </div>
      <div style={{ color: '#8c8c8c' }}>
        {item.formData.descField_xxx || ''}
      </div>
    </div>
  );
}

export function renderJsx() {
  var self = this;
  var d = DENSITY_CONFIG[_customState.density] || DENSITY_CONFIG.comfortable;

  return (
    <div style={{ padding: d.cardPadding, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: d.sectionGap,
        padding: d.cardPadding,
        background: '#fff',
        borderRadius: '6px',
      }}>
        <span style={{ fontSize: d.fontSize, fontWeight: 600 }}>数据列表</span>
        {self.renderDensityToggle.call(self, d)}
      </div>

      {/* 数据列表 */}
      {_customState.dataList.length === 0
        ? <div style={{ textAlign: 'center', padding: '40px', color: '#bfbfbf', fontSize: d.fontSize }}>暂无数据</div>
        : _customState.dataList.map(function (item) {
            return self.renderDataCard.call(self, item, d);
          })
      }
    </div>
  );
}
