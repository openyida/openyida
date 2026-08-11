/**
 * OpenYida Code Canvas complete scaffold.
 *
 * @openyida-scene workbench
 * @openyida-content-blocks 页面标题,主操作区,数据表格,空状态,详情抽屉,新建入口,数据管理入口,首屏加载,主题同步,错误提示
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
  primary: {
    title: '',
    status: '',
    owner: '',
    updatedAt: '',
  },
};
const DESIGN_DEFAULTS = {
  // @openyida-design-defaults:start
  "designSource": {
    "designFile": "",
    "designId": ""
  },
  "themeTokens": {
    "--color-brand1-6": "#2563eb",
    "--color-brand1-1": "#eff6ff",
    "--openyida-surface": "#ffffff",
    "--openyida-bg": "#f6f8fb",
    "--openyida-border": "#d8e0ea",
    "--openyida-text": "#172033",
    "--openyida-muted": "#667085"
  },
  "layout": {
    "pagePadding": 24,
    "panelPadding": 24,
    "sectionGap": 16,
    "panelRadius": 22,
    "controlRadius": 12
  }
  // @openyida-design-defaults:end
};
const THEME_TOKENS = DESIGN_DEFAULTS.themeTokens;

const DEFAULT_BINDING = {
  appType: APP_TYPE,
  corpId: '',
  formUuid: FORM_UUIDS.primary,
  pageSize: 20,
  fields: FIELDS.primary,
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
  return String(row.formInstId || '');
}

function fieldOf(row, fieldId) {
  if (!row || !fieldId) return '';
  const formData = row.formData || {};
  return formData[fieldId];
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

function readCorpIdFromWindow(targetWindow) {
  if (!targetWindow) return '';
  try {
    const config = targetWindow.pageConfig || targetWindow.g_config || targetWindow.__YIDA__ || {};
    const queryCorpId = new URLSearchParams(targetWindow.location && targetWindow.location.search || '').get('corpid');
    return String(queryCorpId || config.corpId || config.corpid || '').trim();
  } catch (error) {
    return '';
  }
}

function resolveCorpId() {
  const runtime = getOpenYidaRuntime();
  const runtimeContext = runtime && runtime.context && typeof runtime.context === 'object' ? runtime.context : {};
  const runtimeCorpId = runtime && (runtime.corpId || runtime.corpid);
  const candidates = [
    runtimeCorpId,
    runtimeContext.corpId,
    runtimeContext.corpid,
    readCorpIdFromWindow(typeof window !== 'undefined' ? window : null),
    readCorpIdFromWindow(readWindow('parent')),
    readCorpIdFromWindow(readWindow('top')),
  ];
  return String(candidates.find((value) => value) || '').trim();
}

function buildSubmissionUrl({ baseUrl, appType, formUuid }) {
  return `${baseUrl}/${appType}/submission/${formUuid}?iframe=true&isRenderNav=false`;
}

function buildFormDetailUrl({ baseUrl, appType, formUuid, formInstId }) {
  if (!formInstId) {
    throw new Error('构造详情页 URL 必须传入 formInstId。');
  }
  const query = new URLSearchParams({
    formInstId,
    iframe: 'true',
    'navConfig.layout': '1180',
    isRenderNav: 'false',
  });
  return `${baseUrl}/${appType}/formDetail/${formUuid}?${query.toString()}`;
}

function buildWorkbenchUrl({ baseUrl, appType, formUuid, corpId }) {
  if (!corpId) {
    throw new Error('打开数据管理页必须传入真实 corpid。');
  }
  const query = new URLSearchParams({
    hideLeftNav: 'true',
    corpid: corpId,
  });
  return `${baseUrl}/${appType}/workbench/${formUuid}?${query.toString()}`;
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

function isDocumentDetachedError(error) {
  const message = String(error && error.message ? error.message : error || '');
  return /document is already detached|failed to execute 'send' on 'xmlhttprequest'/i.test(message);
}

function formatLoadError(error) {
  if (isDocumentDetachedError(error)) {
    return '表单窗口关闭后正在刷新数据，请稍后再试。';
  }
  return error && error.message ? error.message : '数据加载失败';
}

function normalizeRow(row, fields) {
  return {
    key: resolveFormInstanceId(row) || String(Math.random()),
    formInstId: resolveFormInstanceId(row),
    title: fieldOf(row, fields.title),
    status: fieldOf(row, fields.status),
    owner: fieldOf(row, fields.owner),
    updatedAt: fieldOf(row, fields.updatedAt),
    raw: row,
  };
}

function FormOpenContainer({ openState, onClose, themeTokens }) {
  const iframeRef = useRef(null);
  const title = openState.type === 'detail'
    ? '查看详情'
    : openState.type === 'management' ? '数据管理' : '提交表单';
  return (
    <Drawer
      title={title}
      width="min(720px, 100vw)"
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
      setError(formatLoadError(loadError));
      if (!isDocumentDetachedError(loadError)) {
        setRows([]);
        setTotalCount(0);
      }
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
  const { error, loadRows, loading, rows, setError, totalCount } = useCanvasBaseState(binding);
  const [openState, setOpenState] = useState({ visible: false, type: '', url: '' });
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    const runtime = getOpenYidaRuntime();
    if (runtime && runtime.theme && typeof runtime.theme.install === 'function') {
      runtime.theme.install({ tokens: themeTokens });
    }
  }, [themeTokens]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
  }, []);

  const scheduleLoadRows = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      loadRows();
    }, 400);
  }, [loadRows]);

  const openForm = useCallback((request) => {
    const type = request && request.type;
    const targetAppType = (request && request.appType) || binding.appType;
    const targetFormUuid = (request && request.formUuid) || binding.formUuid;
    try {
      let url;
      if (type === 'detail') {
        const formInstId = request.formInstId || assertFormInstanceId(request.row);
        url = buildFormDetailUrl({ baseUrl, appType: targetAppType, formUuid: targetFormUuid, formInstId });
      } else if (type === 'management') {
        url = buildWorkbenchUrl({
          baseUrl,
          appType: targetAppType,
          formUuid: targetFormUuid,
          corpId: (request && request.corpId) || binding.corpId || resolveCorpId(),
        });
      } else {
        url = buildSubmissionUrl({ baseUrl, appType: targetAppType, formUuid: targetFormUuid });
      }
      setOpenState({ visible: true, type: type === 'detail' ? 'detail' : type === 'management' ? 'management' : 'submission', url });
    } catch (openError) {
      setError(openError && openError.message ? openError.message : '表单地址构造失败');
    }
  }, [baseUrl, binding.appType, binding.corpId, binding.formUuid, setError]);

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
    <ConfigProvider theme={{ token: { colorPrimary: themeTokens['--color-brand1-6'], borderRadius: DESIGN_DEFAULTS.layout.controlRadius } }}>
      <div className="openyida-canvas-scaffold" style={{ minHeight: '100%', padding: DESIGN_DEFAULTS.layout.pagePadding, background: 'var(--openyida-bg)' }}>
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
          border-radius: ${DESIGN_DEFAULTS.layout.panelRadius}px;
          padding: ${DESIGN_DEFAULTS.layout.panelPadding}px;
        }
        `}</style>
        <div className="openyida-canvas-panel">
        <Space direction="vertical" size={DESIGN_DEFAULTS.layout.sectionGap} style={{ width: '100%' }}>
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
            <Button type="link" onClick={() => openForm({ type: 'management' })}>
              打开数据管理页
            </Button>
          ) : null}
        </Space>
        </div>
        <FormOpenContainer
          openState={openState}
          onClose={() => {
            setOpenState({ visible: false, type: '', url: '' });
            scheduleLoadRows();
          }}
          themeTokens={themeTokens}
        />
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
