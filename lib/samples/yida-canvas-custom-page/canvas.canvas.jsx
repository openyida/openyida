/**
 * OpenYida Code Canvas complete scaffold.
 *
 * @openyida-scene workbench
 * @openyida-content-blocks 页面标题,状态摘要,主操作区,数据筛选,数据表格,空状态,详情抽屉,新建入口,主题同步,错误提示
 *
 * This is the only generic Canvas scaffold. Extend dataBinding, fields,
 * blocks and actions in this file. Do not fork separate website/dashboard/list
 * scaffolds.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, ConfigProvider, Drawer, Empty, Space, Spin, Table, Typography } from 'antd';

const { Text, Title } = Typography;

const APP_TYPE = '';
const FORM_UUIDS = { primary: '' };
const FIELDS = {
  title: '',
  status: '',
  owner: '',
  updatedAt: '',
};
const THEME_TOKENS = {
  '--color-brand1-6': '#2563eb',
  '--color-brand1-1': '#eff6ff',
  '--openyida-surface': '#ffffff',
  '--openyida-bg': '#f6f8fb',
  '--openyida-border': '#d8e0ea',
  '--openyida-text': '#172033',
  '--openyida-muted': '#667085',
};

const DEFAULT_BINDING = {
  appType: APP_TYPE,
  formUuid: FORM_UUIDS.primary,
  pageSize: 20,
  fields: FIELDS,
};

function readWindow(name) {
  try {
    const target = window[name];
    return target && target !== window ? target : null;
  } catch (error) {
    return null;
  }
}

function getOpenYidaRuntime() {
  const parentWindow = readWindow('parent');
  const topWindow = readWindow('top');
  const candidates = [
    typeof window !== 'undefined' ? window.__OPENYIDA_RUNTIME__ : null,
    typeof window !== 'undefined' ? window.openyidaRuntime : null,
    parentWindow ? parentWindow.__OPENYIDA_RUNTIME__ : null,
    parentWindow ? parentWindow.openyidaRuntime : null,
    topWindow ? topWindow.__OPENYIDA_RUNTIME__ : null,
    topWindow ? topWindow.openyidaRuntime : null,
  ];
  const runtime = candidates.find((item) => item && item.yida);
  if (runtime) {
    return runtime;
  }

  const yidaApi =
    (typeof window !== 'undefined' && window.__OPENYIDA_YIDA_API__) ||
    (typeof window !== 'undefined' && window.openyidaYidaApi) ||
    (parentWindow && parentWindow.__OPENYIDA_YIDA_API__) ||
    (parentWindow && parentWindow.openyidaYidaApi) ||
    (topWindow && topWindow.__OPENYIDA_YIDA_API__) ||
    (topWindow && topWindow.openyidaYidaApi) ||
    null;
  return yidaApi ? { ready: yidaApi.ready, yida: yidaApi, yidaApi, theme: null } : null;
}

function getYidaApi(runtime) {
  return runtime && runtime.yida ? runtime.yida : null;
}

function requireYidaApi(runtime, methodName) {
  const api = getYidaApi(runtime);
  if (!runtime || runtime.ready !== true || !api || typeof api[methodName] !== 'function') {
    const error = new Error(`发布 runtime 未就绪或缺少 ${methodName}。`);
    error.code = 'OPENYIDA_RUNTIME_NOT_READY';
    error.evidence = { methodName, runtimeReady: Boolean(runtime && runtime.ready) };
    error.retryable = true;
    error.repairType = 'runtime';
    throw error;
  }
  return api;
}

function normalizeSearchParams(params) {
  const next = { ...(params || {}) };
  if (next.query && !next.searchFieldJson) {
    next.searchFieldJson = JSON.stringify(next.query);
    delete next.query;
  }
  if (next.searchFieldJson && typeof next.searchFieldJson !== 'string') {
    next.searchFieldJson = JSON.stringify(next.searchFieldJson);
  }
  if (!next.searchFieldJson) {
    next.searchFieldJson = '';
  }
  return next;
}

function unwrapRows(payload) {
  const queue = [payload];
  const seen = [];
  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) continue;
    seen.push(item);
    if (Array.isArray(item)) return item;
    ['data', 'list', 'values', 'records'].forEach((key) => {
      if (Array.isArray(item[key])) queue.unshift(item[key]);
    });
    ['result', 'content', 'value'].forEach((key) => {
      if (item[key] && typeof item[key] === 'object') queue.push(item[key]);
    });
  }
  return [];
}

function unwrapTotalCount(payload, rows) {
  const queue = [payload];
  const seen = [];
  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.indexOf(item) >= 0) continue;
    seen.push(item);
    if (typeof item.totalCount === 'number') return item.totalCount;
    if (typeof item.total === 'number') return item.total;
    if (typeof item.count === 'number') return item.count;
    ['result', 'content', 'data', 'value'].forEach((key) => {
      if (item[key] && typeof item[key] === 'object') queue.push(item[key]);
    });
  }
  return Array.isArray(rows) ? rows.length : 0;
}

function resolveFormInstanceId(row) {
  if (!row || typeof row !== 'object') return '';
  return String(row.formInstId || row.formInstanceId || row.instanceId || row.id || '');
}

function assertFormInstanceId(row) {
  const formInstId = resolveFormInstanceId(row);
  if (!formInstId) {
    throw new Error('缺少真实 formInstId，不能打开详情页。');
  }
  return formInstId;
}

function resolveBaseUrl() {
  const parentWindow = readWindow('parent');
  const config =
    (typeof window !== 'undefined' && (window.pageConfig || window.g_config || window.__YIDA__)) ||
    (parentWindow && (parentWindow.pageConfig || parentWindow.g_config || parentWindow.__YIDA__)) ||
    {};
  const origin = config.baseUrl || config.origin || (typeof location !== 'undefined' ? location.origin : '');
  return String(origin || '').replace(/\/$/, '');
}

function buildSubmissionUrl({ baseUrl, appType, formUuid }) {
  return `${baseUrl}/${appType}/submission/${formUuid}?isRenderNav=false`;
}

function buildFormDetailUrl({ baseUrl, appType, formUuid, formInstId }) {
  if (!formInstId) {
    throw new Error('构造详情页 URL 必须传入 formInstId。');
  }
  const query = new URLSearchParams({
    formInstId,
    'navConfig.layout': '1180',
    isRenderNav: 'false',
  });
  return `${baseUrl}/${appType}/formDetail/${formUuid}?${query.toString()}`;
}

function buildWorkbenchUrl({ baseUrl, appType, formUuid }) {
  return `${baseUrl}/${appType}/workbench/${formUuid}?iframe=true`;
}

function installThemeIntoFrame(themeTokens, iframeElement) {
  const runtime = getOpenYidaRuntime();
  if (!runtime || !runtime.theme || typeof runtime.theme.installIntoFrame !== 'function') {
    return false;
  }
  try {
    return runtime.theme.installIntoFrame(themeTokens, iframeElement).installed > 0;
  } catch (error) {
    return false;
  }
}

function normalizeRow(row, fields) {
  const formData = row && (row.formData || row.data || row);
  return {
    key: resolveFormInstanceId(row) || String(Math.random()),
    formInstId: resolveFormInstanceId(row),
    title: formData && fields.title ? formData[fields.title] : '',
    status: formData && fields.status ? formData[fields.status] : '',
    owner: formData && fields.owner ? formData[fields.owner] : '',
    updatedAt: formData && fields.updatedAt ? formData[fields.updatedAt] : '',
    raw: row,
  };
}

function FormOpenContainer({ openState, onClose, themeTokens }) {
  const iframeRef = useRef(null);
  const title = openState.type === 'detail' ? '查看详情' : '提交表单';
  return (
    <Drawer
      title={title}
      width="50vw"
      open={openState.visible}
      onClose={onClose}
      destroyOnClose
      styles={{ body: { padding: 0 } }}
    >
      {openState.url ? (
        <iframe
          ref={iframeRef}
          title={title}
          src={openState.url}
          style={{ width: '100%', height: '100%', border: 0, minHeight: 'calc(100vh - 56px)' }}
          onLoad={() => installThemeIntoFrame(themeTokens, iframeRef.current)}
        />
      ) : (
        <Empty description="缺少表单地址" />
      )}
    </Drawer>
  );
}

function useCanvasBaseState(binding) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const loadRows = useCallback(async () => {
    const runtime = getOpenYidaRuntime();
    if (!binding.formUuid) {
      setRows([]);
      setTotalCount(0);
      setError('请先在 dataBinding 中填入真实 formUuid 和字段映射。');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const api = requireYidaApi(runtime, 'searchFormDatas');
      const payload = await api.searchFormDatas(normalizeSearchParams({
        appType: binding.appType,
        formUuid: binding.formUuid,
        currentPage: 1,
        pageSize: binding.pageSize || 20,
        searchFieldJson: '',
      }));
      const nextRows = unwrapRows(payload);
      const nextTotal = unwrapTotalCount(payload, nextRows);
      if (nextTotal > 0 && nextRows.length === 0) {
        throw new Error('接口返回 totalCount > 0，但页面未解析到行数据。');
      }
      setRows(nextRows.map((row) => normalizeRow(row, binding.fields || {})));
      setTotalCount(nextTotal);
    } catch (loadError) {
      setError(loadError && loadError.message ? loadError.message : '数据加载失败');
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [binding]);

  return { error, loadRows, loading, rows, setError, setRows, totalCount };
}

function YidaComp(props) {
  const binding = useMemo(() => ({ ...DEFAULT_BINDING, ...((props && props.dataBinding) || {}) }), [props]);
  const themeTokens = useMemo(() => ({ ...THEME_TOKENS, ...((props && props.themeTokens) || {}) }), [props]);
  const baseUrl = resolveBaseUrl();
  const { error, loadRows, loading, rows, totalCount } = useCanvasBaseState(binding);
  const [openState, setOpenState] = useState({ visible: false, type: '', url: '' });

  useEffect(() => {
    const runtime = getOpenYidaRuntime();
    if (runtime && runtime.theme && typeof runtime.theme.install === 'function') {
      runtime.theme.install({ tokens: themeTokens });
    }
  }, [themeTokens]);

  const openForm = useCallback((request) => {
    const type = request && request.type;
    let url;
    if (type === 'detail') {
      const formInstId = request.formInstId || assertFormInstanceId(request.row);
      url = buildFormDetailUrl({ baseUrl, appType: binding.appType, formUuid: binding.formUuid, formInstId });
    } else {
      url = buildSubmissionUrl({ baseUrl, appType: binding.appType, formUuid: binding.formUuid });
    }
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      window.location.assign(url);
      return;
    }
    setOpenState({ visible: true, type: type === 'detail' ? 'detail' : 'submission', url });
  }, [baseUrl, binding.appType, binding.formUuid]);

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
    { title: '负责人', dataIndex: 'owner', key: 'owner', width: 160 },
    { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => openForm({ type: 'detail', formInstId: row.formInstId, row: row.raw })}
          disabled={!row.formInstId}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <ConfigProvider theme={{ token: { colorPrimary: themeTokens['--color-brand1-6'], borderRadius: 8 } }}>
      <div className="openyida-canvas-scaffold" style={{ minHeight: '100%', padding: 24, background: 'var(--openyida-bg)' }}>
        <style>{`
        .openyida-canvas-scaffold {
          color: var(--openyida-text);
          box-sizing: border-box;
        }
        .openyida-canvas-scaffold *,
        .openyida-canvas-scaffold *::before,
        .openyida-canvas-scaffold *::after {
          box-sizing: border-box;
        }
        .openyida-canvas-scaffold button,
        .openyida-canvas-scaffold input,
        .openyida-canvas-scaffold textarea,
        .openyida-canvas-scaffold select {
          font: inherit;
        }
        .openyida-canvas-panel {
          background: var(--openyida-surface);
          border: 1px solid var(--openyida-border);
          border-radius: 8px;
          padding: 20px;
        }
        `}</style>
        <div className="openyida-canvas-panel">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
            <div>
              <Title level={4} style={{ margin: 0 }}>业务工作台</Title>
              <Text type="secondary">共 {totalCount} 条记录</Text>
            </div>
            <Space>
              <Button onClick={loadRows}>刷新</Button>
              <Button type="primary" onClick={() => openForm({ type: 'submission' })}>新建</Button>
            </Space>
          </Space>
          {error ? <Alert type="warning" showIcon message={error} /> : null}
          <Spin spinning={loading}>
            <Table
              rowKey="key"
              columns={columns}
              dataSource={rows}
              pagination={false}
              locale={{ emptyText: <Empty description="暂无真实表单数据" /> }}
            />
          </Spin>
          {binding.appType && binding.formUuid ? (
            <Button type="link" href={buildWorkbenchUrl({ baseUrl, appType: binding.appType, formUuid: binding.formUuid })} target="_blank">
              打开数据管理页
            </Button>
          ) : null}
        </Space>
        </div>
        <FormOpenContainer
          openState={openState}
          onClose={() => {
            setOpenState({ visible: false, type: '', url: '' });
            loadRows();
          }}
          themeTokens={themeTokens}
        />
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
