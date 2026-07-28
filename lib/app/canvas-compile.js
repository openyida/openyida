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
 * 把 export default 改写成画布入口 `YidaComp` → 正则抽出依赖包名。
 */

const Babel = require('@babel/standalone');
const {
  assertNoEmojiInArtifactName,
  assertNoEmojiInText,
} = require('../core/no-emoji-guard');
const { CliError, isCliError } = require('../core/cli-error');

/**
 * 依赖 → window 别名白名单。
 * 逐条镜像自 @ali/vc-deep-yida 的
 *   src/components/yida-code-canvas/dependencies.ts → getModuleAliasMap()
 * 只保留运行时真正用到的 windowAlias（资源 URL 由画布运行时按别名注入，
 * 本地编译不关心 CDN 地址）。默认拒绝未收录依赖；如果宜搭物料依赖表已经
 * 先于 CLI 升级，可临时设置 OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS=1
 * 退回旧的 window["pkg"] 映射，避免白名单漂移阻断发布。
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

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function shouldAllowUnsupportedBareImports(options = {}, env = process.env) {
  return options.allowUnsupportedBareImports === true ||
    isTruthy(env.OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS);
}

function packageTempName(pkg) {
  return String(pkg || 'module').replace(/[^A-Za-z0-9_$]+/g, '_') || 'module';
}

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
function esmToWindowPlugin({ types: t }, options = {}) {
  const allowUnsupportedBareImports = options.allowUnsupportedBareImports === true;

  function moduleExpr(pkg, alias) {
    if (alias) {
      return t.memberExpression(t.identifier('window'), t.identifier(alias));
    }
    return t.memberExpression(t.identifier('window'), t.stringLiteral(pkg), true);
  }

  function buildUnsupportedBareImportError(path, pkg) {
    return path.buildCodeFrameError(
      `Code Canvas 不支持从裸包 "${pkg}" 导入绑定。`
      + '只允许 MODULE_ALIAS_MAP 白名单依赖；'
      + '宜搭平台运行态全局对象请显式使用 window.* 访问'
      + '（例如 window.Deep、window.DeepYida、window.YidaNativeComponents），不要从包中 import。'
      + '若已确认宜搭物料运行态已注入该包且 CLI 白名单滞后，可临时设置 '
      + 'OPENYIDA_CANVAS_ALLOW_UNSUPPORTED_IMPORTS=1 退回 legacy window["pkg"] 映射。'
    );
  }

  function hasProgramBinding(path, name) {
    const program = path.findParent((parentPath) => parentPath.isProgram());
    return Boolean(program && program.scope.hasBinding(name));
  }

  function isExistingYidaCompDefault(path, decl) {
    return t.isIdentifier(decl, { name: 'YidaComp' }) && hasProgramBinding(path, 'YidaComp');
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
        const alias = resolveWindowAlias(pkg);
        if (!alias && !allowUnsupportedBareImports) {
          throw buildUnsupportedBareImportError(path, pkg);
        }

        const decls = [];
        const tmp = path.scope.generateUidIdentifier(alias || packageTempName(pkg));
        decls.push(t.variableDeclarator(t.cloneNode(tmp), moduleExpr(pkg, alias)));

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
            if (decl.id.name === 'YidaComp') {
              path.replaceWith(decl);
              return;
            }
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
        if (isExistingYidaCompDefault(path, decl)) {
          path.remove();
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

function buildCanvasRuntimeWrapper(runtimeCode) {
  return (
    'return function(iframeWindow, parentWindow){ const window = iframeWindow; '
    + runtimeCode
    + ' return YidaComp; }'
  );
}

function assertCanvasRuntimeParseable(runtimeCode, options = {}) {
  try {
    // 只编译 wrapper，不执行 factory 或用户组件，避免触发源码里的运行期副作用。
    // eslint-disable-next-line no-new-func
    new Function(buildCanvasRuntimeWrapper(runtimeCode));
  } catch (error) {
    const detail = error && error.message ? error.message : String(error);
    const sourceLabel = options.sourcePath ? ` (${options.sourcePath})` : '';
    const compileError = new Error(
      `Code Canvas runtimeCode 无法通过画布运行时装配校验${sourceLabel}: ${detail}`
      + '。请检查默认导出、YidaComp 入口或 window 等运行时保留变量是否重复声明。'
    );
    compileError.code = 'OPENYIDA_CANVAS_RUNTIME_PARSE_FAILED';
    compileError.cause = error;
    throw compileError;
  }
}

/**
 * 本地编译 Code Canvas 源码。
 * @param {string} source 原始 React/JSX/TSX 源码
 * @returns {{ runtimeCode: string, importedModules: string }}
 */
function compileCanvasLocal(source, options = {}) {
  if (options.sourcePath) {
    assertNoEmojiInArtifactName(options.sourcePath, {
      code: 'OPENYIDA_PAGE_FILENAME_EMOJI_FORBIDDEN',
    });
  }
  assertNoEmojiInText(source, {
    artifact: options.sourcePath || 'Code Canvas source',
    code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
  });

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
    plugins: [[esmToWindowPlugin, {
      allowUnsupportedBareImports: shouldAllowUnsupportedBareImports(options),
    }]],
    sourceType: 'module',
    compact: false,
    babelrc: false,
    configFile: false,
  });

  const runtimeCode = stage2.code || '';
  assertNoEmojiInText(runtimeCode, {
    artifact: options.sourcePath ? options.sourcePath + ' runtime' : 'Code Canvas runtime',
    code: 'OPENYIDA_CANVAS_SOURCE_EMOJI_FORBIDDEN',
  });
  assertCanvasRuntimeParseable(runtimeCode, options);
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
function compileCanvas(source, options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof source !== 'string' || source.trim() === '') {
      reject(new CliError('canvas 编译源码为空', {
        code: 'OPENYIDA_CANVAS_COMPILE_EMPTY_SOURCE',
        details: {
          stage: 'canvas_compile',
          sourcePath: options.sourcePath,
        },
      }));
      return;
    }
    try {
      resolve(compileCanvasLocal(source, options));
    } catch (compileError) {
      if (isCliError(compileError)) {
        reject(compileError);
        return;
      }
      const detail = compileError && compileError.message ? compileError.message : String(compileError);
      if (
        compileError &&
        /^OPENYIDA_/.test(String(compileError.code || '')) &&
        compileError.details !== undefined
      ) {
        reject(new CliError(`Code Canvas 本地编译失败: ${detail}`, {
          code: compileError.code,
          details: compileError.details,
        }));
        return;
      }
      reject(new CliError(`Code Canvas 本地编译失败: ${detail}`, {
        code: 'OPENYIDA_CANVAS_COMPILE_FAILED',
        details: {
          stage: 'canvas_compile',
          sourcePath: options.sourcePath,
          causeCode: compileError && compileError.code,
          causeName: compileError && compileError.name,
          loc: compileError && compileError.loc,
        },
      }));
    }
  });
}

module.exports = {
  compileCanvas,
  compileCanvasLocal,
  extractImportedModules,
  resolveWindowAlias,
  shouldAllowUnsupportedBareImports,
  assertCanvasRuntimeParseable,
  MODULE_ALIAS_MAP,
};
