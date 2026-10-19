---
created: 2026-10-19
updated: 2026-10-19
type: task
reporter: jari
status: open
priority: normal
preparation: ready
---

# Research: browser shell and file editing (web VS Code) for each person

Jari, 2026-10-19: "Voisitko tutkia, että miten voimme integroida käyttäjille tähän: ihan tavallisen bash-shellin? jonkinlaisen tavan päästä katsomaan / muokkaamaan tiedostoja. Kenties jokin verkkosivupohjainen VS Code? Näistä siis ihan yleisiä ajatuksia, että miten voisi toteuttaa."

Research how Open Habitat could give a signed-in person (1) an ordinary shell in the browser and (2) a way to view and edit their files, ideally a web-based VS Code, within the architecture: the Unix user is the security boundary, the per-user daemon runs as the person, the gateway only authenticates and proxies, mature native components are reused, and the browser is another way to reach the same native sessions (SSH/tmux keep working alongside). `docs/product.md` currently lists wider editor and tool views as out of scope "for now, decided separately"; this research feeds that decision. Output: `issues/research-shell-editor/report.md`.

## Jari's direction (2026-10-19)

"Käyttäjällä ei ole lähtökohtaisesti tällä serverillä mitään muuta tapaa käsitellä agentteja. Eli jos tämän puitteissa ei ole tmux-sessiota, niin sitten sellaista ei ole, mutta jos on, niin sitä voi tietysti käyttää. Shell selaimessa kuulostaa ihan perusjärkevältä; tästä varmaan prototyyppaus, miltä se näyttää." — The browser is the person's only route to the server by default (no SSH assumed); the shell attaches to an existing tmux session when there is one, otherwise it is a plain shell. Files: "Tiedostoista varmaan nyt seuraavaksi prototyyppaus. Tässä varmaan koko repon avaaminen, mutta meillä pitäisi kanssa tunnistaa viesteistä tiedostolinkkejä ja niistä klikattavia." Prototype rounds: `proto-browser-shell`, `proto-file-viewing`.
