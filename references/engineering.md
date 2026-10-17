# Source and dependency review

## Source

Start at primary routes and trace components → state/data → server/API as access allows. Read representative shared/complex modules and relevant tests; list the sample. Lint passing only verifies configured rules.

Review failure paths, stale/duplicated state, async races/cleanup, repeated requests, expensive work supported by profiling, semantics, routing, validation and recovery. Examine boundaries, type/API contracts, repeated logic, configuration drift, test relevance, CI and build reproducibility. Avoid universal line-count or coverage thresholds.

Trace suspicious security-relevant input to sink and mitigations before assigning severity. Report exposed secrets without copying values. Missing CSP, public source maps, or a risky API name alone does not prove an exploit. This is not an intrusive penetration test.

Inspect scripts and pre/post hooks before executing existing lint/type/test/build checks. Use non-fixing modes and project conventions; do not format, regenerate locks, or broadly install dependencies. Builds/tests can execute arbitrary project code and write outputs: use an appropriate local environment, timeouts and no production credentials. Preserve existing application changes.

Record command, directory, return code, meaningful diagnostics and whether a tool was blocked, failed to run, or found defects. Missing tooling is not itself a code defect without context. Missing tests do not prove a particular feature has never been tested.

## Library health: five distinct questions

1. **Inventory:** declared range, exact locked version, installed version if known, manifest/workspace, direct/transitive and runtime/dev/optional/peer scope. `^18` is a range, not an installed version. Locks may contain several versions and diverge from installed environments.
2. **Freshness:** newest allowed by the current range (`wanted`) versus current registry `latest`/chosen channel. Record registry/date. Latest tags may point at prereleases or older supported majors; mismatch alone does not establish that a version is older.
3. **Advisories:** affected ranges/IDs, fixed versions, dependency path and scope. Reachability is a separate analysis. No matches means none in the consulted database at that time, not proof of safety.
4. **Maintenance:** registry deprecation and official runtime/framework support/EOL. Old publication dates alone do not prove abandonment. Unavailable/private metadata is unknown.
5. **Upgrade suitability:** engine/peer constraints, framework compatibility, maintainer migration guide, major-change risk and relevant tests. Prefer a supported compatible security fix; never default to `--force` or latest-everything.

Cover each discovered workspace/ecosystem. Investigate mixed lockfiles rather than picking a manager arbitrarily. The collector resolves npm v1/v2/v3 direct lock references only. Resolve pnpm/Yarn/Bun and other ecosystems natively or by lock inspection. Do not run npm against another manager's lock to manufacture coverage.

Dependency table: name, workspace/ecosystem, kind/scope, declared, locked/installed, compatible update, latest/channel, advisory/deprecation/support, recommendation, evidence and checked time. Keep unknown columns explicit and include multiple versions/paths where relevant. Group transitive issues under the parent fix while retaining advisory IDs.

Prioritize materially affected high-impact production paths, then compatible fixes, deprecated/EOL dependencies and routine updates. Dev dependencies can still affect CI/build security. Outdated without a known vulnerability is not automatically critical. Use official registries, release/support notes and advisory databases; verify unfamiliar command syntax in current official docs.
