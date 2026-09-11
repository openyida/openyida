'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync, spawnSync } = require('child_process');

const { buildPageSource, ensureYidaRuntimeContract, fixYidaSource } = require('../lib/app/page-compat');
const { lintYidaSource } = require('../lib/app/page-linter');
const { default: babelTransform } = require('../lib/core/babel-transform');

const ROOT = path.join(__dirname, '..');
const BIN = path.join(ROOT, 'bin', 'yida.js');

function evaluateActions(sourceCode) {
  const babelResult = babelTransform(sourceCode, {}, false, { RE_VERSION: '7.4.0' });
  if (babelResult.error) {
    throw babelResult.error;
  }
  const sandbox = {
    exports: {},
    module: { exports: {} },
    console,
    React: { createElement: () => ({}) },
    Object,
    Date,
  };
  vm.runInNewContext(`${babelResult.compiled}\nmodule.exports = exports;`, sandbox);
  return sandbox.module.exports;
}

function createYidaInstance(actions) {
  const instance = {
    state: {},
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
    },
  };
  Object.keys(actions).forEach((key) => {
    if (typeof actions[key] === 'function') {
      instance[key] = actions[key];
    }
  });
  return instance;
}

describe('page compatibility builder', () => {
  test('lowers a small authoring React function into Yida export functions', () => {
    const source = `
import React, { useEffect, useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    window.__mounted = true;
    return () => {
      window.__mounted = false;
    };
  }, []);

  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`;

    const result = buildPageSource(source, '/tmp/counter.oyd.jsx');

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('modern-authoring');
    expect(result.code).toContain('var _customState =');
    expect(result.code).toContain('export function renderJsx()');
    expect(result.code).toContain("var count = this.getCustomState('count');");
    expect(result.code).toContain('this.setCustomState({');
    expect(result.code).toContain('count: count + 1');
    expect(result.code).toContain('__openYidaCompatState: nextState');
    expect(result.code).toMatch(/display:\s*["']none["']/);
    expect(result.code).toContain('this.state && this.state.timestamp');
    expect(result.code).not.toContain('useState');
    expect(result.code).not.toContain('import React');
    expect(lintYidaSource(result.code, '/tmp/counter.yida.jsx').errors).toHaveLength(0);
  });

  test('persists lowered state through the Yida component instance state', () => {
    const source = `
import React, { useEffect, useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  return <button onClick={() => setCount(count + 1)}>{ready ? count : 'loading'}</button>;
}
`;

    const result = buildPageSource(source, '/tmp/runtime.oyd.jsx');
    expect(result.ok).toBe(true);

    const actions = evaluateActions(result.code);
    const instance = createYidaInstance(actions);

    expect(instance.getCustomState('count')).toBe(0);
    expect(instance.getCustomState('ready')).toBe(false);

    instance.didMount();
    instance.setCustomState({ count: 1 });

    expect(instance.state.__openYidaCompatState).toMatchObject({ count: 1, ready: true });
    expect(instance.getCustomState('count')).toBe(1);
    expect(instance.getCustomState('ready')).toBe(true);

    const reloadedActions = evaluateActions(result.code);
    Object.keys(reloadedActions).forEach((key) => {
      if (typeof reloadedActions[key] === 'function') {
        instance[key] = reloadedActions[key];
      }
    });

    expect(instance.getCustomState('count')).toBe(1);
    expect(instance.getCustomState('ready')).toBe(true);
  });

  test('lowers functional state updaters so lifecycle code reads current custom state', () => {
    const source = `
import React, { useEffect, useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(2);
  useEffect(() => {
    setCount((prev) => prev + 1);
  }, []);

  return <button onClick={() => setCount((prev) => prev + 1)}>{count}</button>;
}
`;

    const result = buildPageSource(source, '/tmp/updater.oyd.jsx');

    expect(result.ok).toBe(true);
    expect(result.code).toMatch(/this\.getCustomState\(["']count["']\) \+ 1/);

    const actions = evaluateActions(result.code);
    const instance = createYidaInstance(actions);

    expect(instance.getCustomState('count')).toBe(2);
    instance.didMount();
    expect(instance.getCustomState('count')).toBe(3);
  });

  test('mechanically fixes direct this event handlers in existing Yida pages', () => {
    const source = `
export function renderJsx() {
  return <button onClick={this.handleClick}>Run</button>;
}
export function handleClick() {}
`;

    const result = fixYidaSource(source);

    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('onClick={e => {');
    expect(result.code).toContain('this.handleClick(e);');
  });

  test('preserves bound arguments when fixing .bind(this) event handlers', () => {
    const source = `
export function renderJsx() {
  var row = { id: 'R-001' };
  return <button onClick={this.openRow.bind(this, row.id)}>Open</button>;
}
export function openRow(id, e) {}
`;

    const result = fixYidaSource(source);

    expect(result.errors).toHaveLength(0);
    expect(result.code).toContain('this.openRow(row.id, e);');
  });

  test('injects hidden timestamp into native render branches', () => {
    const source = `
export function renderJsx() {
  if (this.getCustomState('loading')) {
    return <section>Loading</section>;
  }
  return <main><button onClick={this.handleClick}>Run</button></main>;
}
export function handleClick() {}
`;

    const result = fixYidaSource(source);

    expect(result.errors).toHaveLength(0);
    expect(result.code.match(/this\.state && this\.state\.timestamp/g)).toHaveLength(2);
    expect(result.fixes.map(fix => fix.rule)).toContain('render-timestamp');
  });

  test('injects missing runtime exports for minimal native pages', () => {
    const source = `
export function renderJsx() {
  return <main>Hello</main>;
}
`;

    const result = ensureYidaRuntimeContract(source);

    expect(result.code).toContain('var _customState = {};');
    expect(result.code).toContain('export function getCustomState');
    expect(result.code).toContain('export function setCustomState');
    expect(result.code).toContain('export function forceUpdate');
    expect(result.code).toContain('export function didMount() {}');
    expect(result.code).toContain('export function didUnmount() {}');
  });

  test('treats .oyd files with renderJsx as native Yida source', () => {
    const source = `
export function renderJsx() {
  return <button onClick={this.handleClick}>Save</button>;
}
export function handleClick() {}
`;

    const result = buildPageSource(source, '/tmp/native.oyd.jsx');

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('yida-source');
    expect(result.code).toContain('export function renderJsx()');
    expect(result.code).toContain('onClick={e => {');
    expect(result.fixes.map(fix => fix.rule)).toContain('event-direct-method');
  });

  test('auto-fixes array callbacks in native Yida source', () => {
    const source = `
export function renderJsx() {
  const items = [1, 2, 3];
  return <div>{items.map(function(item) { return <span onClick={() => this.pick(item)}>{item}</span>; })}</div>;
}
export function pick(item) {}
`;

    const result = buildPageSource(source, '/tmp/native-callbacks.oyd.jsx');

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('yida-source');
    expect(result.code).toContain('var items = [1, 2, 3];');
    expect(result.code).toContain('items.map(item => {');
    expect(result.fixes.map(fix => fix.rule)).toContain('array-callback-arrow');
    expect(result.fixes.map(fix => fix.rule)).toContain('variable-declaration-var');
  });

  test('rejects unsupported hooks in authoring mode', () => {
    const source = `
import React, { useReducer } from 'react';
export default function Page() {
  const [state] = useReducer((s) => s, {});
  return <div>{state.name}</div>;
}
`;

    const result = buildPageSource(source, '/tmp/reducer.oyd.jsx');

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'UNSUPPORTED_HOOK',
        hook: 'useReducer',
        line: 4,
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        sourceRepairable: true,
        recommendedAuthoringMode: 'canvas',
        replacement: expect.stringContaining('useState'),
        nextAction: {
          type: 'edit_source_then_recheck',
          commandId: 'check-page',
        },
      }),
    ]));
  });

  test('rejects useEffect with dependency arrays that cannot be lowered safely', () => {
    const source = `
import React, { useEffect, useState } from 'react';
export default function Page() {
  const [count] = useState(0);
  useEffect(() => {
    window.__count = count;
  }, [count]);
  return <div>{count}</div>;
}
`;

    const result = buildPageSource(source, '/tmp/effect-deps.oyd.jsx');

    expect(result.ok).toBe(false);
    expect(result.errors.map(issue => issue.code)).toContain('UNSUPPORTED_EFFECT_DEPS');
  });

  test('rejects useEffect bodies that reference render-local helpers', () => {
    const source = `
import React, { useEffect, useState } from 'react';
export default function Page() {
  const [ready, setReady] = useState(false);
  const loadRows = () => {
    setReady(true);
  };
  useEffect(() => {
    loadRows();
  }, []);
  return <div>{ready ? 'ready' : 'loading'}</div>;
}
`;

    const result = buildPageSource(source, '/tmp/local-effect.oyd.jsx');

    expect(result.ok).toBe(false);
    expect(result.errors.map(issue => issue.code)).toContain('UNSUPPORTED_EFFECT_LOCAL_REFERENCE');
  });

  test('rejects useEffect cleanup captures that would be undefined in didUnmount', () => {
    const source = `
import React, { useEffect, useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setCount((prev) => prev + 1), 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return <div>{count}</div>;
}
`;

    const result = buildPageSource(source, '/tmp/cleanup-capture.oyd.jsx');

    expect(result.ok).toBe(false);
    expect(result.errors.map(issue => issue.code)).toContain('UNSUPPORTED_EFFECT_CLEANUP_REFERENCE');
  });

  test('inserts var self = this at the top of renderJsx when missing', () => {
    const source = `
export function renderJsx() {
  return <button onClick={(e) => { this.save(e); }}>Save</button>;
}
export function save() {}
`;

    const result = fixYidaSource(source);

    expect(result.errors).toHaveLength(0);
    expect(result.fixes.map(fix => fix.rule)).toContain('self-binding-inserted');
    expect(result.code).toContain('var self = this;');
  });

  test('does not re-insert self binding when renderJsx already declares it', () => {
    const source = `
export function renderJsx() {
  var self = this;
  return <button onClick={(e) => { self.save(e); }}>Save</button>;
}
export function save() {}
`;

    const result = fixYidaSource(source);

    expect(result.errors).toHaveLength(0);
    expect(result.fixes.map(fix => fix.rule)).not.toContain('self-binding-inserted');
    expect(result.code.match(/var self = this;/g)).toHaveLength(1);
  });

  test('clamps oversized pageSize to the platform max of 100', () => {
    const source = `
export function renderJsx() {
  return <div />;
}
export function loadRows() {
  this.utils.yida.searchFormDatas({ formUuid: 'FORM-X', pageSize: 200 });
}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).toContain('pagesize-clamped');
    expect(result.code).toMatch(/pageSize:\s*100/);
    expect(result.code).not.toMatch(/pageSize:\s*200/);
  });

  test('inserts the recommended pageSize 50 when a pagination object omits it', () => {
    const source = `
export function renderJsx() {
  return <div />;
}
export function loadRows() {
  this.utils.yida.searchFormDatas({ formUuid: 'FORM-X', currentPage: 1 });
}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).toContain('pagesize-default-inserted');
    expect(result.code).toMatch(/pageSize:\s*50/);
  });

  test('leaves a legal explicit pageSize untouched', () => {
    const source = `
export function renderJsx() {
  return <div />;
}
export function loadRows() {
  this.utils.yida.searchFormDatas({ formUuid: 'FORM-X', pageSize: 50 });
}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).not.toContain('pagesize-clamped');
    expect(result.fixes.map(fix => fix.rule)).not.toContain('pagesize-default-inserted');
    expect(result.code).toMatch(/pageSize:\s*50/);
  });

  test('does not inject pageSize into setCustomState state objects that merely carry currentPage', () => {
    const source = `
export function renderJsx() {
  return <div />;
}
export function chooseStatus(value) {
  this.setCustomState({ statusFilter: value, openDropdown: '', currentPage: 1 });
}
export function goPage(page) {
  this.setCustomState({ currentPage: page });
}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).not.toContain('pagesize-default-inserted');
    expect(result.code).not.toMatch(/pageSize:\s*50/);
    expect(result.code).toMatch(/currentPage/);
  });

  test('still injects pageSize for a data-fetch call argument even without formUuid inline', () => {
    const source = `
export function renderJsx() {
  return <div />;
}
export function loadRows() {
  this.utils.yida.searchFormDatas({ currentPage: 1 });
}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).toContain('pagesize-default-inserted');
    expect(result.code).toMatch(/pageSize:\s*50/);
  });

  test('injects the Tailwind loader only when Tailwind classes are used', () => {
    const withTailwind = `
export function renderJsx() {
  var self = this;
  return <div className="flex items-center gap-2 px-4">Hello</div>;
}
`;

    const result = fixYidaSource(withTailwind);

    expect(result.fixes.map(fix => fix.rule)).toContain('tailwind-injected');
    expect(result.fixes.map(fix => fix.rule)).toContain('tailwind-didmount-hook');
    expect(result.code).toContain('export function ensureTailwind');
    expect(result.code).toContain('this.ensureTailwind();');
    expect(result.code).toContain('https://g.alicdn.com/code/lib/tailwindcss-browser/0.0.0-insiders.fed6c6a/index.global.min.js');
    expect(result.code).not.toContain('https://cdn.tailwindcss.com');

    const withoutTailwind = `
export function renderJsx() {
  var self = this;
  return <div className="my-plain-card">Hello</div>;
}
`;

    const plain = fixYidaSource(withoutTailwind);

    expect(plain.fixes.map(fix => fix.rule)).not.toContain('tailwind-injected');
    expect(plain.code).not.toContain('export function ensureTailwind');
  });

  test('does not clobber a user-authored didMount when injecting Tailwind', () => {
    const source = `
export function renderJsx() {
  var self = this;
  return <div className="flex items-center gap-2 px-4">Hello</div>;
}
export function didMount() {
  this.loadData();
}
export function loadData() {}
`;

    const result = fixYidaSource(source);

    expect(result.fixes.map(fix => fix.rule)).toContain('tailwind-injected');
    expect(result.fixes.map(fix => fix.rule)).not.toContain('tailwind-didmount-hook');
    expect(result.code).toContain('this.loadData();');
  });
});

describe('build-page command', () => {
  let tmpDir;
  let tmpHome;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-build-page-'));
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-build-home-'));
    fs.writeFileSync(path.join(tmpDir, 'config.json'), '{}', 'utf8');
    fs.mkdirSync(path.join(tmpDir, 'pages', 'src'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function cliEnv() {
    const env = {
      ...process.env,
      HOME: tmpHome,
      USERPROFILE: tmpHome,
      OPENYIDA_LANG: 'zh',
      CI: '1',
    };
    for (const key of Object.keys(env)) {
      if (key.startsWith('CODEX') || key === 'AGENT_WORK_ROOT') {
        delete env[key];
      }
    }
    return env;
  }

  test('writes generated Yida source and compile consumes .oyd.jsx automatically', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'counter.oyd.jsx');
    fs.writeFileSync(sourcePath, `
import React, { useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`, 'utf8');

    const output = execFileSync(process.execPath, [BIN, 'build-page', 'pages/src/counter.oyd.jsx', '--json'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
    expect(parsed.outputPath).toContain(path.join('pages', 'build', 'counter.yida.jsx'));
    expect(fs.existsSync(parsed.outputPath)).toBe(true);

    execFileSync(process.execPath, [BIN, 'compile', 'pages/src/counter.oyd.jsx'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(fs.existsSync(path.join(tmpDir, 'pages', 'dist', 'counter.yida.js'))).toBe(true);
  });

  test('check-page compatibility-builds .oyd.jsx before linting', () => {
    const sourcePath = path.join(tmpDir, 'pages', 'src', 'native.oyd.jsx');
    fs.writeFileSync(sourcePath, `
export function renderJsx() {
  var items = [1, 2];
  return <div>{items.map(function(item) { return <button onClick={this.handleClick}>{item}</button>; })}</div>;
}
export function handleClick() {}
`, 'utf8');

    const output = execFileSync(process.execPath, [BIN, 'check-page', 'pages/src/native.oyd.jsx', '--json'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });
    const parsed = JSON.parse(output);

    expect(parsed.ok).toBe(true);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.build.mode).toBe('yida-source');
    expect(parsed.build.fixes.map(fix => fix.rule)).toEqual(expect.arrayContaining([
      'array-callback-arrow',
      'event-direct-method',
    ]));
  });

  test('check-page compatibility-builds plain export-default JSX pages', () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'plain-react.jsx'), `
import React, { useState } from 'react';
export default function Page() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
`, 'utf8');

    const output = execFileSync(process.execPath, [BIN, 'check-page', 'pages/src/plain-react.jsx', '--json'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });
    const parsed = JSON.parse(output);

    expect(parsed.ok).toBe(true);
    expect(parsed.build.mode).toBe('modern-authoring');
  });

  test('check-page returns one structured repairable error for unsupported hooks', () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'src', 'reducer.oyd.jsx'), `
import React, { useReducer } from 'react';
export default function Page() {
  const [state] = useReducer((value) => value, {});
  return <div>{state.name}</div>;
}
`, 'utf8');

    const result = spawnSync(process.execPath, [BIN, 'check-page', 'pages/src/reducer.oyd.jsx', '--json'], {
      cwd: tmpDir,
      env: cliEnv(),
      encoding: 'utf8',
      timeout: 10000,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toMatchObject({
      success: false,
      errorCode: 'CHECK_PAGE_FAILED',
      details: {
        retryable: false,
        retrySafe: true,
        sideEffectState: 'none',
        sourceRepairable: true,
        primaryIssue: {
          code: 'UNSUPPORTED_HOOK',
          hook: 'useReducer',
          line: 4,
        },
        nextAction: {
          type: 'edit_source_then_recheck',
          commandId: 'check-page',
        },
      },
    });
  });
});
