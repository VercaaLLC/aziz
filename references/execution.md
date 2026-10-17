# Tool adapters

Use capabilities already available. No particular MCP, paid service or other skill is required. Save raw output and record missing/failed checks. Respect approved registries and private data boundaries.

With the complete GitHub installer, the core tools are already provisioned. Read `$AZIZ_WA_HOME/setup.json`, use `AZIZ_WA_PYTHON` for Python and `AZIZ_WA_TOOLS_DIR` for Node packages, and preserve `PLAYWRIGHT_BROWSERS_PATH`/`CHROME_PATH`. Run the managed launcher with `doctor` to diagnose failure; do not reinstall merely because system tools are absent from another terminal. [Setup](setup.md).

## Helpers

`collect.py` defaults to Python standard-library offline inventory. It does not install packages, execute project scripts or read .env files. It includes package script text for inspection: review artifacts before sharing. `--registry` contacts public npm without authentication and skips unapproved scopes/detected private mappings. It inspects registry directives in user/project .npmrc, without extracting or using auth values; global/custom config outside these locations still needs agent review. `--npm-audit` is explicit because installed npm sends dependency metadata to the configured registry. Neither option fixes anything.

`browser-audit.mjs` accepts an explicit URL and `--tools-dir` containing node_modules. It visits that URL at three viewports, captures screenshots, runtime/network failures and overflow candidates, and runs axe when installed. It never runs npm/npx. It does not crawl, authenticate, test tasks/screen readers, perform visual judgment or establish field performance. Inspect final URLs for login/bot challenge/error pages before counting coverage.

If browser tools are absent and installation is permitted, use an isolated tools directory outside the repository:

```bash
npm install --prefix <tools-dir> --ignore-scripts --no-audit --no-fund playwright @axe-core/playwright lighthouse
node <tools-dir>/node_modules/playwright/cli.js install chromium
node <skill-dir>/scripts/browser-audit.mjs --url <url> --out <audit-dir>/browser --tools-dir <tools-dir> --require-axe
```

Download a browser only if needed, or add `--channel chrome` to use installed Google Chrome. Tools are free but require network/disk access; don't retry installation repeatedly after an environment block. Record/pin versions for repeat comparisons. Use existing browser connectors instead when practical. Keep authenticated artifacts local and redact personal content.

## Lighthouse

Use existing DevTools/MCP capabilities or a local CLI after checking installed-version help and Chrome availability:

```bash
node <tools-dir>/node_modules/lighthouse/cli/index.js <url> --output=json --output=html --output-path=<audit-dir>/lighthouse-mobile --chrome-flags="--headless"
node <tools-dir>/node_modules/lighthouse/cli/index.js <url> --preset=desktop --output=json --output=html --output-path=<audit-dir>/lighthouse-desktop --chrome-flags="--headless"
```

Record device, throttling, environment and versions. Use supported categories/metrics, repeated samples for comparisons and visible variance. Lab traces are not real-user INP or field CWV passes. [Official Lighthouse overview](https://developer.chrome.com/docs/lighthouse/overview).

## Native dependency checks

Examples to adapt after checking installed-version help/current official docs. Save stdout/stderr and status; never run fix/update variants. Resolve each workspace and disclose direct/transitive scope.

| Ecosystem | Freshness | Advisory/inventory |
| --- | --- | --- |
| npm | `npm outdated --json --long`; add `--all` where useful | `npm audit --json --ignore-scripts` with existing lock |
| pnpm | `pnpm outdated --format json` or installed-version equivalent; recurse workspaces | `pnpm audit --json` |
| Yarn modern | Current `yarn npm info` metadata compared with lock; not `yarn up` | `yarn npm audit --all --recursive --json`; Classic differs |
| Bun | `bun outdated` | `bun audit` if supported |
| Python | `python -m pip list --outdated --format=json` describes that environment | Existing `pip-audit` with supported resolved requirements/lock; do not execute untrusted setup code |
| PHP | `composer --no-plugins --no-scripts outdated --direct --format=json` | `composer --no-plugins --no-scripts audit --format=json` |
| Ruby | `bundle outdated` after inspecting configuration | Existing `bundler-audit` against Gemfile.lock |
| Rust | Existing `cargo outdated` or crates.io metadata + lock | Existing `cargo audit`, recording database freshness |
| Go | Module metadata / `go list -m -u`, considering network/cache effects | Existing `govulncheck`; not a freshness checker |
| .NET | SDK-supported package-list outdated command | SDK-supported vulnerable command; consider restore effects/no-restore |
| Java | Existing Maven/Gradle dependency report and version checker | Existing OWASP Dependency-Check or approved OSV scanner |

No installed analyzer means partial coverage unless alternative evidence fills it. Do not silently omit an ecosystem. Do not invoke unknown tools through npx just to check availability: it can download/execute code.

Primary references: [npm outdated](https://docs.npmjs.com/cli/v11/commands/npm-outdated/), [npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit/), [pnpm](https://pnpm.io/cli/outdated), [Yarn](https://yarnpkg.com/cli/npm/audit), [pip-audit](https://github.com/pypa/pip-audit), [Composer](https://getcomposer.org/doc/03-cli.md), [OSV Scanner](https://google.github.io/osv-scanner/).
