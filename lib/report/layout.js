'use strict';

const { t } = require('../core/i18n');

const GRID_COLUMNS = 6;

function layoutError(code, message, details) {
  const error = new Error(message);
  error.name = 'ReportLayoutError';
  error.code = code;
  error.details = details;
  return error;
}

function assertDimension(item, index) {
  if (!item || typeof item !== 'object') {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_item_object', index), { index });
  }
  if (!Number.isInteger(item.w) || item.w <= 0 || item.w > GRID_COLUMNS) {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_width', index, GRID_COLUMNS), { index, field: 'w', value: item.w });
  }
  if (!Number.isInteger(item.h) || item.h <= 0) {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_height', index), { index, field: 'h', value: item.h });
  }
  if (typeof item.i !== 'string' || !item.i) {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_id', index), { index, field: 'i' });
  }
}

function overlaps(left, right) {
  return left.x < right.x + right.w
    && left.x + left.w > right.x
    && left.y < right.y + right.h
    && left.y + left.h > right.y;
}

function assertReportLayout(layout) {
  if (!Array.isArray(layout)) {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_array'));
  }
  const ids = new Set();
  layout.forEach((item, index) => {
    assertDimension(item, index);
    if (!Number.isInteger(item.x) || item.x < 0 || item.x + item.w > GRID_COLUMNS) {
      throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_x', index, GRID_COLUMNS), { index, field: 'x', value: item.x });
    }
    if (!Number.isInteger(item.y) || item.y < 0) {
      throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_y', index), { index, field: 'y', value: item.y });
    }
    if (ids.has(item.i)) {
      throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_duplicate', item.i), { index, field: 'i', value: item.i });
    }
    ids.add(item.i);
  });

  for (let leftIndex = 0; leftIndex < layout.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < layout.length; rightIndex += 1) {
      if (overlaps(layout[leftIndex], layout[rightIndex])) {
        throw layoutError('REPORT_LAYOUT_OVERLAP', t('report_runtime.layout_overlap', layout[leftIndex].i, layout[rightIndex].i), {
          left: layout[leftIndex].i,
          right: layout[rightIndex].i,
        });
      }
    }
  }
  return layout;
}

function packReportLayout(items, options = {}) {
  const existingLayout = Array.isArray(options.existingLayout) ? options.existingLayout : [];
  assertReportLayout(existingLayout);
  if (!Array.isArray(items)) {
    throw layoutError('REPORT_LAYOUT_INVALID', t('report_runtime.layout_items_array'));
  }
  items.forEach(assertDimension);

  const startY = existingLayout.reduce((maxBottom, item) => Math.max(maxBottom, item.y + item.h), 0);
  let currentX = 0;
  let currentRowY = startY;
  let currentRowHeight = 0;
  const packed = [];

  for (const item of items) {
    if (currentX + item.w > GRID_COLUMNS) {
      currentRowY += currentRowHeight;
      currentX = 0;
      currentRowHeight = 0;
    }
    packed.push({
      ...item,
      x: currentX,
      y: currentRowY,
      moved: item.moved === true,
      static: item.static === true,
    });
    currentX += item.w;
    currentRowHeight = Math.max(currentRowHeight, item.h);
    if (currentX === GRID_COLUMNS) {
      currentRowY += currentRowHeight;
      currentX = 0;
      currentRowHeight = 0;
    }
  }

  assertReportLayout([...existingLayout, ...packed]);
  return packed;
}

module.exports = Object.freeze({
  GRID_COLUMNS,
  assertReportLayout,
  packReportLayout,
});
