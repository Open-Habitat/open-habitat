#!/usr/bin/env python3
"""Convert PNG screenshots under issues/ or design-system/ to AVIF in place.

usage: screenshots-to-avif.py [--dry-run] [--json] [--quality Q]
                              [--converter auto|avifenc|imagemagick] PATH...

Each PATH is a PNG file or a directory, which is searched recursively for
*.png files (symlinks are neither followed nor converted). Every path must
resolve inside the repository's issues/ or design-system/ tree; one path
outside refuses the whole run before anything is converted. Only untracked
files may be converted: paths in HEAD or the index are refused, even when
explicitly named. Git inspection failures refuse the run.

Each PNG is encoded into a private temporary directory, the AVIF is decoded
back and its dimensions compared with the PNG's, and only then is the AVIF
written next to the source (never over an existing file) and that one
resolved source path removed. A failure leaves the PNG untouched.

The converter is avifenc/avifdec (libavif, as on Alder) when present, else
ImageMagick (`magick` or `convert` with an AVIF delegate, as on Birch).

Exit codes: 0 every file converted (or would be, with --dry-run); 1 at least
one file failed; 2 usage error or refused path; 3 no usable converter.
--json prints {"ok", "dry_run", "converter", "files": [{"source", "target",
"width", "height", "status", "error", "png_bytes", "avif_bytes"}]}.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = ("issues", "design-system")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
EXIT_FAILED, EXIT_USAGE, EXIT_NO_CONVERTER = 1, 2, 3


class Refused(Exception):
    pass


def png_size(path: Path) -> tuple[int, int]:
    with open(path, "rb") as f:
        head = f.read(24)
    if len(head) < 24 or head[:8] != PNG_SIGNATURE or head[12:16] != b"IHDR":
        raise ValueError(f"{path}: not a PNG")
    return struct.unpack(">II", head[16:24])


def allowed_roots() -> list[Path]:
    return [(ROOT / name).resolve() for name in ALLOWED]


def inside_allowed(path: Path) -> bool:
    return any(path == root or root in path.parents for root in allowed_roots())


def collect(args: list[str]) -> list[Path]:
    """Resolve the arguments to PNG files, refusing anything outside the trees."""
    found: list[Path] = []
    for arg in args:
        given = Path(arg)
        if given.is_symlink():
            raise Refused(f"{arg}: is a symlink")
        path = given.resolve()
        if not inside_allowed(path):
            raise Refused(f"{arg}: outside {' and '.join(a + '/' for a in ALLOWED)}")
        if path.is_dir():
            for dirpath, dirnames, filenames in os.walk(path):
                dirnames.sort()
                for name in sorted(filenames):
                    candidate = Path(dirpath) / name
                    if name.lower().endswith(".png") and not candidate.is_symlink():
                        found.append(candidate)
        elif path.is_file():
            if not path.name.lower().endswith(".png"):
                raise Refused(f"{arg}: not a .png file")
            found.append(path)
        else:
            raise Refused(f"{arg}: no such file or directory")
    unique: list[Path] = []
    for path in found:
        if path not in unique:
            unique.append(path)
    return unique


def protected_paths() -> set[Path]:
    """HEAD also protects originals whose deletion has already been staged."""
    try:
        env = os.environ.copy()
        local_vars = subprocess.run(['git', 'rev-parse', '--local-env-vars'],
                                    check=True, capture_output=True, text=True)
        for name in local_vars.stdout.splitlines():
            env.pop(name, None)
        result = subprocess.run(
            ['git', '-C', str(ROOT), 'ls-files', '--cached', '--with-tree=HEAD', '-z'],
            env=env, check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as err:
        raise Refused('cannot inspect Git HEAD and index; refusing conversion') from err
    return {ROOT / os.fsdecode(name) for name in result.stdout.split(b'\0') if name}


def imagemagick() -> str | None:
    for name in ("magick", "convert"):
        exe = shutil.which(name)
        if not exe:
            continue
        listing = subprocess.run([exe, "-list", "format"], capture_output=True, text=True)
        for line in listing.stdout.splitlines():
            fields = line.split()
            if fields and fields[0].rstrip("*") == "AVIF" and len(fields) > 1 and "w" in fields[1]:
                return exe
    return None


def pick_converter(choice: str) -> tuple[str, list[str]] | None:
    if choice in ("auto", "avifenc"):
        enc, dec = shutil.which("avifenc"), shutil.which("avifdec")
        if enc and dec:
            return "avifenc", [enc, dec]
        if choice == "avifenc":
            return None
    exe = imagemagick()
    return ("imagemagick", [exe]) if exe else None


def run(argv: list[str]) -> None:
    done = subprocess.run(argv, capture_output=True, text=True)
    if done.returncode != 0:
        detail = (done.stderr or done.stdout).strip().splitlines()
        raise RuntimeError(f"{Path(argv[0]).name} exited {done.returncode}: "
                           + (detail[-1] if detail else "no output"))


def encode_and_verify(converter: tuple[str, list[str]], source: Path, scratch: Path,
                      quality: int) -> Path:
    """Encode source into scratch, decode it back and return the verified AVIF."""
    avif, decoded = scratch / "out.avif", scratch / "decoded.png"
    kind, exes = converter
    if kind == "avifenc":
        run([exes[0], "-q", str(quality), "-s", "6", str(source), str(avif)])
        run([exes[1], str(avif), str(decoded)])
    else:
        run([exes[0], str(source), "-quality", str(quality), f"avif:{avif}"])
        run([exes[0], f"avif:{avif}", f"png:{decoded}"])
    if png_size(decoded) != png_size(source):
        raise RuntimeError(f"decoded AVIF is {png_size(decoded)}, PNG is {png_size(source)}")
    return avif


def convert_one(converter, source: Path, quality: int, dry_run: bool) -> dict:
    target = source.with_suffix(".avif")
    entry = {"source": str(source.relative_to(ROOT)), "target": str(target.relative_to(ROOT)),
             "width": None, "height": None, "status": "error", "error": None,
             "png_bytes": None, "avif_bytes": None}
    try:
        protected = protected_paths()
        if source in protected or target in protected:
            raise RuntimeError('source or target is tracked in Git HEAD or index; refusing conversion')
        entry["png_bytes"] = source.stat().st_size
        entry["width"], entry["height"] = png_size(source)
        if target.exists() or target.is_symlink():
            raise RuntimeError(f"{entry['target']} already exists")
        if dry_run:
            entry["status"] = "would_convert"
            return entry
        with tempfile.TemporaryDirectory(prefix="screenshots-to-avif.") as scratch:
            avif = encode_and_verify(converter, source, Path(scratch), quality)
            data = avif.read_bytes()
        # "xb" refuses to replace a file that appeared since the check above.
        with open(target, "xb") as out:
            out.write(data)
        if target.stat().st_size != len(data):
            raise RuntimeError(f"{entry['target']} was not written completely")
        if source in protected_paths():
            raise RuntimeError('source became tracked during conversion; keeping PNG')
        os.remove(source)
        entry["avif_bytes"] = len(data)
        entry["status"] = "converted"
    except (OSError, ValueError, RuntimeError, Refused) as err:
        entry["error"] = str(err)
    return entry


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert PNG screenshots under issues/ or design-system/ to AVIF "
                    "and remove each untracked PNG only after its AVIF is verified. "
                    "Files in Git HEAD or the index are refused, including explicit paths.")
    parser.add_argument("paths", nargs="+", metavar="PATH", help="PNG file or directory")
    parser.add_argument("--dry-run", action="store_true", help="list what would be converted")
    parser.add_argument("--json", action="store_true", help="print a JSON report")
    parser.add_argument("--quality", type=int, default=65, metavar="Q",
                        help="AVIF quality 0..100 (default 65)")
    parser.add_argument("--converter", choices=("auto", "avifenc", "imagemagick"), default="auto")
    args = parser.parse_args()
    if not 0 <= args.quality <= 100:
        parser.error("--quality must be within 0..100")

    def fail(code: int, message: str) -> int:
        if args.json:
            print(json.dumps({"ok": False, "error": message}))
        else:
            print(f"screenshots-to-avif: {message}", file=sys.stderr)
        return code

    try:
        sources = collect(args.paths)
        protected_paths()
    except Refused as err:
        return fail(EXIT_USAGE, f"refused: {err}")
    converter = pick_converter(args.converter)
    if converter is None:
        return fail(EXIT_NO_CONVERTER, "no AVIF converter: install libavif-bin (avifenc, avifdec) "
                                       "or ImageMagick with AVIF support")

    files = [convert_one(converter, s, args.quality, args.dry_run) for s in sources]
    ok = all(f["status"] != "error" for f in files)
    if args.json:
        print(json.dumps({"ok": ok, "dry_run": args.dry_run, "converter": converter[0],
                          "files": files}, indent=2))
    else:
        for f in files:
            if f["status"] == "error":
                print(f"error {f['source']}: {f['error']}", file=sys.stderr)
            elif f["status"] == "would_convert":
                print(f"would convert {f['source']} -> {f['target']}")
            else:
                print(f"converted {f['source']} -> {f['target']} "
                      f"({f['png_bytes']} -> {f['avif_bytes']} bytes)")
        if not files:
            print("no PNG files found")
    return 0 if ok else EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())
