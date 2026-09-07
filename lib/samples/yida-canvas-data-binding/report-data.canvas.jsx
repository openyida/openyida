import React, { useEffect, useMemo, useState } from 'react';

// Replace every value from current-app report inspect / Schema evidence before publishing.
const DATA_BINDING = {
  mode: 'report', appType: '{{APP_TYPE}}', reportUuid: '{{REPORT_UUID}}',
  cid: '{{CID}}', componentClassName: '{{COMPONENT_CLASS_NAME}}', dataSetKey: '{{DATA_SET_KEY}}',
};

// Local hook, not an import from an official SDK. The publisher installs the report runtime.
function useReportData(binding, query) {
  const bindingKey = JSON.stringify(binding);
  const queryKey = JSON.stringify(query);
  const [state, setState] = useState({ loading: true, error: null, rows: [], meta: [], totalCount: null, lastUpdatedAt: null });
  const [revision, setRevision] = useState(0);
  const connection = useMemo(() => {
    try {
      if (!window.__OPENYIDA_REPORT__) {throw new Error('Report runtime is unavailable. Republish this Canvas page.');}
      return { bridge: window.__OPENYIDA_REPORT__.createBridge(JSON.parse(bindingKey)) };
    } catch (error) {return { error };}
  }, [bindingKey]);
  useEffect(() => {
    if (connection.error) {
      setState(previous => ({ ...previous, loading: false, error: { message: connection.error.message } }));
      return undefined;
    }
    const unsubscribe = connection.bridge.subscribe(setState);
    return () => {unsubscribe(); connection.bridge.cancel();};
  }, [connection]);
  useEffect(() => {
    if (!connection.bridge) {return undefined;}
    // Changing controls cancels the old query immediately; debounce only the new request.
    connection.bridge.cancel();
    const timer = setTimeout(() => {
      connection.bridge.refresh(JSON.parse(queryKey)).catch(() => {}); // error is rendered from bridge state
    }, 300);
    return () => {clearTimeout(timer); connection.bridge.cancel();};
  }, [connection, queryKey, revision]);
  return { ...state, refresh: () => setRevision(value => value + 1) };
}

export default function YidaComp() {
  const [start, setStart] = useState(0);
  // Add only real filterKey -> values mappings from this component's report model.
  const query = useMemo(() => ({ filters: {}, start, limit: 50 }), [start]);
  const report = useReportData(DATA_BINDING, query);
  const columns = report.meta.length ? report.meta.map(field => ({ key: field.alias, title: field.aliasName || field.alias }))
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
