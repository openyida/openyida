import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';

function chartColors(tokens) {
  const palette = tokens.getPropertyValue('--pod-chart-colors').trim()
    || tokens.getPropertyValue('--color-group').trim();
  const colors = [];
  let depth = 0, start = 0;
  // Color functions can contain commas; only split the top-level palette list.
  for (let index = 0; index <= palette.length; index++) {
    if (palette[index] === '(') depth++;
    if (palette[index] === ')') depth--;
    if (index === palette.length || palette[index] === ',' && depth === 0) {
      const color = palette.slice(start, index).trim();
      if (color) colors.push(color);
      start = index + 1;
    }
  }
  return colors.length ? colors : [tokens.getPropertyValue('--color-brand1-6').trim() || '#1677ff',
    '#3471ea', '#a55bf5', '#da66c3', '#fc7d29', '#ffbc20'];
}

/** Editable ECharts content; the host supplies the query, theme and navigation. */
function AnalysisChart({ analysis }) {
  const element = useRef(null);
  const [selectedRow, setSelectedRow] = useState(null);
  const { rows, columns, displayRows = rows, appearance, select, canDrill, details } = analysis;
  useEffect(() => {
    const chart = echarts.init(element.current);
    const dimension = columns.find(column => !column.numeric);
    const metrics = columns.filter(column => column.numeric);
    const tokens = getComputedStyle(element.current);
    setSelectedRow(null);
    chart.setOption({
      color: chartColors(tokens),
      tooltip: { trigger: 'axis', renderMode: 'richText' },
      legend: { ...appearance?.echartsLegend },
      grid: { left: 12, right: 12, top: 48, bottom: 12, containLabel: true },
      xAxis: { type: 'category', data: rows.map((row, index) => dimension
        ? String(displayRows[index]?.[dimension.key] ?? '—') : '汇总') },
      yAxis: { type: 'value' },
      series: metrics.map(metric => ({ name: metric.title || metric.key, type: 'bar',
        data: rows.map(row => {
          const value = row[metric.key];
          return (typeof value === 'number' || typeof value === 'string' && value.trim())
            && Number.isFinite(Number(value)) ? Number(value) : null;
        }) })),
    });
    chart.on('click', event => {
      if (event.componentType === 'series') setSelectedRow(rows[event.dataIndex] || null);
    });
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(element.current);
    else window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      chart.dispose();
    };
  }, [rows, columns, displayRows, appearance]);
  return <>
    <div ref={element} style={{ width: '100%', height: 280 }} aria-label="当前查询结果柱图" />
    {(canDrill || details) && <div>
      {canDrill && <button disabled={!selectedRow} onClick={() => select(selectedRow)}>下钻</button>}
      {details && <button disabled={!selectedRow} onClick={() => details(selectedRow)}>查看明细</button>}
    </div>}
  </>;
}

/** This source is installed explicitly; an unauthored card shows the host placeholder. */
export default function YidaComp({ analysis }) {
  const { rows = [], columns = [], title = '数据分析', loading, error, refresh, drillPath = [], back } = analysis || {};
  if (error) return <div role="alert">{String(error)}<button onClick={refresh}>重试</button></div>;
  if (loading) return <div role="status">正在加载数据…</div>;
  if (!rows.length) return <div role="status">暂无数据</div>;
  if (!columns.some(column => column.numeric)) return <div role="status">请配置数值指标</div>;
  return <section style={analysis.appearance?.cardStyle}>
    <header><strong>{title}</strong><button onClick={refresh}>刷新</button></header>
    {!!drillPath.length && <nav aria-label="下钻路径">
      <button onClick={() => back(0)}>全部</button>
      {drillPath.map(({ label, value }, index) =>
        <button key={index} onClick={() => back(index + 1)}>{String(label ?? value ?? '—')}</button>)}
    </nav>}
    <AnalysisChart analysis={{ ...analysis, rows, columns }} />
  </section>;
}
