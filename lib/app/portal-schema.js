'use strict';

const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { buildYidaI18n } = require('../core/yida-i18n');
const { CliError } = require('../core/cli-error');

const PACKAGE = '@ali/vc-deep-yida';
const OBSERVED_PORTAL_VERSION = '1.5.169';
const COLUMNS = 6;

function titleConfig(title, showTitle = true) {
  return { showTitle, title: buildYidaI18n(title), desc: buildYidaI18n(''), showLink: false };
}

const todo = { dataSourceFrom: 'yidaTodo', taskTodo: true, taskCreated: true, taskDone: true, taskCopy: true, todoCategory: [] };
const columns = { pcCount: 'auto', mobileCount: 'auto' };
const groups = { hasGroup: false, groupType: 'tabs', mobileGroupType: 'tabs' };
const applicationList = {
  isNoPadding: false, showTitle: true, helpTip: buildYidaI18n(''), viewMore: true,
  maxItems: 8, showAppDescription: false, columnConfig: columns, backgroundImage: '',
};
const entry = { content: [], columnConfig: columns, groupConfig: groups, dataType: 'group', urlTarget: '_blank' };
const catalog = {
  DataCard: { size: [6, 9], count: 5, props: { colorMode: 'brand', cardId: '', isNoPadding: true } },
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
  CC_PortalTodoIndicatorView: { size: [2, 18], count: 1, lowcode: true, props: {
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
  PortalTopBanner: { size: [6, 20], props: { bannerImage: '', mainTitle: '', subTitle: '' } },
};

function invalid(message) {
  throw new CliError(message, { code: 'PORTAL_CONFIG_INVALID' });
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getPortalContent(page) {
  const root = page?.componentsTree?.[0];
  if (!root) {return null;}
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
  page.id = formUuid;
  page.componentsMap = [];
  page.componentsTree = [{
    id: 'node_' + makeNodeId(formUuid, 'page'), componentName: 'Page', condition: true,
    props: { follow: true, pageBackground: 'auto', cardBackground: 'default', titleColorMode: 'default', density: 'normal' },
    children: [{
      id: 'node_' + makeNodeId(formUuid, 'root'), componentName: 'RootContent', condition: true,
      props: { layout: [], rglSwitch: true }, children: [],
    }],
  }];
}

function validateTileProps(name, props, appType) {
  if (name === 'DataManageViews') {
    const { value, appType: formApp, label } = props.form || {};
    if (!/^FORM-[A-Za-z0-9]+$/.test(value || '') || formApp !== appType || typeof label !== 'string' || !label.trim()) {
      invalid('DataManageViews requires form.appType matching the portal app, a real form.value, and form.label.');
    }
  }
  if (name === 'DataCard' && !((typeof props.cardId === 'string' && props.cardId.trim()) || (Number.isSafeInteger(props.cardId) && props.cardId > 0))) {
    invalid('DataCard requires a selectable cardId from the target app.');
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
  if (!isObject(requested) || Object.keys(requested).some(key => !['x', 'y', 'w', 'h'].includes(key))) {
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

function applyPortalConfig(current, config, { appType, formUuid }) {
  if (!isObject(config) || Object.keys(config).some(key => key !== 'tiles') ||
      !Array.isArray(config.tiles) || !config.tiles.length) {
    invalid('The portal configuration must contain a non-empty tiles array.');
  }
  if (!Array.isArray(current.pages) || current.pages.length !== 1) {
    invalid('Expected a single-page portal schema.');
  }

  const schema = JSON.parse(JSON.stringify(current));
  const page = schema.pages[0];
  if (!getPortalContent(page)) {initializePage(page, formUuid);}
  const content = getPortalContent(page);
  content.children ||= [];
  page.componentsMap ||= [];
  const version = page.componentsMap.find(item => item.componentName === 'Page' && item.package === PACKAGE)?.version
    || OBSERVED_PORTAL_VERSION;
  const assets = new Map(page.componentsMap.map(asset => [asset.componentName, asset]));
  for (const componentName of ['Page', 'RootContent']) {
    if (!assets.has(componentName)) {assets.set(componentName, { componentName, package: PACKAGE, version });}
  }
  const changed = new Set();
  const tiles = [];
  // Merge placement changes before checking for collisions.
  const layout = content.props.layout;
  for (const tile of config.tiles) {
    const name = tile?.componentName;
    const definition = Object.hasOwn(catalog, name) && catalog[name];
    if (!definition || typeof tile.key !== 'string' || !/^[a-z][a-zA-Z0-9_-]{0,63}$/.test(tile.key) ||
        Object.keys(tile).some(key => !['key', 'componentName', 'fieldId', 'props', 'layout'].includes(key))) {
      invalid('Each tile requires a stable key and a supported componentName.');
    }
    const suffix = makeNodeId(formUuid, tile.key);
    const fieldId = tile.fieldId || name[0].toLowerCase() + name.slice(1) + '_' + suffix;
    const existing = content.children.find(node => node.props?.fieldId === fieldId);
    if (changed.has(fieldId) || (tile.fieldId && !existing) || (existing && existing.componentName !== name)) {
      invalid('Tile identity does not match an existing component of the same type: ' + tile.key);
    }
    const patch = tile.props ?? {};
    if (!isObject(patch) || Object.keys(patch).some(key =>
      !Object.hasOwn(definition.props, key) && !['displayDevice', 'isHeightAuto'].includes(key))) {
      invalid('Unsupported configuration property for ' + name + '.');
    }
    const props = { isHeightAuto: true, ...definition.props, ...existing?.props, fieldId };
    for (const [key, value] of Object.entries(patch)) {
      props[key] = isObject(props[key]) && isObject(value) ? { ...props[key], ...value } : value;
    }
    props.displayDevice ??= definition.device || 'ALL';
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
    changed.add(fieldId);
    tiles.push({ fieldId, componentName: name, props, placement });
  }
  checkPlacements(layout, changed);
  page.componentsMap = [...assets.values()];
  schema.schemaType ||= 'superform';
  schema.schemaVersion ||= '5.0';
  return { schema, tiles, changed: !isDeepStrictEqual(schema, current) };
}

function inspectPortal(schema) {
  const page = schema.pages?.[0];
  const root = page?.componentsTree?.[0];
  const content = getPortalContent(page);
  return {
    theme: root?.props || null,
    tiles: (content?.children || []).map(node => ({
      componentName: node.componentName,
      fieldId: node.props?.fieldId,
      props: node.props,
      placement: content.props.layout.find(cell => cell.i === node.props?.fieldId),
    })),
  };
}

module.exports = { applyPortalConfig, inspectPortal };
