# Local runtime launcher contract (development implementation)

This Node package contains no Go source or build/download fallback. The runtime
catalog is intentionally empty until release ownership, signing keys, platform
support and real package publication are approved. Internal test injection is not
a CLI trust-root option. Ordinary commands do not resolve or spawn this runtime.

## Production metadata and development mode

`runtime-manifest.js` is the strict v2 codec: no extra/duplicate JSON keys, malformed
UTF-8, unknown OS/CPU aliases, invalid protocol/state ranges, unsafe binary paths,
oversized metadata/binaries or invalid digests. The binary path is exactly
`bin/openyida-agent-runtime` (Windows: `.exe`). `sourceRevision` is a 40- or
64-character lowercase source commit digest, not a public artifact tag.

Detached Ed25519 signature: original UTF-8 `runtime-manifest.json` bytes, with no
re-serialization; `.sig` is canonical base64 for 64 signature bytes, optionally
one final LF. Trust roots live in the main package's `runtime-catalog.json`:
`keys[keyId] = {publicKey: <SPKI PEM>, revoked?: boolean}`. Unknown/revoked keys
fail closed; no TOFU, downloaded trust key, arbitrary URL or PATH fallback exists.

Each approved release entry is `{platform, arch, packageName, packageVersion,
runtimeVersion, manifestSha256}`. The main package must declare that exact
`optionalDependencies` version. Candidate naming is
`@openyida/local-agent-runtime-${process.platform}-${process.arch}`; this is not a
claim those names are registered or published. Platform metadata must match its
exact name/version and single-element `os`/`cpu`, and have no lifecycle scripts.
Main-package-relative Node resolution supports hoisting; platform packages must
make `package.json` resolvable. Missing optional packages block Local Agent only.
The current Beta production allowlist is macOS (`darwin`) and Windows (`win32`).
Linux remains a source/development target but must not appear in the production
catalog or optional dependencies until native acceptance is complete. Ordinary
non-Agent OpenYida CLI commands remain available on Linux.

Unsigned v1 requires CLI `--development-runtime` plus explicit absolute
`--runtime-path` and `--runtime-manifest`. Environment variables cannot enable it.
Node sends `developmentRuntime: true` only for that flag. v1 is not accepted as a
production compatibility fallback. Development binaries are normalized to the
bundle executable filename; their original manifest is preserved as evidence.

## Launch DTO (protocolVersion remains 1)

Go argv is `[command, "--stdio-config"]`; stdin is one JSON object plus LF, at
most 64 KiB. Business access/refresh tokens and ordinary OpenYida profile
identifiers are never included. The launch contains the control endpoint,
endpointId, providers and stateDir; web-first connect may additionally contain
one short-lived Enrollment token. `node.version` remains the OpenYida package
version, not the Node version.

CLI-first connect lets Go create a state/PKCE/device-key-bound Enrollment and open
the configured browser authorization page. Web-first connect receives the same
device result by claiming the single-use `--enroll` token. Both modes persist only
device connection credentials. For every accepted attempt, Python requests a
fixed-value Tianshu task grant with an initial 60-minute lease and Go injects it
only into that attempt's managed environment; Node never falls back to a normal
local profile. The authenticated Runtime heartbeat lets Python renew the lease
server-to-server while the authoritative Run remains active. Node has no task
RefreshToken and cannot renew the bearer itself. The grant is bound to the
application, not one form/page. An optional `formUuid` remains per-turn focus
context and may change between turns inside the same `appType`.

The device bearer is not sufficient by itself. Python sends a fresh nonce before
accepting the Runtime hello, and Go signs the device/endpoint/nonce binding with
the Ed25519 key created at Enrollment. Refresh requests similarly sign the
device/action/refresh-token digest/endpoint binding. A copied access or refresh
bearer therefore cannot connect or rotate without the enrolled private key.

For both `connect` and `run`, added fields are:

```json
{
  "parentWatchFD": 3,
  "node": {
    "executable": "/external/node",
    "nodeVersion": "v22.22.3",
    "sha256": "NODE_BINARY_SHA256",
    "version": "2026.9.7",
    "packageRoot": "/private/bundles/BUNDLE_SHA256/openyida",
    "cliEntry": "/private/bundles/BUNDLE_SHA256/openyida/bin/yida.js"
  },
  "bundle": {
    "schemaVersion": 1,
    "id": "BUNDLE_SHA256",
    "root": "/private/bundles/BUNDLE_SHA256",
    "manifestPath": "/private/bundles/BUNDLE_SHA256/bundle-manifest.json",
    "manifestSha256": "BUNDLE_SHA256",
    "runtimeVersion": "0.1.0-dev",
    "skillsDir": "/private/bundles/BUNDLE_SHA256/openyida/yida-skills"
  }
}
```

The launcher uses four stdio pipes and keeps fd 3 open independently from normal
configuration stdin EOF. Parent death/pipe EOF asks Go to stop admission and
cancel/drain, never to report successful completion. Node forwards SIGINT/TERM;
failure grants 15 seconds before forcing the Go wrapper down. Such timeout returns
`AGENT_RUNTIME_STOP_UNCONFIRMED` with `executionState: unknown`, not proof that
provider processes or in-flight business effects stopped.

## Bundle bytes, ownership and lifetime

`bundle-manifest.json` is `JSON.stringify(object) + "\n"`, encoded as UTF-8.
Its exact SHA-256 is the bundle ID; it is a local content manifest, not a publisher
signature. Fields (in emitted order) are:

```text
schemaVersion: 1
product: "openyida-local-agent-bundle"
openyidaVersion, runtimeVersion
launcherProtocol: 1
wireProtocol: 1
node: {version: <process.version>, sha256: <external Node binary hash>}
runtime: {executable: "runtime/bin/openyida-agent-runtime[.exe]",
          manifest: "runtime/runtime-manifest.json",
          signature: "runtime/runtime-manifest.sig" | null,
          development: boolean}
cliEntry: "openyida/bin/yida.js"
skillsDir: "openyida/yida-skills"
files: [{path: <relative POSIX>, size: <integer>, sha256: <lowercase hex>,
         mode: 292 | 365}]
```

Files sort by path using UTF-8 byte order (not JavaScript UTF-16 comparison).
Mode 292 is octal 0444; 365 is 0555.
The manifest is not its own files entry. Unknown files and symlinks are rejected.
Go verifies the same raw manifest digest, file list/hash/size/mode, launch paths,
runtime version and external Node identity before accepting work and before
subsequent helper/new-turn use. Production publication trust is established by
Node's v2 signature and approved digest, not by pretending the local bundle hash
is a release signature.

Node copies only packaged CLI assets and the recursively resolved production
dependency/peer/available optional closure, preserving nested dependency
resolution and cycles. It omits root platform packages (verified runtime bytes
are copied separately), user projects, credentials, checkout metadata and
devDependencies. Source content/tree membership is checked again before publish;
missing dependencies or concurrent replacement fail closed. No install hook runs.

Unique private staging directories plus atomic compare-and-publish handle
concurrent materializers without a second execution lease. Contents are read-only;
on macOS the staging root must remain writable until rename, then becomes 0500.
Cache is 0700 on Unix. Same-user/root compromise is outside this protection;
Windows ACL/OS release acceptance remains unverified. Interrupted staging is not
an executable published bundle. Node does not repair a modified winner or GC
existing bundles, unknown journals or user files.

Go exclusively owns durable refs under
`stateDir/bundle-references/<bundleId>/...` for connection, session and attempt
lifetimes. Session identity no longer pins BundleID.
Node has no ref writer, owner lease, GC or automatic migration. Global npm upgrade
can produce a new bundle. After the connection drains and is restarted, a compatible
bundle may continue the same native session; an active attempt never switches. External Node and
provider binaries are not redistributed/frozen by this package; loss or an
incompatible change blocks new work rather than silently starting fresh.

For allowlisted Yida write commands only, Node writes one bounded Mutation Receipt
after an explicit success result in OPENYIDA_AGENT_RECEIPTS_DIR. Read-only, failed
and interrupted commands write nothing.
Go forwards a successful openyida_mutation through the authenticated Run stream;
Python adds requiresHostRefresh. No Go command gateway is involved.
Windows parent lifetime uses parentPID and an OS process handle, not parentWatchFD.

All current automated tests use generated signing keys and fake processes.
No real provider, user account, Yida write, public upload or npm publication is
part of this implementation checkpoint.
