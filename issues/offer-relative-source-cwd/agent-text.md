# Agent text changed by offer-relative-source-cwd — for Jari's proofreading

The shipped agent skill (`internal/cli/agent/SKILL.md`) and `--help` described
a relative `--source` as relative to the conversation's workspace. They now
say it is relative to the current working directory. Changed texts:

## `internal/cli/agent/SKILL.md` (views section, applies to file offers too)

Before:

> For both view and file offers, `--source` accepts an absolute path inside or
> outside the workspace (for example `/var/tmp/report.html`), or a path relative
> to the conversation's workspace (for example `site/index.html`). The source
> must be readable as the person; symlinks in the path are refused.

After:

> For both view and file offers, `--source` is an absolute path inside or
> outside the workspace (for example `/var/tmp/report.html`), or a path relative
> to your current working directory, as in any shell command (for example
> `site/index.html`). The source must be readable as the person; symlinks in the
> path are refused.

## `--help` flag descriptions (`internal/cli/help.go`)

- `--workspace` (view/file offer): "Own conversation workspace ws_ ID; base for
  relative --source paths; …" → "Own conversation workspace ws_ ID the offer
  belongs to; defaults to the launch context's workspace with --current"
- `--source` (view and file offer), opening clause: "Absolute path inside or
  outside the workspace, or workspace-relative path, readable as the person; …"
  → "Absolute path, or path relative to the current working directory as in
  any shell command, readable as the person; …"

## CLI error messages (new)

- `file_source_not_found` / `view_source_not_found` before the daemon: "no file
  or directory at ABSOLUTE-PATH; a relative --source is resolved against the
  current working directory"
- the same codes from the daemon: "no file or directory found among: PATH, PATH"
- `unsafe_file_source` / `unsafe_view_source`: "--source passes through the
  symlink PATH before ".."; symlinks in the path are refused; pass the real path"
- usage: "--source requires a file or directory path, absolute or relative to
  the current working directory (at most 1024 bytes)"
