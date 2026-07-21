---
name: yida-login
description: 宜搭登录态管理。默认 OAuth token；YIDA_AUTH_ENABLED=true 时使用宿主注入 token。
---

# yida-login

## Mode

- IF `YIDA_AUTH_ENABLED=true`: `auth_mode=token`, `auth_source=env`; only credential sources are host-injected token env such as `OPENYIDA_ACCESS_TOKEN` and `OPENYIDA_REFRESH_TOKEN`.
- ELSE: `auth_mode=token`; use OAuth token flow only.
- NEVER infer auth from `.cache/cookies*.json`.

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
| `failure_reason=env_token_missing` | STOP; host did not inject `OPENYIDA_ACCESS_TOKEN` or `OPENYIDA_REFRESH_TOKEN`; do not OAuth |
| `auth_mode=token`, not logged in, `YIDA_AUTH_ENABLED` is not true | Run `openyida login`, then verify with `openyida login --check-only --json` |

## Token Mode Commands

Use OAuth login only when `YIDA_AUTH_ENABLED` is not true.

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

## Host-Injected Token Mode Commands

Use only when `YIDA_AUTH_ENABLED=true`.

```bash
openyida agent-capabilities --summary-json
openyida env --json
openyida login --check-only --json
openyida auth status
openyida auth refresh
```

Expected usable shape:

```json
{
  "auth_mode": "token",
  "auth_source": "env",
  "status": "ok",
  "can_auto_use": true
}
```

## NEVER

- Never hardcode or print `access_token`, `refresh_token`, Cookie, or CSRF.
- Never read/write `.env`, token files, or Cookie files manually.
- In host-injected token mode: 不要再执行 `openyida login` 触发 OAuth.
- In host-injected token mode: 缺 token 时回到宿主修复注入，不要查找本地 `.cache/cookies*.json`.
- Do not pass Cookie, `_csrf_token`, or Bearer token manually in business commands.

## Done

- Login/auth preflight reports usable auth, or
- Host-injected token mode reports a clear stop reason for the host to fix.
