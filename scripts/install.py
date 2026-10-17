#!/usr/bin/env python3
"""Install this portable skill without overwriting existing skills."""
import argparse
import json
from pathlib import Path
import shutil
import sys
import uuid

SKILL_NAME = "aziz-wa"


def install(source, destination, copy=False, update_owned=False, managed_root=None):
    source = source.resolve()
    managed_root = Path(managed_root).resolve() if managed_root else None
    try:
        if destination.is_symlink() and destination.resolve() == source:
            return {"path": str(destination), "status": "already-installed"}
        if destination.exists() or destination.is_symlink():
            owner = None
            marker = destination / ".aziz-wa-install.json"
            if not destination.is_symlink() and marker.is_file():
                try:
                    owner = json.loads(marker.read_text())
                except (OSError, ValueError):
                    pass
            if not (copy and update_owned and managed_root and owner and owner.get("root") == str(managed_root)):
                return {"path": str(destination), "status": "conflict-preserved"}
            # Retain an existing managed copy before replacing it.
            backup = managed_root / "backups" / ("agent-skill-" + uuid.uuid4().hex)
            backup.parent.mkdir(parents=True, exist_ok=True)
        else:
            backup = None
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not copy:
            destination.symlink_to(source, target_is_directory=True)
            return {"path": str(destination), "status": "installed"}
        stage = destination.parent / (".aziz-wa-stage-" + uuid.uuid4().hex)
        try:
            shutil.copytree(source, stage, ignore=shutil.ignore_patterns("__pycache__", ".git", ".DS_Store"))
            (stage / ".aziz-wa-install.json").write_text(json.dumps({"root": str(managed_root) if managed_root else None, "source": str(source)}))
            if backup:
                destination.rename(backup)
            try:
                stage.rename(destination)
            except OSError:
                if backup:
                    backup.rename(destination)
                raise
        finally:
            if stage.exists():
                shutil.rmtree(stage)
        result = {"path": str(destination), "status": "updated" if backup else "installed-copy"}
        if backup:
            result["backup"] = str(backup)
        return result
    except OSError as exc:
        return {"path": str(destination), "status": "blocked", "reason": str(exc)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent", choices=("both", "claude", "codex"), default="both")
    parser.add_argument("--project", help="Existing repository for project-local links")
    parser.add_argument("--copy", action="store_true", help="Copy skill files; no symlink privileges needed on Windows")
    parser.add_argument("--update-owned", action="store_true", help="Update only a copy previously marked as managed by this installation")
    parser.add_argument("--managed-root", help="Dedicated bootstrap installation root")
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
    results = [install(source, destination, args.copy, args.update_owned, args.managed_root) for destination in targets]
    print(json.dumps({"source": str(source), "results": results}, indent=2))
    return int(any(r["status"] in {"blocked", "conflict-preserved"} for r in results))


if __name__ == "__main__":
    sys.exit(main())
