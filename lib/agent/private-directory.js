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
function mkdirPrivateDirectories(directories) {
  if (process.platform !== 'win32') {
    for (const directory of directories) {fs.mkdirSync(directory, { recursive: true, mode: 0o700 });}
    return;
  }
  const targets = [...new Set(directories.map(directory => path.resolve(directory)))];
  const pending = new Set();
  for (const target of targets) {
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
    for (const directory of missing) {pending.add(directory);}
  }
  const missing = [...pending];
  if (!missing.length) {return;}
  // A frozen bundle can contain hundreds of directories. Budget the batch,
  // including ACL verification, instead of giving it a single-directory limit.
  // Keep an upper bound so a stalled PowerShell process still terminates.
  const timeout = Math.min(120000, 15000 + missing.length * 100);
  const script = `
$ErrorActionPreference = 'Stop'
$reader = [System.IO.StreamReader]::new([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetOwner($identity)
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @($identity.Value, 'S-1-5-18', 'S-1-5-32-544')) {
  $principal = New-Object System.Security.Principal.SecurityIdentifier($sid)
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($principal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
}
foreach ($directory in ($reader.ReadToEnd() | ConvertFrom-Json)) {
  # Concurrent launchers may create the same parent. Never rewrite a winner;
  # accept it only when its actual owner and grants meet the same private policy.
  # Extended-length paths avoid the .NET Framework MAX_PATH limit. Paths
  # are already absolute and validated by the Node caller.
  $nativePath = $directory
  if (-not $directory.StartsWith('\\\\?\\')) {
    if ($directory.StartsWith('\\\\')) { $nativePath = '\\\\?\\UNC\\' + $directory.Substring(2) }
    else { $nativePath = '\\\\?\\' + $directory }
  }
  [System.IO.Directory]::CreateDirectory($nativePath, $acl) | Out-Null
  $actual = (New-Object System.IO.DirectoryInfo($nativePath)).GetAccessControl()
  if ($actual.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $identity.Value) {throw 'Private directory owner differs'}
  foreach ($rule in $actual.Access) {
    $sid = $rule.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
    if ($rule.AccessControlType -ne 'Allow' -or $sid -notin @($identity.Value, 'S-1-5-18', 'S-1-5-32-544')) {throw 'Private directory access differs'}
  }
}
`;
  try {
    execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true, timeout, stdio: 'pipe',
        // Stdin avoids Windows environment-variable size limits for full bundles.
        input: JSON.stringify(missing),
      });
  } catch {
    throw directoryError();
  }
  for (const target of targets) {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {throw directoryError();}
  }
}

function mkdirPrivate(directory) {
  mkdirPrivateDirectories([directory]);
}

module.exports = { mkdirPrivate, mkdirPrivateDirectories };
