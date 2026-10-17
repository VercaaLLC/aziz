# Validation performed

17 October 2026, Python 3.14 and Node 26 on macOS.

- Skill frontmatter/scaffold validation passed using the bundled skill-creator validator.
- 14 deterministic tests passed: npm v1/v3 exact lock resolution, workspace hoisting/overrides, pnpm unresolved-version honesty, malformed locks, no network/script execution by default, source preservation, symlink/.env exclusion, semver direction/prerelease comparison, explicit scoped lookup, private-registry exclusion, registry failure remaining unknown, advisory JSON with nonzero return, existing-evidence/skill preservation, installer idempotency, and stable installation names when a GitHub clone has a different folder name.
- Repository collector CLI ran against the skill itself and wrote a valid inventory with no collection errors. This is a CLI smoke check, not a website audit.
- Browser helper syntax and real Playwright/axe module loading were checked with Playwright 1.63.0 and @axe-core/playwright 4.13.0 from the existing local npm cache. A package-exports metadata issue found during this check was fixed.
- End-to-end screenshot/axe capture could not be verified: this execution sandbox blocked launching Chrome. The helper wrote an explicit incomplete report instead of a false pass. No browser success, screen-reader test, live journey audit or website-quality result is claimed.
- Installer behavior is verified with isolated temporary project directories. Agent discovery can depend on the host's configured skill roots and session lifecycle; restart or open a new session when necessary. The same SKILL.md is usable directly by absolute path in either agent.

Repeat local checks:

```bash
python3 scripts/test_collect.py
node --check scripts/browser-audit.mjs
```

The Markdown-first and explicit-PPTX-approval rules were reviewed in the skill instructions. No PPTX was created, because no website report has yet been audited and approved for conversion. Behavioral quality of future audits still depends on host capabilities, source/browser access and the agent's evidence review.
