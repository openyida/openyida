import React from 'react';

const SAMPLE_ROWS = [
  { category: '配件', sales: 82400 },
  { category: '办公设备', sales: 61500 },
  { category: '耗材', sales: 43900 },
];

const DEFAULT_FIELDS = { dimension: 'category', metric: 'sales' };
const currencyFormat = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
});

/**
 * Renders ranked rows from an aggregate query. The caller owns the query and
 * supplies rows in display order. The optional selection callback gets the raw
 * dimension value, which the caller can use as a filter or drill-down input.
 */
function AnalysisCard({ aggregatedRows, fields = DEFAULT_FIELDS, title = '品类销售额', onSelect }) {
  const hasLiveRows = aggregatedRows !== undefined;
  const rows = hasLiveRows ? aggregatedRows : SAMPLE_ROWS;
  const dimension = hasLiveRows ? fields?.dimension : DEFAULT_FIELDS.dimension;
  const metric = hasLiveRows ? fields?.metric : DEFAULT_FIELDS.metric;
  const validRows = Array.isArray(rows) && rows.every(row =>
    row && (typeof row[dimension] === 'string' || Number.isFinite(row[dimension]))
      && (Number.isFinite(row[metric]) || row[metric] === null));
  const select = typeof onSelect === 'function' ? onSelect : null;

  return (
    <section className="oy-analysis-card" aria-label={title}>
      <style>{`
        .oy-analysis-card {
          box-sizing: border-box;
          padding: var(--pod-card-padding, 16px);
          border-radius: var(--corner-2, 8px);
          background: var(--pod-card-bg-color, #fff);
          color: var(--color-text1-4, #172033);
          border: 1px solid var(--color-line1-1, #e5e7eb);
        }
        .oy-analysis-card h2 { margin: 0; font-size: 16px; }
        .oy-analysis-card p { color: var(--color-text1-3, #596579); }
        .oy-analysis-card ol { display: grid; gap: 8px; padding: 0; margin: 12px 0 0; list-style: none; }
        .oy-analysis-card .oy-analysis-row {
          display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start;
          width: 100%; padding: 8px 0; border: 0; border-bottom: 1px solid var(--color-line1-1, #e5e7eb);
          background: transparent; color: inherit; font: inherit; text-align: start;
        }
        .oy-analysis-card button.oy-analysis-row { cursor: pointer; }
        .oy-analysis-card button.oy-analysis-row:focus-visible {
          outline: 2px solid var(--color-brand1-6, #1677ff); outline-offset: 2px;
        }
        .oy-analysis-card .oy-analysis-label { overflow-wrap: anywhere; }
        .oy-analysis-card .oy-analysis-value { font-variant-numeric: tabular-nums; }
      `}</style>
      <h2>{title}</h2>
      {!hasLiveRows && <p>{'示例数据'}</p>}
      {!validRows && <p role="alert">{'数据字段或数值类型与卡片配置不匹配。'}</p>}
      {validRows && rows.length === 0 && <p>{'当前筛选下没有数据。'}</p>}
      {validRows && rows.length > 0 && (
        <ol>
          {rows.map(row => {
            const label = row[dimension];
            const value = row[metric];
            const cells = (
              <>
                <span className="oy-analysis-label">{label}</span>
                <span className="oy-analysis-value">{value === null ? '—' : currencyFormat.format(value)}</span>
              </>
            );
            return (
              <li key={JSON.stringify(label)}>
                {select ? (
                  <button type="button" className="oy-analysis-row" onClick={() => select(label)}>
                    {cells}
                  </button>
                ) : <div className="oy-analysis-row">{cells}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function YidaComp(props) {
  const { nativeCardCode, query, drillDimensions, detailSource, onSelect, title } = props;
  if (nativeCardCode || query) {
    const Card = window.__VcDeepYidaUtils__?.YidaAnalysisCard;
    if (!Card) {return <p role="alert">{'当前页面尚未加载可编程数据卡片组件。'}</p>;}
    return <Card cardCode={nativeCardCode} query={query} drillDimensions={drillDimensions}
      detailSource={detailSource} onSelect={onSelect} title={title || '数据分析'} view="bar" />;
  }
  return <AnalysisCard {...props} />;
}
