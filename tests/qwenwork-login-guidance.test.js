'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildQwenWorkLoginInvocation } = require('../lib/core/qwenwork-login-guidance');

describe('桌面登录的机器可读调用契约', () => {
  let directory;
  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openyida-invocation-')); });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));
  test('复用当前绝对路径并提供成功和失败的后续动作', () => {
    expect(buildQwenWorkLoginInvocation({ executablePath: '/sandbox/prefix/bin/openyida', packageRoot: directory })).toEqual({
      command: '/sandbox/prefix/bin/openyida login --qwenwork --json',
      required_runtime: { tool: 'qwenwork', subtype: 'qwenwork_desktop' },
      execution: 'command', preserve_command_verbatim: true,
      output_visibility: 'internal', success_next_step: 'continue_business_operation_silently',
      failure_next_step: 'follow_returned_invocation_guidance',
    });
  });
  test('当前入口为包内脚本时定位同一个安装前缀的 openyida', () => {
    const root = path.join(directory, 'prefix/lib/node_modules/openyida');
    fs.mkdirSync(path.join(root, 'bin'), { recursive: true });
    const entry = path.join(root, 'bin/yida-pre-beta.js'); fs.writeFileSync(entry, '');
    const bin = path.join(directory, 'prefix/bin/openyida'); fs.mkdirSync(path.dirname(bin)); fs.symlinkSync(entry, bin);
    expect(buildQwenWorkLoginInvocation({ executablePath: entry, packageRoot: root }).command).toBe(`${bin} login --qwenwork --json`);
  });
  test('不选择同一个前缀里指向其他包的旧命令', () => {
    const root = path.join(directory, 'prefix/lib/node_modules/openyida'); fs.mkdirSync(root, { recursive: true });
    const foreign = path.join(directory, 'older.js'); fs.writeFileSync(foreign, '');
    const bin = path.join(directory, 'prefix/bin/openyida'); fs.mkdirSync(path.dirname(bin)); fs.symlinkSync(foreign, bin);
    expect(buildQwenWorkLoginInvocation({ executablePath: '/unknown/yida.js', packageRoot: root }).command).toBe('openyida login --qwenwork --json');
  });
  test.each(['/path with spaces/openyida', 'openyida;echo', '$(command -v openyida)', '/unknown/yida.js'])('无法直接执行的入口不生成复合 Shell 命令：%s', executablePath => {
    expect(buildQwenWorkLoginInvocation({ executablePath, packageRoot: directory }).command).toBe('openyida login --qwenwork --json');
  });
});
