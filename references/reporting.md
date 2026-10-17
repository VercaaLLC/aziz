# Report contract

Write `aziz-WA-audit-report.md` as the primary deliverable, with a linked table of contents when long. Include executive assessment/top risks; target/product/stack inventory; method/scope/sample; UI review; UX journey results; accessibility; code quality; complete available dependency health table; measured performance; technical SEO; relevant security/privacy signals; prioritized findings; grounded strengths; remediation roadmap; and verification/limitations/evidence appendix. State not-applicable/not-tested areas rather than padding them with generic advice. Link raw artifacts locally. Coverage `verified` means the declared sample was checked, not the whole product is defect-free.

For a deep report, explain the consequences and practical remedies rather than producing a checklist of unsupported assertions. Include route/state/viewport and source-review coverage tables, failing/passing check summaries, an advisory/update plan with compatibility constraints, and immediate/next/later priorities. Add precise code excerpts only when useful and sanitized. Trace each recommendation to a finding or clearly label it optional.

Deliver the Markdown file before asking whether to convert it to PowerPoint. Wait for explicit conversion approval; do not create a PPTX in advance.

Severity: critical = confirmed severe exposure/essential task completely blocked without viable workaround; high = serious barrier to an important task or materially affected security/reliability; medium = meaningful friction or maintenance/reliability risk; low = limited polish/maintenance; info = useful context without established defect. Use context and preserve upstream advisory severity separately. Confidence high = reproduced/measured or clear source trace; medium = supported inference; low = hypothesis with a next check. Label unconfirmed severe hypotheses explicitly.

Do not invent an overall score, claim WCAG compliance, zero vulnerabilities or guaranteed conversion improvements. Retain real tool scores with scope, units and environment. Include failed/skipped checks. Unknown dependency cells remain unknown with a reason.

Write valid `audit-findings.json` with this structure (sample date is illustrative):

```json
{
  "schema_version": "1.0",
  "checked_at": "2026-01-01T00:00:00Z",
  "target": {"url": null, "repository": null, "commit": null},
  "coverage": {
    "ui": {"status": "not-tested", "scope": [], "limitations": []},
    "ux": {"status": "not-tested", "scope": [], "limitations": []},
    "code-quality": {"status": "not-tested", "scope": [], "limitations": []},
    "libraries": {"status": "not-tested", "scope": [], "limitations": []}
  },
  "findings": [],
  "dependencies": [],
  "checks": [],
  "limitations": []
}
```

Each finding: `id`, `category` (ui/ux/accessibility/code-quality/libraries/performance/seo/security-privacy), `title`, `severity`, `confidence`, `basis` (observed/source/heuristic/hypothesis), `location` (URL/viewport/state or path/line), `evidence`, `reproduction`, `impact`, `recommendation`, `effort`, `verification`, `status` (open/fixed/needs-validation). Add coverage entries for the supporting categories when applicable; retain the four required core entries.

Each dependency: name, ecosystem, workspace, kind, scope, declared, locked, installed, wanted, latest, channel, freshness, vulnerabilities, deprecation, support, recommendation, evidence, checked_at. Use null for unknown scalars and explain limitations. Include multiple paths/versions where relevant.

Each check: name, command/capability, environment, result, return_code if applicable, raw artifact path. Empty findings do not make untested coverage pass. Redact credential-bearing URLs and private content; use relative artifact links where possible.
