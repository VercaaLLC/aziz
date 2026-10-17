# Validation record

## Version 1.1: complete installer

The [clean installation workflow](https://github.com/VercaaLLC/aziz/actions/runs/39021580555) passed all three hosted platforms on 17 October 2026: Windows, macOS and Ubuntu Linux, using commit `563bf95953720f0d8df3db117f6b94f3f450284b`. Each job bootstrapped its own Node.js 24 runtime and managed Python, installed the selected agents and audit/presentation packages, installed Chromium, and passed the executable, library and real Chromium/axe diagnostics. Windows installed skill copies without requiring symlink privileges. These are hosted-runner results; other supported OS versions, architectures and restricted corporate networks were not individually tested.

Local checks on 17 October 2026 (macOS, Node 26, Python 3.14):

- 17 Python tests cover exact npm locks, workspace hoisting, missing/malformed metadata, read-only collection, private data exclusions, failure visibility, light installation, Windows-style copy installation, owner-checked updates and backups.
- 15 Node tests cover platform paths, argument validation, missing-tool doctor failures, package executable resolution, managed releases/backups, unknown-folder preservation, URL validation, HTTPS/redirect/size restrictions, custom-root launcher execution, desktop-file preservation, side-effect-free plans and checksum verification before stage-two execution. The Unix-specific tests run on macOS/Linux; Windows runs the applicable tests plus its PowerShell parser and complete setup.
- Bash syntax and ShellCheck pass. JavaScript files pass Node syntax checks. SKILL.md passes the skill-creator frontmatter/scaffold validator.
- GitHub Actions parses the PowerShell entry point and runs a clean full installation on Windows, macOS and Linux, including actual Chromium/axe diagnostics. The successful run above establishes those hosted-platform results. The 25 published source files were also downloaded from GitHub, compared byte for byte, and all 32 local tests passed from that downloaded copy.

Repeat the local checks:

```bash
python3 -B scripts/test_collect.py
node --test scripts/test_setup.mjs
bash -n install.sh
```

The local execution sandbox blocks outbound shell downloads and direct Chrome launch; the live installation evidence comes from the linked GitHub Actions run. The installer reports incomplete if any runtime/tool/browser check fails. It never claims that failed/skipped checks passed.

## Initial audit helpers

The original 1.0 evidence collector CLI completed against the skill itself with no collection errors. Real Playwright 1.63.0 and @axe-core/playwright 4.13.0 module loading was checked; an exports metadata bug found then was fixed. Browser capture itself could not complete in the restricted local sandbox. No prospect-site audit, real-user performance pass, screen-reader test or accessibility conformance is claimed by these setup checks.

The Markdown-first and explicit-PowerPoint-approval instructions remain part of the skill. Tool installation and diagnostic browser fixtures do not create an audit PPTX or grant approval for one. Audit quality still depends on target access, evidence, the agent's review and any manual/user-research validation needed.
