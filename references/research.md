# Research behind aziz-WA

Research date: 17 October 2026. Requirement: one free tool or skill for professional UI, UX, repository code quality, and current dependency/library health. This was a documentation/source review, not a hands-on benchmark of every competitor. Product availability and limits can change.

**Result:** I could not verify one existing free offering with thorough, explicit coverage of all four areas. Several are useful partial solutions. A URL scanner cannot inspect private source or reliably recover the complete exact dependency graph. A coordinated agent skill can combine browser and repository evidence, given access to both.

The gaps below are my assessment of documented scope, not proof that a product could never be extended.

| Candidate and primary source | Free status / documented focus | Gap against the request |
| --- | --- | --- |
| [Google Lighthouse](https://developer.chrome.com/docs/lighthouse/overview) | Open source; performance, accessibility, technical page-quality audits | No full visual design/critical-journey review, repository maintainability assessment, or complete lockfile freshness analysis |
| [Unlighthouse](https://unlighthouse.dev/) | Open-source site-wide Lighthouse workflow | Broadens page coverage; inherits the need for separate source, dependency and qualitative UX review |
| [SiteOne Crawler](https://crawler.siteone.io/) | Free/MIT crawler, technical audits and reports; optional browser and bring-your-own-LLM features | Documented crawling/technical checks do not establish private-source maintainability or exact package graph freshness |
| [Mazylon Web Audit](https://www.mazylon.com/en/solutions/web-audit/) | Vendor describes a free/open-source CLI aggregating Lighthouse, security and accessibility tools | Closest multi-engine technical scanner found; source quality and full dependency currency are not established by the documented URL workflow; auto-installed tool prerequisites matter |
| [Squirrelscan](https://docs.squirrelscan.com/agent-setup) | Local CLI audits are free/no account; hosted browser/AI features use credits | Documented SEO, performance, security, accessibility and agent checks do not establish full repository quality/freshness; cloud is not unlimited free |
| [Impeccable](https://impeccable.style/) and [free-use FAQ](https://impeccable.style/faq/) | Free/open-source design skills/commands; supports Claude Code and Codex; model usage is separate | Strong design-focused candidate; not a complete dependency/advisory/source-quality auditing system |
| [Addy Osmani: web-quality-audit](https://github.com/addyosmani/web-quality-skills/blob/main/skills/web-quality-audit/SKILL.md) | MIT Agent Skill combining live and source evidence for performance, accessibility, SEO and best practices | Closest existing general web-quality skill; dependency freshness/support/migration inventory and deep visual/journey/code-maintainability reporting are not comprehensive in this entrypoint |
| [Web-Check](https://github.com/Lissy93/web-check) | Open-source website/infrastructure/OSINT analysis | Public-site intelligence is different from deep task-based usability, private repository analysis and lockfile health |
| [SonarQube plans](https://www.sonarsource.com/plans-and-pricing/) | Source-quality/security product family; feature tiers differ, including separate advanced SCA capabilities | Does not provide the required visual/journey review; do not assume all dependency/security features are free |
| [Qodana editions](https://www.jetbrains.com/help/qodana/pricing.html) and [Community coverage](https://www.jetbrains.com/help/qodana/cloud-configure-for-os-projects.html) | Free Community linters with limited language/feature coverage; other plans paid | Static analysis does not supply visual UI/UX review, and free coverage does not establish the entire requested stack |

The plugin directory search returned general website builders rather than a dedicated verified all-area auditor, so no additional external plugin was installed. Only this custom skill was created.

## What was built

**aziz-WA** is one reusable skill with the portable identifier `aziz-wa`. It coordinates deep visual/journey/source/dependency review, plus accessibility, performance, technical SEO and relevant security/privacy signals. Free optional tools collect evidence; the host agent evaluates it. It does not claim that an automated score proves usability, compliance or security.

Included automation: offline repository/manifest inventory; exact npm direct lock resolution including workspace hoisting; opt-in current public npm version/deprecation metadata; opt-in installed npm advisory reports; optional Playwright screenshots/runtime/overflow capture and axe accessibility reports. Other ecosystems and transitive analysis use native tools, with explicit coverage gaps if unavailable.

Output: a detailed `aziz-WA-audit-report.md`, structured supporting findings, linked raw evidence, and prioritized remediation. The workflow then asks for approval before creating a `.pptx` presentation. It does not generate slides speculatively.

No paid audit platform or extra model API key is required. Claude/Codex usage can cost money; optional browser/tools need installation/network access. A full audit needs the source repository and usable browser target. Human research, screen-reader testing and field data remain distinct from automated and heuristic checks.

Compatibility: [Agent Skills specification](https://agentskills.io/specification), [Claude Code skills](https://code.claude.com/docs/en/skills), [OpenAI skills workflow](https://developers.openai.com/blog/skills-agents-sdk). The lowercase identifier preserves the common naming convention; the user-facing name is exactly aziz-WA.
