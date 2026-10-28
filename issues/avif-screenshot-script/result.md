# Result

`scripts/screenshots-to-avif.py` converts PNG screenshots named by file or
directory (recursive, symlinks skipped) under `issues/` or `design-system/`.
Each PNG is encoded into a private temporary directory, decoded back and its
dimensions compared with the source; only then is the AVIF written next to the
PNG with exclusive create and that one resolved PNG removed with `os.remove`.
`--dry-run`, `--json`, `--quality` (default 65) and `--converter`. Exit codes
0 / 1 file failed / 2 refused path / 3 no converter. Named in
`design-system/prototypes/AGENTS.md` and `scripts/AGENTS.md`; the test
`scripts/test-screenshots-to-avif.py` runs in `ci-local.sh`.

Converter: Birch has ImageMagick 6.9.12 with an AVIF (libheif) write
delegate but no avifenc; Alder has avifenc/avifdec 1.3.0 but no ImageMagick.
The script prefers avifenc/avifdec and falls back to `magick`/`convert` only
when its `-list format` shows AVIF as writable. The unit tests pass on both
(Birch: ImageMagick, Alder: avifenc). A real 2880×1800 evidence screenshot
went 161 KB → 62 KB with text still sharp.

## Decisions for later review

- **Quality 65 by default.** Alternatives: lossless (large) or ~50 (smaller,
  fuzzier UI text). 65 kept small UI text legible in the check above.
- **One refused path refuses the whole run** before anything converts, rather
  than skipping it, so a typo never yields a half-done batch.
- **An existing `.avif` is never overwritten**; that PNG is reported as an
  error and kept. Alternative was `--force`; not needed until someone asks.
- **Did not convert the PNGs already committed under `issues/`** (e.g.
  `archive-notice-header-row/evidence`): they belong to other issues.
- The `issuectl doctor` advisory is also described in `.pi/agent/skills/issue*`
  and `.codex/prompts/`; those are copies of the shared issuectl skills, so
  they were left unchanged.
