/**
 * OpenYida Code Canvas 表单入口脚手架。
 *
 * 使用方式：
 * openyida sample openyida-scaffold canvas-form-drawer --output project/pages/src/customer-entry.canvas.jsx --var APP_TYPE=APP_XXX --var FORM_UUID=FORM_XXX
 *
 * 关键约定：
 * - PC 端新增和详情使用 FormOpenContainer 右侧抽屉 iframe。
 * - 移动端才整页进入原生提交页或详情页。
 * - 详情页必须先解析真实 formInstId，缺少实例 ID 时禁用入口。
 * - 预览行不携带伪造 formInstId，接入 searchFormDatas 真实 rows 后才启用详情。
 * - 提交页和详情页由新版主题运行时自行加载应用级自定义主题 CSS。
 */

import React, { useMemo, useState } from 'react';
import { Alert, Button, ConfigProvider, Drawer, Empty, Space, Table, Tag, Typography } from 'antd';
import { Eye, Plus, RefreshCw } from 'lucide-react';

const { Text, Title } = Typography;

const RAW_APP_TYPE = '{{APP_TYPE}}';
const RAW_FORM_UUID = '{{FORM_UUID}}';
const FORM_OPEN_DRAWER_WIDTH = '50vw';

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

function readThemeColor(name, fallback) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
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

function FormOpenContainer({ request, currentAppType, onClose, onAfterClose }) {
  const iframeSrc = useMemo(
    () => buildYidaFormUrl(request, currentAppType),
    [request, currentAppType]
  );

  return (
    <Drawer
      title={request && request.title ? request.title : '表单'}
      open={!!request}
      width={FORM_OPEN_DRAWER_WIDTH}
      destroyOnClose
      bodyStyle={{ padding: 0, overflow: 'hidden' }}
      onClose={() => {
        onClose();
        if (typeof onAfterClose === 'function') onAfterClose();
      }}
    >
      {iframeSrc ? (
        <iframe
          title={request && request.title ? request.title : '表单'}
          src={iframeSrc}
          style={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 56px)', border: 0, display: 'block' }}
        />
      ) : null}
    </Drawer>
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
              <Tag color={isBound ? 'success' : 'warning'}>{isBound ? '已绑定真实表单' : '脚手架预览'}</Tag>
              <Tag>{rows.length} 条记录</Tag>
            </Space>
          </div>

          {!isBound ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="当前仍是脚手架占位资源"
              description="请通过 --var APP_TYPE=... --var FORM_UUID=... 替换模板变量，或在运行时 props 中传入 appType、formUuid 和 rows。"
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
