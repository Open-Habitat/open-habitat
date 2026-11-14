# Result

The website now uses the accepted direction 3 "Merkki kantaa" in both
languages. The hero shows the large mark (the ring draws itself and the
resident steps in, once), the status pill with the mark, the headline,
the tagline and the actions, with the "What the mark tells you" panel and the
round's five state captions beside them. Below the hero, the server diagram
(its states are now marks, and Anna's agent has two orbiting sub-agents) sits
beside the "same work" paragraph, and the rest of the page keeps today's text
and order, styled as the round styles it. Header, footer and favicon carry
the new mark.

Site-wide themes: Päivä and Yö follow the system or Starlight's theme menu,
which now says Day / Night (fi: Päivä / Yö). Korkea kontrasti is never in the
menu. It is shown only while the menu is on Auto and the system sets
`prefers-contrast: more`; picking Day or Night keeps that choice. Reduced
motion stops every mark animation, and the states still read from shape and
colour. The site makes no external requests, and `noindex` is unchanged.

## Validation

- `cd website && npm ci && npm run build`: 13 pages, internal links valid.
- A Playwright check of the built site (40 checks) covered en and fi at 1440
  and 390 in Päivä and Yö. It measured every hero, content and header text at
  4.5:1 against its own background and confirmed nothing overflows. Under
  Auto with more contrast it confirmed Korkea kontrasti at 7:1 for light and
  dark systems, that Day in the menu wins and Auto returns to contrast, that
  a stored Night wins, and that the menu has no contrast entry. It also
  checked the fi menu labels, that the docs page uses contrast, that
  animations run without reduced motion and none run with it, that there are
  no external requests and that the console stays clean.
- The round's `build.mjs` still reads the landing text object.
- Screenshots (scale 2, viewport plus full page) are in the worker-results
  directory: landing en/fi × 1440/390 × Päivä/Yö, landing en 1440 in Korkea
  kontrasti, and the docs page in Päivä and in Korkea kontrasti.

## Decisions for later review

- **The brand CSS is copied into `website/src/styles/brand.css`**, loaded
  after `design-system/styles.css`. The design-system tokens still hold the
  old colours (`brand-themes-and-state-mark` is open), and this unit could
  only touch `website/`. The copy is the round's `brand.css` with only its
  header comment changed. Remove it once the tokens carry the themes;
  `website/AGENTS.md` says so.
- **Korkea kontrasti via a small inline script (`website/contrast.mjs`)**
  that watches Starlight's `data-theme` and sets `contrast` while the stored
  choice is Auto and `prefers-contrast: more` holds. A pure CSS media query
  would also override an explicit Day/Night choice, which would make the
  menu look broken. Starlight treats any value other than `light` as dark,
  so code blocks and its chrome render as dark there.
- **Under Korkea kontrasti, Starlight's `gray-6` is mapped to
  `--ah-surface-hover`.** Starlight uses gray-6 for backgrounds as well as
  lines, such as the search shortcut and the search dialog. The contrast
  theme's mid-grey line made the "Ctrl K" hint 3.4:1.
- **The theme menu is relabelled Day/Night (Päivä/Yö)** through Starlight's
  i18n collection. "Auto" is unchanged.
- **The hero replaces Starlight's `Hero` component.** Starlight puts the hero
  image before the h1 in the DOM, which would have read the states panel's
  heading before the page title. The status pill is shown above the
  headline but follows it in the DOM, so the h1 is read first. The large hero
  mark is decorative (`aria-hidden`), because the site title already names
  the product.
- **The "How it differs" action became a bordered secondary button**, as in
  the round. Before, it was Starlight's minimal link.
- **Borders of chips, server, layers and cards use `--ah-line-strong`**, as
  in the round, so boundaries meet 3:1.
- **`website/AGENTS.md` no longer says deployment is manual.** The workflow
  already deploys on push to main.

## Live check

After the conductor pushes, check https://open-habitat.ai/ and
https://open-habitat.ai/fi/ in a light and a dark system. With the system's
"increase contrast" on and the menu on Auto, the page should be black and
white with green accents. Choosing Day should give Päivä.
