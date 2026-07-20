'use strict';

const { stripSubtableFieldPrefix } = require('../../formula/field-refs');

function createNodeIdGenerator() {
  let counter = 1;
  return function nextNodeId() {
    return 'node_oc' + Date.now().toString(36) + (counter++).toString(36);
  };
}

function generateSuffix() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function getGlobalDataSourceFitConfig() {
  const fitCompiled = "'use strict';\n\nvar __preParser__ = function fit(response) {\n  var content = response.content !== undefined ? response.content : response;\n  var error = {\n    message: response.errorMsg || response.errors && response.errors[0] && response.errors[0].msg || response.content || '远程数据源请求出错，success is false'\n  };\n  var success = true;\n  if (response.success !== undefined) {\n    success = response.success;\n  } else if (response.hasError !== undefined) {\n    success = !response.hasError;\n  }\n  return {\n    content: content,\n    success: success,\n    error: error\n  };\n};";
  const fitSource = "function fit(response) {\r\n  const content = (response.content !== undefined) ? response.content : response;\r\n  const error = {\r\n    message: response.errorMsg ||\r\n      (response.errors && response.errors[0] && response.errors[0].msg) ||\r\n      response.content || '远程数据源请求出错，success is false',\r\n  };\r\n  let success = true;\r\n  if (response.success !== undefined) {\r\n    success = response.success;\r\n  } else if (response.hasError !== undefined) {\r\n    success = !response.hasError;\r\n  }\r\n  return {\r\n    content,\r\n    success,\r\n    error,\r\n  };\r\n}";

  return {
    fit: {
      compiled: fitCompiled,
      source: fitSource,
      type: 'js',
      error: {},
    },
  };
}

function buildDefaultPageDataSource(formUuid) {
  const urlParamsDataSource = {
    id: 'VCB660714833IBHEOXK376TA7XJH2AXUWR8MMW',
    name: 'urlParams',
    description: '当前页面地址的参数：如 aliwork.com/APP_XXX/workbench?id=1&name=宜搭，可通过 this.state.urlParams.name 获取到宜搭',
    formUuid,
    protocal: 'URI',
    isReadonly: true,
  };
  const timestampDataSource = {
    id: '',
    name: 'timestamp',
    description: '',
    formUuid,
    protocal: 'VALUE',
    initialData: '',
  };

  return {
    offline: [],
    globalConfig: getGlobalDataSourceFitConfig(),
    online: [urlParamsDataSource, timestampDataSource],
    list: [urlParamsDataSource, timestampDataSource],
    sync: true,
  };
}

function cloneJson(value) {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

function isBuiltInPageDataSource(item) {
  return !!(item && (item.name === 'urlParams' || item.name === 'timestamp'));
}

function getDataSourceIdentity(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  if (isBuiltInPageDataSource(item)) {
    return 'builtin:' + item.name;
  }
  if (item.id) {
    return 'id:' + item.id;
  }
  if (item.name && item.protocal) {
    return 'name:' + item.name + '|protocal:' + item.protocal;
  }
  if (item.name) {
    return 'name:' + item.name;
  }
  return JSON.stringify(item);
}

function mergeDataSourceArray(existingItems, generatedItems) {
  const merged = Array.isArray(existingItems) ? cloneJson(existingItems) : [];
  const seen = new Set(merged.map(getDataSourceIdentity).filter(Boolean));

  (Array.isArray(generatedItems) ? generatedItems : []).forEach((item) => {
    const identity = getDataSourceIdentity(item);
    if (!identity || !seen.has(identity)) {
      merged.push(cloneJson(item));
      if (identity) {
        seen.add(identity);
      }
    }
  });

  return merged;
}

function mergePageDataSource(existingDataSource, generatedDataSource) {
  if (!existingDataSource || typeof existingDataSource !== 'object') {
    return cloneJson(generatedDataSource);
  }

  const existing = cloneJson(existingDataSource);
  const generated = cloneJson(generatedDataSource || {});
  const merged = Object.assign({}, generated, existing);

  merged.offline = mergeDataSourceArray(existing.offline, generated.offline);
  merged.online = mergeDataSourceArray(existing.online, generated.online);
  merged.list = mergeDataSourceArray(existing.list, generated.list);
  merged.globalConfig = Object.assign(
    {},
    generated.globalConfig || {},
    existing.globalConfig || {}
  );
  merged.sync = existing.sync !== undefined ? existing.sync : generated.sync;

  return merged;
}

function extractSchemaContent(schemaResult) {
  if (!schemaResult) {
    return null;
  }

  let content = schemaResult.content !== undefined ? schemaResult.content : schemaResult;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch {
      return null;
    }
  }

  if (content && typeof content === 'object' && content.pages) {
    return content;
  }
  if (schemaResult.pages) {
    return schemaResult;
  }
  return null;
}

function extractPageDataSource(schema) {
  if (!schema || !Array.isArray(schema.pages)) {
    return null;
  }

  function findPageDataSource(node) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    if (node.componentName === 'Page' && node.dataSource) {
      return node.dataSource;
    }
    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
      const dataSource = findPageDataSource(child);
      if (dataSource) {
        return dataSource;
      }
    }
    return null;
  }

  for (const page of schema.pages) {
    const tree = page && Array.isArray(page.componentsTree) ? page.componentsTree : [];
    for (const component of tree) {
      const dataSource = findPageDataSource(component);
      if (dataSource) {
        return dataSource;
      }
    }
  }
  return null;
}

function countCustomPageDataSources(dataSource) {
  if (!dataSource || typeof dataSource !== 'object') {
    return 0;
  }

  const identities = new Set();
  ['offline', 'online', 'list'].forEach((key) => {
    (Array.isArray(dataSource[key]) ? dataSource[key] : []).forEach((item) => {
      if (!isBuiltInPageDataSource(item)) {
        const identity = getDataSourceIdentity(item);
        if (identity) {
          identities.add(identity);
        }
      }
    });
  });
  return identities.size;
}

function buildNativePageSchemaContent(sourceCode, compiledCode, formUuid, options = {}) {
  const onBuildingSchema = normalizeOptionalCallback(options.onBuildingSchema, 'onBuildingSchema');
  const onFormulaPrefixFixed = normalizeOptionalCallback(
    options.onFormulaPrefixFixed,
    'onFormulaPrefixFixed'
  );
  onBuildingSchema();

  const sourceFix = stripSubtableFieldPrefix(sourceCode);
  const compiledFix = stripSubtableFieldPrefix(compiledCode);
  sourceCode = sourceFix.value;
  compiledCode = compiledFix.value;
  const fixedRefs = sourceFix.count + compiledFix.count;
  if (fixedRefs > 0) {
    onFormulaPrefixFixed(fixedRefs);
  }

  const nextNodeId = resolveSchemaBuilderDependency(
    options.nextNodeId,
    createNodeIdGenerator,
    'nextNodeId'
  );
  const nextSuffix = resolveSchemaBuilderDependency(
    options.nextSuffix,
    () => generateSuffix,
    'nextSuffix'
  );
  const constructorCode = "function constructor() {\nvar module = { exports: {} };\nvar _this = this;\nthis.__initMethods__(module.exports, module);\nObject.keys(module.exports).forEach(function(item) {\n  if(typeof module.exports[item] === 'function'){\n    _this[item] = module.exports[item];\n  }\n});\n\n}";
  const pageDataSource = mergePageDataSource(
    options.existingDataSource,
    buildDefaultPageDataSource(formUuid)
  );

  const schema = {
    schemaType: 'superform',
    schemaVersion: '5.0',
    pages: [
      {
        utils: [
          {
            name: 'legaoBuiltin',
            type: 'npm',
            content: {
              package: '@ali/vu-legao-builtin',
              version: '3.0.0',
              exportName: 'legaoBuiltin',
            },
          },
          {
            name: 'yidaPlugin',
            type: 'npm',
            content: {
              package: '@ali/vu-yida-plugin',
              version: '1.1.0',
              exportName: 'yidaPlugin',
            },
          },
        ],
        componentsMap: [
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootHeader' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Jsx' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootContent' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'RootFooter' },
          { package: '@ali/vc-deep-yida', version: '1.5.169', componentName: 'Page' },
        ],
        componentsTree: [
          {
            componentName: 'Page',
            id: nextNodeId(),
            props: {
              contentBgColor: 'white',
              pageStyle: { backgroundColor: '#f2f3f5' },
              contentMargin: '0',
              contentPadding: '0',
              showTitle: false,
              contentPaddingMobile: '0',
              templateVersion: '1.0.0',
              contentMarginMobile: '0',
              className: 'page_' + nextSuffix(),
              contentBgColorMobile: 'white',
            },
            condition: true,
            css: 'body{background-color:#f2f3f5}.vc-page-yida-page{--yida-form-content-padding:0;--yida-form-content-margin:0;--yida-layout-padding:0}.vc-deep-container-entry.vc-rootcontent{padding:0!important;margin-top:0!important;margin-right:0!important;margin-bottom:0!important;margin-left:0!important}',
            methods: {
              __initMethods__: {
                type: 'js',
                source: 'function (exports, module) { /*set actions code here*/ }',
                compiled: 'function (exports, module) { /*set actions code here*/ }',
              },
            },
            dataSource: pageDataSource,
            lifeCycles: {
              constructor: {
                type: 'js',
                compiled: constructorCode,
                source: constructorCode,
              },
              componentWillUnmount: {
                name: 'didUnmount',
                id: 'didUnmount',
                type: 'actionRef',
                params: {},
              },
              componentDidMount: {
                name: 'didMount',
                id: 'didMount',
                params: {},
                type: 'actionRef',
              },
            },
            hidden: false,
            title: '',
            isLocked: false,
            conditionGroup: '',
            children: [
              {
                componentName: 'RootHeader',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
              },
              {
                componentName: 'RootContent',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
                children: [
                  {
                    componentName: 'Jsx',
                    id: nextNodeId(),
                    props: {
                      render: {
                        type: 'js',
                        compiled: 'function main(){\n    \n    "use strict";\n\nvar __compiledFunc__ = function render() {\n  return this.renderJsx();\n};\n    return __compiledFunc__.apply(this, arguments);\n  }',
                        source: 'function render() {\n  return this.renderJsx();\n}',
                        error: {},
                      },
                      __style__: {},
                      fieldId: 'jsx_' + nextSuffix(),
                    },
                    condition: true,
                    hidden: false,
                    title: '',
                    isLocked: false,
                    conditionGroup: '',
                  },
                ],
              },
              {
                componentName: 'RootFooter',
                id: nextNodeId(),
                props: {},
                condition: true,
                hidden: false,
                title: '',
                isLocked: false,
                conditionGroup: '',
              },
            ],
          },
        ],
        id: formUuid,
        connectComponent: [],
      },
    ],
    actions: {
      module: {
        compiled: compiledCode,
        source: sourceCode,
      },
      type: 'FUNCTION',
      list: [
        { id: 'getCustomState', title: 'getCustomState' },
        { id: 'setCustomState', title: 'setCustomState' },
        { id: 'forceUpdate', title: 'forceUpdate' },
        { id: 'didMount', title: 'didMount' },
        { id: 'didUnmount', title: 'didUnmount' },
        { id: 'renderJsx', title: 'renderJsx' },
      ],
    },
    config: {
      connectComponent: [],
    },
  };

  return JSON.stringify(schema);
}

function normalizeOptionalCallback(value, property) {
  if (value === undefined) {
    return () => {};
  }
  if (typeof value !== 'function') {
    throw new TypeError(`buildNativePageSchemaContent ${property} must be a function`);
  }
  return value;
}

function resolveSchemaBuilderDependency(value, createDefault, property) {
  if (value === undefined) {
    return createDefault();
  }
  if (typeof value !== 'function') {
    throw new TypeError(`buildSchemaContent ${property} must be a function`);
  }
  return value;
}

module.exports = Object.freeze({
  buildDefaultPageDataSource,
  buildNativePageSchemaContent,
  countCustomPageDataSources,
  createNodeIdGenerator,
  extractPageDataSource,
  extractSchemaContent,
  generateSuffix,
  getGlobalDataSourceFitConfig,
  mergePageDataSource,
});
