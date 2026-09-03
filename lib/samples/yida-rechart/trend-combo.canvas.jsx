/**
 * Code Canvas + Recharts 已聚合趋势组合图样例。
 *
 * 数据契约：
 * - props.aggregatedRows: 已由原生报表或聚合接口产出的时间序列。
 * - 页面只切换展示窗口，不拉取全量明细做前端聚合。
 * - 未传入 aggregatedRows 时显示带标识的 sample/seed 数据。
 */

import React, { useMemo, useState } from 'react';
import { Alert, ConfigProvider, Segmented, Space, Tag, Typography } from 'antd';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const { Text, Title } = Typography;

const SAMPLE_ROWS = [
  { label: '07-17', revenue: 42, orders: 128, target: 45 },
  { label: '07-18', revenue: 48, orders: 146, target: 46 },
  { label: '07-19', revenue: 45, orders: 139, target: 47 },
  { label: '07-20', revenue: 53, orders: 161, target: 49 },
  { label: '07-21', revenue: 58, orders: 176, target: 51 },
  { label: '07-22', revenue: 56, orders: 168, target: 52 },
  { label: '07-23', revenue: 63, orders: 192, target: 54 },
  { label: '07-24', revenue: 68, orders: 204, target: 57 },
  { label: '07-25', revenue: 66, orders: 198, target: 59 },
  { label: '07-26', revenue: 74, orders: 223, target: 62 },
  { label: '07-27', revenue: 79, orders: 237, target: 65 },
  { label: '07-28', revenue: 83, orders: 249, target: 68 },
];

const THEME = {
  brand: '#2563EB',
  brandSoft: '#DBEAFE',
  cyan: '#0891B2',
  amber: '#D97706',
  ink: '#172033',
  muted: '#667085',
  line: '#E4EAF2',
  panel: '#FFFFFF',
  canvas: '#F5F8FC',
};

function normalizeAggregatedRows(rows) {
  return rows
    .filter((row) => row && row.label !== undefined)
    .map((row) => ({
      label: String(row.label),
      revenue: Number(row.revenue) || 0,
      orders: Number(row.orders) || 0,
      target: Number(row.target) || 0,
    }));
}

function MetricCard({ label, value, note, tone }) {
  return (
    <div className="rechart-metric">
      <Text className="rechart-metric-label">{label}</Text>
      <div className="rechart-metric-value" style={{ color: tone }}>{value}</div>
      <Text type="secondary">{note}</Text>
    </div>
  );
}

function YidaComp(props) {
  const [windowSize, setWindowSize] = useState(7);
  const hasRealRows = Boolean(props && Array.isArray(props.aggregatedRows) && props.aggregatedRows.length);
  const rows = useMemo(
    () => normalizeAggregatedRows(hasRealRows ? props.aggregatedRows : SAMPLE_ROWS),
    [hasRealRows, props && props.aggregatedRows]
  );
  const visibleRows = useMemo(() => rows.slice(-windowSize), [rows, windowSize]);
  const latest = visibleRows.length ? visibleRows[visibleRows.length - 1] : null;
  const previous = visibleRows.length > 1 ? visibleRows[visibleRows.length - 2] : null;
  const revenueDelta = latest && previous ? latest.revenue - previous.revenue : 0;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: THEME.brand,
          colorText: THEME.ink,
          colorBgLayout: THEME.canvas,
          borderRadius: 10,
        },
      }}
    >
      <style>{`
        .rechart-page {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 28px;
          background:
            radial-gradient(circle at 92% 4%, rgba(37, 99, 235, .12), transparent 30%),
            var(--pod-page-bg-color, ${THEME.canvas});
          color: ${THEME.ink};
        }
        .rechart-shell { max-width: 1240px; margin: 0 auto; }
        .rechart-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
        }
        .rechart-title.ant-typography { margin: 0 0 6px; color: ${THEME.ink}; }
        .rechart-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin: 18px 0;
        }
        .rechart-metric, .rechart-panel {
          border: 1px solid ${THEME.line};
          border-radius: 16px;
          background: ${THEME.panel};
          box-shadow: 0 12px 34px rgba(37, 56, 88, .07);
        }
        .rechart-metric { padding: 18px 20px; }
        .rechart-metric-label { display: block; color: ${THEME.muted}; }
        .rechart-metric-value {
          margin: 8px 0 4px;
          font-size: 30px;
          font-weight: 760;
          letter-spacing: -.03em;
        }
        .rechart-panel { padding: 22px 20px 16px; }
        .rechart-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .rechart-chart { width: 100%; height: 390px; }
        .rechart-empty {
          display: grid;
          min-height: 320px;
          place-items: center;
          color: ${THEME.muted};
        }
        @media (max-width: 760px) {
          .rechart-page { padding: 18px 12px; }
          .rechart-header, .rechart-panel-head { align-items: stretch; flex-direction: column; }
          .rechart-grid { grid-template-columns: 1fr; }
          .rechart-chart { height: 330px; }
        }
      `}</style>

      <div className="rechart-page">
        <div className="rechart-shell">
          <div className="rechart-header">
            <div>
              <Title level={2} className="rechart-title">业务增长趋势</Title>
              <Text type="secondary">展示服务端已聚合的收入、订单量与目标线</Text>
            </div>
            <Space wrap>
              <Tag color={hasRealRows ? 'success' : 'warning'}>
                {hasRealRows ? '已接聚合数据' : 'sample/seed 聚合数据'}
              </Tag>
              <Segmented
                value={windowSize}
                onChange={setWindowSize}
                options={[
                  { label: '近 7 期', value: 7 },
                  { label: '近 12 期', value: 12 },
                ]}
              />
            </Space>
          </div>

          {!hasRealRows ? (
            <Alert
              type="warning"
              showIcon
              message="当前为 sample/seed 预览，未接真实原生报表或聚合接口。"
            />
          ) : null}

          <div className="rechart-grid">
            <MetricCard
              label="最新收入"
              value={latest ? latest.revenue + ' 万元' : '--'}
              note={revenueDelta >= 0 ? '较上期增加 ' + revenueDelta + ' 万元' : '较上期减少 ' + Math.abs(revenueDelta) + ' 万元'}
              tone={THEME.brand}
            />
            <MetricCard
              label="最新订单"
              value={latest ? latest.orders + ' 单' : '--'}
              note="来自已聚合时间序列"
              tone={THEME.cyan}
            />
            <MetricCard
              label="目标差值"
              value={latest ? (latest.revenue - latest.target) + ' 万元' : '--'}
              note="页面不拉明细计算统计口径"
              tone={THEME.amber}
            />
          </div>

          <div className="rechart-panel">
            <div className="rechart-panel-head">
              <div>
                <Text strong>收入与订单组合趋势</Text>
                <br />
                <Text type="secondary">柱线组合基于同一组已聚合时间点</Text>
              </div>
              <Tag color="blue">{visibleRows.length} 个时间点</Tag>
            </div>

            {visibleRows.length ? (
              <div className="rechart-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={visibleRows} margin={{ top: 8, right: 10, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.brand} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={THEME.brand} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={THEME.line} strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: THEME.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="money" tick={{ fill: THEME.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="orders" orientation="right" tick={{ fill: THEME.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Area yAxisId="money" type="monotone" dataKey="revenue" name="收入（万元）" stroke={THEME.brand} fill="url(#revenueFill)" strokeWidth={2.5} />
                    <Bar yAxisId="orders" dataKey="orders" name="订单量" fill={THEME.cyan} radius={[5, 5, 0, 0]} barSize={18} />
                    <Line yAxisId="money" type="monotone" dataKey="target" name="目标（万元）" stroke={THEME.amber} strokeWidth={2} strokeDasharray="6 4" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rechart-empty">暂无已聚合数据，请检查报表或聚合接口。</div>
            )}
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
