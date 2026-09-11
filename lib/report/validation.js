'use strict';

const { t } = require('../core/i18n');

const {
  getReportChartCapability,
  listReportChartTypes,
  normalizeReportChartType,
} = require('./capability-registry');
const {
  isValidTimeGranularityType,
  normalizeCubeCode,
  normalizeFieldCode,
} = require('./field-utils');

function issue(code, path, message, details = {}) {
  return { code, path, message, ...details };
}

function valueCount(value) {
  if (Array.isArray(value)) {return value.filter(Boolean).length;}
  return value ? 1 : 0;
}

function fieldValues(chart, keys) {
  return keys.flatMap((key) => {
    const value = chart[key];
    if (!value) {return [];}
    return Array.isArray(value) ? value : [value];
  });
}

function validateChartConfigDetailed(chart, chartIndex = 0) {
  const path = `charts[${chartIndex}]`;
  const issues = [];
  if (!chart || typeof chart !== 'object' || Array.isArray(chart)) {
    return [issue('REPORT_CHART_INVALID', path, t('report_runtime.chart_object'))];
  }

  const chartType = normalizeReportChartType(chart.type);
  if (!chartType) {
    issues.push(issue('REPORT_CHART_TYPE_REQUIRED', `${path}.type`, t('report_runtime.chart_type_required')));
    return issues;
  }
  const capability = getReportChartCapability(chartType);
  if (!capability) {
    issues.push(issue(
      'REPORT_CHART_TYPE_UNSUPPORTED',
      `${path}.type`,
      t('report_runtime.chart_type_unsupported', chartType),
      { supportedTypes: listReportChartTypes() }
    ));
    return issues;
  }

  if (!chart.cubeCode || typeof chart.cubeCode !== 'string') {
    issues.push(issue('REPORT_CHART_CUBE_REQUIRED', `${path}.cubeCode`, t('report_runtime.chart_cube_required')));
  }

  for (const role of capability.roles) {
    const count = role.anyOf.reduce((sum, key) => sum + valueCount(chart[key]), 0);
    if (count < role.min) {
      issues.push(issue(
        'REPORT_CHART_ROLE_REQUIRED',
        path,
        t('report_runtime.chart_role_required', chartType, role.code),
        { role: role.code, anyOf: [...role.anyOf], min: role.min }
      ));
    }
  }

  const normalizedChartCube = normalizeCubeCode(chart.cubeCode || '');
  const seen = new Set();
  for (const [fieldIndex, field] of fieldValues(chart, capability.fieldKeys).entries()) {
    if (typeof field === 'string') {
      if (!field.trim()) {
        issues.push(issue('REPORT_CHART_FIELD_REQUIRED', `${path}.fields[${fieldIndex}]`, t('report_runtime.chart_field_required')));
      }
      continue;
    }
    if (!field || typeof field !== 'object' || !field.fieldCode || typeof field.fieldCode !== 'string') {
      issues.push(issue('REPORT_CHART_FIELD_REQUIRED', `${path}.fields[${fieldIndex}]`, t('report_runtime.chart_field_required')));
      continue;
    }
    const fieldIdentity = `${field.fieldCode}\u0000${field.aggregateType || ''}`;
    if (seen.has(fieldIdentity)) {
      issues.push(issue('REPORT_CHART_FIELD_DUPLICATE', `${path}.fields[${fieldIndex}]`, t('report_runtime.chart_field_duplicate'), { fieldCode: field.fieldCode }));
    }
    seen.add(fieldIdentity);
    if (field.cubeCode && normalizeCubeCode(field.cubeCode) !== normalizedChartCube) {
      issues.push(issue('REPORT_CHART_FIELD_CUBE_MISMATCH', `${path}.fields[${fieldIndex}].cubeCode`, t('report_runtime.chart_field_cube_mismatch'), {
        chartCubeCode: normalizedChartCube,
        fieldCubeCode: normalizeCubeCode(field.cubeCode),
      }));
    }
    if (!isValidTimeGranularityType(field.timeGranularityType)) {
      issues.push(issue('REPORT_CHART_TIME_GRANULARITY_INVALID', `${path}.fields[${fieldIndex}].timeGranularityType`, t('report_runtime.chart_time_granularity')));
    }
  }

  if (chart.w !== undefined && (!Number.isInteger(chart.w) || chart.w <= 0 || chart.w > 6)) {
    issues.push(issue('REPORT_LAYOUT_INVALID', `${path}.w`, t('report_runtime.chart_width')));
  }
  if (chart.h !== undefined && (!Number.isInteger(chart.h) || chart.h <= 0)) {
    issues.push(issue('REPORT_LAYOUT_INVALID', `${path}.h`, t('report_runtime.chart_height')));
  }

  return issues;
}

function resolveFilterTargetIndexes(filter, charts) {
  const explicitTargets = filter.linkTo;
  if (explicitTargets !== undefined) {
    if (!Array.isArray(explicitTargets) || explicitTargets.length === 0) {return [];}
    const indexes = [];
    for (const target of explicitTargets) {
      if (Number.isInteger(target)) {
        if (target < 0 || target >= charts.length) {return [];}
        indexes.push(target);
        continue;
      }
      if (typeof target !== 'string' || !target) {return [];}
      const matches = charts
        .map((chart, index) => chart.title === target ? index : -1)
        .filter(index => index >= 0);
      if (matches.length !== 1) {return [];}
      indexes.push(matches[0]);
    }
    return [...new Set(indexes)];
  }
  const filterCube = normalizeCubeCode(filter.cubeCode || '');
  return charts
    .map((chart, index) => normalizeCubeCode(chart.cubeCode || '') === filterCube ? index : -1)
    .filter(index => index >= 0);
}

function validateFilterConfigDetailed(filter, filterIndex, charts) {
  const path = `filters[${filterIndex}]`;
  const issues = [];
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return [issue('REPORT_FILTER_INVALID', path, t('report_runtime.filter_object'))];
  }
  if (!filter.cubeCode || typeof filter.cubeCode !== 'string') {
    issues.push(issue('REPORT_FILTER_CUBE_REQUIRED', `${path}.cubeCode`, t('report_runtime.filter_cube_required')));
  }
  const valueField = filter.valueField;
  if (!valueField || typeof valueField !== 'object' || !valueField.fieldCode) {
    issues.push(issue('REPORT_FILTER_FIELD_REQUIRED', `${path}.valueField.fieldCode`, t('report_runtime.filter_value_required')));
  }
  if (filter.labelField && (!filter.labelField.fieldCode || typeof filter.labelField.fieldCode !== 'string')) {
    issues.push(issue('REPORT_FILTER_FIELD_REQUIRED', `${path}.labelField.fieldCode`, t('report_runtime.filter_label_invalid')));
  }
  if (filter.filterFieldCode && valueField && valueField.fieldCode
    && normalizeFieldCode(filter.filterFieldCode) !== normalizeFieldCode(valueField.fieldCode)) {
    issues.push(issue('REPORT_FILTER_FIELD_MISMATCH', `${path}.filterFieldCode`, t('report_runtime.filter_field_mismatch')));
  }
  const filterCube = normalizeCubeCode(filter.cubeCode || '');
  for (const fieldKey of ['valueField', 'labelField']) {
    const field = filter[fieldKey];
    if (field && field.cubeCode && normalizeCubeCode(field.cubeCode) !== filterCube) {
      issues.push(issue('REPORT_FILTER_FIELD_CUBE_MISMATCH', `${path}.${fieldKey}.cubeCode`, t('report_runtime.filter_field_cube_mismatch')));
    }
  }

  const targetIndexes = resolveFilterTargetIndexes(filter, charts);
  if (targetIndexes.length === 0) {
    issues.push(issue('REPORT_FILTER_LINK_TARGET_INVALID', `${path}.linkTo`, t('report_runtime.filter_link_invalid')));
  } else {
    for (const targetIndex of targetIndexes) {
      const chartCube = normalizeCubeCode(charts[targetIndex].cubeCode || '');
      if (filterCube !== chartCube) {
        issues.push(issue('REPORT_FILTER_LINK_CUBE_MISMATCH', `${path}.linkTo`, t('report_runtime.filter_link_cube_mismatch'), {
          targetIndex,
          filterCubeCode: filterCube,
          chartCubeCode: chartCube,
        }));
      }
    }
  }
  return issues;
}

function validateReportConfig(charts, filters = []) {
  const safeCharts = Array.isArray(charts) ? charts : [];
  const safeFilters = Array.isArray(filters) ? filters : [];
  const chartIssues = safeCharts.flatMap(validateChartConfigDetailed);
  const filterIssues = safeFilters.flatMap((filter, index) => validateFilterConfigDetailed(filter, index, safeCharts));
  const issues = [
    ...(safeCharts.length === 0 ? [issue('REPORT_CHARTS_REQUIRED', 'charts', t('report_runtime.charts_required'))] : []),
    ...chartIssues,
    ...filterIssues,
  ];
  return {
    ok: issues.length === 0,
    issues,
  };
}

module.exports = Object.freeze({
  resolveFilterTargetIndexes,
  validateChartConfigDetailed,
  validateFilterConfigDetailed,
  validateReportConfig,
});
