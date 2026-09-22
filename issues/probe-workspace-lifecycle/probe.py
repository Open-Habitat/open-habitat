#!/usr/bin/env python3
"""Disposable local workspace lifecycle probe.

Creates fixtures only below this issue directory, emits redacted JSON evidence, and
removes every fixture in a finally block. It does not contact GitHub or inspect
credentials; the separately documented read-only authorization commands do that.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ISSUE_DIR = Path(__file__).resolve().parent


def run(
    *argv: str,
    cwd: Path | None = None,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, cwd=cwd, check=check, text=True, capture_output=True, env=env)


def redact(text: str, root: Path) -> str:
    return text.replace(str(root), "<FIXTURE>").replace(str(Path.home()), "<HOME>")


def version_line(*argv: str) -> str:
    return run(*argv).stdout.strip().splitlines()[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    root = Path(tempfile.mkdtemp(prefix=".probe-tmp-", dir=ISSUE_DIR))
    sleeper: subprocess.Popen[str] | None = None
    evidence: dict[str, object] = {
        "schema_version": 1,
        "fixture_policy": "created below issue directory and removed in finally",
    }
    try:
        src = root / "src"
        outside = root / "outside"
        src.mkdir()
        outside.mkdir()

        plain = src / "plain"
        repo = src / "repo"
        plain.mkdir()
        repo.mkdir()
        (outside / "sentinel.txt").write_text("must survive\n", encoding="utf-8")
        (src / "linked-outside").symlink_to(outside, target_is_directory=True)

        entries = []
        for entry in sorted(os.scandir(src), key=lambda item: item.name):
            entries.append(
                {
                    "name": entry.name,
                    "is_directory_without_following_symlinks": entry.is_dir(follow_symlinks=False),
                    "is_symlink": entry.is_symlink(),
                }
            )
        evidence["directory_discovery"] = entries
        evidence["path_escape"] = {
            "lexical_child": str(src / "linked-outside").startswith(str(src) + os.sep),
            "resolved_child": os.path.realpath(src / "linked-outside").startswith(os.path.realpath(src) + os.sep),
            "resolved_target": redact(os.path.realpath(src / "linked-outside"), root),
        }

        run("git", "init", "--initial-branch=main", ".", cwd=repo)
        run("git", "config", "user.name", "Disposable Probe", cwd=repo)
        run("git", "config", "user.email", "probe.invalid@example.invalid", cwd=repo)
        (repo / "fixture.txt").write_text("fixture\n", encoding="utf-8")
        run("git", "add", "fixture.txt", cwd=repo)
        commit_env = os.environ.copy()
        commit_env.update(
            {
                "GIT_AUTHOR_DATE": "2000-01-01T00:00:00Z",
                "GIT_COMMITTER_DATE": "2000-01-01T00:00:00Z",
            }
        )
        run("git", "commit", "-m", "fixture", cwd=repo, env=commit_env)
        commit = run("git", "rev-parse", "HEAD", cwd=repo).stdout.strip()

        linked = outside / "agent-worktree"
        run("git", "worktree", "add", "--detach", str(linked), "HEAD", cwd=repo)
        worktree_porcelain = run("git", "worktree", "list", "--porcelain", cwd=repo).stdout
        main_common = run("git", "rev-parse", "--absolute-git-dir", cwd=repo).stdout.strip()
        linked_common = run("git", "rev-parse", "--path-format=absolute", "--git-common-dir", cwd=linked).stdout.strip()
        linked_git_dir = run("git", "rev-parse", "--absolute-git-dir", cwd=linked).stdout.strip()
        evidence["git"] = {
            "initialized": True,
            "commit": commit,
            "worktrees_porcelain": redact(worktree_porcelain, root),
            "main_git_dir": redact(main_common, root),
            "linked_common_dir": redact(linked_common, root),
            "linked_per_worktree_git_dir": redact(linked_git_dir, root),
            "common_identity_matches": os.path.realpath(main_common) == os.path.realpath(linked_common),
        }

        # Native Git metadata survives as stale state when a linked directory is
        # removed behind Git's back. The dry-run proves what explicit cleanup sees.
        shutil.rmtree(linked)
        stale_list = run("git", "worktree", "list", "--porcelain", cwd=repo).stdout
        prune = run("git", "worktree", "prune", "--dry-run", "--verbose", "--expire=now", cwd=repo)
        evidence["removed_linked_worktree_boundary"] = {
            "native_list_after_raw_directory_removal": redact(stale_list, root),
            "native_prune_dry_run": redact(prune.stdout + prune.stderr, root).strip(),
        }

        delete_me = src / "delete-me"
        delete_me.mkdir()
        (delete_me / "outside-link").symlink_to(outside / "sentinel.txt")
        shutil.rmtree(delete_me)
        safe_target_survived = (outside / "sentinel.txt").read_text(encoding="utf-8") == "must survive\n"

        # Demonstrate why canonicalizing an untrusted workspace symlink and then
        # recursively deleting the result is unsafe. This destroys only a second
        # synthetic target inside the disposable fixture.
        vulnerable_target = outside / "vulnerable-target"
        vulnerable_target.mkdir()
        (vulnerable_target / "sentinel.txt").write_text("synthetic\n", encoding="utf-8")
        vulnerable_link = src / "vulnerable-link"
        vulnerable_link.symlink_to(vulnerable_target, target_is_directory=True)
        shutil.rmtree(vulnerable_link.resolve())
        evidence["symlink_deletion"] = {
            "workspace_removed_without_following_descendant_link": not delete_me.exists(),
            "outside_target_survived_safe_primitive": safe_target_survived,
            "resolved_link_target_destroyed_by_vulnerable_primitive": not vulnerable_target.exists(),
            "workspace_symlink_still_exists_after_target_destruction": vulnerable_link.is_symlink(),
        }

        # Deleting a main worktree first strands a linked worktree because its
        # .git file points back into the now-missing common Git directory.
        doomed = src / "doomed-main"
        doomed.mkdir()
        run("git", "init", "--initial-branch=main", ".", cwd=doomed)
        run("git", "config", "user.name", "Disposable Probe", cwd=doomed)
        run("git", "config", "user.email", "probe.invalid@example.invalid", cwd=doomed)
        (doomed / "fixture.txt").write_text("fixture\n", encoding="utf-8")
        run("git", "add", "fixture.txt", cwd=doomed)
        run("git", "commit", "-m", "fixture", cwd=doomed, env=commit_env)
        stranded = outside / "stranded-worktree"
        run("git", "worktree", "add", "--detach", str(stranded), "HEAD", cwd=doomed)
        shutil.rmtree(doomed)
        stranded_status = run("git", "status", "--porcelain", cwd=stranded, check=False)
        evidence["removed_main_worktree_boundary"] = {
            "linked_directory_survived": stranded.is_dir(),
            "linked_git_status_exit": stranded_status.returncode,
            "linked_git_status_error": redact(stranded_status.stderr, root).strip(),
            "common_git_directory_survived": doomed.exists(),
        }

        # Linux permits unlinking a process's current directory. Liveness must be
        # checked and governed separately; filesystem deletion is not process stop.
        busy = src / "busy"
        busy.mkdir()
        sleeper = subprocess.Popen(["sleep", "30"], cwd=busy, text=True)
        time.sleep(0.05)
        shutil.rmtree(busy)
        cwd_after = os.readlink(f"/proc/{sleeper.pid}/cwd")
        evidence["process_boundary"] = {
            "directory_removed_while_process_alive": not busy.exists() and sleeper.poll() is None,
            "proc_cwd_after_removal": redact(cwd_after, root),
        }

        taskfleet_result = run(
            "taskfleet", "run", "show", "--current", "--output", "json", check=False
        )
        if taskfleet_result.returncode == 0:
            current = json.loads(taskfleet_result.stdout)["data"]
            evidence["taskfleet_native_association"] = {
                "status": "current_run_found",
                "run_id": current["run_id"],
                "kind": current["kind"],
                "source_branch": current["source_branch"],
                "worktree_path": redact(current["worktree_path"], root),
                "harness": current["harness"],
                "git_branch": run("git", "symbolic-ref", "--short", "HEAD", cwd=ISSUE_DIR).stdout.strip(),
                "git_common_dir": redact(run("git", "rev-parse", "--path-format=absolute", "--git-common-dir", cwd=ISSUE_DIR).stdout.strip(), root),
                "git_dir": redact(run("git", "rev-parse", "--absolute-git-dir", cwd=ISSUE_DIR).stdout.strip(), root),
            }
        else:
            evidence["taskfleet_native_association"] = {
                "status": "not_in_taskfleet_worktree",
                "detail": "local fixture evidence remains valid; no current run was associated",
            }
        evidence["versions"] = {
            "git": version_line("git", "--version"),
            "taskfleet": json.loads(run("taskfleet", "version", "--output", "json").stdout)["data"],
        }
        evidence["all_assertions_passed"] = all(
            [
                evidence["path_escape"]["lexical_child"],  # type: ignore[index]
                not evidence["path_escape"]["resolved_child"],  # type: ignore[index]
                evidence["git"]["common_identity_matches"],  # type: ignore[index]
                any(e["name"] == "linked-outside" and e["is_symlink"] and not e["is_directory_without_following_symlinks"] for e in entries),
                "prunable" in stale_list,
                evidence["symlink_deletion"]["outside_target_survived_safe_primitive"],  # type: ignore[index]
                evidence["symlink_deletion"]["resolved_link_target_destroyed_by_vulnerable_primitive"],  # type: ignore[index]
                evidence["removed_main_worktree_boundary"]["linked_directory_survived"],  # type: ignore[index]
                evidence["removed_main_worktree_boundary"]["linked_git_status_exit"] != 0,  # type: ignore[index]
                evidence["process_boundary"]["directory_removed_while_process_alive"],  # type: ignore[index]
            ]
        )
        args.output.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return 0
    finally:
        if sleeper is not None and sleeper.poll() is None:
            sleeper.terminate()
            try:
                sleeper.wait(timeout=2)
            except subprocess.TimeoutExpired:
                sleeper.kill()
                sleeper.wait()
        shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
