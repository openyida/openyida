import React, { useState } from 'react';
import { Button, Empty, Alert, Skeleton, Table } from 'antd';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Editable composition: the platform supplies data/actions; this component owns every visible element. */
export default function YidaComp({ analysis }) {
  const [showTable, setShowTable] = useState(false);
  const { rows = [], displayRows = rows, columns = [], loading, error, refresh, select, back,
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
  const palette = ['var(--color-brand1-6, #1677ff)', '#4e9d9a', '#9272cb', '#d4844b', '#6588b4'];
  const choose = item => { const row = item?.payload?.row || item?.row; if (row) select?.(row); };
  return (
    <section className="oy-programmable-analysis" aria-busy={!!loading}>
      <style>{`
        .oy-programmable-analysis { color:var(--color-text1-4,#1c2534); background:var(--pod-card-bg-color,#fff); border:1px solid var(--color-line1-1,#e8edf3); border-radius:var(--pod-card-border-radius,16px); padding:clamp(16px,3vw,24px); min-width:0; }
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
        .oy-programmable-analysis .charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr)); gap:24px; }
        .oy-programmable-analysis .chart { min-width:0; }
        .oy-programmable-analysis .state { padding:28px 0; }
        .oy-programmable-analysis .table { margin-top:24px; overflow:auto; }
      `}</style>
      <header className="head">
        <div><h2>{title}</h2><p className="muted">按当前筛选与分组查看数据</p></div>
        <div className="actions">
          <Button onClick={() => setShowTable(value => !value)}>{showTable ? '收起表格' : '查看表格'}</Button>
          {refresh && <Button onClick={refresh} loading={loading}>刷新</Button>}
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
                  <XAxis type="number" /><YAxis type="category" dataKey="label" width={80} />
                  <Tooltip /><Bar dataKey="value" name={metric.title || metric.key} radius={4}
                    fill={palette[0]} onClick={choose} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart"><h3>当前结果占比</h3>
              {canShare ? <ResponsiveContainer width="100%" height={260} minWidth={1}>
                <PieChart><Pie data={chartData} dataKey="value" nameKey="label" innerRadius="56%" outerRadius="80%"
                  onClick={choose} isAnimationActive={false}>
                  {chartData.map((item,index) => <Cell key={item.index} fill={palette[index % palette.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer> : <Empty description="占比图需要非负值，且至少一项大于 0" />}
            </div>
          </div>
          {showTable && <div className="table"><Table size="small" pagination={false} rowKey="index" dataSource={data}
            columns={columns.map(column => ({ key:column.key, title:column.title || column.key,
              align:column.numeric ? 'right' : 'left',
              render:(_, item) => column.key === dimension?.key && select
                ? <Button type="link" onClick={() => select(item.row)}>{item.label}</Button>
                : format((displayRows[item.index] || item.row)[column.key]),
            }))} /></div>}
        </>}
    </section>
  );
}
