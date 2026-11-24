'use strict';

const { CliError } = require('../core/cli-error');

const analysisViews = ['table', 'bar', 'donut', 'kpi'];
const analysisModules = new Set(['react', 'antd', 'recharts', 'echarts', 'echarts-wordcloud']);

/** Build report display settings while leaving the report data configuration intact. */
function buildAnalysisPresentation(chart) {
  const view = chart.view || 'table';
  const renderCard = chart.renderCard;
  if (!renderCard && !analysisViews.includes(view)) {
    throw new CliError('分析卡片的展示方式无效', { code: 'REPORT_ANALYSIS_CONFIG_INVALID' });
  }
  // Source owns presentation; retain view only for historical cards without authored code.
  const settings = { container: { height: 248 }, ...(!renderCard ? { view } : {}) };
  if (renderCard === undefined || renderCard === '') {
    return settings;
  }
  if (typeof renderCard === 'string') {
    return { ...settings, renderCard };
  }
  if (!renderCard || typeof renderCard.source !== 'string' || !renderCard.source.trim()) {
    throw new CliError('renderCard.source 必须是非空 JSX 源码', { code: 'REPORT_ANALYSIS_CONFIG_INVALID' });
  }

  // Use the same JSX compiler as CodeCanvas. Report modules come from the report bundle.
  const { compileCanvasLocal } = require('../app/canvas-compile');
  const compiled = compileCanvasLocal(renderCard.source, { reportAnalysis: true });
  const importedModules = JSON.parse(compiled.importedModules);
  const unsupported = importedModules.filter((name) => !analysisModules.has(name));
  if (unsupported.length) {
    throw new CliError('报表卡片支持导入 ' + [...analysisModules].join('、') + '，不支持 ' + unsupported.join('、'), {
      code: 'REPORT_ANALYSIS_CONFIG_INVALID',
      details: { unsupported },
    });
  }
  return {
    ...settings,
    renderCard: { source: renderCard.source, runtimeCode: compiled.runtimeCode, importedModules },
  };
}

module.exports = { buildAnalysisPresentation };
