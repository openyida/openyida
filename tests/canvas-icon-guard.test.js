'use strict';

const fs = require('fs');
const path = require('path');
const { assertCanvasIconExports } = require('../lib/app/canvas-icon-guard');
const { compileCanvasLocal } = require('../lib/app/canvas-compile');
const manifest = require('../lib/app/canvas-icon-exports.json');

describe('Canvas runtime icon exports', () => {
  test.each([
    "import { Museum } from 'lucide-react';",
    "import { Museum as Logo } from 'lucide-react';",
    "import * as Icons from 'lucide-react'; const x = <Icons.Museum />;",
    "import * as Icons from 'lucide-react'; const x = Icons['Museum'];",
    "import * as Icons from 'lucide-react'; const x = Icons[`Museum`];",
    "import * as Icons from 'lucide-react'; const x = Icons?.Museum;",
    "import * as Icons from 'lucide-react'; const {Museum: Logo} = Icons;",
    "import * as Icons from 'lucide-react'; let Logo; ({Museum: Logo} = Icons);",
    "import * as Icons from 'lucide-react'; const Alias = Icons; const x = <Alias.Museum />;",
  ])('rejects unavailable exports: %s', source => {
    expect(() => assertCanvasIconExports(source, { sourcePath: 'home.canvas.jsx' })).toThrow(expect.objectContaining({
      code: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE',
      details: expect.objectContaining({
        sourcePath: 'home.canvas.jsx', packageName: 'lucide-react', exportName: 'Museum',
        line: 1, suggestions: ['Landmark'], runtimeAsset: manifest.packages['lucide-react'].assetUrl,
      }),
    }));
  });

  test('rejects missing Ant Design icons too', () => {
    expect(() => compileCanvasLocal("import { MuseumOutlined } from '@ant-design/icons'; export default () => <MuseumOutlined />;"))
      .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE' }));
  });

  test('does not treat inherited object properties as special exports', () => {
    expect(() => assertCanvasIconExports("import { constructor as Icon } from 'lucide-react';"))
      .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE' }));
  });

  test('preserves valid aliases and existing runtime import conventions', () => {
    const source = `
      import DynamicIcon, { Landmark as Museum, Search, DynamicIcon as Dynamic } from 'lucide-react';
      import * as Icons from 'lucide-react';
      import Icon, { HomeOutlined } from '@ant-design/icons';
      export default () => <div><Museum/><Search/><Icons.RefreshCw/><HomeOutlined/>
        <DynamicIcon name="home"/><Dynamic name="home"/><Icon/></div>;
    `;
    expect(compileCanvasLocal(source).runtimeCode).toContain('window.LucideReact');
  });

  test('does not confuse shadowed variables with namespace imports', () => {
    const source = `import * as Icons from 'lucide-react';
      function Child(Icons) { return <Icons.Museum/>; }
      export default () => <Child Icons={{ Museum: Icons.Landmark }}/>;`;
    expect(() => compileCanvasLocal(source)).not.toThrow();
  });

  test('ignores type-only imports and unrelated packages', () => {
    expect(() => assertCanvasIconExports("import type { Museum } from 'lucide-react'; import { type FakeIcon, Home } from 'lucide-react'; import { Museum as Other } from 'other';"))
      .not.toThrow();
  });

  test('retains dynamic lookups with an explicit supported fallback', () => {
    expect(() => compileCanvasLocal(`import * as Icons from 'lucide-react';
      export default function App({name}) { const Icon = Icons[name] || Icons.Landmark; return <Icon/>; }`)).not.toThrow();
  });

  test('library escape hatch cannot bypass known unavailable icon exports', () => {
    expect(() => compileCanvasLocal("import { Museum } from 'lucide-react'; export default () => <Museum/>;", { allowUnsupportedBareImports: true }))
      .toThrow(expect.objectContaining({ code: 'OPENYIDA_CANVAS_ICON_EXPORT_UNAVAILABLE' }));
  });

  test('reports original source line and column before JSX transformation', () => {
    expect(() => compileCanvasLocal("\n\nimport { Museum as Logo } from 'lucide-react';\nexport default () => <Logo/>;"))
      .toThrow(expect.objectContaining({ details: expect.objectContaining({ line: 3, column: 10, exportName: 'Museum' }) }));
  });

  test('checked-in export manifest is complete, sorted and tied to runtime assets', () => {
    for (const entry of Object.values(manifest.packages)) {
      expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(entry.assetUrl).toMatch(/^https:\/\/g\.alicdn\.com\//);
      expect(entry.exports).toEqual([...new Set(entry.exports)].sort());
      expect(entry.exports.length).toBeGreaterThan(800);
    }
    expect(manifest.packages['lucide-react'].exports).toContain('Landmark');
    expect(manifest.packages['lucide-react'].exports).not.toContain('Museum');
  });

  test('shipped samples use available icon exports', () => {
    function walk(directory) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) { walk(filename); }
        else if (/\.(jsx|tsx)$/.test(filename)) {
          expect(() => assertCanvasIconExports(fs.readFileSync(filename, 'utf8'), { sourcePath: filename })).not.toThrow();
        }
      }
    }
    walk(path.join(__dirname, '../lib/samples'));
  });
});
