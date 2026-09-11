import React, { useEffect, useMemo, useRef, useState } from 'react';

// Only stable identifiers from this app's report inspect; the host resolves the model.
const DATA_BINDING = {
  reportUuid: '{{REPORT_UUID}}', cid: '{{CID}}', dataSetKey: '{{DATA_SET_KEY}}',
};

// React owns subscription/debounce only; yc-utils owns requests, cancellation and state.
function useReportData(binding, query) {
  const bindingKey = JSON.stringify(binding);
  const queryKey = JSON.stringify(query);
  const bridgeRef = useRef(null);
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: [], totalCount: null, lastUpdatedAt: null });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let bridge;
    let unsubscribe;
    try {
      const api = window.__OPENYIDA_YIDA_API__;
      if (!api || !api.availableMethods.includes('createReportDataBridge')) {
        throw new Error('当前运行环境暂不支持报表查询，请联系应用管理员。');
      }
      bridge = api.createReportDataBridge(JSON.parse(bindingKey));
      bridgeRef.current = bridge;
      setState(bridge.getState());
      unsubscribe = bridge.subscribe(setState);
    } catch (error) {
      setState(previous => ({ ...previous, loading: false, error }));
    }
    return () => {
      if (unsubscribe) {unsubscribe();}
      if (bridge) {bridge.dispose();}
      bridgeRef.current = null;
    };
  }, [bindingKey]);
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!bridge) {return undefined;}
    // Cancel immediately when controls change; only the replacement request is debounced.
    bridge.cancel();
    const timer = setTimeout(() => {
      bridge.refresh(JSON.parse(queryKey)).catch(() => {}); // error is rendered from shared state
    }, 300);
    return () => {clearTimeout(timer); bridge.cancel();};
  }, [bindingKey, queryKey, revision]);
  return { ...state, refresh: () => setRevision(value => value + 1) };
}

export default function YidaComp() {
  const [start, setStart] = useState(0);
  // Add only real filterKey -> values mappings from this component's report model.
  const query = useMemo(() => ({ filterValueMap: {}, paging: { start, limit: 50 } }), [start]);
  const report = useReportData(DATA_BINDING, query);
  const columns = Array.isArray(report.meta) && report.meta.length ? report.meta.map(field => ({ key: field.alias, title: field.aliasName || field.alias }))
    : Object.keys(report.rows[0] || {}).map(key => ({ key, title: key }));
  return <main style={{ minHeight: '100vh', padding: 24, background: 'var(--pod-page-bg-color, #fff)' }}>
    <h1>数据分析</h1>
    <button disabled={report.loading} onClick={report.refresh}>刷新</button>
    {report.loading && <p role="status">正在更新，已展示的数据为上次查询结果。</p>}
    {report.error && <p role="alert">查询失败：{report.error.message}；已展示的数据未更新。</p>}
    {!report.loading && !report.error && report.rows.length === 0 && <p>当前条件下暂无数据。</p>}
    <table><thead><tr>{columns.map(column => <th key={column.key}>{String(column.title)}</th>)}</tr></thead>
      <tbody>{report.rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column.key}>{row[column.key] == null ? '' : String(row[column.key])}</td>)}</tr>)}</tbody>
    </table>
    <p>当前页 {report.rows.length} 条；{report.totalCount === null ? '总数未返回' : '结果总数 ' + report.totalCount}</p>
    {report.lastUpdatedAt && <p>最近更新：{new Date(report.lastUpdatedAt).toLocaleString()}</p>}
    <button disabled={report.loading || start === 0} onClick={() => setStart(value => Math.max(0, value - 50))}>上一页</button>
    <button disabled={report.loading || !!report.error || (report.totalCount === null ? report.rows.length < 50 : start + 50 >= report.totalCount)} onClick={() => setStart(value => value + 50)}>下一页</button>
  </main>;
}
