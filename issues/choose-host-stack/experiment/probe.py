#!/usr/bin/env python3
"""Build and exercise the disposable Unix-socket peer-credential probe."""

import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile

HERE = Path(__file__).resolve().parent
TARGET = Path(tempfile.gettempdir()) / "native-agent-host-stack-probe-target"


def run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, text=True, check=True, **kwargs)


def exchange(binary: Path, allowed_uid: int, expected_status: str) -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="host-stack-uds-") as root:
        sock = Path(root) / "daemon.sock"
        process = subprocess.Popen(
            [str(binary), str(sock), str(allowed_uid)],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        try:
            assert process.stdout is not None
            ready = process.stdout.readline().strip()
            if ready != f"READY {sock}":
                raise RuntimeError(f"unexpected readiness line: {ready!r}")
            mode = sock.stat().st_mode & 0o777
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
                client.connect(str(sock))
                client.sendall(b"GET /healthz HTTP/1.1\r\nHost: local\r\n\r\n")
                chunks = []
                while chunk := client.recv(4096):
                    chunks.append(chunk)
            response = b"".join(chunks).decode("utf-8")
            if not response.startswith(f"HTTP/1.1 {expected_status}\r\n"):
                raise RuntimeError(f"unexpected response: {response!r}")
            return {"allowed_uid": allowed_uid, "socket_mode": oct(mode), "status": expected_status}
        finally:
            stdout, stderr = process.communicate(timeout=10)
            if process.returncode != 0:
                raise RuntimeError(f"probe server failed: stdout={stdout!r} stderr={stderr!r}")


def main() -> None:
    env = os.environ.copy()
    env["CARGO_TARGET_DIR"] = str(TARGET)
    run(["cargo", "build", "--locked", "--release", "--manifest-path", str(HERE / "Cargo.toml")], env=env)
    gnu_binary = TARGET / "release" / "host-stack-uds-probe"
    current_uid = os.getuid()
    cases = [
        exchange(gnu_binary, current_uid, "200 OK"),
        exchange(gnu_binary, current_uid + 1, "403 Forbidden"),
    ]

    run(
        [
            "cargo",
            "build",
            "--locked",
            "--release",
            "--target",
            "x86_64-unknown-linux-musl",
            "--manifest-path",
            str(HERE / "Cargo.toml"),
        ],
        env=env,
    )
    musl_binary = TARGET / "x86_64-unknown-linux-musl" / "release" / "host-stack-uds-probe"
    file_output = run(["file", str(musl_binary)], capture_output=True).stdout.strip()
    ldd = subprocess.run(["ldd", str(musl_binary)], text=True, capture_output=True)
    if "statically linked" not in file_output and "static-pie linked" not in file_output:
        raise RuntimeError(f"musl artifact is not reported static: {file_output}")

    result = {
        "schema_version": 1,
        "rustc": run(["rustc", "--version"], capture_output=True).stdout.strip(),
        "cargo": run(["cargo", "--version"], capture_output=True).stdout.strip(),
        "target": "x86_64-unknown-linux-musl",
        "cases": cases,
        "artifact": {
            "file": file_output.replace(str(TARGET), "<TEMP_TARGET>"),
            "bytes": musl_binary.stat().st_size,
            "ldd_exit": ldd.returncode,
            "ldd_output": (ldd.stdout + ldd.stderr).strip().replace(str(TARGET), "<TEMP_TARGET>"),
        },
        "limits": [
            "Both runtime cases use the current Unix user; the deny case changes the configured expected UID.",
            "The probe demonstrates Linux SO_PEERCRED and a static Rust artifact, not Axum, OIDC, systemd socket ownership, or two-user isolation.",
        ],
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    shutil.rmtree(TARGET, ignore_errors=True)


if __name__ == "__main__":
    main()
