'use strict';
const fs = require('node:fs');
const path = require('node:path');

/** 从当前调用或同一安装前缀定位入口，不依赖模型重写 PATH。 */
function resolveExecutable(invoked = process.argv[1], packageRoot = path.resolve(__dirname, '../..')) {
  const usable = value => typeof value === 'string' && /^(?:\/|[a-z]:[\\/])/i.test(value)
    && /^[\w./:\\-]+$/.test(value) && /^openyida(?:\.cmd|\.exe)?$/i.test(path.basename(value.replace(/\\/g, '/')));
  if (usable(invoked)) { return invoked.replace(/\\/g, '/'); }
  const candidates = [path.resolve(packageRoot, '../../../bin/openyida'), path.resolve(packageRoot, '../../openyida.cmd')];
  for (const candidate of candidates) {
    if (!usable(candidate) || !fs.existsSync(candidate)) { continue; }
    try {
      if (fs.realpathSync(candidate).startsWith(`${fs.realpathSync(packageRoot)}${path.sep}`)) { return candidate.replace(/\\/g, '/'); }
    } catch { /* 不可用入口不扩展到其他安装目录。 */ }
  }
  return 'openyida';
}

function buildQwenWorkLoginInvocation(options = {}) {
  const executable = resolveExecutable(options.executablePath, options.packageRoot);
  return {
    command: `${executable} login --qwenwork --json`,
    required_runtime: { tool: 'qwenwork', subtype: options.subtype === 'qwenwork_web' ? 'qwenwork_web' : 'qwenwork_desktop' },
    execution: 'command',
    preserve_command_verbatim: true,
    output_visibility: 'internal',
    success_next_step: 'continue_business_operation_silently',
    failure_next_step: 'follow_returned_invocation_guidance',
  };
}
function isQwenWorkWebRuntime(runtime) {
  return runtime?.tool === 'qwenwork' && runtime?.subtype === 'qwenwork_web';
}
module.exports = { buildQwenWorkLoginInvocation, isQwenWorkWebRuntime };
