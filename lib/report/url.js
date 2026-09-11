'use strict';

function buildReportWorkbenchUrl(baseUrl, appType, reportId) {
  const values = [baseUrl, appType, reportId];
  if (values.some(value => value === null || value === undefined || String(value).length === 0)) {
    return null;
  }
  return `${String(baseUrl).replace(/\/+$/, '')}/${appType}/workbench/${reportId}`;
}

module.exports = Object.freeze({
  buildReportWorkbenchUrl,
});
