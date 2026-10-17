# One installation from GitHub

The bootstrap installs its own Node.js before executing JavaScript. No preinstalled Node.js, npm, Python, Git, Claude Code or Codex is required. Internet access, a supported 64-bit OS, a terminal and normal OS download/archive utilities are needed. It does not create accounts or collect credentials.

macOS / supported Linux, paste once into Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/VercaaLLC/aziz/main/install.sh | bash
```

Windows, paste once into PowerShell:

```powershell
irm https://raw.githubusercontent.com/VercaaLLC/aziz/main/install.ps1 | iex
```

Both agents are installed by default; users choose which account to use later and need not sign into both. Current supported browser platforms include macOS 14+, Windows 11+/Server 2019+, and supported x64/ARM64 versions of Ubuntu 22.04/24.04/26.04 and Debian 12/13, following [Playwright](https://playwright.dev/docs/intro). Linux browser system libraries install automatically and may request administrator authorization. Device policies, unsupported distributions, proxies or unavailable downloads can block setup; failed checks never produce a ready status.

## Installed components

- Private Node.js 24 LTS and npm, checked against Node's published SHA-256 manifest.
- uv plus managed Python 3.12 in an isolated environment; python-pptx and Pillow.
- Playwright/Chromium, axe accessibility tools and Lighthouse.
- PptxGenJS and Marp for presentation creation and browser-rendered slide export.
- Claude Code and Codex CLI from official npm packages, including their platform binaries.
- aziz-WA discovery, launcher and desktop shortcut when a Desktop folder exists.

Software lives in `~/.local/share/aziz-wa` on macOS/Linux or `%LOCALAPPDATA%\aziz-wa` on Windows. System Node/Python and shell profiles are left alone; the launcher supplies the private runtime PATH to the agent. Installed npm versions/lock are in `tools/`; `setup.json` records progress and diagnostics without account secrets.

## After installation

Open **aziz-WA** from the desktop shortcut or the launcher path printed at completion. Choose an agent, enter a website URL and sign into that agent if asked. A public-site marketing audit brief is supplied automatically and a separate report folder is created under `audits`. Markdown comes first, then a PowerPoint approval question.

The installed Marp/Chromium fallback generates image-based PPTX slides and PNG previews. Editable generators are also present; native editable-PPTX visual verification may require another presentation renderer, which the agent must disclose if unavailable.

## Diagnose or update

Run the printed launcher path followed by `doctor`. It checks Node/npm, Python presentation imports, agents, package availability and a real Chromium launch with axe. It does not sign in, create an audit PPTX or contact a prospect.

Rerun the same GitHub command to repair/update. Managed skill releases and copied-agent replacements retain backups. Unknown existing agent skills are preserved and reported as conflicts. Relocate/remove a conflicting skill yourself only when you intend to replace it, then rerun. Interrupted setup remains incomplete until checks pass.

Advanced local options: `bash install.sh --agent codex --home /absolute/dedicated/folder --no-shortcut`; `bash install.sh --plan` makes no installation. Windows equivalents: `-Agent codex`, `-InstallDir C:\dedicated\folder`, `-NoShortcut`, `-Plan`. CI can use `--source <repo>` / `-SourceDir <repo>` for a checked-out source. Public setup downloads this repo without Git.

The original Skills CLI route installs only the skill for an existing configured agent. Agent Skills discovery is not expected to execute installers automatically.

Primary sources: [Node](https://nodejs.org/dist/latest-v24.x/), [uv](https://docs.astral.sh/uv/reference/environment/#uv_unmanaged_install), [Claude Code npm installation](https://code.claude.com/docs/en/setup#install-with-npm), [Codex CLI](https://learn.chatgpt.com/docs/codex/cli), [Playwright](https://playwright.dev/docs/browsers#install-system-dependencies), [Marp](https://github.com/marp-team/marp-cli).
