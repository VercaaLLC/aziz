# aziz-WA

Deep website audits for UI, UX, accessibility, code quality, library health, performance and SEO. Built for Claude Code and Codex, including public-site marketing prospect reports.

**Audit → detailed Markdown report → your approval → PowerPoint.**

## One install, including the requirements

You do not need Node.js, npm, Python, Git, Claude Code or Codex installed first. The GitHub installer handles the software setup.

**Mac / supported Linux:** open Terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/VercaaLLC/aziz/main/install.sh | bash
```

**Windows:** open PowerShell and paste:

```powershell
irm https://raw.githubusercontent.com/VercaaLLC/aziz/main/install.ps1 | iex
```

This installs:

- A private Node.js 24 LTS runtime, npm and managed Python.
- Claude Code and Codex, so you can choose the agent you use.
- Chromium, Playwright, axe and Lighthouse for browser/accessibility/performance checks.
- PowerPoint creation and slide-preview tools: python-pptx, Pillow, PptxGenJS and Marp.
- The aziz-WA skill, a launcher and a desktop shortcut when your Desktop folder exists.

The installer checks the tools before reporting success. Linux may request your administrator password for browser system libraries. Internet access and a supported OS are required. [Platforms, installation details and troubleshooting](references/setup.md).

**You still sign into the agent yourself.** The skill/installer are free; model accounts and usage are separate. No account credentials are installed, requested by the setup script, or uploaded.

## Use it

1. Open the **aziz-WA** shortcut on your desktop, or the launcher path printed after setup.
2. Choose Claude Code or Codex.
3. Enter the website URL. Sign into the chosen agent if asked.
4. Let the agent collect evidence and deliver `aziz-WA-audit-report.md`.
5. Review the report. It asks your approval before creating a `.pptx`.

The launcher supplies a public-site marketing audit request automatically: verified findings, a client-friendly summary and suggested services tied to the evidence. Source/backend/full dependency checks remain explicitly unverified for websites you do not own. It does not submit forms or perform intrusive security tests.

If you already use an agent session, invoke:

Claude Code:

```text
/aziz-wa Audit https://example.com using public pages only. Deliver the deep Markdown report, then ask my approval before PowerPoint conversion.
```

Codex:

```text
$aziz-wa Audit https://example.com using public pages only. Deliver the deep Markdown report, then ask my approval before PowerPoint conversion.
```

For source-aware audits, open/provide your website repository as well. The display name is **aziz-WA**; the portable identifier/command is lowercase `aziz-wa`.

## What gets reviewed

| Area | Coverage |
| --- | --- |
| UI / UX | Hierarchy, typography, layout, mobile behavior, navigation, journeys, forms and recovery |
| Accessibility | Keyboard/focus, semantics, contrast, reflow and available automated checks |
| Code quality | Representative source architecture, state/data flow, errors, async cleanup, duplication, types and tests when source is available |
| Libraries | Versions, updates, advisories, deprecation, support and upgrade compatibility when exact metadata is available |
| Performance / SEO | Measured loading/runtime signals, indexability, metadata, canonicals and relevant technical SEO |
| Security/privacy | Relevant passive public/source signals within authorized access |

Findings include evidence, location, impact, priority, confidence, a remedy and a retest. The report lists what was sampled and what could not be verified. Automated checks do not prove complete accessibility, usability or security. Reports and screenshots stay local unless you choose to share them.

## Reports and PowerPoint

The launcher creates a separate folder under the installation's `audits` directory for each website. It contains the Markdown report, structured findings and available evidence. Application files are reviewed without changes unless you request fixes.

After approval, the installed presentation tools can generate a real PPTX. The Marp/Chromium fallback also produces slide images for visual review and uses image-based PowerPoint slides. Editable generators are installed too; the agent discloses any unavailable native slide verification. [Presentation workflow](references/powerpoint.md).

## Updates and diagnostics

Rerun the same GitHub install command to repair or update. Installer-managed files retain backups; unknown existing skills are preserved. Run the printed launcher path followed by `doctor` for runtime/browser checks. [Setup details](references/setup.md).

Already have an agent and all required tools? The lightweight skill-only route remains available:

```bash
npx skills add VercaaLLC/aziz --skill aziz-wa -g -a claude-code -a codex
```

That command installs only the skill. The one-command bootstrap above is the full installation.

## Development checks

```bash
python3 -B scripts/test_collect.py
node --test scripts/test_setup.mjs
bash -n install.sh
```

GitHub Actions checks the installers on Windows, macOS and Linux and runs a clean complete setup. [Validation record](references/validation.md) · [Original research](references/research.md) · [MIT License](LICENSE).
