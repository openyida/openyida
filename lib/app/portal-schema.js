'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { buildYidaI18n } = require('../core/yida-i18n');
const { CliError } = require('../core/cli-error');

const PACKAGE = '@ali/vc-deep-yida';
const OBSERVED_PORTAL_VERSION = '1.5.169';
const COLUMNS = 6;
const pageDefaults = {
  // The legacy portal renderer requires a named palette even in theme-enabled apps.
  portalTheme: 'blue', chromatographer: 'blue', borderRadio: 'medium',
  bgLightColor: '#f4f9ff', bgDarkColor: '#d9edff', pageBackground: 'auto',
  pageWidth: 'normal', topMargin: 'small', density: 'normal', cardBackground: 'default',
  titleColorMode: 'default', follow: true, personalInfo: false,
};

function titleConfig(title, showTitle = true) {
  return { showTitle, title: buildYidaI18n(title), desc: buildYidaI18n(''), showLink: false };
}

const todo = { dataSourceFrom: 'yidaTodo', taskTodo: true, taskCreated: true, taskDone: true, taskCopy: true, todoCategory: [] };
const palettes = ['blue', 'orange', 'green', 'yellow', 'purple'];
const themeChoices = {
  portalTheme: [...palettes, 'diy'], chromatographer: palettes,
  pageWidth: ['normal', 'wider', 'auto'], topMargin: ['small', 'medium', 'large'],
  density: ['normal', 'default', 'small'], pageBackground: ['auto', 'color'],
  borderRadio: ['rightAngle', 'small', 'medium', 'large', 'huge'],
  cardBackground: ['default', 'frostedGlass'], titleColorMode: ['default', 'brand'], infoStyle: ['dark', 'light'],
};
const themeFields = { ...pageDefaults, diyColor: '', themeColor: '', bottomImg: '', topPcImg: {}, personalDesc: '', infoStyle: 'dark' };
const tileFields = ['displayDevice', 'isHeightAuto'];
const layoutFields = ['x', 'y', 'w', 'h'];
const columns = { pcCount: 'auto', mobileCount: 'auto' };
const groups = { hasGroup: false, groupType: 'tabs', mobileGroupType: 'tabs' };
const applicationList = {
  isNoPadding: false, showTitle: true, helpTip: buildYidaI18n(''), viewMore: true,
  maxItems: 8, showAppDescription: false, columnConfig: columns, backgroundImage: '',
};
const entry = { content: [], columnConfig: columns, groupConfig: groups, dataType: 'group', urlTarget: '_blank' };
const todoPresetBackground = 'https://img.alicdn.com/imgextra/i2/O1CN01fT3E8B1Zy34fRcNpL_!!6000000003262-2-tps-2976-333.png';
const todoStylePresets = {
  gray: { label: '灰色底' },
  light: { label: '浅色底' },
  dark: { label: '深色底' },
  compact: { label: '移动端紧凑' },
  'compact-multiple': { label: '移动端紧凑多色' },
  'compact-light': { label: '移动端紧凑浅色' },
  'compact-dark': { label: '移动端紧凑深色' },
  transparentLight: { label: '透明背景', backgroundImage: todoPresetBackground },
  transparentLightWithoutIcon: { label: '无图标透明背景', backgroundImage: todoPresetBackground },
};

const catalog = {
  DataCard: { size: [6, 9], count: 5, props: { colorMode: 'brand', cardId: '', cardCode: '', isNoPadding: true } },
  AIChatEntry: { size: [2, 4], fixedHeight: true, props: {
    title: buildYidaI18n('AI对话入口'), componentStyle: 'button', colorMode: 'default', radius: 'huge',
    showIcon: true, motion: false, gradientFrom: '#0066FF', gradientTo: '#5AD479', solidColor: '#0066FF',
  } },
  CC_PortalCarouselView: { size: [6, 20], lowcode: true, props: {
    titleConfig: titleConfig('轮播图', false), dataType: 'static', content: [],
    dataConfig: { dataFilterRules: {}, limit: 5 }, styleConfig: { zoomRule: 'cover' },
    urlTarget: '_blank', isHeightAuto: false, isNoPadding: true,
  } },
  CC_PortalNewsListView: { size: [4, 37], lowcode: true, fixedHeight: true, props: {
    titleConfig: titleConfig('资讯列表'), dataType: 'static', content: [],
    dataConfig: { dataFilterRules: {}, limit: 10 }, theme: 'graphic', urlTarget: '_blank',
  } },
  CC_PortalNoticeBoardView: { size: [2, 28], lowcode: true, props: {
    titleConfig: titleConfig('公告栏'), dataType: 'static', content: [],
    dataConfig: { dataFilterRules: {}, dataSourceFrom: 'yidaForm', limit: 5, noticeCategory: [] },
    showBanner: false, banner: '', link: {}, theme: 'image-large', zoomRule: 'cover', urlTarget: '_blank',
  } },
  CC_PortalQuickEntryView: { size: [4, 13], lowcode: true, props: {
    ...entry, titleConfig: titleConfig('快捷入口'), theme: 'normal',
  } },
  CC_PortalTodoIndicatorView: { size: [2, 18], count: 1, lowcode: true, stylePresets: todoStylePresets, props: {
    titleConfig: titleConfig('待办指标'), dataType: 'todoIndicator', compConfig: todo, theme: 'gray', backgroundImage: '',
  } },
  CC_PortalTodoListView: { size: [4, 33], count: 1, fixedHeight: true, lowcode: true, props: {
    titleConfig: titleConfig('待办清单'), dataType: 'todoList',
    compConfig: { ...todo, limit: 5, taskCopyUnread: false, displayFields: [] }, theme: 'full-tab',
  } },
  CC_PortalTodoOverviewView: { size: [2, 40], count: 1, lowcode: true, props: {
    titleConfig: titleConfig('钉钉日程'), dataType: 'todoOverview',
  } },
  DataManageViews: { size: [6, 25], count: 1, device: 'PC', props: { form: {}, isHeightAuto: false } },
  QuickAccessCard: { size: [6, 6], count: 1, props: {
    ...applicationList, title: buildYidaI18n('快捷访问'), theme: 'column-transparentLight',
    enableGrouping: false, enableCancelAccess: false,
  } },
  RecentlyUsedCard: { size: [6, 6], count: 1, props: {
    ...applicationList, title: buildYidaI18n('最近使用'), theme: 'row-white', enableQuickAccess: false,
  } },
  PortalQuickEntry: { size: [4, 13], props: {
    ...entry, titleConfig: titleConfig('快捷入口'), theme: 'normal',
    themeConfig: { layout: 'top-bottom', backgroundColorMode: 'none', iconBackgroundColorMode: 'light' },
  } },
  PortalTopBanner: {
    size: [6, 20], props: { bannerImage: '', mainTitle: '', subTitle: '' },
    optional: ['textPosition', 'textColor', 'mainTitleSize', 'subTitleSize'],
  },
};

function invalid(message) {
  throw new CliError(message, { code: 'PORTAL_CONFIG_INVALID' });
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function canEditProp(definition, key) {
  return Object.hasOwn(definition.props, key) || tileFields.includes(key) || definition.optional?.includes(key);
}

function isThemeValue(key, value) {
  if (!Object.hasOwn(themeFields, key)) {return false;}
  if (Object.hasOwn(themeChoices, key)) {return themeChoices[key].includes(value);}
  if (key === 'topPcImg') {
    return isObject(value) && typeof value.value === 'string' && typeof value.name === 'string';
  }
  if (key === 'personalDesc' && isObject(value)) {
    return value.type === 'i18n' && Object.entries(value).every(([locale, text]) =>
      (locale === 'type' || /^[a-z]{2}_[A-Z]{2}$/.test(locale)) && typeof text === 'string');
  }
  return typeof value === typeof themeFields[key];
}

function portalCatalog(componentName) {
  if (componentName && !Object.hasOwn(catalog, componentName)) {
    invalid('Unknown portal component: ' + componentName);
  }
  const components = Object.entries(catalog)
    .filter(([name]) => !componentName || name === componentName)
    .map(([name, definition]) => ({
      componentName: name,
      props: { ...definition.props, displayDevice: definition.device || 'ALL', isHeightAuto: definition.props.isHeightAuto ?? true },
      optionalProps: definition.optional || [],
      ...(definition.stylePresets ? { stylePresets: definition.stylePresets } : {}),
      layout: { w: definition.size[0], h: definition.size[1] },
      ...(definition.fixedHeight ? { fixedHeight: definition.size[1] } : {}),
      ...(definition.count ? { maxInstances: definition.count } : {}),
      ...(name === 'DataManageViews' ? { requiredProps: ['form'] } : {}),
      ...(name === 'DataCard' ? { requiredAnyProps: ['cardCode', 'cardId'] } : {}),
    }));
  return { columns: COLUMNS, layoutFields, displayDevices: ['ALL', 'PC'], components, theme: { defaults: pageDefaults, fields: Object.keys(themeFields), choices: themeChoices } };
}

function getPortalContent(page) {
  const root = page?.componentsTree?.[0];
  if (!root || (!root.componentName && !root.children?.length)) {return null;}
  const contents = root.children?.filter(node => node.componentName === 'RootContent') || [];
  if (root.componentName !== 'Page' || contents.length !== 1 || !Array.isArray(contents[0].props?.layout)) {
    invalid('The portal does not have a single supported Page / RootContent grid.');
  }
  return contents[0];
}

function makeNodeId(formUuid, key) {
  return createHash('sha256').update(formUuid + ':' + key).digest('hex').slice(0, 18);
}

function initializePage(page, formUuid) {
  page.id ||= formUuid;
  page.componentsMap ||= [];
  const [scaffold, ...remaining] = page.componentsTree || [];
  page.componentsTree = [{
    ...scaffold,
    id: 'node_' + makeNodeId(formUuid, 'page'), componentName: 'Page', condition: true,
    props: { ...pageDefaults, ...scaffold?.props },
    children: [{
      id: 'node_' + makeNodeId(formUuid, 'root'), componentName: 'RootContent', condition: true,
      props: { layout: [], rglSwitch: true }, children: [],
    }],
  }, ...remaining];
}

function validateTileProps(name, props, appType) {
  if (name === 'DataManageViews') {
    const { value, appType: formApp, label } = props.form || {};
    if (!/^FORM-[A-Za-z0-9]+$/.test(value || '') || formApp !== appType || typeof label !== 'string' || !label.trim()) {
      invalid('DataManageViews requires form.appType matching the portal app, a real form.value, and form.label.');
    }
  }
  if (name === 'DataCard') {
    const validCode = typeof props.cardCode === 'string' && /^CARD-[A-Za-z0-9]+$/.test(props.cardCode);
    const validLegacyId = (typeof props.cardId === 'string' && props.cardId.trim())
      || (Number.isSafeInteger(props.cardId) && props.cardId > 0);
    if ((props.cardCode && !validCode) || (!validCode && !validLegacyId)) {
      invalid('DataCard requires a published cardCode or a legacy cardId from the target app.');
    }
  }
  if (Object.hasOwn(props, 'content') && !Array.isArray(props.content)) {
    invalid(name + ' content must be an array.');
  }
  for (const item of props.content || []) {
    if (!isObject(item) || !['page', 'app', 'url'].includes(item.linkType)) {
      invalid(name + ' content items must specify linkType page, app or url.');
    }
    const key = item.linkType;
    if (key === 'url' && !/^https?:\/\/\S+$/i.test(item.url || '')) {
      invalid(name + ' URL items require an http(s) URL.');
    }
    if (key !== 'url' && (!isObject(item[key]) || typeof item[key].value !== 'string' || !item[key].value)) {
      invalid(name + ' ' + key + ' items require the selected entity with its value.');
    }
  }
}

function makePlacement(tile, definition, fieldId, previous, layout) {
  const [w, h] = definition.size;
  const requested = tile.layout || {};
  if (!isObject(requested) || Object.keys(requested).some(key => !layoutFields.includes(key))) {
    invalid('Tile layout accepts x, y, w and h.');
  }
  const bottom = Math.max(0, ...layout.map(cell => cell.y + cell.h));
  const cell = { x: 0, y: bottom, w, h, ...previous, ...requested, i: fieldId };
  if (![cell.x, cell.y, cell.w, cell.h].every(Number.isSafeInteger) || cell.x < 0 || cell.y < 0 ||
      cell.w < 1 || cell.h < 1 || cell.x + cell.w > COLUMNS || cell.y + cell.h > 10000) {
    invalid('Tile ' + tile.key + ' falls outside the six-column portal grid.');
  }
  if (definition.fixedHeight) {
    if (cell.h !== h) {invalid(tile.componentName + ' uses height ' + h + '.');}
    cell.minH = h;
    cell.maxH = h;
  }
  return cell;
}

function checkPlacements(layout, changed) {
  for (const first of layout.filter(cell => changed.has(cell.i))) {
    const overlaps = layout.some(second => first.i !== second.i &&
      first.x < second.x + second.w && second.x < first.x + first.w &&
      first.y < second.y + second.h && second.y < first.y + first.h);
    if (overlaps) {invalid('Overlapping tiles at ' + first.i + '. Set explicit, non-overlapping positions.');}
  }
}

function inspectMobileLayout(content) {
  const custom = content?.props.customSortForMobile === true;
  const ids = (content?.children || []).filter(node => {
    const { fieldId, visibility } = node.props || {};
    return fieldId && (!Array.isArray(visibility) || !visibility.length || visibility.includes('MOBILE'));
  }).map(node => node.props.fieldId);
  if (custom) {return { mode: 'custom', fieldIds: ids };}
  const layout = content?.props.layout || [];
  const order = new Map([...layout]
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((cell, index) => [cell.i, index]));
  ids.sort((a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity));
  return { mode: 'desktop', fieldIds: ids };
}

function configureMobileOrder(content, requested, keys) {
  if (requested === undefined) {return undefined;}
  if (requested === 'desktop') {
    content.props.customSortForMobile = false;
    return inspectMobileLayout(content);
  }
  const current = inspectMobileLayout(content).fieldIds;
  const visible = new Set(current);
  const first = requested.map(id => visible.has(id) ? id : keys.get(id));
  const ordered = new Set(first);
  if (ordered.size !== first.length || first.some(id => !visible.has(id))) {
    invalid('mobileOrder must reference distinct, mobile-visible tile keys or fieldIds.');
  }
  const nodes = new Map(content.children.map(node => [node.props?.fieldId, node]));
  const order = [...first, ...current.filter(id => !ordered.has(id))];
  let index = 0;
  content.children = content.children.map(node => visible.has(node.props?.fieldId) ? nodes.get(order[index++]) : node);
  content.props.customSortForMobile = true;
  return inspectMobileLayout(content);
}

function applyPortalConfig(current, config, { appType, formUuid }) {
  if (!isObject(config) || Object.keys(config).some(key => !['tiles', 'theme', 'mobileOrder'].includes(key)) ||
      (config.tiles !== undefined && !Array.isArray(config.tiles)) ||
      (config.theme !== undefined && !isObject(config.theme)) ||
      (!config.tiles?.length && !Object.keys(config.theme || {}).length && config.mobileOrder === undefined)) {
    invalid('Provide a non-empty tiles array, a portal theme patch, or mobileOrder.');
  }
  if (config.mobileOrder !== undefined && config.mobileOrder !== 'desktop' &&
      (!Array.isArray(config.mobileOrder) || !config.mobileOrder.length ||
       config.mobileOrder.some(id => typeof id !== 'string' || !id.trim()))) {
    invalid('mobileOrder accepts tile keys or fieldIds, or "desktop".');
  }
  const theme = config.theme || {};
  for (const [key, value] of Object.entries(theme)) {
    if (!isThemeValue(key, value)) {invalid('Unsupported portal theme value for ' + key + '.');}
  }
  if (!Array.isArray(current.pages) || current.pages.length !== 1) {
    invalid('Expected a single-page portal schema.');
  }

  const schema = JSON.parse(JSON.stringify(current));
  const page = schema.pages[0];
  const existingContent = getPortalContent(page);
  if (!existingContent) {initializePage(page, formUuid);}
  const root = page.componentsTree[0];
  if (root.id === 'node_' + makeNodeId(formUuid, 'page')) {
    root.props = { ...pageDefaults, ...root.props };
  }
  root.props = { ...root.props, ...theme };
  if (existingContent && !config.tiles?.length) {
    const mobileLayout = configureMobileOrder(existingContent, config.mobileOrder, new Map());
    return { schema, tiles: [], theme, mobileLayout, changed: !isDeepStrictEqual(schema, current) };
  }
  const content = existingContent || getPortalContent(page);
  content.children ||= [];
  page.componentsMap ||= [];
  const version = page.componentsMap.find(item => item.componentName === 'Page' && item.package === PACKAGE)?.version
    || OBSERVED_PORTAL_VERSION;
  const assets = new Map(page.componentsMap.map(asset => [asset.componentName, asset]));
  for (const componentName of ['Page', 'RootContent']) {
    if (!assets.has(componentName)) {assets.set(componentName, { componentName, package: PACKAGE, version });}
  }
  const changed = new Set();
  const keys = new Map();
  const tiles = [];
  // Merge placement changes before checking for collisions.
  const layout = content.props.layout;
  for (const tile of config.tiles || []) {
    const name = tile?.componentName;
    const definition = Object.hasOwn(catalog, name) && catalog[name];
    if (!definition || typeof tile.key !== 'string' || !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(tile.key) ||
        Object.keys(tile).some(key => !['key', 'componentName', 'fieldId', 'props', 'layout', 'stylePreset'].includes(key))) {
      invalid('Each tile requires a stable key and a supported componentName.');
    }
    if (Array.isArray(config.mobileOrder) && keys.has(tile.key)) {
      invalid('Tile keys must be distinct when using mobileOrder.');
    }
    const suffix = makeNodeId(formUuid, tile.key);
    const fieldId = tile.fieldId || name[0].toLowerCase() + name.slice(1) + '_' + suffix;
    const existing = content.children.find(node => node.props?.fieldId === fieldId);
    if (changed.has(fieldId) || (tile.fieldId && !existing) || (existing && existing.componentName !== name)) {
      invalid('Tile identity does not match an existing component of the same type: ' + tile.key);
    }
    const patch = tile.props ?? {};
    if (!isObject(patch) || Object.keys(patch).some(key => !canEditProp(definition, key))) {
      invalid('Unsupported configuration property for ' + name + '.');
    }
    const props = { isHeightAuto: true, ...definition.props, ...existing?.props, fieldId };
    for (const [key, value] of Object.entries(patch)) {
      props[key] = isObject(props[key]) && isObject(value) ? { ...props[key], ...value } : value;
    }
    if (tile.stylePreset !== undefined) {
      const preset = typeof tile.stylePreset === 'string' && definition.stylePresets
        && Object.hasOwn(definition.stylePresets, tile.stylePreset)
        && definition.stylePresets[tile.stylePreset];
      if (!preset || (Object.hasOwn(patch, 'theme') && patch.theme !== tile.stylePreset)) {
        invalid('Unsupported or conflicting stylePreset for ' + name + '.');
      }
      props.theme = tile.stylePreset;
      if (preset.backgroundImage && !props.backgroundImage && !Object.hasOwn(patch, 'backgroundImage')) {
        props.backgroundImage = preset.backgroundImage;
      }
    }
    const existingVisibility = existing?.props?.visibility;
    const pcOnly = Array.isArray(existingVisibility) && existingVisibility.includes('PC') && !existingVisibility.includes('MOBILE');
    props.displayDevice ??= pcOnly ? 'PC' : definition.device || 'ALL';
    if (!['ALL', 'PC'].includes(props.displayDevice) || typeof props.isHeightAuto !== 'boolean') {
      invalid('displayDevice must be ALL or PC, and isHeightAuto must be a boolean.');
    }
    props.visibility = props.displayDevice === 'PC' ? ['PC'] : ['PC', 'MOBILE'];
    validateTileProps(name, props, appType);
    const placementIndex = layout.findIndex(cell => cell.i === fieldId);
    const placement = makePlacement(tile, definition, fieldId, layout[placementIndex], layout);
    if (placementIndex === -1) {layout.push(placement);} else {layout[placementIndex] = placement;}
    if (existing) {
      existing.props = props;
    } else {
      content.children.push({ id: 'node_' + suffix, componentName: name, condition: true, props });
    }
    if (definition.count && content.children.filter(node => node.componentName === name).length > definition.count) {
      invalid(name + ' has a maximum of ' + definition.count + ' tile(s) per portal.');
    }
    if (!assets.has(name)) {
      assets.set(name, definition.lowcode ? { componentName: name, devMode: 'lowcode' } : { componentName: name, package: PACKAGE, version });
    }
    keys.set(tile.key, fieldId);
    changed.add(fieldId);
    tiles.push({ fieldId, componentName: name, props, placement });
  }
  checkPlacements(layout, changed);
  const mobileLayout = configureMobileOrder(content, config.mobileOrder, keys);
  page.componentsMap = [...assets.values()];
  schema.schemaType ||= 'superform';
  schema.schemaVersion ||= '5.0';
  return { schema, tiles, theme, mobileLayout, changed: !isDeepStrictEqual(schema, current) };
}

function inspectPortal(schema) {
  const page = schema.pages?.[0];
  const root = page?.componentsTree?.[0];
  const content = getPortalContent(page);
  return {
    theme: root?.props || null,
    mobileLayout: inspectMobileLayout(content),
    tiles: (content?.children || []).map(node => ({
      componentName: node.componentName,
      fieldId: node.props?.fieldId,
      props: node.props,
      placement: content.props.layout.find(cell => cell.i === node.props?.fieldId),
    })),
  };
}

function editablePortalConfig({ theme, tiles, mobileLayout }) {
  const config = { tiles: [] };
  const skippedTiles = [];
  for (const tile of tiles) {
    const { componentName, fieldId, placement, props } = tile;
    if (!Object.hasOwn(catalog, componentName) || !placement || !fieldId) {
      skippedTiles.push({ componentName, fieldId });
      continue;
    }
    config.tiles.push({
      key: 'tile-' + (config.tiles.length + 1), componentName, fieldId,
      props: Object.fromEntries(Object.entries(props).filter(([key]) => canEditProp(catalog[componentName], key))),
      layout: Object.fromEntries(layoutFields.map(key => [key, placement[key]])),
    });
  }
  const editableTheme = Object.fromEntries(Object.entries(theme || {}).filter(([key, value]) => isThemeValue(key, value)));
  if (Object.keys(editableTheme).length) {config.theme = editableTheme;}
  if (mobileLayout?.mode === 'custom' && mobileLayout.fieldIds.length) {config.mobileOrder = mobileLayout.fieldIds;}
  return { config, skippedTiles };
}

module.exports = { applyPortalConfig, inspectPortal, portalCatalog, editablePortalConfig };
