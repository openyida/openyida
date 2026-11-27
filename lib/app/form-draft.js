'use strict';

const { applyChangesToSchema } = require('./create-form');

/**
 * Apply compact create-form update changes to an editor snapshot without IO.
 * Returns a complete draft and the changes actually applied.
 */
function applyFormDraft(draft, changes) {
  if (!draft || draft.schemaType !== 'superform' || draft.schemaVersion !== '5.0' ||
      !Array.isArray(draft.componentsTree) || !draft.componentsTree.length ||
      !Array.isArray(draft.componentsMap) || !Array.isArray(draft.utils) ||
      Object.prototype.hasOwnProperty.call(draft, 'pages')) {
    throw new Error('Expected a native superform 5.0 draft');
  }
  if (!Array.isArray(changes) || !changes.length) {
    throw new Error('Expected a non-empty list of form changes');
  }

  const { componentsTree, componentsMap, utils, ...root } = structuredClone(draft);
  const schema = { ...root, pages: [{ componentsTree, componentsMap, utils }] };
  const applied = applyChangesToSchema(schema, structuredClone(changes), {});
  if (applied.diagnostics.length || applied.length !== changes.length) {
    throw new Error('One or more draft changes could not be applied');
  }
  const { pages: [page], ...updatedRoot } = schema;
  return { draft: { ...updatedRoot, ...page }, changes: applied };
}

module.exports = { applyFormDraft };
