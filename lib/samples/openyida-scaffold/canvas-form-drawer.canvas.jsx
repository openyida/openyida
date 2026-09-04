/**
 * @openyida-page-template-base
 * OpenYida Code Canvas 表单入口基准模板。
 *
 * 内部生成流程必须先复制本文件，再按 PRD、design.md 和真实数据契约改写。
 * 发布前必须删除本标记、示例数据和全部占位内容。
 *
 * 关键约定：
 * - PC 端新增和详情使用 FormOpenContainer 右侧抽屉 iframe。
 * - 抽屉左边缘可拖拽调宽，双击恢复半屏，全屏切换保留拖拽宽度。
 * - 移动端才整页进入原生提交页或详情页。
 * - 详情页必须先解析真实 formInstId，缺少实例 ID 时禁用入口。
 * - 预览行不携带伪造 formInstId，接入 searchFormDatas 真实 rows 后才启用详情。
 */

// @openyida-form-drawer:start
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { ExternalLink, Maximize2, Minimize2, X } from 'lucide-react';

const FORM_OPEN_DRAWER_WIDTH = '50vw';

function appendQuery(url, params) {
  const query = Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    .join('&');
  if (!query) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + query;
}

function isMobileViewport() {
  return typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(max-width: 767px)').matches;
}

function getYidaFormInstId(row) {
  return row && (row.formInstId || row.formInstanceId || row.instanceId || row.id);
}

function buildYidaFormUrl(request, currentAppType) {
  if (!request) return '';
  const appType = request.appType || currentAppType;
  if (request.type === 'submission') {
    return appendQuery('/' + appType + '/submission/' + request.formUuid, {
      isRenderNav: false,
    });
  }
  if (request.type === 'detail') {
    if (!request.formInstId) return '';
    return appendQuery('/' + appType + '/formDetail/' + request.formUuid, {
      formInstId: request.formInstId,
      'navConfig.layout': 1180,
      isRenderNav: false,
    });
  }
  return '';
}

function CanvasDrawer({ open, title, onClose, onOpenInNewWindow, extra, children }) {
  const [fullScreen, setFullScreen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef(null);
  const maxWidth = Math.floor(viewportWidth * 0.9);
  const minWidth = Math.min(480, Math.floor(viewportWidth / 2));
  const clampWidth = (value) => Math.min(maxWidth, Math.max(minWidth, value));
  const width = drawerWidth === null ? FORM_OPEN_DRAWER_WIDTH : clampWidth(drawerWidth);
  const fullScreenTitle = fullScreen ? '退出全屏' : '全屏';

  function finishResize() {
    const drag = resizeRef.current;
    resizeRef.current = null;
    if (drag && drag.handle.hasPointerCapture(drag.pointerId)) {
      drag.handle.releasePointerCapture(drag.pointerId);
    }
    setResizing(false);
  }

  useEffect(() => {
    if (!open || fullScreen) return;
    const handleResize = () => {
      finishResize();
      setViewportWidth(window.innerWidth);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('blur', finishResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('blur', finishResize);
      finishResize();
    };
  }, [open, fullScreen]);

  function startResize(event) {
    if (event.button !== 0 || resizeRef.current) return;
    event.preventDefault();
    const handle = event.currentTarget;
    resizeRef.current = {
      handle, pointerId: event.pointerId, startX: event.clientX,
      width: handle.closest('.ant-drawer-content-wrapper').getBoundingClientRect().width,
    };
    handle.setPointerCapture(event.pointerId);
    setResizing(true);
  }

  return (
    <>
      <style>{`
        .openyida-form-drawer.ant-drawer .ant-drawer-title {
          color: inherit;
          font-size: inherit;
        }
        .openyida-form-drawer .oy-drawer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .openyida-form-drawer .oy-drawer-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--drawer-close-color, var(--pod-page-header-text-color, var(--color-text1-3, #666)));
          cursor: pointer;
        }
        .openyida-form-drawer .oy-drawer-action:hover {
          color: var(--drawer-close-color-hovered, var(--pod-page-header-text-color, var(--color-text1-4, #1f2329)));
          background: var(--drawer-close-bg-hovered, var(--pod-overlay-color-hover, rgba(83, 88, 97, 0.16)));
        }
        .openyida-form-drawer .oy-drawer-action:focus-visible {
          outline: 2px solid var(--color-brand1-6, #1677ff);
          outline-offset: 2px;
        }
        .openyida-form-drawer .oy-drawer-card {
          height: 100%;
          min-height: 0;
          overflow: auto;
          background: var(--pod-card-bg-color, var(--drawer-bg, var(--color-white, #fff)));
          border-radius: var(--pod-card-border-radius, 20px);
        }
        .openyida-form-drawer .oy-drawer-resize {
          position: absolute;
          inset: 0 auto 0 0;
          width: 8px;
          z-index: 2;
          cursor: ew-resize;
          touch-action: none;
        }
        .openyida-form-drawer .oy-drawer-resize:hover,
        .openyida-form-drawer .oy-drawer-resize:focus-visible {
          background: var(--pod-overlay-color-hover, rgba(83, 88, 97, 0.16));
        }
        .openyida-form-drawer.is-resizing {
          cursor: ew-resize;
          user-select: none;
        }
        .openyida-form-drawer.is-resizing iframe {
          pointer-events: none;
        }
      `}</style>
      <Drawer
        rootClassName={`openyida-form-drawer${resizing ? ' is-resizing' : ''}`}
        title={title}
        open={open}
        width={fullScreen ? '100vw' : width}
        closable={false}
        destroyOnClose
        afterOpenChange={(visible) => { if (!visible) setFullScreen(false); }}
        onClose={onClose}
        extra={
          <div className="oy-drawer-actions">
            {extra}
            <button type="button" className="oy-drawer-action" title={fullScreenTitle} aria-label={fullScreenTitle} aria-pressed={fullScreen} onClick={() => setFullScreen(!fullScreen)}>
              {fullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            {onOpenInNewWindow ? (
              <button type="button" className="oy-drawer-action" title="在新窗口打开" aria-label="在新窗口打开" onClick={onOpenInNewWindow}>
                <ExternalLink size={18} />
              </button>
            ) : null}
            <button type="button" className="oy-drawer-action" title="关闭" aria-label="关闭" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        }
        styles={{
          mask: { background: 'var(--color-calculate-mask-background, rgba(0, 0, 0, 0.35))' },
          wrapper: {
            boxShadow: 'var(--pod-drawer-shadow, var(--drawer-shadow, 0 0 32px rgba(0, 0, 0, 0.1)))',
            ...(resizing ? { transition: 'none' } : {}),
          },
          content: {
            background: 'var(--pod-shell-theme-bg-color, var(--drawer-bg, var(--color-brand1-1, #f4f6ff)))',
            color: 'var(--drawer-content-color, var(--color-text1-4, #1f2329))',
            borderLeft: 'var(--drawer-border-width, 0px) var(--drawer-border-style, solid) var(--drawer-border-color, transparent)',
            borderRadius: fullScreen ? 0 : 'var(--pod-drawer-border-radius, var(--pod-drawer-radius, var(--drawer-corner, 20px))) 0 0 var(--pod-drawer-border-radius, var(--pod-drawer-radius, var(--drawer-corner, 20px)))',
            overflow: 'hidden',
          },
          header: {
            background: 'var(--drawer-title-bg-color, var(--pod-page-header-bg-color, transparent))',
            color: 'var(--drawer-title-color, var(--pod-page-header-text-color, var(--color-text1-4, #1f2329)))',
            fontSize: 'var(--drawer-title-font-size, 16px)',
            padding: 'var(--drawer-title-padding-top, 12px) var(--drawer-title-padding-left-right, 20px) var(--drawer-title-padding-bottom, 12px)',
            borderBottom: 'var(--drawer-title-border-width, 0px) solid var(--drawer-title-border-color, var(--drawer-border-color, transparent))',
          },
          body: { padding: '0 8px 8px', minHeight: 0, overflow: 'hidden' },
        }}
      >
        {!fullScreen ? (
          <div
            className="oy-drawer-resize"
            role="separator"
            aria-label="调整抽屉宽度"
            aria-orientation="vertical"
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            aria-valuenow={Math.round(drawerWidth === null ? viewportWidth / 2 : clampWidth(drawerWidth))}
            tabIndex={0}
            onPointerDown={startResize}
            onPointerMove={(event) => {
              const drag = resizeRef.current;
              if (drag && drag.pointerId === event.pointerId) {
                setDrawerWidth(clampWidth(drag.width + drag.startX - event.clientX));
              }
            }}
            onPointerUp={finishResize}
            onPointerCancel={finishResize}
            onLostPointerCapture={finishResize}
            onDoubleClick={() => setDrawerWidth(null)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              setDrawerWidth(clampWidth((drawerWidth === null ? viewportWidth / 2 : clampWidth(drawerWidth)) + (event.key === 'ArrowLeft' ? 32 : -32)));
            }}
          />
        ) : null}
        <div className="oy-drawer-card">{children}</div>
      </Drawer>
    </>
  );
}

function FormOpenContainer({ request, currentAppType, onClose, onAfterClose }) {
  const iframeSrc = useMemo(() => buildYidaFormUrl(request, currentAppType), [request, currentAppType]);
  const title = request && request.title ? request.title : '表单';
  return (
    <CanvasDrawer
      title={title}
      open={!!request}
      onOpenInNewWindow={iframeSrc ? () => window.open(iframeSrc, '_blank', 'noopener,noreferrer') : undefined}
      onClose={() => {
        onClose();
        if (typeof onAfterClose === 'function') onAfterClose();
      }}
    >
      {iframeSrc ? <iframe title={title} src={iframeSrc} style={{ width: '100%', height: '100%', border: 0, display: 'block' }} /> : null}
    </CanvasDrawer>
  );
}

function useYidaFormOpen(currentAppType, refreshData) {
  const [formRequest, setFormRequest] = useState(null);

  function openForm(request) {
    if (request && request.type === 'detail' && !request.formInstId) return;
    const href = buildYidaFormUrl(request, currentAppType);
    if (!href) return;
    if (isMobileViewport()) {
      window.location.href = href;
      return;
    }
    setFormRequest(request);
  }

  const formOpenContainer = (
    <FormOpenContainer
      request={formRequest}
      currentAppType={currentAppType}
      onClose={() => setFormRequest(null)}
      onAfterClose={refreshData}
    />
  );

  return { openForm, formOpenContainer };
}
// @openyida-form-drawer:end

import { Alert, Button, ConfigProvider, Empty, Space, Table, Tag, Typography } from 'antd';
import { Eye, Plus, RefreshCw } from 'lucide-react';

const { Text, Title } = Typography;

const RAW_APP_TYPE = '{{APP_TYPE}}';
const RAW_FORM_UUID = '{{FORM_UUID}}';

const SAMPLE_ROWS = [
  {
    _rowKey: 'sample-001',
    title: '客户回访确认',
    priority: 'P1',
    status: '处理中',
    owner: '张三',
    updatedAt: '08-23 10:20',
  },
  {
    _rowKey: 'sample-002',
    title: '报价资料补齐',
    priority: 'P2',
    status: '待处理',
    owner: '李四',
    updatedAt: '08-23 09:15',
  },
  {
    _rowKey: 'sample-missing-inst',
    title: '缺少实例 ID 的记录',
    priority: 'P3',
    status: '待确认',
    owner: '未分配',
    updatedAt: '待同步',
  },
];

function isUnresolvedTemplate(value) {
  return !value || /\{\{[^}]+\}\}/.test(String(value)) || String(value) === 'APP_XXX' || String(value) === 'FORM_XXX';
}

function resolveConfigValue(value, fallback) {
  return isUnresolvedTemplate(value) ? fallback : String(value);
}

function readThemeColor(name, fallback) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function normalizeRows(rows) {
  const source = Array.isArray(rows) && rows.length ? rows : SAMPLE_ROWS;
  return source.map((row, index) => ({
    _rowKey: row._rowKey || row.formInstId || row.id || 'row-' + index,
    title: row.title || row.name || row.subject || '未命名事项',
    priority: row.priority || 'P2',
    status: row.status || '待处理',
    owner: row.owner || row.assignee || '未分配',
    updatedAt: row.updatedAt || row.gmtModified || '待同步',
    formInstId: row.formInstId,
    formInstanceId: row.formInstanceId,
    instanceId: row.instanceId,
    id: row.id,
  }));
}

function YidaComp(props) {
  const rawAppType = props && props.appType ? props.appType : RAW_APP_TYPE;
  const rawFormUuid = props && props.formUuid ? props.formUuid : RAW_FORM_UUID;
  const appType = resolveConfigValue(rawAppType, 'APP_XXX');
  const formUuid = resolveConfigValue(rawFormUuid, 'FORM_XXX');
  const isBound = !isUnresolvedTemplate(rawAppType) && !isUnresolvedTemplate(rawFormUuid);
  const [notice, setNotice] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const rows = useMemo(() => normalizeRows(props && props.rows), [props && props.rows, refreshCount]);
  const { openForm, formOpenContainer } = useYidaFormOpen(appType, refreshData);

  function refreshData() {
    setRefreshCount((count) => count + 1);
    setNotice({ type: 'success', message: '已回到当前页面，请在接入 searchFormDatas 后刷新真实列表。' });
  }

  function openSubmission() {
    if (!isBound) {
      setNotice({ type: 'warning', message: '请先替换 APP_TYPE 和 FORM_UUID，或通过 props 注入真实资源。' });
      return;
    }
    openForm({ type: 'submission', title: '新增事项', formUuid });
  }

  function openDetail(row) {
    const formInstId = getYidaFormInstId(row);
    if (!isBound) {
      setNotice({ type: 'warning', message: '请先绑定真实 appType/formUuid 后再打开详情。' });
      return;
    }
    if (!formInstId) {
      setNotice({ type: 'warning', message: '当前记录缺少 formInstId，已阻止打开空详情页。' });
      return;
    }
    openForm({ type: 'detail', title: '事项详情', formUuid, formInstId });
  }

  const columns = [
    {
      title: '事项名称',
      dataIndex: 'title',
      width: 280,
      render: (value, row) => (
        <div>
          <Text strong>{value}</Text>
          <div className="oys-subtext">实例 ID：{getYidaFormInstId(row) || '未返回'}</div>
        </div>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 110,
      render: (value) => <Tag color={value === 'P1' || value === 'P0' ? 'red' : 'blue'}>{value}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value) => <Tag color={value === '已完成' ? 'success' : 'processing'}>{value}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 120,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 140,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, row) => {
        const formInstId = getYidaFormInstId(row);
        return (
          <Button
            type="link"
            icon={<Eye size={15} />}
            disabled={!formInstId || !isBound}
            onClick={() => openDetail(row)}
          >
            详情
          </Button>
        );
      },
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: readThemeColor('--color-brand1-6', '#1677FF'),
          colorInfo: readThemeColor('--color-brand1-6', '#1677FF'),
          colorText: readThemeColor('--color-text1-4', '#1F2329'),
          colorBgLayout: readThemeColor('--color-fill1-1', '#F5F6F7'),
          borderRadius: 8,
        },
      }}
      getPopupContainer={(triggerNode) => (triggerNode && triggerNode.parentElement) || document.body}
    >
      <style>{`
        .oys-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 24px;
          background: var(--pod-page-bg-color, var(--color-white, #fff));
          color: var(--color-text1-4);
        }
        .oys-shell {
          max-width: 1240px;
          margin: 0 auto;
        }
        .oys-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }
        .oys-title.ant-typography {
          margin: 0 0 6px;
        }
        .oys-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: var(--pod-card-border, none);
          border-radius: var(--pod-card-border-radius, 20px);
          background: var(--pod-card-bg-color, var(--color-white, #fff));
        }
        .oys-table-panel {
          margin-top: 12px;
          overflow: hidden;
          border: var(--pod-card-border, none);
          border-radius: var(--pod-card-border-radius, 20px);
          background: var(--pod-card-bg-color, var(--color-white, #fff));
        }
        .oys-subtext {
          margin-top: 4px;
          color: var(--color-text1-3);
          font-size: 12px;
          line-height: 1.4;
        }
        .oys-empty {
          padding: 48px 0;
        }
        .oys-page .ant-table-cell {
          vertical-align: top;
        }
        @media (max-width: 760px) {
          .oys-page {
            padding: 16px 10px;
          }
          .oys-header,
          .oys-toolbar {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="oys-page">
        <div className="oys-shell">
          <div className="oys-header">
            <div>
              <Title level={2} className="oys-title">OpenYida 表单入口</Title>
              <Text type="secondary">原生表单负责提交和详情，自定义页负责列表、筛选与当前页面交互。</Text>
            </div>
            <Space wrap>
              <Tag color={isBound ? 'success' : 'warning'}>{isBound ? '数据源已配置' : '数据源待配置'}</Tag>
              <Tag>{rows.length} 条记录</Tag>
            </Space>
          </div>

          {!isBound ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="页面数据尚未配置"
              description="请先完成应用与表单绑定，并接入真实业务数据。"
            />
          ) : null}

          {notice ? (
            <Alert
              type={notice.type}
              showIcon
              closable
              style={{ marginBottom: 12 }}
              message={notice.message}
              onClose={() => setNotice(null)}
            />
          ) : null}

          <div className="oys-toolbar">
            <Space wrap>
              <Button type="primary" icon={<Plus size={15} />} onClick={openSubmission}>
                新增事项
              </Button>
              <Button icon={<RefreshCw size={15} />} onClick={refreshData}>
                刷新列表
              </Button>
            </Space>
            <Text type="secondary">详情入口缺少 formInstId 时保持禁用，不打开空白详情页。</Text>
          </div>

          <div className="oys-table-panel">
            {rows.length ? (
              <Table
                rowKey={(row) => row._rowKey}
                columns={columns}
                dataSource={rows}
                pagination={false}
                scroll={{ x: 920 }}
              />
            ) : (
              <div className="oys-empty">
                <Empty description="暂无记录，请先新增一条表单数据或接入 searchFormDatas。" />
              </div>
            )}
          </div>

          {formOpenContainer}
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
