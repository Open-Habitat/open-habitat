#!/usr/bin/env python3
"""Record a secret-free, read-only GitHub authorization boundary probe."""

from __future__ import annotations

import argparse
import getpass
import json
import platform
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse


def github_remote_identity(url: str) -> dict[str, str] | None:
    """Return only non-secret GitHub host/repository/protocol fields."""
    scp = re.fullmatch(r"(?:[^@]+@)?([^:]+):/?(.+)", url)
    if scp and "://" not in url:
        host, path, protocol = scp.group(1), scp.group(2), "ssh"
    else:
        parsed = urlparse(url)
        host, path = parsed.hostname or "", parsed.path.lstrip("/")
        protocol = parsed.scheme
    if host.lower() != "github.com" or not path:
        return None
    repository = path.removesuffix(".git").strip("/")
    if repository.count("/") != 1:
        return None
    return {"host": "github.com", "repository": repository, "protocol": protocol}


def run(*argv: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, text=True, capture_output=True, check=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True, help="Exact OWNER/REPO to inspect")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    api_user = run("gh", "api", "user", "--jq", "{login:.login,id:.id}")
    repo = run(
        "gh", "repo", "view", args.repository,
        "--json", "nameWithOwner,viewerPermission,isPrivate",
    )
    ssh = run("ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-T", "git@github.com")
    remote_url_result = run("git", "remote", "get-url", args.remote)
    remote_identity = (
        github_remote_identity(remote_url_result.stdout.strip())
        if remote_url_result.returncode == 0
        else None
    )
    remote_identity_matches = bool(
        remote_identity
        and remote_identity["repository"].casefold() == args.repository.casefold()
    )
    remote = run("git", "ls-remote", "--exit-code", args.remote, "HEAD")
    gh_version = run("gh", "--version")

    # Keep a negative assertion in the executable fixture: an unrelated remote
    # must never satisfy the selected-repository binding.
    unrelated = github_remote_identity("git@github.com:example/unrelated.git")
    assert unrelated and unrelated["repository"].casefold() != args.repository.casefold()

    ssh_text = (ssh.stdout + ssh.stderr).strip()
    account_match = re.search(r"Hi ([^!]+)! You've successfully authenticated", ssh_text)
    remote_head = remote.stdout.split()[0] if remote.returncode == 0 and remote.stdout.split() else None
    evidence = {
        "schema_version": 1,
        "safety": "read-only API and transport checks; no token values requested or stored",
        "host": platform.node().split(".")[0],
        "unix_user": getpass.getuser(),
        "gh_version": gh_version.stdout.splitlines()[0] if gh_version.returncode == 0 else None,
        "repository_input": args.repository,
        "api_user": json.loads(api_user.stdout) if api_user.returncode == 0 else None,
        "api_user_exit": api_user.returncode,
        "repository": json.loads(repo.stdout) if repo.returncode == 0 else None,
        "repository_view_exit": repo.returncode,
        "ssh": {
            "authenticated_account": account_match.group(1) if account_match else None,
            "reported_authenticated": account_match is not None,
            "exit": ssh.returncode,
            "expected_github_no_shell_exit": 1,
        },
        "remote_read": {
            "remote_name": args.remote,
            "sanitized_identity": remote_identity,
            "identity_matches_repository_input": remote_identity_matches,
            "head_oid": remote_head,
            "exit": remote.returncode,
        },
    }
    evidence["boundary_checks_passed"] = all(
        [
            api_user.returncode == 0,
            repo.returncode == 0,
            account_match is not None and ssh.returncode == 1,
            remote_url_result.returncode == 0 and remote_identity_matches,
            remote.returncode == 0 and remote_head is not None,
        ]
    )
    args.output.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if evidence["boundary_checks_passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
