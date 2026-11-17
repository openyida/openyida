'use strict';

const { applyPortalConfig, inspectPortal, portalCatalog, editablePortalConfig } = require('../lib/app/portal-schema');

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

test('binds published data cards by cardCode and accepts a legacy cardId', () => {
  const tile = { key: 'operations', componentName: 'DataCard' };
  const withCard = props => applyPortalConfig({ pages: [{}] }, { tiles: [{ ...tile, props }] }, target);
  expect(withCard({ cardCode: 'CARD-operations' }).tiles[0].props.cardCode).toBe('CARD-operations');
  expect(withCard({ cardId: 42 }).tiles[0].props.cardId).toBe(42);
  expect(() => withCard({ cardCode: 'FORM-operations', cardId: 42 })).toThrow(/published cardCode/);
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

test('lists all editable components and their source-defined constraints', () => {
  expect(portalCatalog().components).toHaveLength(14);
  expect(portalCatalog('CC_PortalTodoListView').components).toEqual([
    expect.objectContaining({ componentName: 'CC_PortalTodoListView', maxInstances: 1, fixedHeight: 33 }),
  ]);
  expect(portalCatalog('PortalTopBanner').components[0].optionalProps).toContain('textPosition');
  expect(() => portalCatalog('unknown')).toThrow(/Unknown portal component/);
});

test('exports a reusable edit file and patches theme fields without changing tiles', () => {
  const { schema } = applyPortalConfig({ pages: [{}], actions: { list: [] } }, config, target);
  const portal = inspectPortal(schema);
  const editable = editablePortalConfig(portal);
  expect(editable.skippedTiles).toEqual([]);
  expect(editable.config.tiles[0].props).not.toHaveProperty('fieldId');
  expect(editable.config.tiles[0].props).not.toHaveProperty('visibility');
  expect(editable.config.tiles[0].layout).not.toHaveProperty('i');
  expect(applyPortalConfig(schema, editable.config, target).changed).toBe(false);
  const result = applyPortalConfig(schema, { theme: { follow: true, topMargin: 'medium' } }, target);
  expect(inspectPortal(result.schema)).toEqual({ ...portal, theme: { ...portal.theme, topMargin: 'medium' } });
  expect(result.schema.actions).toEqual(schema.actions);
  expect(() => applyPortalConfig(schema, { theme: { topMargin: 'invalid' } }, target)).toThrow(/topMargin/);
});

test('uses RGL desktop order by default and can preserve a distinct mobile order', () => {
  const { schema, tiles } = applyPortalConfig({ pages: [{}] }, config, target);
  const [favorites, recent, records] = tiles;
  const initial = inspectPortal(schema);
  expect(initial.mobileLayout).toEqual({ mode: 'desktop', fieldIds: [favorites.fieldId, recent.fieldId] });

  const updated = applyPortalConfig(schema, { mobileOrder: [recent.fieldId] }, target);
  const portal = inspectPortal(updated.schema);
  expect(portal.mobileLayout).toEqual({ mode: 'custom', fieldIds: [recent.fieldId, favorites.fieldId] });
  expect(portal.tiles).toEqual([initial.tiles[1], initial.tiles[0], initial.tiles[2]]);
  expect(applyPortalConfig(updated.schema, editablePortalConfig(portal).config, target).changed).toBe(false);
  expect(inspectPortal(applyPortalConfig(updated.schema, { mobileOrder: 'desktop' }, target).schema).mobileLayout)
    .toEqual(initial.mobileLayout);
  expect(() => applyPortalConfig(schema, { mobileOrder: [records.fieldId] }, target)).toThrow(/mobile-visible/);

  const created = applyPortalConfig({ pages: [{}] }, { ...config, mobileOrder: ['recent', 'favorites'] }, target);
  expect(created.mobileLayout).toEqual(portal.mobileLayout);
});

test('selects a native todo indicator style and preserves explicit background choices', () => {
  const style = 'transparentLight';
  const definition = portalCatalog('CC_PortalTodoIndicatorView').components[0];
  expect(Object.keys(definition.stylePresets)).toHaveLength(9);
  const tile = { key: 'todo', componentName: definition.componentName, stylePreset: style };
  const apply = (schema, extra = {}) => applyPortalConfig(schema, { tiles: [{ ...tile, ...extra }] }, target);
  const result = apply({ pages: [{}] });
  const backgroundImage = definition.stylePresets[style].backgroundImage;
  expect(result.tiles[0].props).toMatchObject({ theme: style, backgroundImage });
  expect(apply(result.schema).changed).toBe(false);
  expect(apply(result.schema, { stylePreset: 'light' }).tiles[0].props).toMatchObject({
    theme: 'light', backgroundImage,
  });
  expect(apply(result.schema, { props: { backgroundImage: '' } }).tiles[0].props.backgroundImage).toBe('');
  expect(() => apply(result.schema, { stylePreset: 'unknown' })).toThrow(/stylePreset/);
});
