#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function readThemeSnapshot(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = {};
  let depth = 0;
  let boundary = 0;
  let bodyStart = 0;
  let rootBlock = false;
  let quote = '';
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '\\') { index++; continue; }
    if (quote) {
      if (char === quote) {quote = '';}
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '{') {
      if (depth === 0) {
        rootBlock = source.slice(boundary, index).trim() === ':root';
        bodyStart = index + 1;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth < 0) {throw new Error('Unbalanced theme CSS');}
      if (depth === 0) {
        if (rootBlock) {
          const body = source.slice(bodyStart, index);
          for (const declaration of body.matchAll(/(?:^|;)\s*(--[\w-]+)\s*:\s*([^;]+)(?=;|$)/g)) {
            tokens[declaration[1]] = declaration[2].trim().replace(/\s*!important\s*$/, '');
          }
        }
        boundary = index + 1;
      }
    } else if (char === ';' && depth === 0) {
      boundary = index + 1;
    }
  }
  if (depth !== 0 || quote) {throw new Error('Unbalanced theme CSS');}
  if (!tokens['--color-brand1-6']) {
    throw new Error('theme file must declare --color-brand1-6 in a top-level :root block');
  }
  return tokens;
}

function buildProvider(css, url) {
  if (url && new URL(url).protocol !== 'https:') {
    throw new Error('--theme-url must be an absolute HTTPS URL from the theme upload result');
  }
  const source = {
    url: url ? new URL(url).href : '',
    sha256: crypto.createHash('sha256').update(css).digest('hex'),
    tokens: readThemeSnapshot(css),
  };
  return renderProvider(source);
}

function renderProvider(source, includeImports = true) {
  let template = fs.readFileSync(path.join(__dirname, 'canvas-theme-provider.template.jsx'), 'utf8');
  if (!includeImports) {template = template.slice(template.indexOf('const CANVAS_THEME_SOURCE'));}
  // Keep generated source safe to embed in HTML and compatible with Canvas compilation.
  return template.replace('__CANVAS_THEME_SOURCE__', JSON.stringify(source).replace(/</g, '\\u003c'));
}

function buildApplicationProvider(includeImports = true) {
  return renderProvider({ url: '', sha256: '', tokens: {} }, includeImports);
}

function assembleApplicationTheme(source) {
  const marker = '/* @canvas-application-theme */';
  const parts = source.split(marker);
  if (parts.length === 1) {return source;}
  if (parts.length !== 2) {throw new Error('Sample must contain exactly one application theme marker');}
  return parts.join(buildApplicationProvider(false));
}

function run(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--theme-file', '--theme-url', '--output', '--page'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Usage: node build-canvas-theme.js --theme-file app-theme.css [--theme-url https://...] --output page.canvas.jsx [--page source.canvas.jsx]');
    }
    if (options[args[i]]) {throw new Error(`Duplicate option: ${args[i]}`);}
    options[args[i]] = args[i + 1];
  }
  if (!options['--theme-file'] || !options['--output']) {throw new Error('--theme-file and --output are required');}
  const output = path.resolve(options['--output']);
  const inputs = [options['--theme-file'], options['--page'], __filename, path.join(__dirname, 'canvas-theme-provider.template.jsx')].filter(Boolean).map(file => path.resolve(file));
  if (inputs.includes(output)) {throw new Error('--output must not overwrite an input or generator');}
  const css = fs.readFileSync(options['--theme-file'], 'utf8');
  const provider = buildProvider(css, options['--theme-url']);
  let result;
  if (options['--page']) {
    const page = fs.readFileSync(options['--page'], 'utf8');
    const marker = '/* @canvas-theme-provider */';
    if (page.split(marker).length !== 2) {throw new Error('Page must contain exactly one /* @canvas-theme-provider */ marker at module scope');}
    result = page.replace(marker, () => provider);
  } else {
    result = provider + `
import { Button, Space, Modal, Tabs, Segmented, Radio } from 'antd';
function ThemePreviewContent() {
  const { status, token } = useCanvasThemeContext();
  const [modal, holder] = Modal.useModal();
  const [category, setCategory] = React.useState('全部');
  const categories = ['全部', '人像摄影', '风光摄影', '商业静物', '婚礼纪实'];
  return <section style={{ margin: 24, padding: 24, background: 'var(--pod-card-bg-color, var(--color-white, #fff))' }}>
    {holder}
    <h2>Canvas 主题预览</h2>
    <p>主题状态：{status}；主色：{token.colorPrimary || '未读取'}</p>
    <Space wrap>
      <Button type="primary">主操作</Button><Button>次操作</Button>
      <Button danger>危险操作</Button><Button disabled>禁用</Button>
      <Button type="link">主题链接</Button>
      <Button onClick={() => modal.confirm({ title: '主题确认弹窗', content: '检查按钮与页面主题是否一致' })}>打开弹窗</Button>
    </Space>
    <h3>分类筛选</h3>
    <Segmented options={categories} value={category} onChange={setCategory} />
    <p>当前分类：{category}</p>
    <Radio.Group value={category} onChange={event => setCategory(event.target.value)} optionType="button" options={categories} />
    <h3>内容视图</h3>
    <Tabs items={[{key:'works',label:'作品',children:'作品内容'}, {key:'albums',label:'相册',children:'相册内容'}, {key:'disabled',label:'暂不可用',disabled:true}]} />
  </section>;
}
function YidaComp() {
  return <CanvasThemeProvider preview><ThemePreviewContent /></CanvasThemeProvider>;
}
export default YidaComp;
`;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result);
  return output;
}

if (require.main === module) {
  try { console.log(run(process.argv.slice(2))); } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { readThemeSnapshot, buildProvider, buildApplicationProvider, assembleApplicationTheme, run };
