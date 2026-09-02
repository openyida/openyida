/**
 * Code Canvas + antd 表格批量录入样例。
 *
 * 写入契约：
 * - props.writeBridge.verified === true
 * - props.writeBridge.saveRow(payload, context) 是已验证的数据写入函数
 * - props.fieldMap 提供真实 fieldId：name/status/dueDate/quantity
 *
 * 未提供上述契约时，页面只支持本地草稿与校验，提交保持禁用。
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  ConfigProvider,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const BATCH_SIZE = 10;
const STATUS_OPTIONS = [
  { label: '待处理', value: '待处理' },
  { label: '进行中', value: '进行中' },
  { label: '已完成', value: '已完成' },
];

function createRow(seed) {
  return {
    _rowId: 'row_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    _status: 'draft',
    _errors: {},
    _submitError: '',
    name: '',
    status: '待处理',
    dueDate: '',
    quantity: 1,
    ...(seed || {}),
  };
}

function loadDraft(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) && value.length
      ? value.map((item) => {
          const base = createRow();
          return {
            ...base,
            ...(item || {}),
            _rowId: item && item._rowId ? item._rowId : base._rowId,
            _errors: item && item._errors ? item._errors : {},
            _submitError: item && item._submitError ? item._submitError : '',
          };
        })
      : [createRow()];
  } catch (error) {
    return [createRow()];
  }
}

function validateRow(row) {
  const errors = {};
  if (!String(row.name || '').trim()) errors.name = '请输入事项名称';
  if (!row.status) errors.status = '请选择状态';
  if (!row.dueDate) errors.dueDate = '请选择计划日期';
  if (!Number.isFinite(Number(row.quantity)) || Number(row.quantity) < 1) {
    errors.quantity = '数量必须大于 0';
  }
  return errors;
}

function isFieldMapReady(fieldMap) {
  return Boolean(
    fieldMap &&
    fieldMap.name &&
    fieldMap.status &&
    fieldMap.dueDate &&
    fieldMap.quantity
  );
}

function readThemeColor(name, fallback) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return fallback;
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function toPayload(row, fieldMap) {
  return {
    [fieldMap.name]: String(row.name).trim(),
    [fieldMap.status]: row.status,
    [fieldMap.dueDate]: row.dueDate,
    [fieldMap.quantity]: Number(row.quantity),
  };
}

function getBridgeState(props) {
  const writeBridge = props && props.writeBridge;
  const fieldMap = props && props.fieldMap;
  if (!writeBridge || writeBridge.verified !== true || typeof writeBridge.saveRow !== 'function') {
    return { ready: false, reason: '未注入已验证的同源 fetch、连接器或数据写入桥。' };
  }
  if (!isFieldMapReady(fieldMap)) {
    return { ready: false, reason: '未提供由真实 Schema 解析出的 fieldMap。' };
  }
  return { ready: true, reason: '', writeBridge, fieldMap };
}

function YidaComp(props) {
  const formUuid = props && props.formUuid ? props.formUuid : 'sample-unbound';
  const draftKey = 'openyida_canvas_table_form_draft_' + formUuid;
  const [rows, setRows] = useState(() => loadDraft(draftKey));
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState(null);
  const bridgeState = useMemo(
    () => getBridgeState(props),
    [props && props.writeBridge, props && props.fieldMap]
  );

  useEffect(() => {
    try {
      const editableRows = rows.filter((row) => row._status !== 'submitted');
      if (editableRows.length) {
        localStorage.setItem(draftKey, JSON.stringify(rows));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch (error) {
      // localStorage 不可用时仍保留当前页面内状态。
    }
  }, [draftKey, rows]);

  function updateCell(rowId, field, value) {
    setRows((current) => current.map((row) => {
      if (row._rowId !== rowId || row._status === 'submitted' || row._status === 'submitting') {
        return row;
      }
      const nextErrors = { ...(row._errors || {}) };
      delete nextErrors[field];
      return {
        ...row,
        [field]: value,
        _status: 'draft',
        _errors: nextErrors,
        _submitError: '',
      };
    }));
    setSummary(null);
  }

  function addRow() {
    setRows((current) => [...current, createRow()]);
  }

  function addDemoRows() {
    setRows((current) => [
      ...current.filter((row) => String(row.name || '').trim()),
      createRow({ name: '华东门店补货确认', status: '待处理', dueDate: '2026-07-30', quantity: 12 }),
      createRow({ name: '重点客户回访', status: '进行中', dueDate: '2026-07-31', quantity: 6 }),
      createRow({ name: '月末库存复核', status: '待处理', dueDate: '2026-08-01', quantity: 18 }),
    ]);
  }

  function removeRow(rowId) {
    setRows((current) => {
      const next = current.filter((row) => row._rowId !== rowId || row._status === 'submitted');
      return next.length ? next : [createRow()];
    });
  }

  async function performSubmit(candidates) {
    setSubmitting(true);
    setSummary(null);
    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < candidates.length; index += BATCH_SIZE) {
      const batch = candidates.slice(index, index + BATCH_SIZE);
      const batchIds = new Set(batch.map((row) => row._rowId));
      setRows((current) => current.map((row) => (
        batchIds.has(row._rowId)
          ? { ...row, _status: 'submitting', _submitError: '' }
          : row
      )));

      const results = await Promise.all(batch.map(async (row) => {
        try {
          const value = await bridgeState.writeBridge.saveRow(
            toPayload(row, bridgeState.fieldMap),
            {
              rowId: row._rowId,
              idempotencyKey: 'canvas-table:' + formUuid + ':' + row._rowId,
            }
          );
          if (!value || (value.success !== true && !value.formInstId)) {
            throw new Error('数据桥未返回可确认写入成功的 success 或 formInstId。');
          }
          return { rowId: row._rowId, ok: true, value };
        } catch (error) {
          return {
            rowId: row._rowId,
            ok: false,
            error: error && error.message ? error.message : '提交失败，请检查数据桥返回值。',
          };
        }
      }));

      successCount += results.filter((result) => result.ok).length;
      failureCount += results.filter((result) => !result.ok).length;
      const resultMap = new Map(results.map((result) => [result.rowId, result]));
      setRows((current) => current.map((row) => {
        const result = resultMap.get(row._rowId);
        if (!result) return row;
        return result.ok
          ? {
              ...row,
              _status: 'submitted',
              _errors: {},
              _submitError: '',
              _formInstId: result.value && result.value.formInstId,
            }
          : {
              ...row,
              _status: 'failed',
              _submitError: result.error,
            };
      }));
    }

    setSummary({ successCount, failureCount });
    setSubmitting(false);
  }

  function confirmSubmit() {
    if (!bridgeState.ready) return;

    const candidates = rows.filter((row) => row._status !== 'submitted');
    const validated = candidates.map((row) => {
      const errors = validateRow(row);
      return {
        ...row,
        _errors: errors,
        _status: Object.keys(errors).length ? 'invalid' : 'draft',
      };
    });
    const validatedMap = new Map(validated.map((row) => [row._rowId, row]));
    setRows((current) => current.map((row) => validatedMap.get(row._rowId) || row));

    const invalidCount = validated.filter((row) => Object.keys(row._errors).length).length;
    if (invalidCount) {
      setSummary({ successCount: 0, failureCount: invalidCount, validationOnly: true });
      return;
    }
    if (!validated.length) return;

    Modal.confirm({
      title: '确认批量提交',
      content: '将提交 ' + validated.length + ' 行数据，首行事项为“' + validated[0].name + '”。提交后成功行不会重复写入。',
      okText: '确认提交',
      cancelText: '返回检查',
      onOk: () => performSubmit(validated),
    });
  }

  const statusTag = {
    draft: ['default', '草稿'],
    invalid: ['error', '待修正'],
    submitting: ['processing', '提交中'],
    submitted: ['success', '已提交'],
    failed: ['error', '提交失败'],
  };

  const columns = [
    {
      title: '事项名称',
      dataIndex: 'name',
      width: 250,
      render: (_, row) => (
        <div>
          <Input
            value={row.name}
            status={row._errors.name ? 'error' : ''}
            disabled={row._status === 'submitted' || row._status === 'submitting'}
            placeholder="请输入事项名称"
            onChange={(event) => updateCell(row._rowId, 'name', event.target.value)}
          />
          {row._errors.name ? <Text type="danger">{row._errors.name}</Text> : null}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 160,
      render: (_, row) => (
        <div>
          <Select
            value={row.status}
            status={row._errors.status ? 'error' : ''}
            disabled={row._status === 'submitted' || row._status === 'submitting'}
            options={STATUS_OPTIONS}
            style={{ width: '100%' }}
            onChange={(value) => updateCell(row._rowId, 'status', value)}
          />
          {row._errors.status ? <Text type="danger">{row._errors.status}</Text> : null}
        </div>
      ),
    },
    {
      title: '计划日期',
      dataIndex: 'dueDate',
      width: 180,
      render: (_, row) => (
        <div>
          <DatePicker
            value={row.dueDate ? dayjs(row.dueDate) : null}
            status={row._errors.dueDate ? 'error' : ''}
            disabled={row._status === 'submitted' || row._status === 'submitting'}
            style={{ width: '100%' }}
            onChange={(_, dateString) => updateCell(row._rowId, 'dueDate', dateString)}
          />
          {row._errors.dueDate ? <Text type="danger">{row._errors.dueDate}</Text> : null}
        </div>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 130,
      render: (_, row) => (
        <div>
          <InputNumber
            min={1}
            value={row.quantity}
            status={row._errors.quantity ? 'error' : ''}
            disabled={row._status === 'submitted' || row._status === 'submitting'}
            style={{ width: '100%' }}
            onChange={(value) => updateCell(row._rowId, 'quantity', value)}
          />
          {row._errors.quantity ? <Text type="danger">{row._errors.quantity}</Text> : null}
        </div>
      ),
    },
    {
      title: '行状态',
      dataIndex: '_status',
      width: 150,
      render: (_, row) => {
        const tag = statusTag[row._status] || statusTag.draft;
        return (
          <div>
            <Tag color={tag[0]}>{tag[1]}</Tag>
            {row._submitError ? <div className="canvas-table-error">{row._submitError}</div> : null}
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, row) => (
        <Button
          type="link"
          danger
          disabled={row._status === 'submitted' || row._status === 'submitting'}
          onClick={() => removeRow(row._rowId)}
        >
          删除
        </Button>
      ),
    },
  ];

  const pendingCount = rows.filter((row) => row._status !== 'submitted').length;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: readThemeColor('--color-brand1-6', '#1677FF'),
          colorInfo: readThemeColor('--color-brand1-6', '#1677FF'),
          borderRadius: 9,
          colorText: readThemeColor('--color-text1-4', '#1F2329'),
          colorBgLayout: readThemeColor('--color-fill1-1', '#F5F6F7'),
        },
      }}
    >
      <style>{`
        .canvas-table-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px;
          background: var(--pod-page-bg-color, var(--color-white, #fff));
        }
        .canvas-table-shell { max-width: 1320px; margin: 0 auto; }
        .canvas-table-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }
        .canvas-table-title.ant-typography { margin: 0 0 6px; }
        .canvas-table-panel {
          overflow: hidden;
          border: var(--pod-card-border, none);
          border-radius: var(--pod-card-border-radius, 20px);
          background: var(--pod-card-bg-color, var(--color-white, #fff));
        }
        .canvas-table-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--color-line1-2, rgba(31, 35, 41, .12));
        }
        .canvas-table-body { padding: 0 18px 18px; }
        .canvas-table-error { margin-top: 4px; color: #C2413B; font-size: 12px; line-height: 1.35; }
        .canvas-table-summary { margin-top: 14px; }
        .canvas-table-page .ant-table-cell { vertical-align: top; }
        @media (max-width: 760px) {
          .canvas-table-page { padding: 16px 10px; }
          .canvas-table-header, .canvas-table-toolbar { align-items: stretch; flex-direction: column; }
        }
      `}</style>

      <div className="canvas-table-page">
        <div className="canvas-table-shell">
          <div className="canvas-table-header">
            <div>
              <Title level={2} className="canvas-table-title">批量事项录入</Title>
              <Text type="secondary">草稿保存在当前浏览器；每批最多并发提交 {BATCH_SIZE} 行。</Text>
            </div>
            <Space wrap>
              <Tag color={bridgeState.ready ? 'success' : 'warning'}>
                {bridgeState.ready ? '写入桥已验证' : '写入桥未闭环'}
              </Tag>
              <Tag>{pendingCount} 行待处理</Tag>
            </Space>
          </div>

          {!bridgeState.ready ? (
            <Alert
              type="warning"
              showIcon
              message="当前仅支持本地草稿与校验"
              description={bridgeState.reason + ' 未验证前不会模拟提交成功。'}
              style={{ marginBottom: 16 }}
            />
          ) : null}

          <div className="canvas-table-panel">
            <div className="canvas-table-toolbar">
              <Space wrap>
                <Button onClick={addRow}>添加一行</Button>
                <Button onClick={addDemoRows}>载入示例行</Button>
              </Space>
              <Button
                type="primary"
                loading={submitting}
                disabled={!bridgeState.ready || submitting || pendingCount === 0}
                onClick={confirmSubmit}
              >
                校验并批量提交
              </Button>
            </div>

            <div className="canvas-table-body">
              <Table
                rowKey="_rowId"
                columns={columns}
                dataSource={rows}
                pagination={false}
                scroll={{ x: 1080 }}
                rowClassName={(row) => 'canvas-table-row-' + row._status}
              />

              {summary ? (
                <Alert
                  className="canvas-table-summary"
                  type={summary.failureCount ? 'warning' : 'success'}
                  showIcon
                  message={
                    summary.validationOnly
                      ? '有 ' + summary.failureCount + ' 行未通过校验，请逐行修正。'
                      : '提交完成：成功 ' + summary.successCount + ' 行，失败 ' + summary.failureCount + ' 行。'
                  }
                  description={
                    summary.failureCount
                      ? '失败行已保留，可修正后仅重试未成功的行。'
                      : '全部成功后本地草稿已清除。'
                  }
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
