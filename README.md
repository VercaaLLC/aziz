# aziz-WA

An open-source website auditing skill for Claude Code and Codex. Review UI, UX, accessibility, code quality, library health, performance, technical SEO, and relevant security/privacy signals in one evidence-based workflow.

**The workflow:** audit deeply → deliver a detailed Markdown file → ask your approval → create a PowerPoint only after approval.

## Install from GitHub

Install for both Claude Code and Codex with the [Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a claude-code -a codex
```

Or install for one agent:

```bash
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a claude-code
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a codex
```

To install without the Skills CLI, clone the repository into a folder you will keep:

```bash
git clone https://github.com/VercaaLLC/aziz.git
cd aziz
python3 scripts/install.py --agent both
```

The Python installer creates links under `~/.claude/skills/aziz-wa` and `~/.agents/skills/aziz-wa`. It preserves existing entries. Keep the clone in place because the links point to it. Use `--agent claude` or `--agent codex` to select one client, or `--project /path/to/project` for project-local links. A new agent session may be needed for discovery. [More setup details](references/usage.md).

The display name is **aziz-WA**. Its portable command is lowercase `aziz-wa`, following the Agent Skills naming convention.

## Use it

Open the website's source project in your agent and provide its URL or local preview.

Claude Code:

```text
/aziz-wa Deeply audit https://example.com and this repository. Deliver the Markdown report, then ask my approval before converting it to PowerPoint. Do not edit application files.
```

Codex:

```text
$aziz-wa Deeply audit https://example.com and this repository. Deliver the Markdown report, then ask my approval before converting it to PowerPoint. Do not edit application files.
```

You can also ask either agent to read this repository's `SKILL.md` directly and follow it.

## What the report covers

| Area | Review |
| --- | --- |
| UI | Visual hierarchy, typography, spacing, consistency, responsive layouts and control states |
| UX | Critical journeys, navigation, forms, feedback, recovery and mobile interaction |
| Accessibility | Keyboard/focus, semantics, contrast, reflow and available automated checks |
| Code quality | Architecture, state/data flow, error handling, async cleanup, duplication, types and tests |
| Libraries | Declared/locked versions, available updates, advisories, deprecation, support and upgrade compatibility |
| Performance | Available loading, runtime and bundle evidence, with lab/field distinctions |
| Technical SEO | Indexability, metadata, canonicals, robots/sitemaps and relevant structured data |
| Security/privacy | Relevant observed/source signals within authorized access |

Each finding includes its location, evidence, impact, severity, confidence, suggested fix, rough effort and verification method. The report records sampled routes, states, viewports, source files, tool results and anything that could not be checked.

## Deliverables

- `aziz-WA-audit-report.md`: the detailed primary report, delivered as a file.
- `audit-findings.json`: structured supporting findings and coverage.
- Local screenshots and raw tool reports where available.
- `aziz-WA-audit-report.pptx`: created only after you explicitly approve conversion of the Markdown report.

Application files are reviewed without changes by default. Request implementation separately if you want fixes applied.

## Requirements and limits

The skill is free and MIT-licensed. It requires no paid auditing account or extra model API key; Claude/Codex usage may still cost money.

Python 3.11+ runs the optional repository collector. Browser review uses the host's browser tools or optional Playwright/axe/Lighthouse installations. The helpers do not automatically install dependencies. [Free tool setup and native package-manager adapters](references/execution.md).

Full coverage needs source access and a usable browser target. URL-only review cannot verify private source or the exact dependency graph. Offline metadata cannot establish current freshness. Automatic lock resolution covers direct npm dependencies; other ecosystems and transitive checks use native tools and agent review.

This is an agent skill with evidence collectors. The agent must inspect screenshots/source and walk journeys. Automated checks do not prove usability, accessibility conformance, or absence of vulnerabilities. Missing checks stay explicit.

## Validation and maintenance

```bash
python3 -B scripts/test_collect.py
node --check scripts/browser-audit.mjs
```

See [validation details](references/validation.md) for tested behavior and environment limits, and the [original tool comparison](references/research.md) for research behind the workflow.

For Skills CLI installations, check and update using its supported commands:

```bash
npx skills check
npx skills update aziz-wa
```

For a manual linked clone, update it with `git pull --ff-only`. Review changes before running updated helpers.

Licensed under the [MIT License](LICENSE).
