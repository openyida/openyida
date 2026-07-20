/**
 * Code Canvas operations cockpit starter
 * Recommended stack: antd + recharts + ahooks
 *
 * Local preflight:
 * node -e "const fs=require('fs'); const {compileCanvasLocal}=require('./lib/app/canvas-compile'); const src=fs.readFileSync('project/pages/src/dashboard-starter.canvas.jsx','utf8'); console.log(compileCanvasLocal(src).importedModules)"
 */

import React, { useMemo, useState } from 'react';
import { ConfigProvider, Button, Segmented, Tag, Typography } from 'antd';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMemoizedFn } from 'ahooks';

const { Text, Title } = Typography;

const SAMPLE_THEME = {
  name: 'citrus-ops-cockpit',
  brand: '#13A779',
  brandDeep: '#087A61',
  brandSoft: '#ECFBF4',
  amber: '#F5A524',
  coral: '#F06449',
  sky: '#3A8DFF',
  violet: '#7C6CF2',
  ink: '#20362E',
  muted: '#6B7E75',
  line: '#D7E9DE',
  panel: '#FFFFFF',
};

const trendData = [
  { hour: '08', done: 86, risk: 14, target: 82 },
  { hour: '10', done: 114, risk: 18, target: 96 },
  { hour: '12', done: 128, risk: 16, target: 118 },
  { hour: '14', done: 156, risk: 22, target: 138 },
  { hour: '16', done: 184, risk: 19, target: 166 },
  { hour: '18', done: 203, risk: 17, target: 188 },
  { hour: '20', done: 232, risk: 13, target: 212 },
];

const channelData = [
  { name: '直营', value: 46, color: SAMPLE_THEME.brand },
  { name: '渠道', value: 28, color: SAMPLE_THEME.sky },
  { name: '线上', value: 18, color: SAMPLE_THEME.amber },
  { name: '伙伴', value: 8, color: SAMPLE_THEME.violet },
];

const stageData = [
  { name: '受理', value: 96 },
  { name: '分派', value: 82 },
  { name: '处理中', value: 68 },
  { name: '完成', value: 61 },
];

const events = [
  { time: '09:42', title: '华东渠道补货完成分派', detail: '预计 16:00 前回传签收结果。', tone: 'good' },
  { time: '10:18', title: '西南库存低于安全线', detail: '3 个门店低于 2 日库存，建议优先补货。', tone: 'warn' },
  { time: '11:05', title: '重点客户回访进入 SLA', detail: '剩余 2.4 小时，客服组已接单。', tone: 'focus' },
];

const risks = [
  { label: '库存异常', value: '3 单', level: '高', color: SAMPLE_THEME.coral },
  { label: '超时待办', value: '12 件', level: '中', color: SAMPLE_THEME.amber },
  { label: '回访积压', value: '24 人', level: '低', color: SAMPLE_THEME.sky },
];

function Icon({ name, size, color }) {
  const common = {
    width: size || 16,
    height: size || 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color || 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'block' },
  };

  if (name === 'refresh') {
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 0 1-15.3 6.4" />
        <path d="M3 12A9 9 0 0 1 18.3 5.6" />
        <path d="M18 2v4h-4" />
        <path d="M6 22v-4h4" />
      </svg>
    );
  }
  if (name === 'pulse') {
    return (
      <svg {...common}>
        <path d="M4 12h4l2-6 4 12 2-6h4" />
      </svg>
    );
  }
  if (name === 'spark') {
    return (
      <svg {...common}>
        <path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 17l5-5 4 4 7-9" />
      <path d="M15 7h5v5" />
    </svg>
  );
}

function formatSigned(value) {
  return (value > 0 ? '+' : '') + value + '% 环比';
}

function MetricCard({ item, index }) {
  return (
    <div className="oy-metric-card" style={{ '--metric-color': item.color }}>
      <div className="oy-metric-top">
        <span>{item.label}</span>
        <Tag color={item.delta > 0 ? 'success' : 'warning'}>{formatSigned(item.delta)}</Tag>
      </div>
      <div className="oy-metric-value">{item.value}</div>
      <div className="oy-mini-bars" aria-hidden="true">
        {[28, 42, 36, 54, 48, 68, 61, 76].map((height, barIndex) => (
          <i key={barIndex} style={{ height: height - index * 3 }} />
        ))}
      </div>
    </div>
  );
}

const RISK_LEVEL_TAG_COLOR = { '高': 'error', '中': 'warning', '低': 'processing' };

function YidaComp() {
  const [range, setRange] = useState('今日');
  const [updatedAt, setUpdatedAt] = useState('09:30');

  const refresh = useMemoizedFn(() => {
    const now = new Date();
    setUpdatedAt(String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
  });

  const metrics = useMemo(() => [
    { label: '今日处理', value: '2,326', delta: 12, color: SAMPLE_THEME.brand },
    { label: '准时履约', value: '94.8%', delta: 6, color: SAMPLE_THEME.sky },
    { label: '风险待清', value: '17', delta: -4, color: SAMPLE_THEME.coral },
    { label: '人效指数', value: '86.2', delta: 8, color: SAMPLE_THEME.violet },
  ], []);

  const HEALTH_SCORE_MAP = { '今日': '87.4', '本周': '91.2', '本月': '88.6' };
  const healthScore = HEALTH_SCORE_MAP[range] || '87.4';

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: SAMPLE_THEME.brand,
          borderRadius: 8,
          colorText: SAMPLE_THEME.ink,
        },
      }}
    >
      <div className="oy-ops-cockpit">
        <style>{`
          .oy-ops-cockpit {
            --oy-brand: ${SAMPLE_THEME.brand};
            --oy-brand-deep: ${SAMPLE_THEME.brandDeep};
            --oy-brand-soft: ${SAMPLE_THEME.brandSoft};
            --oy-amber: ${SAMPLE_THEME.amber};
            --oy-coral: ${SAMPLE_THEME.coral};
            --oy-sky: ${SAMPLE_THEME.sky};
            --oy-violet: ${SAMPLE_THEME.violet};
            --oy-ink: ${SAMPLE_THEME.ink};
            --oy-muted: ${SAMPLE_THEME.muted};
            --oy-line: ${SAMPLE_THEME.line};
            min-height: 100vh;
            padding: 24px;
            color: var(--oy-ink);
            background:
              linear-gradient(135deg, #F3FAF0 0%, #F8FBF5 42%, #FFF7EA 100%);
            font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
            letter-spacing: 0;
          }
          .oy-shell { max-width: 1320px; margin: 0 auto; }
          .oy-topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
          .oy-title-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
          .oy-mark { width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, var(--oy-brand), #6FD6A7); box-shadow: 0 16px 34px rgba(19,167,121,.18); }
          .oy-page-title { margin: 0 !important; font-size: 24px !important; line-height: 32px !important; }
          .oy-page-subtitle { color: var(--oy-muted); }
          .oy-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
          .oy-status-pill { height: 32px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border: 1px solid #CDEBDD; border-radius: 999px; background: rgba(255,255,255,.72); color: var(--oy-brand-deep); font-weight: 700; }
          .oy-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--oy-brand); box-shadow: 0 0 0 4px rgba(19,167,121,.12); }
          .oy-grid { display: grid; grid-template-columns: 290px minmax(0, 1fr) 320px; gap: 14px; align-items: stretch; }
          .oy-panel { border: 1px solid var(--oy-line); border-radius: 18px; background: rgba(255,255,255,.82); box-shadow: 0 18px 48px rgba(69,112,89,.10); backdrop-filter: blur(12px); }
          .oy-side { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
          .oy-health { padding: 20px; border-radius: 16px; color: var(--oy-ink); background: linear-gradient(145deg, #FFFFFF, #EAFBF2); border: 1px solid #CFECDD; position: relative; overflow: hidden; }
          .oy-health:after { content: ""; position: absolute; right: -52px; bottom: -68px; width: 190px; height: 190px; border-radius: 50%; background: rgba(19,167,121,.12); }
          .oy-health-label { color: var(--oy-muted); font-weight: 700; }
          .oy-health-value { margin-top: 8px; font-size: 58px; line-height: 1; font-weight: 850; font-variant-numeric: tabular-nums; }
          .oy-health-note { margin-top: 10px; color: var(--oy-brand-deep); line-height: 20px; position: relative; z-index: 1; }
          .oy-metric-card { padding: 14px; border: 1px solid #DDEFE5; border-left: 4px solid var(--metric-color); border-radius: 14px; background: rgba(255,255,255,.82); }
          .oy-metric-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--oy-muted); font-size: 12px; font-weight: 700; }
          .oy-metric-value { margin-top: 8px; font-size: 28px; line-height: 34px; font-weight: 850; font-variant-numeric: tabular-nums; color: var(--metric-color); }
          .oy-mini-bars { height: 38px; display: flex; align-items: end; gap: 4px; margin-top: 8px; }
          .oy-mini-bars i { flex: 1; min-width: 3px; border-radius: 999px 999px 0 0; background: var(--metric-color); opacity: .68; }
          .oy-main { padding: 18px; display: grid; grid-template-rows: auto 1fr auto; gap: 14px; min-height: 680px; }
          .oy-main-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
          .oy-section-title { margin: 0 !important; font-size: 18px !important; line-height: 26px !important; }
          .oy-insight { margin-top: 6px; color: var(--oy-muted); line-height: 22px; }
          .oy-chart-card { min-height: 330px; padding: 16px; border-radius: 16px; border: 1px solid #DCEEDF; background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(248,253,248,.82)); }
          .oy-chart-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .oy-bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
          .oy-small-panel { padding: 16px; border-radius: 16px; border: 1px solid #DCEEDF; background: rgba(255,255,255,.72); min-height: 230px; }
          .oy-right { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
          .oy-risk-card { padding: 14px; border-radius: 14px; border: 1px solid #F0E4D4; border-left: 4px solid var(--risk-color); background: #FFFFFF; }
          .oy-risk-top { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
          .oy-risk-title { font-weight: 800; color: var(--oy-ink); }
          .oy-risk-value { margin-top: 8px; font-size: 24px; font-weight: 850; color: var(--risk-color); font-variant-numeric: tabular-nums; }
          .oy-event { display: grid; grid-template-columns: 52px 1fr; gap: 12px; padding: 13px 0; border-top: 1px solid #E3EFE7; }
          .oy-event:first-of-type { border-top: 0; }
          .oy-event-time { color: var(--oy-brand-deep); font-weight: 800; font-variant-numeric: tabular-nums; }
          .oy-event-title { font-weight: 800; color: var(--oy-ink); }
          .oy-event-detail { margin-top: 3px; color: var(--oy-muted); line-height: 20px; font-size: 12px; }
          .oy-stage-row { display: grid; grid-template-columns: 62px 1fr 42px; align-items: center; gap: 10px; margin-top: 14px; }
          .oy-stage-name { color: var(--oy-muted); font-weight: 700; }
          .oy-stage-track { height: 9px; border-radius: 999px; background: #E8F2EA; overflow: hidden; }
          .oy-stage-bar { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--oy-brand), #8BD98B); }
          .oy-stage-value { text-align: right; color: var(--oy-ink); font-weight: 800; font-variant-numeric: tabular-nums; }
          .oy-pie-wrap { height: 178px; }
          .recharts-tooltip-wrapper { outline: none; }
          @media (max-width: 1080px) {
            .oy-grid { grid-template-columns: 1fr; }
            .oy-main { min-height: auto; }
          }
          @media (max-width: 720px) {
            .oy-ops-cockpit { padding: 16px; }
            .oy-topbar, .oy-main-head { flex-direction: column; align-items: stretch; }
            .oy-bottom-grid { grid-template-columns: 1fr; }
            .oy-health-value { font-size: 44px; }
          }
        `}</style>

        <div className="oy-shell">
          <div className="oy-topbar">
            <div className="oy-title-row">
              <div className="oy-mark"><Icon name="pulse" size={20} /></div>
              <div>
                <Title level={3} className="oy-page-title">运营驾驶舱</Title>
                <Text className="oy-page-subtitle">订单、履约、风险与人效的一屏式运营总控</Text>
              </div>
            </div>
            <div className="oy-actions">
              <span className="oy-status-pill"><i className="oy-dot" /> 数据在线 · {updatedAt}</span>
              <Segmented value={range} onChange={setRange} options={['今日', '本周', '本月']} />
              <Button type="primary" icon={<Icon name="refresh" size={16} />} onClick={refresh}>刷新</Button>
            </div>
          </div>

          <div className="oy-grid">
            <aside className="oy-panel oy-side">
              <div className="oy-health">
                <div className="oy-health-label">运营健康度</div>
                <div className="oy-health-value">{healthScore}</div>
                <div className="oy-health-note">履约速度高于目标线 9.4%，风险事项集中在库存与回访两类。</div>
              </div>
              {metrics.map((item, index) => <MetricCard key={item.label} item={item} index={index} />)}
            </aside>

            <main className="oy-panel oy-main">
              <div className="oy-main-head">
                <div>
                  <Title level={4} className="oy-section-title">实时处理趋势</Title>
                  <div className="oy-insight">20:00 处理量达到 232 单，持续高于目标线；风险量从午后高点回落到 13 单。</div>
                </div>
                <Tag color="success">高于目标</Tag>
              </div>

              <div className="oy-chart-card">
                <div className="oy-chart-title">
                  <Text strong>处理量 / 风险量 / 目标线</Text>
                  <Text type="secondary">单位：单</Text>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="doneGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SAMPLE_THEME.brand} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={SAMPLE_THEME.brand} stopOpacity={0.04} />
                      </linearGradient>
                      <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SAMPLE_THEME.coral} stopOpacity={0.24} />
                        <stop offset="100%" stopColor={SAMPLE_THEME.coral} stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#DCEBDF" strokeDasharray="4 6" vertical={false} />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="done" name="处理量" stroke={SAMPLE_THEME.brand} strokeWidth={3} fill="url(#doneGradient)" />
                    <Area type="monotone" dataKey="risk" name="风险量" stroke={SAMPLE_THEME.coral} strokeWidth={2} fill="url(#riskGradient)" />
                    <Area type="monotone" dataKey="target" name="目标线" stroke={SAMPLE_THEME.amber} strokeWidth={2} fill="transparent" strokeDasharray="6 6" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="oy-bottom-grid">
                <div className="oy-small-panel">
                  <div className="oy-chart-title">
                    <Text strong>渠道结构</Text>
                    <Text type="secondary">直营贡献 46%</Text>
                  </div>
                  <div className="oy-pie-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={78} paddingAngle={4}>
                          {channelData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="oy-small-panel">
                  <div className="oy-chart-title">
                    <Text strong>履约漏斗</Text>
                    <Text type="secondary">完成率 61%</Text>
                  </div>
                  {stageData.map((item) => (
                    <div className="oy-stage-row" key={item.name}>
                      <span className="oy-stage-name">{item.name}</span>
                      <span className="oy-stage-track"><i className="oy-stage-bar" style={{ width: item.value + '%' }} /></span>
                      <span className="oy-stage-value">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </main>

            <aside className="oy-panel oy-right">
              <div>
                <Title level={4} className="oy-section-title">风险雷达</Title>
                <div className="oy-insight">红色只留给需要立即处理的异常，避免满屏告警疲劳。</div>
              </div>
              {risks.map((item) => (
                <div className="oy-risk-card" style={{ '--risk-color': item.color }} key={item.label}>
                  <div className="oy-risk-top">
                    <span className="oy-risk-title">{item.label}</span>
                    <Tag color={RISK_LEVEL_TAG_COLOR[item.level] || 'processing'}>{item.level}</Tag>
                  </div>
                  <div className="oy-risk-value">{item.value}</div>
                </div>
              ))}

              <div className="oy-small-panel">
                <div className="oy-chart-title">
                  <Text strong>实时事件流</Text>
                  <Icon name="spark" size={16} color={SAMPLE_THEME.amber} />
                </div>
                {events.map((event) => (
                  <div className="oy-event" key={event.title}>
                    <span className="oy-event-time">{event.time}</span>
                    <div>
                      <div className="oy-event-title">{event.title}</div>
                      <div className="oy-event-detail">{event.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}

export default YidaComp;
