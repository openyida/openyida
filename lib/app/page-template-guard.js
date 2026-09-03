'use strict';

const { CliError } = require('../core/cli-error');

const TEMPLATE_RESIDUE_PATTERNS = [
  {
    pattern: /@openyida-page-template-base/,
    residue: 'template-marker',
  },
  {
    pattern: /\bSAMPLE_ROWS\b/,
    residue: 'sample-data',
  },
  {
    pattern: /\{\{(?:APP_TYPE|FORM_UUID)\}\}/,
    residue: 'template-variable',
  },
];

function findPageTemplateResidues(sourceCode) {
  const source = String(sourceCode || '');
  const lines = source.split('\n');
  const issues = [];

  TEMPLATE_RESIDUE_PATTERNS.forEach(({ pattern, residue }) => {
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        issues.push({
          line: index + 1,
          residue,
        });
      }
    });
  });

  return issues;
}

function assertPageTemplateCustomized(sourceCode, sourcePath) {
  const issues = findPageTemplateResidues(sourceCode);
  if (issues.length === 0) {
    return;
  }

  throw new CliError('内置页面模板尚未完成业务化改写：请先替换示例数据、模板变量和占位文案，再发布。', {
    code: 'OPENYIDA_PAGE_TEMPLATE_NOT_CUSTOMIZED',
    details: {
      sourcePath,
      issues,
      retryable: false,
      retrySafe: true,
      sideEffectState: 'none',
      nextAction: {
        type: 'edit_source_then_publish',
        sourcePath,
      },
    },
  });
}

module.exports = {
  assertPageTemplateCustomized,
  findPageTemplateResidues,
};
