#!/usr/bin/env bash
# Build and verify a release; the caller supplies source and gate requirements.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
export TMPDIR=${TMPDIR:-/var/tmp}
version= output= gate= target= remote= branch= runtime_cache=
while (($#)); do
  case "$1" in
    --version|--output|--target|--gate|--remote|--branch|--runtime-cache)
      (($# >= 2)) || { echo "error: missing value for $1" >&2; exit 1; }
      case "$1" in --version) version=$2;; --output) output=$2;; --target) target=$2;; --gate) gate=$2;; --remote) remote=$2;; --branch) branch=$2;; --runtime-cache) runtime_cache=$2; [[ $runtime_cache == /* ]] || { echo 'error: --runtime-cache requires an absolute disposable directory' >&2; exit 1; };; esac
      shift 2;;
    *) echo "error: unknown argument $1" >&2; exit 1;;
  esac
done
[[ -n $version && -n $output && -n $target && -n $remote && -n $branch ]] || { echo 'error: --version, --output, --target, --remote and --branch required' >&2; exit 1; }
[[ $gate == clean-gate || $gate == ungated ]] || { echo 'error: --gate must be clean-gate or ungated' >&2; exit 1; }
[[ $remote != -* && $branch != -* ]] || { echo 'error: invalid remote or branch' >&2; exit 1; }
cd "$repo"
[[ -z $(git status --porcelain --untracked-files=all) ]] || { echo 'error: checkout is not clean' >&2; exit 1; }
git fetch "$remote" "$branch" >&2
git merge-base --is-ancestor HEAD FETCH_HEAD || { echo 'error: source is not pushed to the supplied remote branch' >&2; exit 1; }
if [[ $gate == clean-gate ]]; then
  python3 scripts/gate-receipt.py check >&2
fi
source_commit=$(git rev-parse HEAD)
source_tree=$(git rev-parse 'HEAD^{tree}')
# Ignored node_modules from another checkout/revision is not covered by the gate.
# Install from the committed lockfile before building fresh production assets.
npm ci --prefix web --no-audit --no-fund >&2
npm run build --prefix web >&2
[[ $(git rev-parse HEAD) == "$source_commit" ]] || { echo 'error: source moved during build' >&2; exit 1; }
if [[ $gate == ungated ]]; then
  [[ -z $(git status --porcelain --untracked-files=all) ]] || { echo 'error: checkout changed during build' >&2; exit 1; }
else
  python3 scripts/gate-receipt.py check >&2
fi
archive=$(./scripts/package-release.sh --version "$version" --target "$target" --web-dir web/dist --output "$output")
./scripts/verify-release.sh --archive "$archive" --json >&2
# The binary identity must name precisely the source the release operator approved.
name=$(basename "$archive" .tar.gz)
# Extract only the verified binary to private staging.
stage=$(mktemp -d); trap 'rm -rf "$stage"' EXIT
tar -xzf "$archive" -C "$stage" "$name/bin/open-habitat"
# A binary for another architecture cannot run here, and -trimpath keeps Go
# from recording its link flags. The approved commit and version must then
# appear literally in the binary this build just produced.
case $(uname -m) in x86_64) host=linux-amd64;; aarch64) host=linux-arm64;; *) host=;; esac
if [[ $target == "$host" ]]; then
  embedded=$("$stage/$name/bin/open-habitat" --json version)
else
  embedded=$(python3 - "$stage/$name/bin/open-habitat" "$source_commit" "$version" <<'PY'
import json, sys
b = open(sys.argv[1], 'rb').read()
found = {k: v if v.encode() in b else None for k, v in (('commit', sys.argv[2]), ('version', sys.argv[3]))}
print(json.dumps({'data': found}))
PY
)
fi
python3 - "$source_commit" "$version" "$embedded" <<'PY'
import json, sys
source, version, raw = sys.argv[1:]
data = json.loads(raw)['data']
if data.get('commit') != source or data.get('version') != version:
    sys.exit('error: packaged binary source or version differs from approved checkout')
PY
if [[ -n $runtime_cache ]]; then
  # A native verifier also permits validating a transferred foreign-arch cache.
  # Never install this helper into the machine's PATH or global Go bin directory.
  CGO_ENABLED=0 GOOS=linux GOARCH=$(go env GOHOSTARCH) go build -trimpath -o "$stage/runtime-release" ./cmd/runtime-release
  python3 scripts/prepare-release-closure.py "$repo" "$runtime_cache" "$(realpath "$output")/runtime" \
    "$stage/runtime-release" "$target" "$version" "$source_commit"
fi
if [[ $gate == ungated ]]; then
  [[ -z $(git status --porcelain --untracked-files=all) ]] || { echo 'error: checkout changed during package verification' >&2; exit 1; }
  gate=ungated
else
  python3 scripts/gate-receipt.py check >&2
  gate=clean-gate
fi
[[ $(git rev-parse HEAD) == "$source_commit" && $(git rev-parse 'HEAD^{tree}') == "$source_tree" ]] || { echo 'error: source moved during preparation' >&2; exit 1; }
# Operator-facing provenance, separate from the verified archive and not fed back into it.
python3 - "$output/release-gate.json" "$gate" "$source_commit" "$source_tree" <<'PY'
import json, sys
path, gate, commit, tree = sys.argv[1:]
with open(path, 'x') as out:
    json.dump({'gate': gate, 'source_commit': commit, 'tree': tree}, out, sort_keys=True)
    out.write('\n')
PY
printf '%s\n' "$archive"
