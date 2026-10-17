#!/usr/bin/env python3
"""Read-only audit evidence collector. Python 3.11+, no third-party dependencies."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

IGNORE = {".git", ".hg", ".svn", "node_modules", "vendor", ".venv", "venv",
          "dist", "build", "coverage", ".next", ".nuxt", ".cache", "__pycache__",
          ".website-audit", "target", "Pods"}
MANIFESTS = {"package.json", "pyproject.toml", "requirements.txt", "Pipfile",
             "composer.json", "Gemfile", "Cargo.toml", "go.mod", "pom.xml",
             "build.gradle", "build.gradle.kts", "pubspec.yaml"}
LOCKS = {"package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
         "bun.lock", "bun.lockb", "uv.lock", "poetry.lock", "Pipfile.lock",
         "composer.lock", "Gemfile.lock", "Cargo.lock", "go.sum", "packages.lock.json"}
SOURCE = {".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte", ".css", ".scss",
          ".html", ".py", ".php", ".rb", ".go", ".rs", ".java", ".kt", ".cs"}
GROUPS = ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies")
SEMVER = re.compile(r"^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$")


def now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def redact(value):
    """Best effort only; artifacts still require review before sharing."""
    value = re.sub(r"(https?://)[^/\s@]+@", r"\1<redacted>@", value)
    value = re.sub(r"(?i)((?:token|password|secret|api[_-]?key)\s*[=:]\s*)[^\s;&]+",
                   r"\1<redacted>", value)
    return value


def run(argv, cwd, timeout=30):
    result = {"command": argv, "cwd": str(cwd), "checked_at": now()}
    try:
        proc = subprocess.run(argv, cwd=cwd, capture_output=True, text=True,
                              timeout=timeout, shell=False)
        result.update(return_code=proc.returncode, stdout=redact(proc.stdout),
                      stderr=redact(proc.stderr))
        if len(result["stdout"]) > 4_000_000:
            result["stdout"] = result["stdout"][:4_000_000]
            result["truncated"] = True
    except (OSError, subprocess.TimeoutExpired) as exc:
        result.update(return_code=None, error=redact(str(exc)))
    return result


def read_json(path, limit=50_000_000):
    if path.is_symlink():
        raise ValueError("symlink skipped")
    if path.stat().st_size > limit:
        raise ValueError("file exceeds collection limit")
    return json.loads(path.read_text(encoding="utf-8"))


def inventory(repo, max_files, excluded):
    paths, truncated = [], False
    for directory, dirs, files in os.walk(repo, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in IGNORE
                         and not (Path(directory) / d).is_symlink()
                         and (Path(directory) / d).resolve() not in excluded
                         and not d.startswith("."))
        for name in sorted(files):
            p = Path(directory) / name
            if p.is_symlink() or p.resolve() in excluded or name.startswith("."):
                continue
            paths.append(p)
            if len(paths) >= max_files:
                truncated = True
                return paths, truncated
    return paths, truncated


def resolve_npm(dep, package_dir, repo, lock_cache):
    """Resolve the direct slot by Node ancestor lookup; never confuse nested duplicates."""
    current = package_dir
    while current.is_relative_to(repo):
        for name in ("npm-shrinkwrap.json", "package-lock.json"):
            lock_path = current / name
            if lock_path.is_file() and not lock_path.is_symlink():
                if lock_path not in lock_cache:
                    try:
                        lock_cache[lock_path] = read_json(lock_path)
                    except (OSError, ValueError) as exc:
                        lock_cache[lock_path] = {"_error": str(exc)}
                lock = lock_cache[lock_path]
                packages = lock.get("packages")
                if isinstance(packages, dict):
                    slot_dir = package_dir
                    while slot_dir.is_relative_to(current):
                        rel = slot_dir.relative_to(current).as_posix()
                        key = ("" if rel == "." else rel + "/") + "node_modules/" + dep
                        entry = packages.get(key)
                        if isinstance(entry, dict) and entry.get("version") and not entry.get("link"):
                            return {"locked": entry["version"],
                                    "lockfile": str(lock_path.relative_to(repo)),
                                    "lock_slot": key,
                                    "resolved": redact(str(entry.get("resolved", "")))}
                        if slot_dir == current:
                            break
                        slot_dir = slot_dir.parent
                elif current == package_dir:
                    entry = lock.get("dependencies", {}).get(dep, {})
                    if isinstance(entry, dict) and entry.get("version"):
                        return {"locked": entry["version"],
                                "lockfile": str(lock_path.relative_to(repo)),
                                "lock_slot": "dependencies." + dep,
                                "resolved": redact(str(entry.get("resolved", "")))}
        if current == repo:
            break
        current = current.parent
    return {"locked": None, "lockfile": None, "lock_slot": None}


def version_relation(current, latest):
    """Semver comparison including prerelease precedence; unknown for non-semver."""
    a, b = SEMVER.fullmatch(str(current)), SEMVER.fullmatch(str(latest))
    if not a or not b:
        return "unknown"
    x, y = tuple(map(int, a.group(1, 2, 3))), tuple(map(int, b.group(1, 2, 3)))
    if x != y:
        return "behind-latest-tag" if x < y else "ahead-of-latest-tag"
    ap, bp = a.group(4), b.group(4)
    if ap == bp:
        return "matches-latest-tag"
    if ap is None or bp is None:
        return "ahead-of-latest-tag" if ap is None else "behind-latest-tag"
    for left, right in zip(ap.split("."), bp.split(".")):
        if left == right:
            continue
        if left.isdigit() and right.isdigit():
            less = int(left) < int(right)
        elif left.isdigit() != right.isdigit():
            less = left.isdigit()
        else:
            less = left < right
        return "behind-latest-tag" if less else "ahead-of-latest-tag"
    return "behind-latest-tag" if len(ap.split(".")) < len(bp.split(".")) else "ahead-of-latest-tag"


def public_registry_allowed(dep, repo, package_dir):
    # Extract registry directives only; auth values never enter output or requests.
    configs = [Path.home() / ".npmrc"]
    current = package_dir
    while current.is_relative_to(repo):
        configs.append(current / ".npmrc")
        if current == repo:
            break
        current = current.parent
    scope = dep.split("/")[0] if dep.startswith("@") else None
    for config in configs:
        if not config.is_file():
            continue
        try:
            if config.stat().st_size > 1_000_000:
                return False
            for line in config.read_text(encoding="utf-8").splitlines():
                match = re.match(r"\s*((?:@[^:\s]+:)?registry)\s*=\s*(.*?)\s*$", line)
                if match and (match[1] == "registry" or match[1] == f"{scope}:registry"):
                    if match[2].strip("\"'").rstrip("/") != "https://registry.npmjs.org":
                        return False
        except (OSError, UnicodeError):
            return False
    configured = os.environ.get("npm_config_registry", os.environ.get("NPM_CONFIG_REGISTRY"))
    return not configured or configured.rstrip("/") == "https://registry.npmjs.org"


def fetch_metadata(name, version):
    url = "https://registry.npmjs.org/" + urllib.parse.quote(name, safe="") + "/" + urllib.parse.quote(version, safe="")
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "aziz-wa/1.0"})
    with urllib.request.urlopen(request, timeout=12) as response:
        body = response.read(8_000_001)
        if len(body) > 8_000_000:
            raise ValueError("registry response exceeds 8 MB")
        data = json.loads(body)
    return {"version": data.get("version"), "deprecated": data.get("deprecated"),
            "engines": data.get("engines"), "peerDependencies": data.get("peerDependencies"),
            "license": data.get("license"), "source": url, "checked_at": now()}


def enrich_dependency(dep):
    evidence = {"checked_at": now(), "scope": "direct-only", "wanted": None,
                "vulnerabilities": "not-checked-by-registry-lookup"}
    try:
        latest = fetch_metadata(dep["name"], "latest")
        evidence["latest"] = latest
        if dep.get("locked") and SEMVER.fullmatch(str(dep["locked"])):
            evidence["locked_metadata"] = (latest if dep["locked"] == latest["version"]
                                           else fetch_metadata(dep["name"], dep["locked"]))
            evidence["freshness"] = version_relation(dep["locked"], latest["version"])
        else:
            evidence["freshness"] = "unknown-exact-version"
    except Exception as exc:
        evidence["error"] = redact(str(exc))
        evidence["freshness"] = "unknown-registry-failure"
    return evidence


def collect(args):
    repo = Path(args.repo).expanduser().resolve()
    if not repo.is_dir():
        raise ValueError("repository path must be a directory")
    out = Path(args.out).expanduser().resolve()
    if out.exists():
        raise ValueError("output already exists; choose a fresh evidence file")
    if out == repo or (out.parent == repo and out.name in MANIFESTS | LOCKS):
        raise ValueError("output must not overwrite a project manifest/lockfile")
    paths, truncated = inventory(repo, args.max_files, {out})
    report = {"schema_version": "1.0", "checked_at": now(), "repository": str(repo),
              "manifests": [], "lockfiles": [], "dependencies": [], "errors": [],
              "limitations": ["Inventory is not a code-quality assessment.",
                "Exact auto-resolution covers direct npm lockfile versions only.",
                "Registry lookup does not compute wanted, transitive freshness, EOL or advisories.",
                "Installed versions and non-JS dependency metadata require native-tool review.",
                "Hidden, symlinked, generated and vendor directories are excluded."],
              "checks": [], "tools": {name: shutil.which(name) for name in
                ("git", "node", "npm", "pnpm", "yarn", "bun", "python3", "composer",
                 "cargo", "go", "dotnet", "mvn", "gradle", "ruff", "eslint")}}
    if truncated:
        report["limitations"].append(f"File inventory truncated at {args.max_files} files.")
    extensions, largest, lock_cache = Counter(), [], {}
    for path in paths:
        rel = str(path.relative_to(repo))
        try:
            if path.name in LOCKS:
                report["lockfiles"].append({"path": rel, "bytes": path.stat().st_size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest()
                    if path.stat().st_size <= 50_000_000 else None})
            if path.suffix in SOURCE:
                extensions[path.suffix] += 1
                largest.append({"path": rel, "bytes": path.stat().st_size})
            if path.name not in MANIFESTS and path.suffix not in {".csproj", ".fsproj"}:
                continue
            manifest = {"path": rel}
            report["manifests"].append(manifest)
            if path.name != "package.json":
                continue
            data = read_json(path)
            manifest.update(name=data.get("name"), packageManager=data.get("packageManager"),
                            engines=data.get("engines"), workspaces=data.get("workspaces"),
                            scripts={k: redact(str(v)) for k, v in data.get("scripts", {}).items()})
            for group in GROUPS:
                for name, declared in data.get(group, {}).items():
                    item = {"name": name, "declared": str(declared), "kind": group,
                            "workspace": path.parent.relative_to(repo).as_posix(), "ecosystem": "npm",
                            "manifest": rel, "installed": None}
                    item.update(resolve_npm(name, path.parent, repo, lock_cache))
                    report["dependencies"].append(item)
        except (OSError, ValueError, TypeError, AttributeError) as exc:
            report["errors"].append({"path": rel, "error": redact(str(exc))})
    report["source_footprint"] = {"files_seen": len(paths), "by_extension": dict(extensions),
                                 "largest_files": sorted(largest, key=lambda r: r["bytes"], reverse=True)[:20]}
    for lock_path, lock_data in lock_cache.items():
        if lock_data.get("_error"):
            report["errors"].append({"path": str(lock_path.relative_to(repo)), "error": lock_data["_error"]})
    if report["tools"]["git"]:
        report["checks"].append(run([report["tools"]["git"], "-c", "core.fsmonitor=false", "rev-parse", "HEAD"], repo))
        report["checks"].append(run([report["tools"]["git"], "-c", "core.fsmonitor=false", "status", "--porcelain", "--untracked-files=no"], repo))
    if args.registry:
        approved, skipped = [], []
        for dep in report["dependencies"]:
            scope = dep["name"].split("/")[0] if dep["name"].startswith("@") else None
            declared = dep["declared"]
            resolved = dep.get("resolved", "")
            eligible = (re.fullmatch(r"(?:@[a-zA-Z0-9_.-]+/)?[a-zA-Z0-9_.-]+", dep["name"])
                        and not declared.startswith(("workspace:", "file:", "link:", "git", "http", "npm:", "catalog:"))
                        and (not scope or scope in args.include_scope)
                        and (not resolved or resolved.startswith("https://registry.npmjs.org/"))
                        and public_registry_allowed(dep["name"], repo, repo / dep["workspace"]))
            if eligible:
                approved.append(dep)
            else:
                dep["registry"] = {"freshness": "not-checked", "reason": "private/scoped/custom-registry/non-registry reference excluded"}
                skipped.append(dep["name"])
        # Deduplicate requests across manifests and dependency groups.
        unique = {(d["name"], d.get("locked")): d for d in approved}
        keys = list(unique)[:args.max_registry]
        with ThreadPoolExecutor(max_workers=4) as pool:
            values = list(pool.map(enrich_dependency, (unique[k] for k in keys)))
        mapped = dict(zip(keys, values))
        for dep in approved:
            dep["registry"] = mapped.get((dep["name"], dep.get("locked")),
                {"freshness": "not-checked", "reason": "registry lookup limit"})
        report["registry_summary"] = {"queried_distinct_name_versions": len(keys),
            "excluded_entries": len(skipped), "limit": args.max_registry}
    else:
        report["limitations"].append("No current registry freshness lookup requested.")
    if args.npm_audit:
        roots = sorted({(repo / lock["path"]).parent for lock in report["lockfiles"]
                        if Path(lock["path"]).name in {"package-lock.json", "npm-shrinkwrap.json"}})
        if not roots or not report["tools"]["npm"]:
            report["limitations"].append("npm advisory check unavailable: missing npm or npm lockfile.")
        for directory in roots[:10]:
            result = run([report["tools"]["npm"], "audit", "--json", "--ignore-scripts", "--no-fund"], directory, 90)
            try:
                result["parsed"] = json.loads(result.get("stdout", ""))
                if "error" in result["parsed"]:
                    result["status"] = "failed"
                elif any(key in result["parsed"] for key in ("vulnerabilities", "advisories", "metadata")):
                    result["status"] = "completed-review-results"
                else:
                    result["status"] = "failed-unrecognized-json"
            except ValueError:
                result["status"] = "failed-no-valid-json"
            report["checks"].append(result)
        if len(roots) > 10:
            report["limitations"].append("npm audit root limit: only first 10 npm lock roots checked.")
    else:
        report["limitations"].append("No advisory scanner requested; vulnerability state remains unverified.")
    # Output is newly created only: never overwrite source or previous evidence.
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("x", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--registry", action="store_true", help="Query public npm registry metadata")
    parser.add_argument("--include-scope", action="append", default=[], help="Explicitly public scope such as @types")
    parser.add_argument("--npm-audit", action="store_true", help="Run installed npm audit using configured registry")
    parser.add_argument("--max-files", type=int, default=40000)
    parser.add_argument("--max-registry", type=int, default=150)
    args = parser.parse_args()
    if args.max_files < 1 or args.max_registry < 1:
        parser.error("limits must be positive")
    try:
        report = collect(args)
    except (OSError, ValueError) as exc:
        print(f"Collection failed: {redact(str(exc))}", file=sys.stderr)
        return 2
    print(json.dumps({"output": str(Path(args.out).expanduser().resolve()),
                      "manifests": len(report["manifests"]),
                      "direct_dependency_entries": len(report["dependencies"]),
                      "collection_errors": len(report["errors"]),
                      "note": "Evidence collected; agent review is still required."}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
