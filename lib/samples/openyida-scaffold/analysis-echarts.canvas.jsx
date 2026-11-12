import React, { useEffect, useRef, useState } from 'react';

// Refresh icon: Lucide (ISC), https://lucide.dev/license
// Editable chart component, not a page or a data source. Keep one copy when composing.
// Optional libraries are pinned and shared per window, including across report card instances.
async function loadAnalysisCharts(wordCloud = false) {
  const cache = window.__OPENYIDA_ANALYSIS_CHART_LOADS__ || (window.__OPENYIDA_ANALYSIS_CHART_LOADS__ = {});
  const load = (key, url, ready) => {
    if (ready()) return Promise.resolve();
    if (!cache[key]) cache[key] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const fail = () => { clearTimeout(timer); script.remove(); delete cache[key]; reject(new Error('图表资源加载失败，请重试')); };
      const timer = setTimeout(fail, 20000);
      script.src = url; script.async = true;
      script.onload = () => { if (!ready()) return fail(); clearTimeout(timer); resolve(); };
      script.onerror = fail; document.head.appendChild(script);
    });
    return cache[key];
  };
  if (window.echarts && window.echarts.version !== '5.6.0') throw new Error('已有 ECharts 版本不一致，请统一页面图表资源');
  await load('echarts@5.6.0', 'https://g.alicdn.com/code/lib/echarts/5.6.0/echarts.min.js', () => !!window.echarts);
  if (wordCloud) await load('echarts-wordcloud@2.1.0', 'https://cdn.jsdelivr.net/npm/echarts-wordcloud@2.1.0/dist/echarts-wordcloud.min.js', () => !!window['echarts-wordcloud']);
  return window.echarts;
}

// Pure option recipes. Data is supplied by the caller; no fake values or implicit queries.
// Replace/extend these recipes freely. They are not a platform chart-type restriction.
function analysisChartOption(kind, data, config = {}) {
  const palette = config.colors || ['#4e72b8', '#d99565', '#679987', '#9a82ba', '#d0b25d', '#659bb0'];
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const points = () => {
    assert(Array.isArray(data), '请提供分组结果');
    return data.map(row => { assert(finite(row.value) && row.value >= 0, '构成与权重图需要非负数值'); return { ...row }; });
  };
  const base = { color: palette, animationDuration: 300, aria: { enabled: true }, backgroundColor: config.background || 'transparent',
    textStyle: { color: config.ink || '#384357', fontFamily: 'system-ui, sans-serif' },
    tooltip: { trigger: 'item', confine: true, renderMode: 'richText' } };
  const axis = { grid: { left: 12, right: 18, top: 24, bottom: 42, containLabel: true }, xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value', name: config.unit || '', splitLine: { lineStyle: { color: '#e8edf3' } } } };
  if (['pie', 'donut', 'rose'].includes(kind)) return { ...base, legend: { bottom: 0, type: 'scroll' }, series: [{ type: 'pie',
    radius: kind === 'donut' ? ['43%', '67%'] : ['0%', '67%'], center: ['50%', '43%'], roseType: kind === 'rose' ? 'radius' : undefined,
    label: { formatter: '{b}\n{d}%', fontSize: 11 }, avoidLabelOverlap: true, itemStyle: { borderColor: '#fff', borderWidth: 2 }, data: points() }] };
  if (['line', 'area', 'bar', 'stacked-area', 'stacked-bar'].includes(kind)) {
    const measures = config.measures || [{ key: 'value', name: config.unit || '数值' }];
    return { ...base, ...axis, legend: { bottom: 0 }, tooltip: { ...base.tooltip, trigger: 'axis' },
      xAxis: { type: 'category', data: data.map(r => r.name), boundaryGap: kind.includes('bar') },
      dataZoom: config.zoom ? [{ type: 'inside' }, { type: 'slider', bottom: 26, height: 18 }] : undefined,
      grid: { ...axis.grid, bottom: config.zoom ? 78 : 42 },
      series: measures.map(m => ({ name: m.name, type: kind.includes('bar') ? 'bar' : 'line', symbolSize: 5,
        areaStyle: kind.includes('area') ? { opacity: .18 } : undefined, stack: kind.startsWith('stacked-') ? 'total' : undefined,
        barMaxWidth: 36, emphasis: { focus: 'series' }, data: data.map(r => ({ value: finite(r[m.key]) ? r[m.key] : null, raw: r.raw || r })) })) };
  }
  if (kind === 'radar') {
    assert(data.indicators?.length >= 3 && data.indicators.every(i => finite(i.max) && i.max > 0), '雷达图需要至少三个有明确量程的轴');
    assert(data.series?.every(s => s.values.length === data.indicators.length && s.values.every((v, i) => finite(v) && v >= 0 && v <= data.indicators[i].max)), '雷达数值必须匹配轴及量程');
    return { ...base, legend: { bottom: 0 }, radar: { indicator: data.indicators, radius: '62%', center: ['50%', '45%'],
      splitArea: { areaStyle: { color: ['#f6f8fc', '#fff'] } }, axisName: { fontSize: 11 } },
      series: [{ type: 'radar', areaStyle: { opacity: .12 }, symbolSize: 5, data: data.series.map(s => ({ name: s.name, value: s.values, raw: s.raw })) }] };
  }
  if (['scatter', 'bubble'].includes(kind)) {
    assert(data.every(r => finite(r.x) && finite(r.y) && (kind !== 'bubble' || finite(r.size) && r.size >= 0)), '散点坐标和气泡大小必须为有效数值');
    const max = Math.max(1, ...data.map(r => r.size || 0));
    return { ...base, ...axis, xAxis: { type: 'value', name: config.xName || '' }, yAxis: { ...axis.yAxis, name: config.yName || '' },
      series: [{ type: 'scatter', symbolSize: v => kind === 'bubble' ? 8 + 30 * Math.sqrt(v[2] / max) : 12,
        itemStyle: { opacity: .7 }, data: data.map(r => ({ name: r.name, value: [r.x, r.y, r.size || 0], raw: r.raw || r })) }] };
  }
  if (kind === 'heatmap') {
    assert(data.cells.every(c => Number.isInteger(c[0]) && c[0] >= 0 && c[0] < data.x.length && Number.isInteger(c[1]) && c[1] >= 0 && c[1] < data.y.length && finite(c[2])), '热力格坐标超出范围或值无效');
    return { ...base, ...axis, grid: { left: 70, right: 20, top: 10, bottom: 65 },
      xAxis: { type: 'category', data: data.x, splitArea: { show: true } }, yAxis: { type: 'category', data: data.y },
      visualMap: { min: Math.min(0, ...data.cells.map(c => c[2])), max: Math.max(1, ...data.cells.map(c => c[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#edf2fc', '#91abd6', '#395f9e'] } },
      series: [{ type: 'heatmap', data: data.cells, emphasis: { itemStyle: { borderColor: '#344e7b', borderWidth: 2 } } }] };
  }
  if (kind === 'boxplot') {
    assert(data.every(r => r.values?.length === 5 && r.values.every((v, i) => finite(v) && (!i || v >= r.values[i - 1]))), '箱型图需要有序的下须/Q1/中位数/Q3/上须五数摘要');
    return { ...base, ...axis, xAxis: { type: 'category', data: data.map(r => r.name) },
      series: [{ name: '五数摘要', type: 'boxplot', itemStyle: { color: '#dce6f5', borderColor: palette[0] }, data: data.map(r => ({ value: r.values, raw: r.raw || r })) },
        { name: '离群值', type: 'scatter', data: config.outliers || [], symbolSize: 7 }] };
  }
  if (kind === 'wordcloud') return { ...base, series: [{ type: 'wordCloud', shape: 'circle', gridSize: 10, sizeRange: [14, 48],
    rotationRange: [0, 0], drawOutOfBound: false, shrinkToFit: true, layoutAnimation: false,
    textStyle: { fontFamily: 'system-ui, sans-serif', fontWeight: 500, color: p => palette[p.dataIndex % palette.length] }, data: points() }] };
  if (['treemap', 'sunburst'].includes(kind)) return { ...base, series: [{ type: kind, data,
    roam: false, nodeClick: false, breadcrumb: { show: false }, radius: ['15%', '85%'], label: { fontSize: 12 },
    levels: [{ itemStyle: { borderWidth: 2, gapWidth: 3, borderColor: '#fff' } }] }] };
  if (kind === 'funnel') {
    const rows = points(); assert(rows.every((r, i) => !i || r.value <= rows[i - 1].value), '漏斗必须按同一转化链路排序且人数不递增');
    return { ...base, series: [{ type: 'funnel', left: '12%', right: '12%', top: 12, bottom: 12, sort: 'none', gap: 4,
      label: { position: 'inside', formatter: '{b}: {c}' }, data: rows }] };
  }
  if (kind === 'sankey') {
    const names = new Set(data.nodes.map(n => n.name));
    assert(data.links.every(l => names.has(l.source) && names.has(l.target) && finite(l.value) && l.value >= 0), '桑基流量或节点引用无效');
    return { ...base, series: [{ type: 'sankey', data: data.nodes, links: data.links, left: 8, right: 80, top: 18, bottom: 18,
      emphasis: { focus: 'adjacency' }, lineStyle: { color: 'gradient', curveness: .5 }, nodeWidth: 14, nodeGap: 18 }] };
  }
  if (kind === 'gauge') {
    assert(finite(data.value) && data.value >= 0 && data.value <= 100, '百分比仪表需要 0–100 的真实比例');
    return { ...base, series: [{ type: 'gauge', min: 0, max: 100, startAngle: 210, endAngle: -30, radius: '85%',
      progress: { show: true, width: 12 }, axisLine: { lineStyle: { width: 12 } }, axisTick: { show: false }, splitLine: { length: 8 },
      pointer: { show: false }, anchor: { show: false }, detail: { formatter: '{value}%', fontSize: 28, offsetCenter: [0, '15%'] },
      title: { offsetCenter: [0, '48%'], fontSize: 12 }, data: [{ name: data.name, value: data.value }] }] };
  }
  throw new Error('未知配方；可直接传入自定义 ECharts option');
}

export default function YidaComp({ option, title = '数据分析', note, height = 260, loading = false, error,
  empty = false, onRefresh, onSelect, onRangeChange, actions, style }) {
  const element = useRef(null), chart = useRef(null), callbacks = useRef({ onSelect, onRangeChange });
  callbacks.current = { onSelect, onRangeChange };
  const [resourceError, setResourceError] = useState(''), [retry, setRetry] = useState(0), [ready, setReady] = useState(0);
  const needsCloud = !!option?.series?.some(s => s.type === 'wordCloud');
  const hasOption = !!option;
  useEffect(() => {
    if (!hasOption) return;
    let active = true, instance, observer;
    setResourceError('');
    loadAnalysisCharts(needsCloud).then(engine => {
      if (!active || !element.current) return;
      instance = engine.init(element.current); chart.current = instance;
      instance.on('click', event => callbacks.current.onSelect?.(event.data?.raw ?? event.data, event));
      instance.on('datazoom', event => callbacks.current.onRangeChange?.(event));
      observer = new ResizeObserver(() => instance.resize()); observer.observe(element.current); setReady(n => n + 1);
    }).catch(e => { if (active) setResourceError(e.message); });
    return () => { active = false; observer?.disconnect(); if (chart.current === instance) chart.current = null; instance?.dispose(); };
  }, [needsCloud, retry, hasOption]);
  useEffect(() => {
    if (!chart.current || !option) return;
    try { chart.current.setOption(option, { notMerge: true }); setResourceError(''); }
    catch (e) { setResourceError(e.message); }
  }, [option, ready]);
  useEffect(() => { if (chart.current) loading ? chart.current.showLoading() : chart.current.hideLoading(); }, [loading, ready]);
  return <article className="oy-advanced-chart" style={style} aria-busy={loading}>
    <style>{`.oy-advanced-chart{min-width:0;max-width:100%;box-sizing:border-box;padding:18px 20px;background:var(--analysis-surface,#fff);color:var(--analysis-ink,#35445b);border-radius:var(--analysis-radius,12px);font:12px/1.5 system-ui,sans-serif}.oy-advanced-chart *{box-sizing:border-box}.oy-advanced-chart header{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:4px}.oy-advanced-chart header>div{display:flex;gap:5px;align-items:center;flex-wrap:wrap}.oy-advanced-chart h3{font-size:15px;color:inherit;margin:0}.oy-advanced-chart p{font-size:11px;color:var(--analysis-muted,#738095);margin:4px 0 12px}.oy-advanced-chart button{font:inherit;color:inherit;border:0;border-radius:6px;padding:5px 9px;background:#edf1f6;cursor:pointer}.oy-advanced-chart button:focus-visible{outline:2px solid #4e72b8;outline-offset:2px}.oy-advanced-chart .ec-refresh{position:relative;width:30px;height:30px;padding:6px;background:transparent}.oy-advanced-chart .ec-refresh:after{content:attr(data-tip);position:absolute;right:0;top:32px;white-space:nowrap;background:#35445b;color:#fff;padding:3px 7px;border-radius:4px;z-index:2;visibility:hidden}.oy-advanced-chart .ec-refresh:focus-visible:after,.oy-advanced-chart .ec-refresh:hover:after{visibility:visible}.oy-advanced-chart .ec-refresh:hover{background:#edf1f6}.oy-advanced-chart .ec-refresh:disabled{opacity:.4;cursor:wait}`}</style>
    <header><h3>{title}</h3><div>{actions}{onRefresh && <button className="ec-refresh" aria-label={'刷新'+title} title="刷新数据" data-tip="刷新数据" disabled={loading} onClick={onRefresh}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5"/></svg>
    </button>}</div></header>
    {note && <p>{note}</p>}
    {(error || resourceError) && <p role="alert">{String(error?.message || error || resourceError)} {(resourceError || onRefresh) && <button onClick={() => resourceError ? setRetry(n => n + 1) : onRefresh?.()}>重试</button>}</p>}
    {!loading && (empty || !option) && <p>当前范围没有可绘制的数据</p>}
    <div ref={element} role="img" aria-label={title} style={{ height, minWidth: 0, visibility: error || resourceError || empty ? 'hidden' : 'visible' }} />
  </article>;
}
