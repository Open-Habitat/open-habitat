#!/usr/bin/env bash
set -euo pipefail
verb=${1:-};shift||true
output=
while (($#));do case "$1" in --output)output=$2;shift 2;;*)echo "error: unknown argument $1" >&2;exit 1;;esac;done
[[ $verb == create ]]||{ echo 'error: expected create --output PATH' >&2;exit 1;}
[[ -n $output && $output != / && $output != "$HOME" ]]||{ echo 'error: --output must be a safe explicit path' >&2;exit 1;}
[[ ! -e $output ]]||{ echo "error: output already exists: $output" >&2;exit 1;}
mkdir -p "$output/src/non-git" "$output/home/.pi/agent/sessions";printf 'synthetic\n'>"$output/src/non-git/NOTICE"
git init -q "$output/src/repository";git -C "$output/src/repository" config user.name 'Fixture User';git -C "$output/src/repository" config user.email fixture@invalid;echo fixture>"$output/src/repository/file.txt";git -C "$output/src/repository" add .;git -C "$output/src/repository" commit -qm fixture
git -C "$output/src/repository" worktree add -q -b fixture-linked "$output/linked-manual"
python3 - "$output" <<'PY'
import json,sys
from pathlib import Path
root=Path(sys.argv[1]); events=root/'home/.pi/agent/sessions/fixture.jsonl'
with events.open('w') as f:
 for i in range(2500):
  kind='message' if i%3 else 'tool_result'
  row={'type':kind,'native_key':f'fixture:{i:04d}','text':('x'*8192 if i==2497 else f'synthetic event {i}')}
  if i==2498: row={'type':'edit','native_key':f'fixture:{i:04d}','patch':'--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new'}
  if i==2499: row={'type':'extension_question','native_key':f'fixture:{i:04d}','request_id':'fixture-question','prompt':'Continue?'}
  f.write(json.dumps(row,separators=(',',':'))+'\n')
(root/'home/.pi/agent/sessions/malformed.jsonl').write_text('{not-json}\n')
(root/'fixture-manifest.json').write_text(json.dumps({'schema_version':1,'synthetic':True,'identities':['agent-a','agent-b'],'taskfleet_worktree':'not-created-foundation-does-not-claim-taskfleet-lifecycle'},indent=2)+'\n')
PY
printf '{"schema_version":1,"data":{"status":"created","output":"%s","real_user_history_accessed":false},"warnings":[]}\n' "$output"
