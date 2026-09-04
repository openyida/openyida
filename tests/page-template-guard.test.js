'use strict';

const {
  assertPageTemplateCustomized,
  findPageTemplateResidues,
} = require('../lib/app/page-template-guard');

describe('page template guard', () => {
  test('blocks an unmodified bundled page template before publish', () => {
    const source = `
/** @openyida-page-template-base */
const RAW_APP_TYPE = '{{APP_TYPE}}';
const SAMPLE_ROWS = [];
`;

    expect(findPageTemplateResidues(source)).toEqual(expect.arrayContaining([
      expect.objectContaining({ residue: 'template-marker' }),
      expect.objectContaining({ residue: 'template-variable' }),
      expect.objectContaining({ residue: 'sample-data' }),
    ]));
    expect(() => assertPageTemplateCustomized(source, '/tmp/customer.canvas.jsx')).toThrow(
      expect.objectContaining({
        code: 'OPENYIDA_PAGE_TEMPLATE_NOT_CUSTOMIZED',
      })
    );
  });

  test('accepts a business page after template content is replaced', () => {
    const source = `
const APP_TYPE = 'APP_CUSTOMER';
const FORM_UUID = 'FORM_CUSTOMER';
const rows = [];
function YidaComp() { return null; }
`;

    expect(findPageTemplateResidues(source)).toEqual([]);
    expect(() => assertPageTemplateCustomized(source, '/tmp/customer.canvas.jsx')).not.toThrow();
  });
});
