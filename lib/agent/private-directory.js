'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { CliError } = require('../core/cli-error');
const { t } = require('../core/i18n');

function directoryError() {
  return new CliError(t('agent.private_directory_failed'), { code: 'AGENT_PRIVATE_DIRECTORY_INVALID' });
}

// Node's mkdir mode is ignored on Windows. Create each missing directory with
// an inheritable private DACL before any credentials or logs are written.
// Existing directories are never re-permissioned here.
function mkdirPrivate(directory) {
  if (process.platform !== 'win32') {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    return;
  }
  const target = path.resolve(directory);
  const missing = [];
  let ancestor = target;
  while (!fs.existsSync(ancestor)) {
    missing.unshift(ancestor);
    ancestor = path.dirname(ancestor);
  }
  for (let parent = ancestor; ; parent = path.dirname(parent)) {
    const stat = fs.lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {throw directoryError();}
    if (parent === path.dirname(parent)) {break;}
  }
  if (!missing.length) {return;}
  const script = `
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetOwner($identity)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity.Value, 'S-1-5-18', 'S-1-5-32-544')) {
  $principal = New-Object System.Security.Principal.SecurityIdentifier($sid)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($principal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
foreach ($directory in ($env:OPENYIDA_PRIVATE_DIRECTORIES | ConvertFrom-Json)) {
  if ([System.IO.Directory]::Exists($directory)) {throw 'Directory changed during creation'}
  [System.IO.Directory]::CreateDirectory($directory, $acl) | Out-Null
}
`;
  try {
    execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true, timeout: 15000, stdio: 'pipe',
        env: { ...process.env, OPENYIDA_PRIVATE_DIRECTORIES: JSON.stringify(missing) },
      });
  } catch {
    throw directoryError();
  }
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {throw directoryError();}
}

module.exports = { mkdirPrivate };
