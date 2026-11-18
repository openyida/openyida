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
  expect(theme).toMatchObject({
    portalTheme: 'blue', pageWidth: 'normal', pageBackground: 'auto', follow: true, themeContentTopMargin: null,
  });
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

test('round-trips portal token inheritance, zero spacing, transparent colors and independent device images', () => {
  const { schema } = applyPortalConfig({ pages: [{}] }, config, target);
  const custom = {
    themePageWidth: 1440, themeContentTopMargin: 0, themeCardRadius: 0, themeCardMargin: 0,
    themeCardPadding: 20, themeCardPaddingMobile: 8, themeTitleMargin: 0, themeInnerCardMargin: 12,
    themeInnerCardPadding: 0, themePageBackground: 'transparent', themeCardBackground: 'transparent',
    themeInfoColor: null, themeTitleColor: '#ffffff', themeCardTextColor: '#eeeeee',
    topPcImg: { type: 'custom', name: 'banner', value: 'https://example.com/pc.png', mobile: 'https://example.com/mobile.png', fit: 'contain' },
  };
  const saved = applyPortalConfig(schema, { theme: custom }, target);
  const editable = editablePortalConfig(inspectPortal(saved.schema)).config;
  expect(editable.theme).toMatchObject(custom);
  expect(applyPortalConfig(saved.schema, editable, target).changed).toBe(false);
  const disabled = applyPortalConfig(saved.schema, { theme: { topPcImg: {} } }, target);
  expect(editablePortalConfig(inspectPortal(disabled.schema)).config.theme.topPcImg).toEqual({});
  const inherited = applyPortalConfig(disabled.schema, {
    theme: { topPcImg: null, themeContentTopMargin: null, themePageBackground: null, themeCardPaddingMobile: null },
  }, target);
  expect(editablePortalConfig(inspectPortal(inherited.schema)).config.theme).toMatchObject({
    topPcImg: null, themeContentTopMargin: null, themePageBackground: null, themeCardPaddingMobile: null,
    themeTitleColor: custom.themeTitleColor, themeCardRadius: 0, themeCardPadding: 20,
  });
  expect(portalCatalog().theme.bindings.fields.themeCardPaddingMobile.token).toBe('--pod-card-mobile-padding');
  for (const theme of [{ themePageWidth: 0 }, { themeCardPadding: -1 }, { themeCardRadius: '0' }, { topPcImg: [] }]) {
    expect(() => applyPortalConfig(schema, { theme }, target)).toThrow(/Unsupported portal theme value/);
  }
});

test('preserves existing legacy top-margin presets until explicitly rebound', () => {
  const { schema } = applyPortalConfig({ pages: [{}] }, { ...config, theme: { topMargin: 'medium' } }, target);
  expect(inspectPortal(schema).theme).not.toHaveProperty('themeContentTopMargin');
  const patched = applyPortalConfig(schema, { theme: { themeCardRadius: 0 } }, target);
  expect(inspectPortal(patched.schema).theme).not.toHaveProperty('themeContentTopMargin');
  const rebound = applyPortalConfig(patched.schema, { theme: { themeContentTopMargin: null } }, target);
  expect(inspectPortal(rebound.schema).theme).toMatchObject({ topMargin: 'medium', themeContentTopMargin: null });
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


test('round-trips new-theme appearance mode and page CSS without changing legacy defaults or tiles', () => {
  const { schema } = applyPortalConfig({ pages: [{}] }, config, target);
  const before = inspectPortal(schema);
  expect(before.theme).not.toHaveProperty('themeAppearanceMode');
  expect(before.theme).not.toHaveProperty('containerStyle');
  const css = ':root { background: linear-gradient(90deg, #fff, #eee); }';
  const custom = applyPortalConfig(schema, { theme: { themeAppearanceMode: 'custom', containerStyle: css } }, target);
  const editable = editablePortalConfig(inspectPortal(custom.schema)).config;
  expect(editable.theme).toMatchObject({ themeAppearanceMode: 'custom', containerStyle: css });
  expect(applyPortalConfig(custom.schema, editable, target).changed).toBe(false);
  const follow = applyPortalConfig(custom.schema, { theme: { themeAppearanceMode: 'theme' } }, target);
  expect(inspectPortal(follow.schema).tiles).toEqual(before.tiles);
  expect(inspectPortal(follow.schema).theme.containerStyle).toBe(css);
  expect(portalCatalog().theme.choices.themeAppearanceMode).toEqual(['theme', 'custom']);
  for (const theme of [{ themeAppearanceMode: 'invalid' }, { containerStyle: {} }, { containerStyle: null }]) {
    expect(() => applyPortalConfig(schema, { theme }, target)).toThrow(/Unsupported portal theme value/);
  }
});
