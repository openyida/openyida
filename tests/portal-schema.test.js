'use strict';

const { applyPortalConfig, inspectPortal } = require('../lib/app/portal-schema');

const target = { appType: 'APP_TEST', formUuid: 'FORM-PORTALTEST' };
const config = {
  tiles: [
    { key: 'favorites', componentName: 'QuickAccessCard', layout: { w: 3, x: 0, y: 0 }, props: { maxItems: 4 } },
    { key: 'recent', componentName: 'RecentlyUsedCard', layout: { w: 3, x: 3, y: 0 }, props: { enableQuickAccess: true } },
    {
      key: 'operations', componentName: 'DataManageViews', layout: { y: 6 },
      props: { form: { appType: 'APP_TEST', value: 'FORM-OPERATIONS', label: '运营跟进' } },
    },
  ],
};

test('creates source-defined portal materials with the native grid and stable identities', () => {
  const dataSource = { online: [], offline: [], sync: true };
  const blank = { pages: [{ componentsTree: [{ dataSource }] }] };
  expect(inspectPortal(blank).tiles).toEqual([]);
  const output = applyPortalConfig(blank, config, target);
  expect(output.schema.pages[0].componentsTree[0].dataSource).toEqual(dataSource);
  const { tiles, theme } = inspectPortal(output.schema);
  expect(tiles.map(tile => tile.componentName)).toEqual(['QuickAccessCard', 'RecentlyUsedCard', 'DataManageViews']);
  expect(tiles[0].props.maxItems).toBe(4);
  expect(tiles[1].placement).toMatchObject({ x: 3, y: 0, w: 3, i: tiles[1].fieldId });
  expect(tiles[2].props).toMatchObject({ form: { value: 'FORM-OPERATIONS' }, visibility: ['PC'] });
  expect(theme).toMatchObject({ portalTheme: 'blue', pageWidth: 'normal', pageBackground: 'auto', follow: true });
  expect(output.schema.pages[0].componentsMap).toEqual(expect.arrayContaining([
    expect.objectContaining({ componentName: 'DataManageViews', package: '@ali/vc-deep-yida' }),
  ]));
  expect(applyPortalConfig(output.schema, config, target).changed).toBe(false);
});

test('targets existing tiles by fieldId and preserves the theme and unrelated configuration', () => {
  const { schema } = applyPortalConfig({ pages: [{}], actions: { list: [] } }, config, target);
  schema.pages[0].componentsTree[0].props.pageBackground = 'custom';
  const before = inspectPortal(schema);
  const updated = applyPortalConfig(schema, {
    tiles: [{ key: 'existing', componentName: 'QuickAccessCard', fieldId: before.tiles[0].fieldId, props: { maxItems: 5 } }],
  }, target);
  const after = inspectPortal(updated.schema);
  expect(after.theme).toEqual(before.theme);
  expect(after.tiles.slice(1)).toEqual(before.tiles.slice(1));
  expect(after.tiles[0].props.maxItems).toBe(5);
  expect(updated.schema.actions).toEqual(schema.actions);
});

test('rejects overlapping positions, duplicate singleton tiles and cross-app form bindings', () => {
  const empty = { pages: [{}] };
  const overlapping = structuredClone(config);
  overlapping.tiles[1].layout.x = 2;
  expect(() => applyPortalConfig(empty, overlapping, target)).toThrow(/Overlapping/);
  const duplicate = structuredClone(config);
  duplicate.tiles.push({ key: 'favorite2', componentName: 'QuickAccessCard' });
  expect(() => applyPortalConfig(empty, duplicate, target)).toThrow(/maximum/);
  const crossApp = structuredClone(config);
  crossApp.tiles[2].props.form.appType = 'APP_FOREIGN';
  expect(() => applyPortalConfig(empty, crossApp, target)).toThrow(/matching the portal app/);
});
