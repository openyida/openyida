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

- Do not infer auth mode from agent name, host product, workspace path, or a guessed environment variable.
- First use `openyida agent-capabilities --summary-json`; fallback to `openyida login --check-only --json` only when the compact snapshot is unavailable or insufficient.
- If the snapshot reports `login.auth_source=env` or `failure_reason=env_token_missing`, treat it as host-injected token mode; the host must provide token env such as `OPENYIDA_ACCESS_TOKEN` or `OPENYIDA_REFRESH_TOKEN`.
- Otherwise, `login.auth_mode=token` uses the default OAuth token session flow.
- NEVER infer auth from `.cache/cookies*.json`.

## Decision Table

| Snapshot | Next action |
|---|---|
| command not found | install/update `openyida`; do not create resources |
| `workdir_exists=false` or `active.projectRootExists=false` | run `openyida copy`; do not create resources before workspace exists |
| `auth_mode=token`, `status=ok` or `can_auto_use=true` | continue |
| snapshot reports `auth_source=env` / `failure_reason=env_token_missing` | Treat as host-injected token mode; if token is missing, STOP and ask host to inject `OPENYIDA_ACCESS_TOKEN` or `OPENYIDA_REFRESH_TOKEN`; do not run OAuth |
| `auth_mode=token`, not logged in, and snapshot does not report env injection | run `openyida login`; verify with `openyida login --check-only --json` |
| `auth_mode=token`, access token expired | run `openyida auth refresh`; if still failed and snapshot does not report env injection, run `openyida login` |

## Token Mode Commands

Use OAuth login only when the auth snapshot does not report env injection.

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

## Host-Injected Token Mode Commands

Use only after the auth snapshot reports `auth_source=env` or `failure_reason=env_token_missing`.

```bash
openyida agent-capabilities --summary-json
openyida env --json
openyida login --check-only --json
openyida auth status
openyida auth refresh
```

Allowed result:

```json
{
  "auth_mode": "token",
  "auth_source": "env",
  "status": "ok",
  "can_auto_use": true
}
```

If the host did not inject token env, the snapshot includes `failure_reason=env_token_missing`; stop the task and go back to the host. Do not launch OAuth from this mode.

## NEVER

- Never run `openyida login` after the snapshot reports host-injected token mode.
- Never read `.cache/cookies*.json` as yida-agent auth.
- Never ask the user to export browser Cookie.
- Never print Cookie, CSRF, `access_token`, or `refresh_token`.

## Wukong / Codex

- Same auth mode rules as above.
- Do not special-case Wukong, Codex, yida-agent, or any host identity into an auth branch; follow the OpenYida auth snapshot.
- Do not create app/page/form/publish until auth snapshot is usable.
