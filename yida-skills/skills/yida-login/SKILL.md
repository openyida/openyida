---
name: yida-login
description: 宜搭登录态管理。默认 OAuth token；仅 yida-agent 旧链路使用 YIDA_AUTH_ENABLED=true + OPENYIDA_COOKIE_B64 Cookie 注入。
---

# yida-login

## Mode

- IF `YIDA_AUTH_ENABLED=true`: `auth_mode=cookie`; only credential source is `OPENYIDA_COOKIE_B64`.
- ELSE: `auth_mode=token`; use OAuth token flow only.
- NEVER infer cookie mode from `.cache/cookies*.json`.

## Preflight

Run first:

```bash
openyida agent-capabilities --summary-json
```

Fallback only when needed:

```bash
openyida env --json
openyida login --check-only --json
```

## Decision Table

| Observed status | Action |
|---|---|
| `auth_mode=token`, `status=ok` or `can_auto_use=true` | Continue business command |
| `auth_mode=token`, not logged in | Run `openyida login`, then verify with `openyida login --check-only --json` |
| `auth_mode=cookie`, `status=ok` or `can_auto_use=true` | Continue business command |
| `auth_mode=cookie`, `status=not_logged_in` | STOP; ask host to inject valid `OPENYIDA_COOKIE_B64`; do not OAuth |
| `failure_reason=env_cookie_missing` | STOP; host did not inject `OPENYIDA_COOKIE_B64` |
| `failure_reason=env_cookie_decode_failed` or `env_cookie_parse_failed` | STOP; injected `OPENYIDA_COOKIE_B64` is invalid |
| `failure_reason=csrf_token_missing` | STOP; injected Cookie lacks CSRF |

## Token Mode Commands

Use only when `YIDA_AUTH_ENABLED` is not true.

```bash
openyida login
openyida login --check-only --json
openyida auth status
openyida auth refresh
openyida auth logout
```

If user gives a Yida entry URL, pass it through:

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

Expected usable shape:

```json
{
  "auth_mode": "cookie",
  "auth_source": "env",
  "status": "ok",
  "can_auto_use": true
}
```

## NEVER

- Never hardcode or print `access_token`, `refresh_token`, Cookie, or CSRF.
- Never read/write `.env`, token files, or Cookie files manually.
- In cookie inject mode: 不要再执行 `openyida login` 触发 OAuth.
- In cookie inject mode: do not run `openyida auth refresh`.
- In cookie inject mode: 不要查找本地 `.cache/cookies*.json`.
- Do not pass Cookie, `_csrf_token`, or Bearer token manually in business commands.

## Done

- Login/auth preflight reports usable auth, or
- Cookie inject mode reports a clear stop reason for the host to fix.
