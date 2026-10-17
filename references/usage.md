# Installation and usage

The display name is **aziz-WA**; the portable command/identifier is `aziz-wa` because the common Agent Skills format uses lowercase names. The same skill folder serves Claude Code and Codex. Optional `agents/openai.yaml` provides Codex UI metadata. No model API or paid audit account is built in; host model usage is separate.

Install from the public repository using the [Skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a claude-code -a codex
```

Or clone `https://github.com/VercaaLLC/aziz.git` and run from the clone/extracted skill folder:

```bash
python3 scripts/install.py --agent both
```

This adds personal symlinks under `~/.claude/skills/aziz-wa` and modern Codex `~/.agents/skills/aziz-wa`. It preserves existing entries and reports permission failures. Keep the source folder in place. Use `--project <repo>` for project-local links. For team/cloud portability, copy the whole skill folder into each repository's `.claude/skills/` and `.agents/skills/` instead of committing links to a personal absolute path. Older/custom clients may use their configured skill root.

Start a new session if the skill is not listed. Without installation, tell either agent to read this file's sibling `../SKILL.md` by absolute path and follow it.

Claude Code:

```text
/aziz-wa Deeply audit https://example.com and this repository. Deliver the Markdown report, then ask my approval before converting it to PowerPoint. Do not edit application files.
```

Codex:

```text
$aziz-wa Deeply audit https://example.com and this repository. Deliver the Markdown report, then ask my approval before converting it to PowerPoint. Do not edit application files.
```

Full coverage needs both source and a usable browser preview/URL. URL-only cannot verify private source or exact dependencies. Offline results cannot establish current freshness. The collector automates npm direct-version metadata; native-tool guidance covers other ecosystems and transitive analysis. A capable agent must inspect source, view screenshots and walk journeys; the helpers alone are not a professional audit.

Compatibility references: [Claude Code skills](https://code.claude.com/docs/en/skills), [OpenAI skills workflow](https://developers.openai.com/blog/skills-agents-sdk), [Agent Skills specification](https://agentskills.io/specification).
