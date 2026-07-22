---
name: yida-login
description: 宜搭登录态管理。以 OpenYida auth snapshot 为准；默认 OAuth token，snapshot 返回 env 注入状态时使用宿主 token。
---

# yida-login

## Mode

- Do not infer auth mode from agent name, host product, workspace path, or a guessed environment variable.
- First read `openyida agent-capabilities --summary-json`; fallback to `openyida login --check-only --json` only when needed.
- If the snapshot reports `login.auth_source=env` or `failure_reason=env_token_missing`, treat it as host-injected token mode. The only credential sources are host-injected token env such as `OPENYIDA_ACCESS_TOKEN` and `OPENYIDA_REFRESH_TOKEN`.
- Otherwise, `auth_mode=token` uses the default OAuth token session flow.
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
| `auth_source=env` / `failure_reason=env_token_missing` | Treat as host-injected token mode; if token is missing, STOP and ask host to inject `OPENYIDA_ACCESS_TOKEN` or `OPENYIDA_REFRESH_TOKEN`; do not OAuth |
| `auth_mode=token`, not logged in, and snapshot does not report env injection | Run `openyida login`, then verify with `openyida login --check-only --json` |

## Token Mode Commands

Use OAuth login only when the auth snapshot does not report env injection.

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

Use only after the auth snapshot reports `auth_source=env` or `failure_reason=env_token_missing`.

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
