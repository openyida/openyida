import React from 'react';

// Compose with independently bound chart cards. Keep shared filters in the caller.
export default function YidaComp({ title, context, filters, metrics, primary, comparison, detail }) {
  return <section className="oy-dashboard">
    <style>{`
      .oy-dashboard{container:oy-dashboard/inline-size;min-width:0;color:var(--color-text1-4,#202238)}
      .oy-dashboard h1{margin:0;font-size:clamp(22px,4cqi,34px);overflow-wrap:anywhere}
      .oy-dashboard p{margin:4px 0 0;color:var(--color-text1-3,#576078)}
      .oy-dashboard .oy-dashboard-body{display:grid;gap:var(--oy-section-gap,16px);margin-top:16px}
      .oy-dashboard .oy-dashboard-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px}
      .oy-dashboard .oy-dashboard-charts{display:grid;gap:var(--oy-section-gap,16px);min-width:0}
      .oy-dashboard .oy-dashboard-charts[data-paired]{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}
      .oy-dashboard .oy-dashboard-metrics>*,.oy-dashboard .oy-dashboard-charts>*{min-width:0}
      .oy-dashboard .oy-dashboard-detail{min-width:0;overflow-x:auto}
      @container oy-dashboard (max-width: 720px){
        .oy-dashboard .oy-dashboard-charts[data-paired]{grid-template-columns:minmax(0,1fr)}
      }
    `}</style>
    {title && <header><h1>{title}</h1>{context && <p>{context}</p>}</header>}
    <div className="oy-dashboard-body">
      {filters && <div>{filters}</div>}
      {metrics && <div className="oy-dashboard-metrics">{metrics}</div>}
      {(primary || comparison) && <div className="oy-dashboard-charts" data-paired={primary && comparison ? '' : undefined}>
        {primary && <div>{primary}</div>}
        {comparison && <div>{comparison}</div>}
      </div>}
      {detail && <div className="oy-dashboard-detail">{detail}</div>}
    </div>
  </section>;
}
