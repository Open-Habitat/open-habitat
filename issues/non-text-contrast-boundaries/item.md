---
created: 2026-11-13
updated: 2026-11-13
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:brand-round-2026-11-13/contrast
lane: brand
lane_seq: 1
collision: [design-system/]
preparation: ready
---

# Control and state-box boundaries below 3:1; a button's border is never drawn

## Description

## Description

While the new themes (`brand-themes-and-state-mark`) were tried in the real interface, the boundaries of
controls and state boxes were measured from the rendered DOM against the background they sit on. Fifty
component/state/theme combinations had no border or fill reaching 3:1 (WCAG 1.4.11); most of them are
just as low on main today, so this is not specific to the new colours.

Jari's observation that started it: a red box that does not stand out from the dark background. It is
the `danger-subtle` button, see the first item.

### Findings (light / dark / contrast)

1. **A button's `--i-border` is never drawn.** `web/src/components/Controls.module.css:10`
   `.button { border: 1px solid transparent }` overrides `interactive.module.css:4`
   `border-color: var(--i-border)`. Secondary (`:49`) and danger-subtle (`:96`) are therefore borderless:
   fill against background 1.07 / 1.08 / 1.0 and 1.03 / 1.19 / 1.18. The only button with a border is the
   disabled one (`interactive.module.css:42`, its own `border-color`), which is why a disabled button is
   the most visible button in a high-contrast theme (21:1).
2. **Box borders at 1.2–1.9:1**: field `Controls.module.css:345` and the segmented control's frame
   `:158` (`--ah-line`); neutral and progress banner `WarningBanner.css:9`; success banner `:76`
   (`--ah-accent-line`, also the wrong tone for success); warning notice `components.css:620`; capacity
   chip `CapacityRefusal.css:16`; rail search `components.css:265`; sign-in field `ServerAccess.css:95`
   (`--ah-line-strong`, the same token as the composer frame `composer/composer.css:29` and about forty
   other control borders). The toast (`components.css:638`) is told apart only by its shadow.
3. **Selected state told only by fill**: selected settings page `Settings.css:36` (`--ah-current-line`
   1.36 / 1.83), the current Etusivu link (fill 1.07 / 1.21 / 1.23), the selected segment's shadow edge
   `Controls.module.css:181`.
4. **A disabled checkbox looks like an enabled one**: `components.css:477` has no disabled state.
5. **The settings page heading gets the browser's focus ring on every page change** and reads as a white
   text field (`Account.tsx:781`, h2 with tabindex −1; only h1 is muted, `components.css:516`).
6. The error banner and notice themselves are fine once `--ah-err-line` reaches 3:1: text 9.06 / 9.34 /
   17.79, border 3.3 / 3.66 / 10.65. Focus rings are fine in every control type (at least 5.43 / 9.92 /
   13.77 against the background).

### Proposed change

Tried in a throwaway copy: with it, none of the fifty combinations stays below the limit. It names new
tokens (`--ah-ok-line`, `--ah-turn-line`, `--ah-disabled-line`) and raises `--ah-line-strong`,
`--ah-control-line`, `--ah-accent-line` and `--ah-current-line` to 3:1 on the hardest background of each
theme. The values are for the new themes; if this lands before them, the same rule applies to the
present colours.

```css
/* Ehdotetut tokenmuutokset ja kontrastiteeman säännöt.
   Ladataan teematokenien JÄLKEEN. Kaikki säännöt on kokeiltu sellaisenaan.

   Raja: tilaa tai toimintoa kantavan laatikon reuna tai täyttö vähintään 3:1
   sitä taustaa vasten, jolla se on (WCAG 1.4.11), kontrastiteemassa 4,5:1.
   Arvot on valittu niin, että ne ylittävät rajan teeman TUMMIMMALLA (Päivä:
   --ah-rail #eef2e8) tai VAALEIMMALLA (Yö: --ah-current #1c2620) taustalla.

   Rakenne: (1) tokenit, (2) sääntökorjaukset, jotka tuotteessa ovat yhden
   rivin muutoksia mainittuun tiedostoon (tässä CSS-moduulien hajautettuja
   luokkanimiä vastaan [class*=...]-valitsimin, jotta tiedosto toimii
   sellaisenaan valmiin bundlen päällä), (3) kontrastiteeman omat säännöt,
   (4) prefers-contrast ja forced-colors. */

/* ---------------------------------------------------------------- 1. Tokenit */

/* Ei pelkkä :root: se osuisi myös <html data-theme="contrast">-elementtiin ja
   ylikirjoittaisi kontrastiteeman, koska tämä tiedosto tulee themes.css:n jälkeen. */
:root:not([data-theme="dark"], [data-theme="contrast"]),
[data-theme="light"] {
  /* Kentän ja toissijaisen painikkeen reuna. Oli #b3bfa8: 1,9:1 pinnalla. */
  --ah-control-line: #7f8b78; /* 3,6 pinnalla, 3,2 sivupalkissa */
  /* Vahva reuna on ~40 kohdan kontrollireuna (viestikenttä composer.css:29,
     asetusten tekstialueet, numerosäätimet, ServerBrowser, ClonePage...).
     Oli #bfcab3: 1,6–1,7:1. Sama arvo kuin kontrollin reuna. */
  --ah-line-strong: #7f8b78;
  /* Korostuslaatikon reuna (info-ilmoitus, agenttikortti). Oli #c5dfc3: 1,3:1. */
  --ah-accent-line: #6a9272; /* 3,1 sivupalkissa, 3,4 taustalla */
  /* Valitun reunus (asetusten valittu sivu, päätteen välilehti). Oli #d0d9c6: 1,4:1. */
  --ah-current-line: #828b7e; /* 3,1 sivupalkissa */
  /* Uudet: onnistumisen ja varoituksen laatikon reuna omalla sävyllään. */
  --ah-ok-line: #47949b; /* 3,1 sivupalkissa */
  --ah-turn-line: #b07a22; /* 3,3 sivupalkissa */
  /* Uusi: estetyn kontrollin reuna. Estetty on WCAG:n rajan ulkopuolella,
     mutta sen ei pidä erottua käytettäviä enemmän. */
  --ah-disabled-line: #dde4d5; /* = --ah-line */
}

[data-theme="dark"] {
  --ah-control-line: #617267; /* oli #4a5c51 2,5:1 -> 3,4 pinnalla, 3,05 valitulla */
  --ah-line-strong: #617267; /* oli #3a4b42 2,0:1 */
  --ah-accent-line: #467a42; /* oli #2b5230 2,1:1 -> 3,1 valitulla, 3,7 taustalla */
  --ah-current-line: #64736a; /* oli #33443a 1,6:1 -> 3,1 valitulla */
  --ah-ok-line: #45795f; /* 3,1 valitulla */
  --ah-turn-line: #886a2c; /* 3,1 valitulla */
  --ah-disabled-line: #24302a; /* = --ah-line */
}

[data-theme="contrast"] {
  /* Oli --ah-line-strong #ffffff estetyn reunana (interactive.module.css:42):
     21:1, eli estetty erottui enemmän kuin käytettävä. */
  --ah-disabled-line: #5c5c5c; /* 3,1 mustalla, tarkoituksella alle 4,5 */
  --ah-ok-line: #7dffb0;
  --ah-turn-line: #ffd34d;
  /* Kontrastiteemassa valittu = valkoinen reunus (ennallaan #ffffff). */
}

/* ------------------------------------------------- 2. Sääntökorjaukset */

/* 2a. Painikkeen reuna ei koskaan piirry. Controls.module.css:10 .button
   { border: 1px solid transparent } kumoaa interactive.module.css:4
   border-color: var(--i-border), koska se tulee kaskadissa myöhemmin.
   Siksi secondary (--i-border: line-strong, :49) ja danger-subtle
   (--i-border: err-line, :96) ovat reunattomia, ja ainoa reunallinen
   painike on estetty (oma border-color, interactive.module.css:42).
   Tuotteessa: Controls.module.css:10 -> border: 1px solid var(--i-border, transparent). */
button[class*="_button_"],
a[class*="_button_"] {
  border-color: var(--i-border, transparent);
}
/* Toissijaisen reuna 3:1-tokenilla (Controls.module.css:49 line-strong -> control-line). */
[class*="_secondary_"] {
  --i-border: var(--ah-control-line);
}

/* 2b. Estetyn reuna (interactive.module.css:42 line-strong -> disabled-line). */
[class*="_surface_"]:is(:disabled, [data-disabled]) {
  border-color: var(--ah-disabled-line);
}

/* 2c. Kentät (Controls.module.css:345 --ah-line -> --ah-control-line) ja
   segmentoitu valinta: kehys (:158) ja valittu vaihtoehto (:181). */
[class*="_fieldInput_"],
[class*="_segmented_"],
.ah-rail-search input /* components.css:265 --ah-line */ {
  border-color: var(--ah-control-line);
}
[class*="_segment_"][aria-pressed="true"] {
  box-shadow: 0 0 0 1px var(--ah-control-line);
}

/* 2d. Laatikot sävyn omalla reunalla (WarningBanner.css:9, :76,
   components.css:620, CapacityRefusal.css:16, toast components.css:638). */
.ah-warning,
.ah-capacity-chip {
  border-color: var(--ah-control-line);
}
.ah-warning-success {
  border-color: var(--ah-ok-line);
}
.ah-warning-danger {
  border-color: var(--ah-err-line);
}
.ah-notice.ah-tone-warning {
  border-color: var(--ah-turn-line);
}
.ah-toast {
  border: 1px solid var(--ah-control-line);
}

/* 2e. Valittu navigaatiolinkki (Etusivu, asetusten sivu) erottuu nyt vain
   --ah-current-täytöstä (1,1–1,2:1). Reunus 3:1-tokenilla; sivupalkin
   keskustelurivillä on jo oma korostusrenkaansa (QuietSection.css:6). */
[class*="_link_"][aria-current="page"]:not(.ah-nav-link) {
  box-shadow: inset 0 0 0 1px var(--ah-current-line);
}

/* 2f. Asetussivun otsikko (h2, tabindex=-1) saa ohjelmallisen kohdistuksen
   ja selaimen oletuskehän joka sivunvaihdossa; components.css:516 vaimentaa
   sen vain h1:ltä (otsikko Account.tsx:781 .s-main h2). Kontrastiteemassa se
   näyttää valkoiselta tekstikentältä. */
h2[tabindex="-1"]:focus:not(:focus-visible),
.s-main h2[tabindex="-1"]:focus {
  outline: none;
}

/* ------------------------------------------- 3. Korkea kontrasti: säännöt */

[data-theme="contrast"] {
  /* Läpikuultavat kerrokset (rgba-valkoinen) näkyvät kiinteinä harmaina:
     täyttö ei yksin erota, joten jokaisella tilalla on reuna. */
  --ah-control: #1f1f1f;
  --ah-control-hover: #333333;
  --ah-control-press: #474747;
  --ah-hover: #1f1f1f;
  /* Varjot eivät näy mustalla; kelluva pinta saa reunan (alla). */
  --ah-shadow-float: none;
}
/* Tekstipainike (quiet ja secondary) erottuu reunasta, ei harmaasta täytöstä. */
[data-theme="contrast"] [class*="_button_"][class*="_quiet_"][class*="_text_"]:not([role="menuitem"], [role="menuitemradio"]) {
  --i-border: var(--ah-line);
}
/* Hover ja painallus: reuna valkoiseksi, ettei tila ole pelkkä sävyero. */
[data-theme="contrast"] [class*="_surface_"]:not(:disabled, [data-disabled]):is(:hover, [data-hovered], [data-ah-state="hover"], :active, [data-pressed], [data-ah-state="pressed"]) {
  border-color: var(--ah-ink);
}
/* Kelluvat pinnat (ponnahdukset, dialogit, toast) ilman varjoa. Valikoilla on jo oma reunansa. */
[data-theme="contrast"] :is([role="dialog"], .ah-toast, .react-aria-Popover) {
  outline: 1px solid var(--ah-line);
}
/* Valittu segmentti: 2 px:n valkoinen reunus, ei pelkkä pinnan sävy. */
[data-theme="contrast"] [class*="_segment_"][aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--ah-ink);
}
/* Estetty: harmaa katkoviivareuna (--ah-disabled-line), ei kirkas valkoinen. */
[data-theme="contrast"] [class*="_surface_"]:is(:disabled, [data-disabled]) {
  border-style: dashed;
}
/* Kuvat ja esikatselut valkoisella --ah-content-canvas-pohjalla: rajaus. */
[data-theme="contrast"] :is(img, canvas, iframe, .ah-mermaid, [class*="preview"]) {
  outline: 1px solid var(--ah-line);
}

/* --------------------------------- 4. prefers-contrast ja forced-colors */

/* Tuote ei nyt reagoi kumpaankaan (ei yhtään @media-sääntöä). Ehdotus:
   theme.ts valitsee "contrast"-teeman, kun valinta on Järjestelmä ja
   matchMedia("(prefers-contrast: more)") osuu; CSS:ssä vain varmistus
   (tätä lohkoa ei ole kaapattu eikä mitattu): */
@media (prefers-contrast: more) {
  :root:not([data-theme="contrast"]) {
    --ah-line: var(--ah-control-line);
    --ah-line-soft: var(--ah-control-line);
  }
}
/* Windowsin pakotetut värit: selain korvaa värit järjestelmän väreillä ja
   poistaa taustakuvat ja varjot. Tilamerkki käyttää currentColoria, joten se
   säilyy; tila, joka on pelkkä täyttö (valittu rivi, valittu segmentti),
   tarvitsee reunan. */
@media (forced-colors: active) {
  .ah-rail .ah-now-row:has(.ah-nav-link[aria-current="page"]),
  [class*="_segment_"][aria-pressed="true"],
  [aria-current="page"] {
    outline: 2px solid Highlight;
  }
  .oh-mark .oh-ring { stroke: CanvasText; }
  .oh-mark[data-state="waiting"] .oh-ring,
  .oh-mark[data-state="error"] .oh-ring { stroke: Highlight; }
}
```

Not measured: the composer frame on its own, hover and pressed states from real pointer use (they were
measured from the forced states of the interaction matrix), and the `prefers-contrast` block.

The design system's quiet default (`design-system/design.md`) is a constraint here: stronger borders make
the interface more lined. Where a 3:1 border on every field is judged too heavy for Päivä and Yö, the
contrast theme must still meet it, and the button border bug is a bug either way.

## Acceptance Criteria

- [ ] `.button` draws `--i-border`; secondary and danger-subtle have a boundary of at least 3:1, and a
      disabled button is not more prominent than an enabled one in any theme.
- [ ] Every state-carrying box (banners, notices, toast, chips) has a border in its own tone at 3:1 or
      more against the background it sits on.
- [ ] Fields, the segmented control and selected states meet 3:1, or the exception for Päivä and Yö is
      decided by Jari and recorded; the contrast theme meets 4.5:1 without exception.
- [ ] Disabled checkbox is told apart from an enabled one; the settings heading no longer shows a focus
      ring on page change.
- [ ] The measurement is repeatable: a lab script that reports boundary contrast per component, state
      and theme, with the result in the notes.
