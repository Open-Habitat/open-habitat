---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: open
priority: high
lane: pi-lifecycle
lane_seq: 1
collision: [internal/daemon/pi-lifecycle]
preparation: ready
---

# Idle Pi processes fill the conversation limit and block workspace deletion

Jari on the test server (pilot.231), 2026-10-19, several symptoms with one cause:

- Workspace `issuectl`: **Uusi worktree-agentti**, first message "Moi" → "Keskustelua ei luotu: Liian monta käynnissä olevaa keskustelua — sulje tai pysäytä jokin", although nothing was working.
- Cloned `tailspin-monorepo`, **Avaa työtila** → the new conversation fails with the same "Liian monta käynnissä olevaa keskustelua".
- Trying to move `issuectl` to the trash: "Työtilaa issuectl ei voi poistaa nyt" lists four times "Pi työskentelee tämän työtilan keskustelussa. Odota, että vuoro päättyy, tai pysäytä se keskustelusta." None was working; they were stopped/finished conversations. After he archived those conversations the deletion went through. Jari: "sellaiset agentit, jotka ovat keskeneräisiä tai ei ole mitään kesken, kun siellä ei odota mitään eikä tapahdu mitään, niin nää voi vain arkistoida siitä suoraan." (Idle agents with nothing pending should not block; they can just be archived/stopped directly.)

Conductor's observation on the VM at about 08:00 UTC, after he had archived them: user `maintainer` still had four `pi` processes (PIDs 747736, 750059, 750245, 751494), all with cwd `/home/maintainer/src/issuectl`, parent the daemon, alive 57–70 min, 3–11 s CPU each: idle Pi processes of finished turns that the daemon keeps alive. They fill the per-user limit of four running conversations and the deletion check reports them as "Pi työskentelee".

Expected: the limit counts only conversations that are actually doing something (a turn in progress, queued input, a live process the person started), or the daemon stops idle Pi processes when it needs the slot; archiving a conversation stops its idle Pi; the deletion check stops idle Pi processes of the workspace itself (or offers it in one click) and only blocks on a turn in progress, naming the conversation. Pi's native history is unaffected (the next message resumes, as lazy resume already does). Find where the daemon decides "running" for the limit, for the deletion check and for the "working" label, and make them agree on one definition.
