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

# 3. Install Playwright (required for login)
npx playwright install chromium

# 4. Link globally for local debugging
npm link

# 5. Run tests
npm test
```

## PR Checklist

- [ ] Tested the relevant feature with a real Yida account locally
- [ ] All tests pass: `npm test`
- [ ] JS syntax check passes: `node --check bin/yida.js && for f in lib/*.js lib/locales/*.js; do node --check "$f"; done`
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

## Project Structure

```
openyida/
├── bin/yida.js          # CLI entry point, command routing
├── lib/                 # Command implementation modules
│   ├── env.js           # Environment detection
│   ├── login.js         # Login management
│   ├── create-app.js    # Create application
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

PRs assisted by Claude Code, Cursor, Aone Copilot, or any other AI tool are fully welcome!
Please mention which AI tool you used in the PR description.

## License

By contributing, you agree to license your contribution under the [MIT License](./LICENSE).
