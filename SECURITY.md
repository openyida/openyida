# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2026.x  | ✅ Active support   |
| < 2026  | ❌ No longer supported |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability, please report it privately through one of the following channels:

1. **GitHub Security Advisories (recommended)**
   Go to [Security Advisories](https://github.com/openyida/openyida/security/advisories/new) to create a private security report.

2. **Email**
   Send an email to the maintainers with the subject line `[SECURITY] OpenYida`.

## Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgement | Within 48 hours |
| Initial assessment and triage | Within 5 business days |
| Fix and patch release | Typically 1–2 weeks depending on severity |
| Public disclosure | After the fix is released |

## Disclosure Policy

- We follow the **Responsible Disclosure** principle
- Please do not disclose vulnerability details publicly before a fix is released
- After a fix is released, we will document the security fix in the CHANGELOG and GitHub Release notes
- For valid security reports, we will credit the reporter in the README contributors section (unless anonymity is requested)

## Security Best Practices

When using OpenYida, please keep the following in mind:

- **Credentials**: Cookie cache is stored locally at `project/.cache/cookies.json` — do not commit this file to version control
- **`.gitignore`**: The project ignores `.cache/` by default — do not remove this rule manually
- **Dependency security**: Run `npm audit` regularly to check for dependency vulnerabilities
- **Environment isolation**: Use separate Yida accounts for production and development environments

## Scope

The following types of issues are in scope for this policy:

- Authentication and authorization bypass
- Cookie / credential leakage
- Code injection or remote code execution
- Known vulnerabilities in the dependency chain
- Accidental exposure of sensitive information

The following are out of scope:

- Social engineering attacks
- Physical attacks
- Non-security bugs already discussed in public Issues
