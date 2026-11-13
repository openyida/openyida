import React, { useState } from 'react';
import { Button, Empty, Alert, Skeleton, Table } from 'antd';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Common icons based on Lucide (ISC). Drilldown follows the dashboard layer-arrow icon.
function AnalysisAction({ label, kind, onClick, disabled }) {
  return <button type="button" className="oy-analysis-icon" aria-label={label} title={label}
    onClick={onClick} disabled={disabled}>
    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'refresh' ? <path d="M4 4v6h6M20 20v-6h-6M20 10A8 8 0 0 0 6.34 6.34M4 14a8 8 0 0 0 13.66 3.66" />
        : kind === 'image' ? <path d="M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5" />
        : kind === 'drilldown' ? <>
          <path d="M12 2v8M2 10l10-4 10 4-10 4zM12 16v5" />
          <path d="m9 19.5 3 3 3-3z" fill="currentColor" stroke="none" />
        </>
        : <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />}
    </svg>
  </button>;
}
function exportVisibleRows(columns, rows) {
  const cell = value => {
    const text = String(value ?? '');
    const safe = typeof value !== 'number' && /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const lines = [columns.map(c => cell(c.title || c.key)).join(','),
    ...rows.map(row => columns.map(c => cell(row[c.key])).join(','))];
  const url = window.URL.createObjectURL(new window.Blob(['\uFEFF' + lines.join('\r\n')], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'analysis-current.csv';
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}

/** The report host owns the card frame; this source owns the content. */
export default function YidaComp({ analysis }) {
  const [showTable, setShowTable] = useState(false);
  const { rows = [], displayRows = rows, columns = [], loading, error, refresh, select, canDrill = !!select, back,
    drillPath = [], title = '数据分析' } = analysis || {};
  const dimension = columns.find(column => !column.numeric);
  const metric = columns.find(column => column.numeric);
  const format = value => value == null ? '—' : typeof value === 'number' ? value.toLocaleString('zh-CN') : String(value);
  const data = rows.map((row, index) => ({
    row, index, label: dimension ? format((displayRows[index] || row)[dimension.key]) : '汇总',
    value: metric && typeof row[metric.key] === 'number' && Number.isFinite(row[metric.key]) ? row[metric.key] : null,
  }));
  const chartData = data.filter(item => item.value !== null);
  const lead = chartData.reduce((best, item) => !best || item.value > best.value ? item : best, null);
  const canShare = chartData.length > 0 && chartData.every(item => item.value >= 0) && chartData.some(item => item.value > 0);
  const palette = ['var(--analysis-series-1,#5455b8)', 'var(--analysis-series-2,#15807e)', 'var(--analysis-series-3,#b85e39)', 'var(--analysis-series-4,#9561a5)', 'var(--analysis-series-5,#417cb2)'];
  const choose = item => { const row = item?.payload?.row || item?.row; if (row && canDrill) select?.(row); };
  return (
    <section className="oy-programmable-analysis" aria-busy={!!loading}>
      <style>{`
        .oy-analysis-icon{display:inline-grid;place-items:center;min-width:36px;min-height:36px;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;touch-action:manipulation}.oy-analysis-icon:hover:not(:disabled),.oy-analysis-icon:focus-visible{background:var(--color-fill1-2,#f2f5f5)}.oy-analysis-icon:focus-visible{outline:2px solid var(--color-brand1-6,#147d73);outline-offset:2px}.oy-analysis-icon:disabled{opacity:.45;cursor:default}@media(pointer:coarse){.oy-analysis-icon{min-width:44px;min-height:44px}}
        .oy-programmable-analysis { color:var(--color-text1-4,#1c2534); min-width:0; }
        .oy-programmable-analysis * { box-sizing:border-box; }
        .oy-programmable-analysis .head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .oy-programmable-analysis h2 { margin:0; font-size:18px; }
        .oy-programmable-analysis h3 { margin:0 0 16px; font-size:14px; font-weight:500; }
        .oy-programmable-analysis .muted { color:var(--color-text1-3,#667085); font-size:12px; margin:6px 0 0; }
        .oy-programmable-analysis .actions, .oy-programmable-analysis nav { display:flex; gap:8px; flex-wrap:wrap; }
        .oy-programmable-analysis nav { margin-top:12px; }
        .oy-programmable-analysis .summary { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:12px; margin:24px 0; }
        .oy-programmable-analysis .stat { background:var(--color-fill1-2,#f7f9fc); padding:16px; border-radius:10px; min-width:0; }
        .oy-programmable-analysis .stat strong { display:block; font-size:26px; margin-top:6px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
        .oy-programmable-analysis .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); gap:16px; }
        .oy-programmable-analysis .chart { min-width:0; }
        .oy-programmable-analysis .state { padding:28px 0; }
        .oy-programmable-analysis .table { margin-top:24px; overflow:auto; }
      `}</style>
      <header className="head">
        <div><h2>{title}</h2><p className="muted">按当前筛选与分组查看数据</p></div>
        <div className="actions">
          <Button onClick={() => setShowTable(value => !value)}>{showTable ? '收起表格' : '查看表格'}</Button>
          {refresh && <AnalysisAction kind="refresh" label="刷新数据" disabled={loading} onClick={refresh} />}
          <AnalysisAction kind="download" label="导出当前结果 CSV" disabled={loading || !!error || !columns.length || !rows.length}
            onClick={() => exportVisibleRows(columns, rows)} />
        </div>
      </header>
      {!!drillPath.length && <nav aria-label="下钻路径">
        <Button onClick={() => back?.(0)}>全部</Button>
        {drillPath.map((item, index) => <Button key={index} disabled={index === drillPath.length - 1}
          onClick={() => back?.(index + 1)}>{format(item.value)}</Button>)}
      </nav>}
      {loading ? <div className="state" role="status"><Skeleton active /></div>
        : error ? <div className="state"><Alert type="error" showIcon message="数据加载失败" description={error} /></div>
        : !metric ? <div className="state"><Empty description="请配置分析查询，或使用 analysis.api 接入数据" /></div>
        : !rows.length ? <div className="state"><Empty description="当前筛选下暂无数据" /></div>
        : <>
          <div className="summary">
            <div className="stat"><span className="muted">当前结果分组</span><strong>{rows.length}</strong></div>
            <div className="stat"><span className="muted">当前结果最高值 · {metric.title || metric.key}</span>
              <strong>{format(lead?.value)}</strong><span className="muted">{lead?.label}</span></div>
          </div>
          <div className="charts">
            <div className="chart"><h3>{metric.title || metric.key} · 分组对比</h3>
              <ResponsiveContainer width="100%" height={260} minWidth={1}>
                <BarChart data={chartData} layout="vertical" margin={{ left:0, right:12 }}>
                  <CartesianGrid horizontal={false} stroke="var(--color-line1-1,#e6e9ee)" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize:12 }} />
                  <YAxis type="category" dataKey="label" width={88} axisLine={false} tickLine={false} tick={{ fontSize:12 }} />
                  <Tooltip /><Bar dataKey="value" name={metric.title || metric.key} radius={4}
                    fill={palette[0]} onClick={choose} isAnimationActive={false}>
                    <LabelList dataKey="value" position="right" formatter={value => value === 0 ? '0' : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart"><h3>当前结果占比</h3>
              {canShare ? <ResponsiveContainer width="100%" height={260} minWidth={1}>
                <PieChart><Pie data={chartData} dataKey="value" nameKey="label" innerRadius="56%" outerRadius="80%"
                  onClick={choose} isAnimationActive={false}>
                  {chartData.map((item,index) => <Cell key={item.index} fill={palette[index % palette.length]} />)}
                </Pie><Tooltip /><Legend iconType="circle" iconSize={8} /></PieChart>
              </ResponsiveContainer> : <Empty description="占比图需要非负值，且至少一项大于 0" />}
            </div>
          </div>
          {showTable && <div className="table"><Table size="small" pagination={false} rowKey="index" dataSource={data}
            columns={columns.map(column => ({ key:column.key, title:column.title || column.key,
              align:column.numeric ? 'right' : 'left',
              render:(_, item) => column.key === dimension?.key && canDrill && select
                ? <span>{item.label} <AnalysisAction kind="drilldown" label={'下钻：' + item.label}
                  onClick={() => select(item.row)} /></span>
                : format((displayRows[item.index] || item.row)[column.key]),
            }))} /></div>}
        </>}
    </section>
  );
}
