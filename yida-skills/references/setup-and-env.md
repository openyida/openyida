# setup-and-env

## Run First

```bash
openyida agent-capabilities --summary-json
```

Fallback:

```bash
openyida env --json
openyida login --check-only --json
```

## Auth Mode

- IF `login.auth_mode=token`: OAuth token mode.
- IF `login.auth_mode=cookie`: yida-agent injected Cookie mode.
- Cookie mode is valid only with `YIDA_AUTH_ENABLED=true` + `OPENYIDA_COOKIE_B64`.
- NEVER infer cookie mode from `.cache/cookies*.json`.

## Decision Table

| Snapshot | Next action |
|---|---|
| command not found | install/update `openyida`; do not create resources |
| `workdir_exists=false` or `active.projectRootExists=false` | run `openyida copy`; do not create resources before workspace exists |
| `auth_mode=token`, `status=ok` or `can_auto_use=true` | continue |
| `auth_mode=token`, not logged in | run `openyida login`; verify with `openyida login --check-only --json` |
| `auth_mode=token`, access token expired | run `openyida auth refresh`; if still failed, run `openyida login` |
| `auth_mode=cookie`, `status=ok` or `can_auto_use=true` | continue |
| `auth_mode=cookie`, `failure_reason=env_cookie_missing` | STOP; host must inject `OPENYIDA_COOKIE_B64` |
| `auth_mode=cookie`, `failure_reason=env_cookie_decode_failed` or `env_cookie_parse_failed` | STOP; host injected invalid `OPENYIDA_COOKIE_B64` |
| `auth_mode=cookie`, `failure_reason=csrf_token_missing` | STOP; injected Cookie lacks CSRF |
| `auth_mode=cookie`, not logged in | STOP; do not run `openyida login`; do not run `openyida auth refresh` |

## Token Mode Commands

Use only when `YIDA_AUTH_ENABLED` is not true.

```bash
openyida login
openyida login --check-only --json
openyida auth status
openyida auth refresh
openyida auth logout
```

If user gives target entry URL or environment:

```bash
openyida login https://yida-group.alibaba-inc.com/
openyida login --alibaba
openyida login --intl
```

Overseas / international / global / Japan / Global YiDA => add `--intl` or equivalent.

## Cookie Inject Mode Commands

Use only when `YIDA_AUTH_ENABLED=true`.

```bash
openyida agent-capabilities --summary-json
openyida env --json
openyida login --check-only --json
openyida auth status
```

Allowed result:

```json
{
  "auth_mode": "cookie",
  "auth_source": "env",
  "status": "ok",
  "can_auto_use": true
}
```

Failure result must stop the task and go back to the host.

## NEVER

- Never run `openyida login` in cookie mode.
- Never run `openyida auth refresh` in cookie mode.
- Never read `.cache/cookies*.json` as yida-agent auth.
- Never ask the user to export browser Cookie.
- Never print Cookie, CSRF, `access_token`, or `refresh_token`.

## Wukong / Codex

- Same auth mode rules as above.
- Do not special-case Wukong or Codex into token if snapshot says `auth_mode=cookie`.
- Do not create app/page/form/publish until auth snapshot is usable.
