---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: open
priority: normal
lane: offer-cards-proto
lane_seq: 1
preparation: ready
---

# Prototype: one consistent card and opening place for views, files and folders

## Description

Jari 8.11.2026, test server (`evidence/jari-2026-11-08-cards.avif`): the cards an
agent offers in a conversation look and behave differently by content type,
and they open in different places, which he finds disturbing. He wants them
consistent.

Today (`web/src/components/FileOffer.tsx`, the view offer card, catalogs
`web/src/text/viewOffer.ts`, `fileOffer.ts`, `viewPanel.ts`):

- **View**: icon, title, *Julkinen* switch on the right; *Avaa* (opens beside
  the conversation) and *Avaa omalle välilehdelle*. No kind line, no size, no
  "agent offers" lead.
- **File (CSV)**: "Agentti tarjoaa ladattavaksi:" lead, title in monospace,
  kind/size/visibility line (*CSV-taulukko · 2 riviä · 2 saraketta · 18 t ·
  Vain sinulle*); *Lataa* primary, *Näytä taulukko*.
- **Folder**: same lead, title plus path chip, *2 tiedostoa · 38 t · Vain
  sinulle*; *Lataa kaikki (.zip)*, *Näytä tiedostot*.

Differences to resolve: lead line present or not, title typography, where
visibility is shown and changed (switch vs text), which action is primary
(open vs download), and where "show" opens (side panel, view panel, file
panel, new tab).

Prototype round (`AGENTS-WORKFLOW.md`), one view: the three cards today, then
three directions for one card shape and one opening place shared by views,
files, tables, images, documents and folders (for example: every card opens
in the same side panel with download and share inside it; every card is a
compact row whose primary action is always *Avaa*; a common header line with
kind/size/visibility and the same two actions everywhere). Coordinate with
`proto-conversation-assets` (round 1 awaiting Jari: a list of the
conversation's views and files, recommended in the side panel): the opening
place should be the same one that list uses. 1440 and 390, light and dark.

## Acceptance Criteria

- [x] round 1: today, three directions, view offer and questions for Jari
- [ ] round 2: riffs on Kortti (beside vs popup, own tab, making public), view offer and questions for Jari

## Decision (Jari 2026-11-08, kierros 1)

**1 Kortti** on paras. Riffataan sitä (kierros 2):

- avautuuko kohde viereen (oikea paneeli) vai ponnahdusikkunaksi keskustelun
  päälle;
- miten kohteen saa auki omaan välilehteen;
- miten kohteen voi asettaa julkiseksi: Jari ehdottaa samaa tapaa kuin
  HTML-näkymissä nyt (*Julkinen*-kytkin ja jaettava osoite), kaikille lajeille.
