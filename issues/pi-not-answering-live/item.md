---
created: 2026-10-15
updated: 2026-10-15
type: bug
reporter: jari
status: fixed
priority: high
lane: reauth
lane_seq: 10
collision: [internal/daemon, web/src/app/]
preparation: ready
related: ['@conversation-stuck-reauth', '@pi-model-selector']
closed: 2026-10-15
---

# Pi still does not answer on the test server

Jari, 2026-10-15 19:58 local (16:58 UTC), on the test server
(`jari-2026-10-15-1658utc.png`): "Ei edelleenkään toimi. Musta mä raportoin
jo, että pi ei siellä toimi ja tämä piti jotenkin selvittää." The view shows
"Yhteys katkesi. Näytetään viimeisin tunnettu tila.", the composer in steer
mode ("Ohjaa tai lähetä jonoon…") with "Odota vahvistettua joutotilaa;
epävarmaa viestiä ei lähetetä uudelleen." and the Stop button: the browser
believes a turn is running and the connection is lost.

Earlier the same morning Pi failed because the default model
`openai-codex/gpt-5.5` was not available on his ChatGPT account
(`conversation-stuck-reauth`); `pi-model-selector` then added model choice in
the browser. Jari has not had one working Pi conversation on the test server
since.

Things that happened near 16:58 UTC and must be ruled in or out: the
continuous test watcher installed pilot.90 (16:40) and pilot.91 (16:46), each
switch restarting the product services; and the `implement-user-storage-quotas`
live proof briefly set Jari's mapped account to a 1 MiB quota between roughly
16:40 and 16:58 (its `result.md` says it was restored and read back).

## Acceptance Criteria

- [x] The actual cause is found from primary evidence on the guest (daemon and
      gateway journal, Pi's native session files and stop reasons, quota state),
      not inferred; recorded in `result.md` without secrets or conversation text.
- [x] Fixed in product or Fleetrepo so that a new conversation on the test
      server gets an answer from Pi, shown by the strongest evidence available
      without a synthetic sign-in.
- [x] If a service restart leaves the browser believing a turn is still
      running, that is fixed too: after reconnect the view reflects the native
      state and the person can send.
- [x] `KOKEILTAVAA.md` tells Jari exactly what to try.
