#!/bin/sh
# Ajaa yhden kapellimestariroolin kierroksia peräkkäin määräaikaan asti.
# Käyttö: issues/night-2026-09-30/run-night.sh ui|rest [HH:MM huomenna, oletus 07:00]
# Jokainen kierros on uusi claude-sessio: /stint-start lukee TODO.md:n ja
# tämän hakemiston, ajaa kierroksen ja päättää sen /stint-handoffiin.
set -eu
role=${1:?ui|rest}
stop=${2:-07:00}
repo=$(cd "$(dirname "$0")/../.." && pwd)
cd "$repo"
deadline=$(date -d "tomorrow $stop" +%s)
log="$repo/issues/night-2026-09-30/run-night-$role.log"
round=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  round=$((round + 1))
  printf '\n=== %s round %d %s ===\n' "$role" "$round" "$(date -Is)" >>"$log"
  claude -p --permission-mode bypassPermissions \
    "/stint-start night:$role — this is night round $round of the plan in issues/night-2026-09-30/plan.md. Read plan.md, TODO.md and both status files first. Run one full round. When the round's report is written and every owned run has settled, run /stint-handoff in this same session, writing your round entry to issues/night-2026-09-30/$role-status.md and committing it. Do not wait for user feedback: there is no user tonight." \
    >>"$log" 2>&1 || printf 'round %d exited %s\n' "$round" "$?" >>"$log"
  sleep 60
done
printf '\n=== %s finished at %s after %d rounds ===\n' "$role" "$(date -Is)" "$round" >>"$log"
