# Installation and usage

For a computer with no developer tools, use the one-command GitHub bootstrap in [setup.md](setup.md). It installs the runtimes, audit/presentation tools, agent software, skill and launcher. Sign-in remains a user action.

Open the **aziz-WA** desktop launcher, choose an agent and enter the website URL. A public-site marketing brief is supplied automatically. Detailed Markdown is delivered first, then the agent asks before PowerPoint conversion. Reports live under the installation's `audits` directory.

The display name is **aziz-WA**; its portable identifier is `aziz-wa`. Existing configured agent sessions can still invoke it manually:

Claude Code:

```text
/aziz-wa Deeply audit https://example.com using public pages only for a marketing prospect report. Deliver the detailed Markdown report, then ask my approval before converting it to PowerPoint.
```

Codex:

```text
$aziz-wa Deeply audit https://example.com using public pages only for a marketing prospect report. Deliver the detailed Markdown report, then ask my approval before converting it to PowerPoint.
```

For source-aware audits, also provide the repository and local preview. URL-only review cannot verify private source or exact full dependencies. The agent must inspect screenshots/source and walk journeys; collectors alone are not a professional review.

If all runtimes/tools already exist and you want only the skill:

```bash
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a claude-code -a codex
```

The light Python installer adds links: `python3 scripts/install.py --agent both`. `--copy` avoids symlink privileges and `--project <repo>` targets project-local discovery. Keep linked source folders in place. Team/cloud portability requires copying the whole skill into `.claude/skills/aziz-wa` and `.agents/skills/aziz-wa`, instead of committing personal absolute links. Unknown existing skills are preserved. Open a new agent session if discovery needs refreshing.

Compatibility: [Claude Code](https://code.claude.com/docs/en/skills), [Codex](https://learn.chatgpt.com/docs/build-skills), [Agent Skills](https://agentskills.io/specification).
