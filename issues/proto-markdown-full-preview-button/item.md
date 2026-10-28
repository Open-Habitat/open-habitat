---
created: 2026-10-28
updated: 2026-10-28
type: task
reporter: jari
status: open
priority: normal
lane: proto-markdown-preview
lane_seq: 1
preparation: ready
provenance: chat
source_ref: kokeiltavaa:2026-10-28/proto-markdown-full-preview-button
---

# Prototype: faster shortcut and own button for the full-view Markdown preview

Markdownin koko näkymän esikatselulle parempi pikanäppäin ja oma painike, painike prototyypattava (Jari 28.10., pilot.447, tuotepäätös): Cmd+Shift+V avaa esikatselun koko näkymään editorin tekstin tilalle, ja juuri tätä Jari haluaa. Lukunäkymä saa olla muokkaamaton. Cmd+K V -yhdistelmä on Jarin mukaan liian hidas, ja hän haluaa nopeamman pikanäppäimen. Koko näkymän esikatselulle tarvitaan myös oma painike, joka prototyypataan ennen toteutusta. Koodi: `web/src/components/CodeMirrorEditor.tsx` (`editor-markdown-preview-folding`).

## Prototyyppi

Kierros 28.10. odottaa Jarin valintaa (preparation `pending`): [result.md](result.md), opas [prototypes/markdown-preview/NOTES.md](prototypes/markdown-preview/NOTES.md).

## Decisions

### 2026-10-28T11:29:01Z · @jari

Jari 2026-10-28: suunta Painike. Painikerivi, mieluiten ikonipainikkeina. Rinnakkain-muotoa ei tarvita. Sama esikatselu myös CSV:lle ja muille tiedostomuodoille, joissa se on mielekäs. Riffikierros 2 tältä pohjalta.
