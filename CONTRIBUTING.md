# Contributing to OpenYida

Welcome to OpenYida! 🎉 Thank you for your interest in contributing.

## Quick Links

- **GitHub:** https://github.com/openyida/openyida
- **Issues:** https://github.com/openyida/openyida/issues
- **npm:** https://www.npmjs.com/package/openyida

## Maintainers

- **九神 (yize)** — Core architecture, CLI design
  GitHub: [@yize](https://github.com/yize)
- **alex-mm** — Feature development, testing
  GitHub: [@alex-mm](https://github.com/alex-mm)
- **nicky1108** — OpenClaw integration, skill extensions
  GitHub: [@nicky1108](https://github.com/nicky1108)

## Ways to Contribute

1. **Report a Bug** → Open an Issue with reproduction steps and environment info
2. **Suggest a Feature** → Start a Discussion or Issue first, then implement
3. **Improve Docs** → PRs for documentation are always welcome
4. **Add Skills** → Extend the skill pack under `yida-skills/`
5. **Fix Bugs / New Features** → Follow the development workflow below

## Development Setup

```bash
# 1. Fork and clone the repo
git clone git@github.com:your-username/openyida.git
cd openyida

# 2. Install dependencies
npm install

# 3. Optional: install Playwright for local browser login outside Codex
npx playwright install chromium

# 4. Link globally for local debugging
npm link

# 5. Run the full local CI check
npm run check:ci
```

Codex contributors do not need Playwright for the default login path. In Codex, use `openyida login` or `openyida login --codex` to hand off login to the Codex in-app browser. For terminal QR verification, use `openyida login --qr --corp-id <corpId>` when the account belongs to multiple organizations.

## PR Checklist

- [ ] Tested the relevant feature with a real Yida account locally
- [ ] Full local CI passes: `npm run check:ci`
- [ ] PR description clearly explains what changed and why
- [ ] Screenshots or recordings attached if there are UI/behavior changes

## PR Guidelines

- **One PR, one thing** — don't mix unrelated changes
- **PR title** format: `feat: add xxx` / `fix: fix xxx` / `docs: update xxx`
- **Description** should cover: what, why, and how to test
- If the PR closes an Issue, add `Closes #123` in the description

## Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add export-app command
fix: fix get-page-config path error
docs: update CLI command reference
refactor: refactor login module
test: add utils unit tests
chore: upgrade dependencies
```

## Code Style

- Follow the existing code style (CommonJS modules, prefer Node.js native APIs)
- Use meaningful English names for variables and functions; avoid abbreviations
- Handle errors completely — don't silently swallow exceptions
- When adding a new command, update the CLI command table in `README.md`
- When adding user-visible text, update all locale files under `lib/core/locales/`

## Project Structure

```
openyida/
├── bin/yida.js          # CLI entry point, command routing
├── lib/                 # Command implementation modules
│   ├── core/            # Environment detection, i18n, utilities
│   ├── auth/            # Login, Codex login, QR login, organizations
│   ├── app/             # Application, form, page commands
│   └── ...
├── project/             # User workspace template
│   ├── config.json      # App configuration
│   └── pages/           # Custom page templates
├── yida-skills/         # AI skill pack (read by MCP/Claude/Cursor etc.)
│   ├── SKILL.md         # Skill entry document
│   └── skills/          # Sub-skill directories
└── scripts/             # Build and publish scripts
```

## AI / Vibe-Coded PRs Welcome! 🤖

PRs assisted by Codex, Claude Code, Cursor, Aone Copilot, OpenCode, Wukong, or any other AI tool are fully welcome!
Please mention which AI tool you used in the PR description.

## License

By contributing, you agree to license your contribution under the [MIT License](./LICENSE).
