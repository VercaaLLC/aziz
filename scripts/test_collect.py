#!/usr/bin/env python3
"""Local invariant tests; no external network or project scripts are executed."""
import argparse
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPTS = Path(__file__).resolve().parent


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


collector = load_module("collect")
installer = load_module("install")


class AuditEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="aziz-wa-test-")
        self.base = Path(self.temp.name).resolve()
        self.repo = self.base / "repo"
        self.repo.mkdir()
        self.out = self.base / "result.json"
        self.args = argparse.Namespace(repo=str(self.repo), out=str(self.out), registry=False,
                                       include_scope=[], npm_audit=False, max_files=40000, max_registry=150)

    def tearDown(self):
        self.temp.cleanup()

    def write(self, relative, data):
        path = self.repo / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data) if isinstance(data, dict) else data)
        return path

    def collect(self):
        with patch.object(collector.shutil, "which", return_value=None):
            return collector.collect(self.args)

    def test_npm_v3_hoisting_and_workspace_override(self):
        self.write("package.json", {"dependencies": {"lib": "^1.0.0"}, "workspaces": ["apps/*"]})
        self.write("apps/web/package.json", {"dependencies": {"lib": "^2.0.0", "shared": "^3"}})
        self.write("package-lock.json", {"lockfileVersion": 3, "packages": {
            "node_modules/lib": {"version": "1.2.0"},
            "apps/web/node_modules/lib": {"version": "2.1.0"},
            "node_modules/shared": {"version": "3.0.1"}}})
        rows = self.collect()["dependencies"]
        self.assertEqual({(r["workspace"], r["name"]): r["locked"] for r in rows},
                         {(".", "lib"): "1.2.0", ("apps/web", "lib"): "2.1.0", ("apps/web", "shared"): "3.0.1"})

    def test_npm_v1_lock_and_no_installed_version_inference(self):
        self.write("package.json", {"dependencies": {"lib": "^1.0.0"}})
        self.write("package-lock.json", {"lockfileVersion": 1, "dependencies": {"lib": {"version": "1.4.0"}}})
        row = self.collect()["dependencies"][0]
        self.assertEqual(row["locked"], "1.4.0")
        self.assertIsNone(row["installed"])

    def test_non_npm_lock_does_not_manufacture_exact_version(self):
        self.write("package.json", {"dependencies": {"lib": "^1"}})
        self.write("pnpm-lock.yaml", "lockfileVersion: '9.0'\n")
        self.assertIsNone(self.collect()["dependencies"][0]["locked"])

    def test_malformed_lock_is_visible(self):
        self.write("package.json", {"dependencies": {"lib": "^1"}})
        self.write("package-lock.json", "{bad json")
        report = self.collect()
        self.assertTrue(any(e["path"] == "package-lock.json" for e in report["errors"]))
        self.assertIsNone(report["dependencies"][0]["locked"])

    def test_default_no_network_no_script_execution_no_mutation(self):
        sentinel = self.base / "executed"
        self.write("package.json", {"scripts": {"postinstall": f"touch {sentinel}"}, "dependencies": {"lib": "1.0.0"}})
        before = (self.repo / "package.json").read_bytes()
        with patch.object(collector, "fetch_metadata", side_effect=AssertionError("network attempted")):
            self.collect()
        self.assertFalse(sentinel.exists())
        self.assertEqual((self.repo / "package.json").read_bytes(), before)

    def test_symlink_and_secret_files_excluded(self):
        outside = self.base / "private"
        outside.mkdir()
        (outside / "package.json").write_text('{"dependencies":{"private-name":"1"}}')
        (self.repo / "linked").symlink_to(outside, target_is_directory=True)
        self.write(".env", "SECRET=do-not-collect")
        self.write("app.js", "export const a = 1")
        report = self.collect()
        self.assertEqual(report["manifests"], [])
        self.assertEqual(report["source_footprint"]["files_seen"], 1)
        self.assertNotIn("do-not-collect", self.out.read_text())

    def test_freshness_semver_prerelease_and_ahead(self):
        examples = [("1.0.0", "1.0.1", "behind-latest-tag"),
                    ("2.0.0", "1.9.9", "ahead-of-latest-tag"),
                    ("1.0.0+build1", "1.0.0+build2", "matches-latest-tag"),
                    ("1.0.0-rc.2", "1.0.0-rc.10", "behind-latest-tag"),
                    ("1.0.0", "1.0.0-rc.1", "ahead-of-latest-tag"),
                    ("^1", "1.1.0", "unknown")]
        for current, latest, expected in examples:
            with self.subTest(current=current, latest=latest):
                self.assertEqual(collector.version_relation(current, latest), expected)

    def test_scoped_packages_skipped_by_default_and_explicitly_enabled(self):
        self.write("package.json", {"dependencies": {"@public/lib": "1.0.0", "@private/lib": "1.0.0"}})
        self.args.registry = True
        self.args.include_scope = ["@public"]
        with patch.object(collector, "public_registry_allowed", return_value=True), \
             patch.object(collector, "fetch_metadata", return_value={"version": "1.0.0"}) as fetch:
            rows = self.collect()["dependencies"]
        self.assertEqual(fetch.call_args_list[0].args[0], "@public/lib")
        self.assertEqual(fetch.call_count, 1)
        self.assertEqual(next(r for r in rows if r["name"] == "@private/lib")["registry"]["freshness"], "not-checked")

    def test_custom_registry_skipped_without_serializing_auth(self):
        self.write("package.json", {"dependencies": {"internal": "1.0.0"}})
        self.write(".npmrc", "registry=https://private.invalid\n//private.invalid/:_authToken=NEVER_OUTPUT_THIS\n")
        self.args.registry = True
        with patch.object(collector, "fetch_metadata", side_effect=AssertionError("private lookup attempted")):
            report = self.collect()
        self.assertEqual(report["dependencies"][0]["registry"]["freshness"], "not-checked")
        self.assertNotIn("NEVER_OUTPUT_THIS", self.out.read_text())

    def test_registry_failure_remains_unknown(self):
        self.write("package.json", {"dependencies": {"lib": "1.0.0"}})
        self.args.registry = True
        with patch.object(collector, "public_registry_allowed", return_value=True), \
             patch.object(collector, "fetch_metadata", side_effect=OSError("offline")):
            row = self.collect()["dependencies"][0]
        self.assertEqual(row["registry"]["freshness"], "unknown-registry-failure")

    def test_nonzero_npm_advisory_result_is_not_execution_failure(self):
        self.write("package.json", {})
        self.write("package-lock.json", {"lockfileVersion": 3, "packages": {}})
        self.args.npm_audit = True
        with patch.object(collector.shutil, "which", side_effect=lambda name: "/fake/npm" if name == "npm" else None), \
             patch.object(collector, "run", return_value={"return_code": 1, "stdout": '{"vulnerabilities":{"lib":{"severity":"high"}}}'}):
            result = collector.collect(self.args)
        self.assertEqual(result["checks"][0]["status"], "completed-review-results")
        self.assertEqual(result["checks"][0]["parsed"]["vulnerabilities"]["lib"]["severity"], "high")

    def test_evidence_and_installer_never_overwrite(self):
        self.out.write_text("existing evidence")
        with self.assertRaises(ValueError):
            self.collect()
        target = self.base / "skill"
        target.mkdir()
        (target / "keep").write_text("keep")
        self.assertEqual(installer.install(self.repo, target)["status"], "conflict-preserved")
        self.assertEqual((target / "keep").read_text(), "keep")

    def test_installer_is_idempotent(self):
        target = self.base / "skills" / "aziz-wa"
        self.assertEqual(installer.install(self.repo, target)["status"], "installed")
        self.assertEqual(installer.install(self.repo, target)["status"], "already-installed")
        self.assertEqual(target.resolve(), self.repo)

    def test_installation_name_survives_differently_named_github_clone(self):
        clone = self.base / "aziz"
        (clone / "scripts").mkdir(parents=True)
        project = self.base / "project"
        project.mkdir()
        with patch.object(installer, "__file__", str(clone / "scripts" / "install.py")), \
             patch.object(installer.sys, "argv", ["install.py", "--project", str(project)]), \
             contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(installer.main(), 0)
        self.assertEqual((project / ".claude/skills/aziz-wa").resolve(), clone)
        self.assertEqual((project / ".agents/skills/aziz-wa").resolve(), clone)
        self.assertFalse((project / ".claude/skills/aziz").exists())

    def test_copy_install_works_without_symlink_privileges(self):
        self.write("SKILL.md", "skill")
        target = self.base / "agent-skill"
        result = installer.install(self.repo, target, copy=True)
        self.assertEqual(result["status"], "installed-copy")
        self.assertFalse(target.is_symlink())
        self.assertEqual((target / "SKILL.md").read_text(), "skill")

    def test_managed_copy_update_keeps_previous_files_in_backup(self):
        self.write("SKILL.md", "old")
        target = self.base / "agent-skill"
        managed = self.base / "runtime"
        installer.install(self.repo, target, copy=True, managed_root=managed)
        self.write("SKILL.md", "new")
        result = installer.install(self.repo, target, copy=True, update_owned=True, managed_root=managed)
        self.assertEqual(result["status"], "updated")
        self.assertEqual((target / "SKILL.md").read_text(), "new")
        self.assertEqual((Path(result["backup"]) / "SKILL.md").read_text(), "old")

    def test_copy_update_cannot_replace_another_installations_skill(self):
        self.write("SKILL.md", "old")
        target = self.base / "agent-skill"
        installer.install(self.repo, target, copy=True, managed_root=self.base / "owner-a")
        self.write("SKILL.md", "new")
        result = installer.install(self.repo, target, copy=True, update_owned=True, managed_root=self.base / "owner-b")
        self.assertEqual(result["status"], "conflict-preserved")
        self.assertEqual((target / "SKILL.md").read_text(), "old")


if __name__ == "__main__":
    unittest.main(verbosity=2)
