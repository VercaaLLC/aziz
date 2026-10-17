#!/usr/bin/env python3
"""Install this portable skill without overwriting existing skills."""
import argparse
import json
from pathlib import Path
import sys

SKILL_NAME = "aziz-wa"


def install(source, destination):
    source = source.resolve()
    try:
        if destination.is_symlink() and destination.resolve() == source:
            return {"path": str(destination), "status": "already-installed"}
        if destination.exists() or destination.is_symlink():
            return {"path": str(destination), "status": "conflict-preserved"}
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.symlink_to(source, target_is_directory=True)
        return {"path": str(destination), "status": "installed"}
    except OSError as exc:
        return {"path": str(destination), "status": "blocked", "reason": str(exc)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent", choices=("both", "claude", "codex"), default="both")
    parser.add_argument("--project", help="Existing repository for project-local links")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent.parent
    base = Path(args.project).expanduser().resolve() if args.project else Path.home()
    if not base.is_dir():
        parser.error("project/home directory must exist")
    targets = []
    if args.agent in ("both", "claude"):
        targets.append(base / ".claude" / "skills" / SKILL_NAME)
    if args.agent in ("both", "codex"):
        targets.append(base / ".agents" / "skills" / SKILL_NAME)
    results = [install(source, destination) for destination in targets]
    print(json.dumps({"source": str(source), "results": results}, indent=2))
    return int(any(r["status"] in {"blocked", "conflict-preserved"} for r in results))


if __name__ == "__main__":
    sys.exit(main())
