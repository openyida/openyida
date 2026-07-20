'use strict';

/**
 * canvas-compile.js - Code Canvas 页面本地编译器
 *
 * 把原始 React/JSX/TSX 源码在本地（Node）编译成 Code Canvas 运行态代码
 * （runtimeCode）+ 依赖清单（importedModules），无需调用任何线上编译服务，
 * 因此不依赖登录态、不经过风控 WAF。
 *
 * ── 运行时契约（@ali/vc-deep-yida 的 YidaCodeCanvas 物料）──
 * 画布物料在浏览器里这样消费 runtimeCode（factory.tsx）：
 *
 *   const wrapped = `
 *     return function(iframeWindow, parentWindow){
 *       const window = iframeWindow;
 *       ${runtimeCode}
 *       return YidaComp;
 *     }`;
 *   new Function(wrapped)()(window, window);   // 取 Comp.YidaComp || Comp.default
 *
 * 由此推出 runtimeCode 必须满足：
 *   1) 是 `new Function` 能解析的纯 JS —— 不能含 JSX，也不能含 ESM import/export 语法；
 *   2) 执行结束时在作用域内留下一个 `YidaComp` 绑定；
 *   3) 第三方依赖以 `window.<别名>` 形式引用（antd→window.antd、react→window.React …），
 *      这些 UMD 依赖由画布运行时依据 importedModules 白名单按需注入。
 *
 * 因此本地编译 = Babel 把 JSX/TS 转成 ES5 → 把 import 改写成 window 别名引用、
 * 把 export default 改写成 `var YidaComp = ...` → 正则抽出依赖包名。
 */

const Babel = require('@babel/standalone');

/**
 * 依赖 → window 别名白名单。
 * 逐条镜像自 @ali/vc-deep-yida 的
 *   src/components/yida-code-canvas/dependencies.ts → getModuleAliasMap()
 * 只保留运行时真正用到的 windowAlias（资源 URL 由画布运行时按别名注入，
 * 本地编译不关心 CDN 地址）。若此处与物料白名单漂移，编译产物仍可运行，
 * 只是未收录的包会在浏览器端 `${name} is not found in dependencies map` 告警。
 * @type {Record<string, string>}
 */
const MODULE_ALIAS_MAP = {
  react: 'React',
  'react-dom': 'ReactDOM',
  antd: 'antd',
  ahooks: 'ahooks',
  d3: 'd3',
  '@ant-design/icons': 'icons',
  dayjs: 'dayjs',
  recharts: 'Recharts',
  'yida-plugin-markdown': 'YidaMarkdown',
  '@radix-ui/themes': 'Radix',
  'lucide-react': 'DynamicIcon',
  'framer-motion': 'FramerMotion',
};

const IMPORT_PATTERN = /import\s+(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g;
const IMPORT_SIDE_EFFECT_PATTERN = /import\s+['"]([^'"]+)['"]/g;
const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

function stripJsComments(code) {
  return String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * 从源码里正则抽取裸包名（过滤相对/绝对路径），去重排序。
 * 对齐 dingtalk-ai-app 的 _extract_imported_modules 行为。
 * @param {string} code
 * @returns {string[]}
 */
function extractImportedModules(code) {
  const modules = new Set();
  const source = stripJsComments(code);
  const patterns = [IMPORT_PATTERN, IMPORT_SIDE_EFFECT_PATTERN, REQUIRE_PATTERN, DYNAMIC_IMPORT_PATTERN];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const name = match[1];
      if (name && !name.startsWith('.') && !name.startsWith('/')) {
        modules.add(name);
      }
    }
  }
  return Array.from(modules).sort();
}

/**
 * 把包名（可能是子路径，如 `antd/es/button` 或 `@scope/pkg/sub`）解析到根包，
 * 再查白名单拿 windowAlias。命中返回别名，未命中返回 null。
 * @param {string} pkg
 * @returns {string|null}
 */
function resolveWindowAlias(pkg) {
  if (MODULE_ALIAS_MAP[pkg]) {
    return MODULE_ALIAS_MAP[pkg];
  }
  const segments = pkg.split('/');
  const base = pkg.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  return MODULE_ALIAS_MAP[base] || null;
}

/**
 * Babel 插件：把 ESM import/export 改写成画布运行时约定。
 *   import X from 'react'            → var _r = window.React; var X = _r && _r.__esModule ? _r.default : _r;
 *   import { Button } from 'antd'    → var _a = window.antd; var { Button } = _a;
 *   import * as d3 from 'd3'         → var d3 = window.d3;
 *   import 'some.css'                → （删除；副作用依赖由运行时按 importedModules 注入）
 *   export default App              → var YidaComp = App;
 *   export const x = ...            → const x = ...（去掉 export 关键字）
 * @param {{ types: import('@babel/types') }} babel
 */
function esmToWindowPlugin({ types: t }) {
  function moduleExpr(pkg) {
    const alias = resolveWindowAlias(pkg);
    if (alias) {
      return t.memberExpression(t.identifier('window'), t.identifier(alias));
    }
    // 未收录包：退化为 window["pkg"]，运行时若未注入会自然报错（与线上一致）。
    return t.memberExpression(t.identifier('window'), t.stringLiteral(pkg), true);
  }

  return {
    name: 'yida-esm-to-window',
    visitor: {
      ImportDeclaration(path) {
        const pkg = path.node.source.value;
        const specifiers = path.node.specifiers || [];

        // 相对/绝对路径导入：画布沙箱内无法解析，直接丢弃。
        if (pkg.startsWith('.') || pkg.startsWith('/')) {
          path.remove();
          return;
        }
        // 纯副作用导入（无 specifier）：依赖由运行时注入，删除语句本身。
        if (specifiers.length === 0) {
          path.remove();
          return;
        }

        const decls = [];
        const tmp = path.scope.generateUidIdentifier(resolveWindowAlias(pkg) || 'mod');
        decls.push(t.variableDeclarator(t.cloneNode(tmp), moduleExpr(pkg)));

        const namedProps = [];
        for (const spec of specifiers) {
          if (t.isImportDefaultSpecifier(spec)) {
            // interop：有 __esModule 取 .default，否则取模块本身。
            const init = t.conditionalExpression(
              t.logicalExpression(
                '&&',
                t.cloneNode(tmp),
                t.memberExpression(t.cloneNode(tmp), t.identifier('__esModule'))
              ),
              t.memberExpression(t.cloneNode(tmp), t.identifier('default')),
              t.cloneNode(tmp)
            );
            decls.push(t.variableDeclarator(t.identifier(spec.local.name), init));
          } else if (t.isImportNamespaceSpecifier(spec)) {
            decls.push(t.variableDeclarator(t.identifier(spec.local.name), t.cloneNode(tmp)));
          } else if (t.isImportSpecifier(spec)) {
            const importedName = t.isIdentifier(spec.imported) ? spec.imported.name : spec.imported.value;
            const localName = spec.local.name;
            namedProps.push(
              t.objectProperty(
                t.identifier(importedName),
                t.identifier(localName),
                false,
                importedName === localName
              )
            );
          }
        }
        if (namedProps.length) {
          decls.push(t.variableDeclarator(t.objectPattern(namedProps), t.cloneNode(tmp)));
        }
        path.replaceWith(t.variableDeclaration('var', decls));
      },

      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        if (t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) {
          if (decl.id) {
            // 具名声明：保留声明本体，再补 `var YidaComp = <name>;`
            const idName = decl.id.name;
            path.replaceWithMultiple([
              decl,
              t.variableDeclaration('var', [
                t.variableDeclarator(t.identifier('YidaComp'), t.identifier(idName)),
              ]),
            ]);
            return;
          }
          const expr = t.isFunctionDeclaration(decl)
            ? t.functionExpression(null, decl.params, decl.body, decl.generator, decl.async)
            : t.classExpression(null, decl.superClass, decl.body, decl.decorators || []);
          path.replaceWith(
            t.variableDeclaration('var', [t.variableDeclarator(t.identifier('YidaComp'), expr)])
          );
          return;
        }
        // export default <表达式>
        path.replaceWith(
          t.variableDeclaration('var', [t.variableDeclarator(t.identifier('YidaComp'), decl)])
        );
      },

      ExportNamedDeclaration(path) {
        if (path.node.declaration) {
          // export const/function/class ... → 去掉 export 关键字保留声明。
          path.replaceWith(path.node.declaration);
        } else {
          // export { a, b } / re-export：画布不需要，删除。
          path.remove();
        }
      },

      ExportAllDeclaration(path) {
        path.remove();
      },
    },
  };
}

/**
 * 本地编译 Code Canvas 源码。
 * @param {string} source 原始 React/JSX/TSX 源码
 * @returns {{ runtimeCode: string, importedModules: string }}
 */
function compileCanvasLocal(source) {
  const importedModules = extractImportedModules(source);

  // 第一步：剥类型 + 转 JSX（classic runtime，产出 React.createElement，
  // 引用外部标识符 React；不注入 jsx-runtime import，避免再引入 ESM）。
  const stage1 = Babel.transform(source, {
    filename: 'canvas.tsx',
    presets: [
      ['typescript', { allExtensions: true, isTSX: true, allowDeclareFields: true }],
      ['react', { runtime: 'classic' }],
    ],
    sourceType: 'module',
    compact: false,
    babelrc: false,
    configFile: false,
  });

  let intermediate = stage1.code || '';

  // classic JSX 需要作用域内存在 React；若源码没显式 import react，补一行
  // `import React from 'react'`，交给下一步统一改写为 window.React，并确保
  // 'react' 进入依赖清单（运行时据此注入 React UMD）。
  const usesJsxRuntime = /\bReact\.createElement\b|\bReact\.Fragment\b/.test(intermediate);
  const hasReactBinding = /\b(var|let|const)\s+React\b/.test(intermediate) || /\bimport\s+React\b/.test(intermediate);
  if (usesJsxRuntime && !hasReactBinding) {
    intermediate = "import React from 'react';\n" + intermediate;
    if (!importedModules.includes('react')) {
      importedModules.push('react');
      importedModules.sort();
    }
  }

  // 第二步：把 import/export 改写成 window 别名 + YidaComp。
  const stage2 = Babel.transform(intermediate, {
    filename: 'canvas.js',
    plugins: [esmToWindowPlugin],
    sourceType: 'module',
    compact: false,
    babelrc: false,
    configFile: false,
  });

  const runtimeCode = stage2.code || '';
  return {
    runtimeCode,
    importedModules: JSON.stringify(importedModules),
  };
}

/**
 * 兼容既有调用方传入 options 的异步入口。
 * 本地编译不需要 endpoint，options 保留但忽略。
 * @param {string} source
 * @param {object} [options] 兼容占位，未使用
 * @returns {Promise<{ runtimeCode: string, importedModules: string }>}
 */
function compileCanvas(source, options = {}) { // eslint-disable-line no-unused-vars
  return new Promise((resolve, reject) => {
    if (typeof source !== 'string' || source.trim() === '') {
      reject(new Error('canvas 编译源码为空'));
      return;
    }
    try {
      resolve(compileCanvasLocal(source));
    } catch (compileError) {
      const detail = compileError && compileError.message ? compileError.message : String(compileError);
      reject(new Error(`Code Canvas 本地编译失败: ${detail}`));
    }
  });
}

module.exports = {
  compileCanvas,
  compileCanvasLocal,
  extractImportedModules,
  resolveWindowAlias,
  MODULE_ALIAS_MAP,
};
