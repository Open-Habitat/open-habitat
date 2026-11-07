---
created: 2026-11-07
updated: 2026-11-07
type: task
reporter: jari
status: done
priority: normal
preparation: pending
lane: own-dialog-proto
lane_seq: 1
closed: 2026-11-07
---

# Prototype: Habitat's own dialog for unsaved changes instead of the browser's confirm

## Description

Jari 7.11.2026 (testikone, kuvakaappaus): editorista poistuttaessa selaimen oma
dialogi *open-habitat-test.example.test says · Discard unsaved changes? Cancel
and save first if you want to keep them. · Cancel / OK* on häiritsevä ja
hankala. Tilalle Open Habitatin oma dialogi. Prototyyppikierros
(`AGENTS-WORKFLOW.md`), yksi näkymä: tallentamattomat muutokset poistuttaessa
(nykyinen `window.confirm` kohdassa `web/src/app/BrowserDocument.tsx`
`discardQuestion`), ja sama malli muille selaimen dialogeille
(`web/src/app/WorkspaceEditor.tsx` `switchToPhoneEditor`). Suunnat esim.
*Tallenna ja poistu* / *Hylkää* / *Jatka muokkausta*, tai tallennus
automaattisesti ilman kysymystä. Sivun sulkemisen `beforeunload`-varoitus on
selaimen oma eikä sitä voi korvata; prototyyppi kertoo, missä se jää.

## Acceptance Criteria

- [x] kierros 1: nykytila, kolme suuntaa, näkymätarjous ja kysymykset Jarille

## Decision (Jari 2026-11-07, kierros 1)

**C Ei kysy** (suosituksen mukaan): poistuminen tallentaa, ilmoituksessa
*Kumoa*, ja vain epäonnistunut tallennus kysyy A:n ikkunalla. Kysymykset 2
(Kumoan merkitys / oma *Hylkää muutokset*) ja 3 (VS Coden vaihto puhelimen
editoriin) olivat Jarille epäselviä; ne selitettiin keskustelussa uudelleen
suosituksineen ja odottavat vastausta.

## Decision (Jari 2026-11-07, kysymykset 2 ja 3)

2. *Kumoa* on oikea undo: se palauttaa tiedoston ennalleen ja hylkää muutoksen
   kokonaan (ei jätä sitä editoriin tallentamattomana). Erillistä *Hylkää
   muutokset* -painiketta ei tarvita.
3. VS Coden vaihtuessa puhelimen editoriin (ikkuna alle 800 px): Habitat ei
   tallenna VS Coden puolesta. Selaimen dialogin tilalle Habitatin oma rivi,
   joka pyytää tallentamaan VS Codessa ensin; VS Code pysyy auki, kunnes
   henkilö painaa vaihtoa.

Seuraavaksi toteutus kokeellisena tai korjauksena (nykyinen selaimen dialogi on
vika); toteutusissue tehdään seuraavassa sessiossa.
