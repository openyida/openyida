'use strict';

const {
  REPORT_DOMAIN_CODE,
  assertReportSchemaReadback,
  collectReportI18nKeys,
  findReportSchemaMismatch,
  normalizeReportSchemaContent,
  normalizeReportConfig,
  prepareReportSchemaForSave,
} = require('../lib/report/contract');

function buildSchema(overrides = {}) {
  return {
    id: 'REPORT_1',
    gmtModified: 100,
    i18nData: [{ key: 'legacy' }],
    config: { existing: true },
    pages: [{
      componentsTree: [{
        componentName: 'Page',
        data: { key: 'page-title' },
        children: [{
          componentName: 'Chart',
          data: { key: 'i18n-runtime-owned' },
          children: [{
            componentName: 'Filter',
            data: { key: 'filter-title' },
          }],
        }],
      }],
    }],
    ...overrides,
  };
}

describe('report frontend contract', () => {
  test('uses the report designer domain contract', () => {
    expect(REPORT_DOMAIN_CODE).toBe('tEXDRG');
  });

  test('collects unique non-runtime i18n keys from component data', () => {
    expect(collectReportI18nKeys(buildSchema())).toEqual([
      'page-title',
      'filter-title',
    ]);
  });

  test('prepares a cloned schema like the frontend save path', () => {
    const original = buildSchema();
    const prepared = prepareReportSchemaForSave(original);

    expect(prepared).not.toBe(original);
    expect(prepared).not.toHaveProperty('i18nData');
    expect(prepared.config).toEqual({
      existing: true,
      i18nKeyList: ['page-title', 'filter-title'],
    });
    expect(original).toHaveProperty('i18nData');
  });

  test('prepareReportSchemaForSave strips client-only filter metadata recursively', () => {
    const original = buildSchema();
    original.pages[0].componentsTree[0].children[0].children[0].__filterMeta__ = {
      filterKey: 'client-only-filter-key',
    };

    const prepared = prepareReportSchemaForSave(original);

    expect(prepared.pages[0].componentsTree[0].children[0].children[0])
      .not.toHaveProperty('__filterMeta__');
    expect(original.pages[0].componentsTree[0].children[0].children[0])
      .toHaveProperty('__filterMeta__');
  });

  test('prepareReportSchemaForSave matches platform omission of null chart defaults', () => {
    const original = buildSchema({
      pages: [{
        utils: [],
        css: 'body {\n  background-color: #f2f3f5;\n}\n',
        componentsTree: [{
          componentName: 'Page',
          lifeCycles: { componentDidMount: null, componentWillUnmount: null },
          children: [{
            componentName: 'YoushuPieChart',
            props: {
              height: null,
              dataSetModelMap: {
                chartData: {
                  dataViewQueryModel: {
                    fieldDefinitionList: [{ fieldCode: 'dateField_1', timeGranularityType: null }],
                  },
                },
              },
              settings: {
                height: null,
                legend: { cardWidth: null, showLegend: true },
                tooltip: { contentType: null, showTooltip: true },
                fixedLegend: { cardWidth: 320 },
                yAxis: { min: null, max: null },
              },
              exportData: {
                supportExport: false,
                filterList: null,
                exportPromptFilter: null,
              },
            },
          }],
        }],
      }],
    });

    const prepared = prepareReportSchemaForSave(original);
    const props = prepared.pages[0].componentsTree[0].children[0].props;

    expect(props).not.toHaveProperty('height');
    expect(props.dataSetModelMap.chartData.dataViewQueryModel.fieldDefinitionList[0])
      .toEqual({ fieldCode: 'dateField_1' });
    expect(props.settings).toEqual({
      legend: { showLegend: true },
      tooltip: { showTooltip: true },
      fixedLegend: { cardWidth: 320 },
      yAxis: {},
    });
    expect(props.exportData).toEqual({ supportExport: false });
    expect(prepared.pages[0].componentsTree[0].lifeCycles).toEqual({});
    expect(prepared.pages[0]).not.toHaveProperty('utils');
    expect(prepared.pages[0]).not.toHaveProperty('css');
    expect(original.pages[0].componentsTree[0].children[0].props).toHaveProperty('height', null);
  });

  test('keeps cardWidth strict outside the proven pie legend null normalization', () => {
    const calendar = buildSchema({
      pages: [{
        componentsTree: [{
          componentName: 'Page',
          children: [{
            componentName: 'YoushuCalendarHeatmap',
            props: { settings: { legend: { cardWidth: null } } },
          }],
        }],
      }],
    });
    const pie = buildSchema({
      pages: [{
        componentsTree: [{
          componentName: 'Page',
          children: [{
            componentName: 'YoushuPieChart',
            props: {
              settings: {
                legend: { cardWidth: 320 },
                fixedLegend: { cardWidth: null },
              },
            },
          }],
        }],
      }],
    });

    expect(prepareReportSchemaForSave(calendar).pages[0].componentsTree[0]
      .children[0].props.settings.legend).toHaveProperty('cardWidth', null);
    expect(prepareReportSchemaForSave(pie).pages[0].componentsTree[0]
      .children[0].props.settings).toEqual({
      legend: { cardWidth: 320 },
      fixedLegend: { cardWidth: null },
    });
  });

  test('keeps tooltip contentType strict outside the proven pie null normalization', () => {
    const bar = buildSchema({
      pages: [{
        componentsTree: [{
          componentName: 'Page',
          children: [{
            componentName: 'YoushuGroupedBarChart',
            props: { settings: { tooltip: { contentType: null } } },
          }],
        }],
      }],
    });
    const pie = buildSchema({
      pages: [{
        componentsTree: [{
          componentName: 'Page',
          children: [{
            componentName: 'YoushuPieChart',
            props: {
              settings: {
                tooltip: { contentType: 'NAME_VALUE', showTooltip: true },
                fixedTooltip: { contentType: null },
              },
            },
          }],
        }],
      }],
    });

    expect(prepareReportSchemaForSave(bar).pages[0].componentsTree[0]
      .children[0].props.settings.tooltip).toHaveProperty('contentType', null);
    expect(prepareReportSchemaForSave(pie).pages[0].componentsTree[0]
      .children[0].props.settings).toEqual({
      tooltip: { contentType: 'NAME_VALUE', showTooltip: true },
      fixedTooltip: { contentType: null },
    });
  });

  test('normalizes string and response-wrapped schema content', () => {
    const schema = buildSchema();
    expect(normalizeReportSchemaContent({ content: JSON.stringify(schema) })).toEqual(schema);
  });

  test('normalizes a JSON-string report config and rejects malformed config', () => {
    expect(normalizeReportConfig('{"existing":true}')).toEqual({ existing: true });
    expect(() => normalizeReportConfig('{')).toThrow(expect.objectContaining({
      code: 'REPORT_SCHEMA_CONFIG_INVALID',
    }));
  });

  test('readback ignores the server revision but requires exact saved content', () => {
    const expected = prepareReportSchemaForSave(buildSchema());
    const { id: serverOwnedId, ...persisted } = expected;
    const actual = { ...persisted, gmtModified: 101 };

    expect(serverOwnedId).toBe('REPORT_1');

    expect(assertReportSchemaReadback(expected, actual)).toMatchObject({
      verificationLevel: 'strict-schema-content',
      omitted: [
        { path: '$.gmtModified', reason: 'server-owned revision' },
        { path: '$.id', reason: 'server-owned resource identity returned out-of-band' },
        { path: '$.i18nData', reason: 'server-owned localization materialization' },
        { path: '$.status', reason: 'server-owned publication status' },
      ],
      projection: { pages: expected.pages },
    });
  });

  test('sanitized platform fixture identifies the raw normalization as a missing top-level id', () => {
    expect(findReportSchemaMismatch(
      { id: 'REPORT_FIXTURE', pages: [] },
      { pages: [] }
    )).toEqual({
      path: '$.id',
      kind: 'missing_key',
      expectedFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      actualFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
  });

  test('readback accepts only explicit top-level platform normalization without weakening runtime fields', () => {
    const expected = prepareReportSchemaForSave(buildSchema({
      pages: [{
        css: 'body { color: red; }',
        utils: [{ name: 'runtimeUtil' }],
        componentsTree: [{
          componentName: 'Page',
          lifeCycles: { componentDidMount: 'mount-v1' },
          props: { height: null, visible: true },
          children: [{
            componentName: 'Chart',
            data: { cubeCode: 'FORM_1', fieldCode: 'numberField_1', aggregateType: 'SUM' },
          }],
        }],
      }],
    }));
    const actual = {
      ...expected,
      status: 'PUBLISHED',
      gmtModified: 101,
      i18nData: [{ key: 'server-owned' }],
      config: JSON.stringify(expected.config),
      pages: [{
        css: 'body { color: red; }',
        utils: [{ name: 'runtimeUtil' }],
        componentsTree: [{
          componentName: 'Page',
          lifeCycles: { componentDidMount: 'mount-v1' },
          props: { height: null, visible: true },
          children: [{
            componentName: 'Chart',
            data: { cubeCode: 'FORM_1', fieldCode: 'numberField_1', aggregateType: 'SUM' },
          }],
        }],
      }],
    };

    expect(() => assertReportSchemaReadback(expected, actual)).not.toThrow();
    actual.pages[0].css = 'body { color: blue; }';
    expect(() => assertReportSchemaReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
    }));
    actual.pages[0].css = 'body { color: red; }';
    actual.pages[0].componentsTree[0].children[0].data.aggregateType = 'COUNT';
    expect(() => assertReportSchemaReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
    }));
  });

  test('readback mismatch fails closed with a stable code', () => {
    const expected = prepareReportSchemaForSave(buildSchema());
    const actual = {
      ...expected,
      pages: [{ componentsTree: [] }],
      gmtModified: 101,
    };

    expect(() => assertReportSchemaReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
    }));
  });

  test.each([
    ['added', (children) => [...children, { componentName: 'Unexpected' }], 'array_length_mismatch'],
    ['deleted', (children) => children.slice(0, 1), 'array_length_mismatch'],
    ['reordered', (children) => [...children].reverse(), 'value_mismatch'],
  ])('readback fails closed when components are %s', (label, mutate, expectedKind) => {
    const expected = prepareReportSchemaForSave(buildSchema({
      pages: [{
        componentsTree: [{
          componentName: 'Page',
          children: [
            { componentName: 'ChartA', data: { aggregateType: 'SUM' } },
            { componentName: 'ChartB', data: { aggregateType: 'COUNT' } },
          ],
        }],
      }],
    }));
    const actual = JSON.parse(JSON.stringify(expected));
    actual.pages[0].componentsTree[0].children = mutate(actual.pages[0].componentsTree[0].children);

    let caught;
    try {
      assertReportSchemaReadback(expected, actual);
    } catch (error) {
      caught = error;
    }

    expect(label).toBeTruthy();
    expect(caught).toMatchObject({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: {
        mismatchType: expectedKind,
        mismatchPath: expect.stringMatching(/^\$\.pages\[0\]\.componentsTree\[0\]\.children/),
        retryable: false,
        retrySafe: false,
        sideEffectState: 'unknown',
        readbackAllowed: true,
        recommendedRecovery: 'inspect_then_stop',
        mismatch: {
          kind: expectedKind,
          path: expect.stringMatching(/^\$\.pages\[0\]\.componentsTree\[0\]\.children/),
          expectedFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          actualFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        },
      },
    });
  });

  test('readback mismatch diagnostics fingerprint business values without exposing them', () => {
    const secretBusinessValue = 'SENSITIVE-BUSINESS-VALUE-9f8f6b';
    const secretDynamicKey = 'zzPrivateFieldKey_4a765d';
    const expected = prepareReportSchemaForSave(buildSchema());
    const actual = JSON.parse(JSON.stringify(expected));
    actual.pages[0].componentsTree[0].children[0].data.aggregateType = secretBusinessValue;

    let caught;
    try {
      assertReportSchemaReadback(expected, actual);
    } catch (error) {
      caught = error;
    }

    expect(caught.details.mismatch).toMatchObject({
      path: '$.pages[0].componentsTree[0].children[0].data.aggregateType',
      kind: 'unexpected_key',
      expectedFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      actualFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(caught.details)).not.toContain(secretBusinessValue);

    const dynamicKeyActual = JSON.parse(JSON.stringify(expected));
    dynamicKeyActual.pages[0].componentsTree[0].data[secretDynamicKey] = 'private-value';
    try {
      assertReportSchemaReadback(expected, dynamicKeyActual);
    } catch (error) {
      caught = error;
    }
    expect(caught.details.mismatch).toMatchObject({
      path: expect.stringMatching(/\[key:sha256:[a-f0-9]{12}\]$/),
      kind: 'unexpected_key',
    });
    expect(JSON.stringify(caught.details)).not.toContain(secretDynamicKey);
    expect(JSON.stringify(caught.details)).not.toContain('private-value');
  });

  test('readback only tolerates an omitted server id and rejects a conflicting returned id', () => {
    const expected = prepareReportSchemaForSave(buildSchema());
    const actual = { ...expected, id: 'REPORT_DIFFERENT' };

    expect(() => assertReportSchemaReadback(expected, actual)).toThrow(expect.objectContaining({
      code: 'REPORT_SCHEMA_READBACK_MISMATCH',
      details: expect.objectContaining({
        mismatch: expect.objectContaining({
          path: '$.id',
          kind: 'value_mismatch',
          expectedFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
          actualFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        }),
      }),
    }));
  });
});
