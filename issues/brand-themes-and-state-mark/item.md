---
created: 2026-11-13
updated: 2026-11-14
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:brand-round-2026-11-13/app
lane: brand
lane_seq: 2
blocked_by: ['@non-text-contrast-boundaries']
collision: [design-system/]
preparation: ready
---

# New brand: three themes, new mark and the mark as the agent state indicator

## Description

## Description

Jari chose a new visual identity for Open Habitat on 13.11.2026: a new mark, three colour themes and the
same mark as the agent state indicator. This issue brings them into the app. The website follows in
`proto-website-front-page-brand`; the border and boundary contrast fixes found while trying the themes
in the real interface are in `non-text-contrast-boundaries` and are best landed first or together.

### The mark

A rounded square ring with an opening in the top right corner and a dot in the middle: the ring is the
habitat, the dot is the resident (the agent), the opening is the door. It replaces
`design-system/favicon.svg` and the landing mark (`web/src/components/Landing.tsx`, the static copy in
`web/index.html`, `Landing.css`).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/></svg>
```

The favicon needs fixed colours, because `currentColor` renders black in a tab:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2c6e3f" stroke-width="2" stroke-linecap="round"><style>@media(prefers-color-scheme:dark){*{stroke:#8fe36b}circle{fill:#8fe36b}}</style><path d="M14 3H8a5 5 0 0 0-5 5v8a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5v-6"/><circle cx="12" cy="12" r="2.5" fill="#2c6e3f" stroke="none"/></svg>
```

### Three themes

Päivä replaces the present light theme, Yö the present dark theme, and Korkea kontrasti is a new third
theme (`data-theme="contrast"`, dark). The token names are the present `design-system/tokens/colors.css`
names, so the blocks replace the present ones. Every text pair measures at least 4.5:1 and every mark
and focus ring 3:1 against its background (7:1 and 4.5:1 in the contrast theme); the error box border
is at least 3:1 against page, surface and rail in all three.

```css
/* Kolme teemaa nykyisillä --ah-*-nimillä: Päivä, Yö ja Korkea kontrasti. */

/* Päivä (Sammal) */
:root,
[data-theme="light"] {
  --ah-source-1: var(--ah-syntax-title);
  --ah-source-2: var(--ah-syntax-string);
  --ah-source-3: var(--ah-syntax-keyword);
  --ah-glyph-0: var(--ah-accent);
  --ah-glyph-1: var(--ah-syntax-title);
  --ah-glyph-2: var(--ah-syntax-keyword);
  --ah-glyph-3: var(--ah-syntax-string);
  --ah-glyph-4: var(--ah-syntax-number);
  --ah-syntax-keyword: #71419b;
  --ah-syntax-string: #216142;
  --ah-syntax-number: #8a4b16;
  --ah-syntax-title: #185e87;
  --ah-syntax-comment: #5c675d;
  --ah-syntax-deletion: #a3412b;
  --ah-glyph-5: #9b3d73;
  --ah-glyph-6: #4a5a6b;
  --ah-glyph-7: #5c6a1a;
  --ah-sunken: #eff3ea;
  --ah-hover: rgba(20, 40, 20, 0.06);
  --ah-bg: #f6f8f2;
  --ah-surface: #ffffff;
  --ah-surface-2: #fbfcf9;
  --ah-content-canvas: #ffffff;
  --ah-rail: #eef2e8;
  --ah-line: #dde4d5;
  --ah-line-soft: #e9eee2;
  --ah-ink: #17201a;
  --ah-ink-2: #3a453c;
  --ah-muted: #5c675d;
  --ah-faint: #626d63;
  --ah-accent: #2c6e3f;
  --ah-accent-ink: #1f5430;
  --ah-accent-soft: #e3f1e1;
  --ah-accent-line: #c5dfc3;
  --ah-on-accent: #ffffff;
  --ah-ok: #0f6f78;
  --ah-ok-soft: #e4f3f5;
  --ah-turn: #a86400;
  --ah-err: #a3412b;
  --ah-err-soft: #fdf1ee;
  --ah-err-line: #bf7565;
  --ah-line-strong: #bfcab3;
  --ah-accent-hover: #245e35;
  --ah-accent-press: #1f5430;
  --ah-on-err: #ffffff;
  --ah-err-hover: #8e3825;
  --ah-err-press: #7a2f1f;
  --ah-err-soft-hover: #fae4de;
  --ah-err-soft-press: #f6d6cd;
  --ah-surface-hover: #f1f4ec;
  --ah-surface-press: #e7ecdf;
  --ah-current: #ffffff;
  --ah-current-line: #d0d9c6;
  --ah-disabled-bg: #ebefe5;
  --ah-disabled-fg: #5c675d;
  --ah-focus: #2c6e3f;
  --ah-composer-focus: #086bc1;
  --ah-scrim: rgba(20, 32, 22, 0.32);
  --ah-control: rgba(20, 40, 20, 0.06);
  --ah-control-hover: rgba(20, 40, 20, 0.1);
  --ah-control-press: rgba(20, 40, 20, 0.14);
  --ah-control-line: #b3bfa8;
}

/* Yö (Matrix) */
[data-theme="dark"] {
  --ah-source-1: var(--ah-syntax-title);
  --ah-source-2: var(--ah-syntax-string);
  --ah-source-3: var(--ah-syntax-keyword);
  --ah-glyph-0: var(--ah-accent);
  --ah-glyph-1: var(--ah-syntax-title);
  --ah-glyph-2: var(--ah-syntax-keyword);
  --ah-glyph-3: var(--ah-syntax-string);
  --ah-glyph-4: var(--ah-syntax-number);
  --ah-syntax-keyword: #c9a6f0;
  --ah-syntax-string: #9ad8a0;
  --ah-syntax-number: #edba8d;
  --ah-syntax-title: #8fd0e8;
  --ah-syntax-comment: #96a69a;
  --ah-syntax-deletion: #f0a08c;
  --ah-glyph-5: #e7a3c8;
  --ah-glyph-6: #a8b8ae;
  --ah-glyph-7: #d3cf74;
  --ah-sunken: #090d0b;
  --ah-hover: rgba(160, 255, 170, 0.07);
  --ah-bg: #0d1210;
  --ah-surface: #141b17;
  --ah-surface-2: #101613;
  --ah-content-canvas: #ffffff;
  --ah-rail: #0a0f0d;
  --ah-line: #24302a;
  --ah-line-soft: #1b2520;
  --ah-ink: #e3ece4;
  --ah-ink-2: #bccabf;
  --ah-muted: #8d9e92;
  --ah-faint: #879a8c;
  --ah-accent: #8fe36b;
  --ah-accent-ink: #a6ee86;
  --ah-accent-soft: #17301b;
  --ah-accent-line: #2b5230;
  --ah-on-accent: #0a1a0b;
  --ah-ok: #86dba6;
  --ah-ok-soft: #14261c;
  --ah-turn: #e8b450;
  --ah-err: #ff8370;
  --ah-err-soft: #3a1814;
  --ah-err-line: #b0503f;
  --ah-line-strong: #3a4b42;
  --ah-accent-hover: #a2ec82;
  --ah-accent-press: #b6f29b;
  --ah-on-err: #1a0c08;
  --ah-err-hover: #ffa48f;
  --ah-err-press: #ffb8a7;
  --ah-err-soft-hover: #481e19;
  --ah-err-soft-press: #56241e;
  --ah-surface-hover: #1a231e;
  --ah-surface-press: #212c26;
  --ah-current: #1c2620;
  --ah-current-line: #33443a;
  --ah-disabled-bg: #171e1a;
  --ah-disabled-fg: #8d9e92;
  --ah-focus: #8fe36b;
  --ah-composer-focus: #79c0ff;
  --ah-scrim: rgba(0, 0, 0, 0.55);
  --ah-control: rgba(190, 255, 200, 0.09);
  --ah-control-hover: rgba(190, 255, 200, 0.13);
  --ah-control-press: rgba(190, 255, 200, 0.17);
  --ah-control-line: #4a5c51;
}

/* Korkea kontrasti (tumma) */
[data-theme="contrast"] {
  --ah-source-1: var(--ah-syntax-title);
  --ah-source-2: var(--ah-syntax-string);
  --ah-source-3: var(--ah-syntax-keyword);
  --ah-glyph-0: var(--ah-accent);
  --ah-glyph-1: var(--ah-syntax-title);
  --ah-glyph-2: var(--ah-syntax-keyword);
  --ah-glyph-3: var(--ah-syntax-string);
  --ah-glyph-4: var(--ah-syntax-number);
  --ah-syntax-keyword: #dcc0ff;
  --ah-syntax-string: #a8f0b8;
  --ah-syntax-number: #ffd0a0;
  --ah-syntax-title: #a8dcff;
  --ah-syntax-comment: #d6d6d6;
  --ah-syntax-deletion: #ffb3a0;
  --ah-glyph-5: #ffb8dc;
  --ah-glyph-6: #d0d8e0;
  --ah-glyph-7: #e6ee8a;
  --ah-sunken: #000000;
  --ah-hover: rgba(255, 255, 255, 0.14);
  --ah-bg: #000000;
  --ah-surface: #000000;
  --ah-surface-2: #000000;
  --ah-content-canvas: #ffffff;
  --ah-rail: #000000;
  --ah-line: #8c8c8c;
  --ah-line-soft: #5c5c5c;
  --ah-ink: #ffffff;
  --ah-ink-2: #ffffff;
  --ah-muted: #d6d6d6;
  --ah-faint: #d6d6d6;
  --ah-accent: #9dff70;
  --ah-accent-ink: #b9ff99;
  --ah-accent-soft: #12300a;
  --ah-accent-line: #8c8c8c;
  --ah-on-accent: #000000;
  --ah-ok: #7dffb0;
  --ah-ok-soft: #06240f;
  --ah-turn: #ffd34d;
  --ah-err: #ffa08a;
  --ah-err-soft: #300c05;
  --ah-err-line: #ffa08a;
  --ah-line-strong: #ffffff;
  --ah-accent-hover: #b9ff99;
  --ah-accent-press: #d2ffbd;
  --ah-on-err: #000000;
  --ah-err-hover: #ffb7a6;
  --ah-err-press: #ffcdc0;
  --ah-err-soft-hover: #45130a;
  --ah-err-soft-press: #5a1a0e;
  --ah-surface-hover: #1f1f1f;
  --ah-surface-press: #333333;
  --ah-current: #1c1c1c;
  --ah-current-line: #ffffff;
  --ah-disabled-bg: #1c1c1c;
  --ah-disabled-fg: #b8b8b8;
  --ah-focus: #9dff70;
  --ah-composer-focus: #9ecbff;
  --ah-scrim: rgba(0, 0, 0, 0.75);
  --ah-control: rgba(255, 255, 255, 0.14);
  --ah-control-hover: rgba(255, 255, 255, 0.22);
  --ah-control-press: rgba(255, 255, 255, 0.3);
  --ah-control-line: #ffffff;
}
```

The third theme needs wiring that does not exist today:

- `web/src/theme.ts`, `theme-bootstrap.js` and Settings › Ulkoasu get a fourth choice; the account menu's
  theme icons and the segmented control currently show an empty selection under `contrast`.
- With the Järjestelmä choice, `prefers-contrast: more` selects the contrast theme. The product has no
  `prefers-contrast` or `forced-colors` rule today; under `forced-colors` the present rail state balls
  disappear because they are background colours, while the new SVG mark survives.
- `MermaidDiagram.tsx:10` picks its theme with `=== "dark"`, so the contrast theme gets light nodes on
  black; treat `contrast` as dark.
- In the contrast theme the translucent `--ah-control*` layers measure 1.35–2.46:1 and
  `--ah-shadow-float` is invisible on black: fixed colours and a border instead of the shadow.
- code-server does not receive the theme (`internal/daemon/editor_settings_linux.go:17`); the QR code
  has a hard-coded `#16191d` (`DeviceLink.tsx:40`).

### The mark as the agent state indicator

State shows in both shape and colour, so it survives at 14–16 px and with reduced motion. The CSS below
is the reference; `data-state` names are the mark's, the mapping to product states follows.

```css
/* Open Habitat -merkki ja sen tilat. Kehä on habitaatti, piste asukas (agentti), aukko ovi.
   Merkki: <svg class="oh-mark" data-state="…" viewBox="-12 -12 24 24">
             <path class="oh-ring" pathLength="100" d="M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z"/>
             <circle class="oh-dot" r="2.5"/>
             <g class="oh-orbit"><circle class="oh-sub" data-state="…" r="1.3" cx cy/>…</g>   (aliagentit, säde 5.6)
           </svg>
   Väri tulee currentColorista; tila näkyy sekä muodosta että väristä:
   sinun vuorosi --ah-turn, valmis --ah-ok, virhe --ah-err. */
.oh-mark{overflow:visible;flex:none;--tx:5px;--ty:-5px}
.oh-ring{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:81.3 18.7}
.oh-dot,.oh-sub{fill:currentColor;transform-box:fill-box;transform-origin:center}

/* idle: paikallaan, sama kuin logo */
/* thinking: asukas hengittää */
.oh-mark[data-state=thinking] .oh-dot{animation:oh-breathe 1.5s ease-in-out infinite}
@keyframes oh-breathe{0%,100%{transform:scale(.55);opacity:.55}50%{transform:scale(1.2);opacity:1}}
/* working: ovi kiertää kehää */
/* alkaa puolikierroksen päästä, jotta pysäytyskuvakin eroaa logosta */
.oh-mark[data-state=working] .oh-ring{stroke-dashoffset:-50;animation:oh-turn 1.7s cubic-bezier(.65,0,.35,1) infinite}
@keyframes oh-turn{to{stroke-dashoffset:-150}}
/* waiting: asukas tulee ovelle ja koputtaa, sinun vuorosi -värillä */
/* koko merkki vaihtaa väriä, koska pelkkä piste ei erotu 14–16 px:ssä */
.oh-mark[data-state=waiting]{color:var(--ah-turn)}
.oh-mark[data-state=waiting] .oh-dot{animation:oh-knock 2.6s ease-in-out infinite}
@keyframes oh-knock{0%,8%{transform:translate(0,0)}28%{transform:translate(var(--tx),var(--ty))}38%{transform:translate(calc(var(--tx)*.75),calc(var(--ty)*.75))}48%{transform:translate(var(--tx),var(--ty))}58%{transform:translate(calc(var(--tx)*.75),calc(var(--ty)*.75))}68%,82%{transform:translate(var(--tx),var(--ty))}100%{transform:translate(0,0)}}
/* done: ovi kiinni, kehä ehjä */
.oh-mark[data-state=done]{color:var(--ah-ok)}
.oh-mark[data-state=done] .oh-ring{stroke-dasharray:100 0}
/* error: virheväri, ontto asukas */
.oh-mark[data-state=error]{color:var(--ah-err)}
.oh-mark[data-state=error] .oh-dot{fill:none;stroke:currentColor;stroke-width:1.6}
/* read: vastaus on jo luettu. Asukas seisoo ovella hiljaa: ontto, ei koputusta. */
.oh-mark[data-state=read]{color:var(--ah-turn)}
.oh-mark[data-state=read] .oh-dot{fill:none;stroke:currentColor;stroke-width:1.6;transform:translate(var(--tx),var(--ty))}
/* background: agentti odottaa taustatyötä. Asukas on himmeä ja ovi kiertää hitaasti, tasaisesti. */
.oh-mark[data-state=background] .oh-dot{opacity:.45}
.oh-mark[data-state=background] .oh-ring{stroke-dashoffset:-25;animation:oh-drift 6s linear infinite}
@keyframes oh-drift{to{stroke-dashoffset:-125}}
/* awaited: aliagentti, jota pääagentti odottaa. Työskentelee, ja asukas hengittää samalla. */
.oh-mark[data-state=awaited] .oh-ring{stroke-dashoffset:-50;animation:oh-turn 1.7s cubic-bezier(.65,0,.35,1) infinite}
.oh-mark[data-state=awaited] .oh-dot{animation:oh-breathe 1.5s ease-in-out infinite}
/* unknown: tilaa ei tiedetä. Katkoviivakehä, himmeä väri, ei asukasta. */
.oh-mark[data-state=unknown]{color:var(--ah-muted)}
.oh-mark[data-state=unknown] .oh-ring{stroke-dasharray:4.5 8}
.oh-mark[data-state=unknown] .oh-dot{display:none}
/* stopping: vuoroa pysäytetään. Ovi sulkeutuu ja aukeaa. */
.oh-mark[data-state=stopping] .oh-ring{animation:oh-close 1.2s ease-in-out infinite alternate}
.oh-mark[data-state=stopping] .oh-dot{opacity:.45}
@keyframes oh-close{from{stroke-dasharray:81.3 18.7}to{stroke-dasharray:100 0}}
/* loading: kehä hakee muotoaan, asukas ei ole vielä kotona */
.oh-mark[data-state=loading] .oh-dot{transform:scale(.4);opacity:.3}
.oh-mark[data-state=loading] .oh-ring{animation:oh-load 1.8s ease-in-out infinite}
@keyframes oh-load{0%{stroke-dasharray:8 92;stroke-dashoffset:0}50%{stroke-dasharray:70 30;stroke-dashoffset:-40}100%{stroke-dasharray:8 92;stroke-dashoffset:-100}}
/* intro: sivu avataan, kehä piirtyy ja asukas astuu ovesta sisään (kerran) */
.oh-mark[data-state=intro] .oh-ring{animation:oh-draw 1.1s ease-in-out both}
@keyframes oh-draw{from{stroke-dasharray:0 100}to{stroke-dasharray:81.3 18.7}}
.oh-mark[data-state=intro] .oh-dot{animation:oh-enter .7s cubic-bezier(.3,1.3,.5,1) .9s both}
@keyframes oh-enter{from{transform:translate(calc(var(--tx)*2.6),calc(var(--ty)*2.6)) scale(.4);opacity:0}30%{opacity:1}to{transform:none;opacity:1}}

/* aliagentit: kiertolaiset */
.oh-orbit{animation:oh-orbit 16s linear infinite}
@keyframes oh-orbit{to{transform:rotate(360deg)}}
.oh-mark:has(.oh-sub) .oh-dot{r:2px}
.oh-sub[data-state=working]{animation:oh-breathe .9s ease-in-out infinite}
.oh-sub[data-state=thinking]{animation:oh-breathe 1.9s ease-in-out infinite}
.oh-sub[data-state=waiting]{fill:var(--ah-turn);animation:oh-blink 1.2s steps(2,jump-none) infinite}
.oh-sub[data-state=error]{fill:var(--ah-err)}
@keyframes oh-blink{0%{opacity:1}100%{opacity:.2}}

/* Liikkeen vähennys: tila näkyy silti muodosta ja väristä (ovella, kiinni, ontto). */
@media (prefers-reduced-motion:reduce){
 .oh-mark *,.oh-orbit{animation:none!important}
 .oh-mark[data-state=waiting] .oh-dot{transform:translate(var(--tx),var(--ty))}
 .oh-mark[data-state=read] .oh-dot{transform:translate(var(--tx),var(--ty))}
}
```

| Product state | Mark state |
|---|---|
| `working`; worker `working`, `checking` | `working` |
| `you` (question, unread answer); worker `idle`, `answer` | `waiting` |
| `you` with the answer already read | `read` |
| `waiting_background` | `background` |
| `done`, `waiting`, `closed`; worker `merged`, `reported` | `done` |
| `fail`; worker `failed`, `unfinished` | `error` |
| `unknown`; worker `unknown`, `unmerged` | `unknown` |
| worker `waiting_parent` (the agent waits for it) | `awaited` |
| turn `stopping` | `stopping` |
| live turn activity, where available (`liveTurn.activity`) | `thinking` |
| connecting, page load | `loading`, `intro` on the landing page |

Places that draw the state today, each to be replaced: rail conversation row (`Navigation.tsx:612`
`Ball`), narrow rail (`Navigation.tsx:1046` `NowDot`), workspace row hint (`Navigation.tsx:444`
`NavMark`, `:963` `HintMark`), header (`HeaderShortening.tsx:140` `HeaderActivity`), background wait chip
(`ProcessTray.tsx:818`), turn row (`AgentTurn.tsx:458`), composer progress row (`WorkingProgress.tsx:88`),
background strip and the workers popover (`BackgroundStrip.tsx`, `WorkerMark.tsx`), archive and worktree
attention (`ConversationArchive.tsx:143`, `WorktreeAttention.tsx:306`), home cards
(`HomeWorkspaces.tsx:125`), return view (`ReturnView.tsx:101`).

Decided by Jari:

- Sub-agents are small dots orbiting the resident, shown only where the mark is at least 20 px; in
  smaller marks the number of sub-agents is a figure beside the mark.
- The branch mark at the right edge of a rail row (`WorkerBranchMark`) is removed.
- The narrow rail is designed separately from the wide one (the 14 px mark covered the corner of the
  workspace icon).

Found while trying it in the real interface:

- The header does not know about failure: `BrowserConversation.tsx:2556` `presentation` has no
  `failure`, so a failed turn shows `done`; the read-only conversation's header (`HistoryView.tsx:1707`)
  is always `unknown` or `working`.
- The mark needs 14–16 px where the present ball is 8 px. In the rail a 20 px mark keeps the 32 px row
  and leaves the title 178–182 px (192 px today); a 24 px mark needs a 36 px row.
- A sub-agent dot is 2.2 px in a 20 px mark and barely readable at 1×; a figure beside the mark may
  serve better there too.

### Decisions (Jari 14.11.2026)

Wide rail **B**; narrow rail **N2** (dashed ring for `read`); sub-agents at 20 px as dots up to three, a figure above that. Jari reviews them on the test server.

### Original open decisions

1. Wide rail: mark in its present place at 20 px (A), at the left edge of the row before the workspace
   icon at 20 px (B), or at the left edge at 24 px with a 36 px row (C). Recommendation: B.
2. Narrow rail: a reduced mark in the icon's corner (N1), the mark's ring drawn around the workspace
   icon (N2), or a small ball in the state colour (N3). Recommendation: N2, with a dashed ring for
   `read` so that it differs from `waiting` by more than animation.
3. Whether sub-agents at 20 px are dots or a figure.

## Acceptance Criteria

- [ ] The three themes replace light and dark and add `contrast`, selectable in Settings › Ulkoasu, the
      account menu and by `prefers-contrast: more` under Järjestelmä; no stale selection state.
- [ ] Favicon, landing mark and its static copy use the new mark; the landing page plays `intro` once.
- [ ] Every place listed above draws the new mark with the mapping in the table; no place keeps the old
      ball, and the header shows failure.
- [ ] Rail rows follow Jari's choice for the wide and the narrow rail; the branch mark is gone.
- [ ] Reduced motion: every state is still told apart by shape and colour.
- [ ] `forced-colors`: the mark and the selected states remain visible.
- [ ] Text contrast measured in the rendered interface is at least 4.5:1 in Päivä and Yö and 7:1 in the
      contrast theme; the two known light-theme shortfalls on main are listed if they remain.
- [ ] Mermaid, terminal and syntax colours follow all three themes; what cannot follow (code-server) is
      stated in the notes.
- [ ] Browser specs for the theme choice and the state mapping; a KOKEILTAVAA line.
