---
created: 2026-10-19
updated: 2026-10-20
type: task
reporter: jari
status: done
priority: normal
preparation: pending
closed: 2026-10-20
---

# Research: browser shell and file editing (web VS Code) for each person

Jari, 2026-10-19: "Voisitko tutkia, että miten voimme integroida käyttäjille tähän: ihan tavallisen bash-shellin? jonkinlaisen tavan päästä katsomaan / muokkaamaan tiedostoja. Kenties jokin verkkosivupohjainen VS Code? Näistä siis ihan yleisiä ajatuksia, että miten voisi toteuttaa."

Research how Open Habitat could give a signed-in person (1) an ordinary shell in the browser and (2) a way to view and edit their files, ideally a web-based VS Code, within the architecture: the Unix user is the security boundary, the per-user daemon runs as the person, the gateway only authenticates and proxies, mature native components are reused, and the browser is another way to reach the same native sessions (SSH/tmux keep working alongside). `docs/product.md` currently lists wider editor and tool views as out of scope "for now, decided separately"; this research feeds that decision. Output: `issues/research-shell-editor/report.md`.

## Jari's direction (2026-10-19)

"Käyttäjällä ei ole lähtökohtaisesti tällä serverillä mitään muuta tapaa käsitellä agentteja. Eli jos tämän puitteissa ei ole tmux-sessiota, niin sitten sellaista ei ole, mutta jos on, niin sitä voi tietysti käyttää. Shell selaimessa kuulostaa ihan perusjärkevältä; tästä varmaan prototyyppaus, miltä se näyttää." — The browser is the person's only route to the server by default (no SSH assumed); the shell attaches to an existing tmux session when there is one, otherwise it is a plain shell. Files: "Tiedostoista varmaan nyt seuraavaksi prototyyppaus. Tässä varmaan koko repon avaaminen, mutta meillä pitäisi kanssa tunnistaa viesteistä tiedostolinkkejä ja niistä klikattavia." Prototype rounds: `proto-browser-shell`, `proto-file-viewing`.

## Jari's decisions (2026-10-19, later)

"Tämä paneeli on kyllä tässä hyvä. Tehdään niin, että se on tämä paneeli ja arkkitehtuuripäätökset suositusten mukaan." Accepted, as recommended in `report.md` §"Decisions this needs from Jari": (1) the gateway gains a WebSocket relay and a second editor host with editor-scoped sessions; (2) the broker enables lingering when it creates an account (one decision for shells, editors and Taskfleet spinoffs); (3) the daemon starts and stops long-lived interactive services (tmux server, code-server) as the person and relays to their sockets, storing nothing; (4) Taskfleet's tmux sessions are attachable read-only only; (5) always tmux, created if missing; (6) no shell-specific re-authentication. Shell placement: direction **Paneeli** of `proto-browser-shell`. Implementation: `implement-browser-shell`, `broker-enable-linger`. Files: Jari prefers the **Editori** direction but the editor lacks room in the round; a second round `proto-file-viewing-2` rethinks its space before implementation.
