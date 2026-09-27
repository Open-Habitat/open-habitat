# Omega Habitat — brand identity handoff

**Status:** design brief for external exploration, not an approved identity or production asset set. The product currently appears in source/UI under the working name Native Agent Host; this brief does not authorize a repository or UI rename. The proposed public name is **Omega Habitat**. Jari will select and approve the identity before implementation.

## What the product is

Omega Habitat is a browser front end to AI agents running natively in each person's own Linux account. A signed-in person opens workspaces from their own filesystem and continues the same native agent conversations they can reach through SSH and tmux. The browser is another doorway to that environment, not a new agent platform or a simulated agent workspace. Unix user boundaries separate people; native tools retain their own histories, credentials and processes. The first product scope is a single-host, desktop-first, Finnish-language UI centered on Pi. Other agents, mobile and multi-host navigation are not launch promises.

**Audience:** people who already use coding agents and developer workspaces, and the small teams administering a shared Linux host. They need to recognize the product quickly in a browser tab or workspace navigation, trust that it respects native work, and distinguish it from an AI model, a cloud IDE or a generic chatbot. The identity should feel composed, technical and approachable rather than cosmic, mystical, militarized or loud. Do not imply isolation, security certification, uptime, scale or features beyond the description above.

**Name rationale:** “Habitat” evokes agents working in their native environment. Omega (Ω) suggests an encompassing place for agents and browser/SSH/tmux access paths, and its curved shape can become a recognizable arch or gateway. This is a metaphor, not a claim that every agent or access method is supported today. Spell the wordmark **Omega Habitat**; use Ω as an optional symbol, not a replacement for the readable name everywhere. Avoid relying on the Greek letter alone for pronunciation or discoverability. Do not borrow the branding of a specific agent such as Pi, nor imitate Meta's Habitat simulation project.

## Creative recommendation

**Lead direction — the native doorway.** Explore an ownable, restrained Ω-derived arch whose *negative space* reads as an open passage into a stable workspace. Keep the silhouette distinct from a stock Greek font glyph, a house roof or a padlock. Pair it with a calm, highly legible wordmark. The passage is the browser entering a native environment; the two grounded ends suggest continuity with other access paths without drawing literal cables or servers. Prioritize recognition at tiny sizes over conceptual detail. Show the mark with the name first; a detached symbol should still work when the name cannot fit.

**Alternative to test — a grounded monogram.** Build an O/H relationship from simple geometry and an intentional opening, with less reliance on the Ω reading. This may survive 16 px better, but risks looking like a generic tech monogram; show side-by-side at actual size before choosing. **Do not** produce three unrelated moodboards or force a globe, robot head, terminal prompt, cloud, infinity sign or network diagram into the mark. Explain why the chosen direction wins on recognition, small-size clarity and fit with the product. A non-Ω result is acceptable if it passes those tests better.

## Fit with the existing interface

The existing UI uses quiet neutral surfaces, dark ink and a muted teal accent (light `#2b7f8c`, dark `#4fa6b4`). Both light and dark themes are in scope; system preference is the default. Treat these as integration context, not a mandate that the logo be teal or a request to change UI tokens. Present full-color and one-color identities on light (`#ffffff`, `#f6f7f8`) and dark (`#1b1f23`, `#14171a`) surfaces; include a neutral monochrome version where accent is unavailable. Leave error red to errors. Avoid gradients, hairlines and detail that only survives on a marketing canvas. The logo must not encode operational status; the UI always supplies state in text as well as any color or icon.

Show a **headline web lockup** at desktop header/landing scale with meaningful whitespace, a horizontal compact header lockup, a **standalone small mark** for navigation, a **favicon** at 16×16 and 32×32, and an **app icon** at 192×192 and 512×512. An app icon is a deliverable for possible later install/launcher use, not a promise of a mobile app or PWA. Design for responsive reduction: wordmark and symbol may separate or switch lockups, but never shrink the full headline treatment into a favicon. Provide minimum sizes and clear-space rules in the final usage notes. Test the mark on real pixels, not only enlarged mockups; remove or redraw inner gaps that close at 16 px. Check 200% browser zoom and narrow desktop headers without clipping or unreadably compressed text. Avoid baking a tagline into tiny lockups.

**Typography and content:** the UI is Finnish, but the proper name can remain Omega Habitat in English. Make the wordmark readable with ordinary fallback typography and state font licensing and redistribution rights. No dependency on a third-party runtime font service. If a custom letterform or font is used, include outlined vector geometry *and* editable text/source with the font name and license. Keep the brand separate from code, command, path and agent names; never stylize technical identifiers as if they were the product name.

## Tagline exploration (candidates, not approved copy)

Try the following as typographic companions to the large lockup; recommend one and justify it, or propose a more accurate short variant. Do not add an unsupported promise of universal compatibility or guaranteed persistence.

- **Your agents, in their native habitat.** Memorable name link; verify it does not suggest ownership of every agent or environment.
- **The browser door to native agents.** Clear about access, perhaps less expressive.
- **Work here. Continue anywhere you already work.** Captures continuity but may overpromise; use only if shortened and qualified for the supported paths.

Taglines must be removable without weakening the wordmark. Provide Finnish-language alternatives for product UI context, checked for natural phrasing rather than literal translation. Do not put any tagline in the favicon or small mark.

## Accessibility and production handoff requirements

- Supply light and dark examples plus single-color positive/reverse versions. Any *text* in a proposed branded header must meet WCAG AA contrast against its actual background (at least 4.5:1 for normal-size text, 3:1 for qualifying large text). Essential graphical shape and focus-adjacent UI use need at least 3:1 against adjacent colors where WCAG non-text contrast applies. Measure and report the tested foreground/background pairs and ratios; do not assume a token or screenshot passes. Test grayscale and low-vision legibility. Meaning must not depend only on hue.
- Deliver editable **vector originals** for every master (SVG with clean paths/layers and an editable source file such as AI, Figma export or Inkscape SVG), plus web-ready optimized SVG for each lockup and mark. Include outlined-font SVG and editable-text master when lettering is custom. Provide transparent PNG exports of app icons and favicon sizes, favicon ICO or multi-size PNGs, and a simple monochrome mask version. State color values, fonts/licenses, sizing, padding and clear space. No raster tracing masquerading as an editable vector.
- SVGs should be static, accessible as decorative when adjacent to visible brand text, and safe for normal web embedding (no scripts, external fetches or embedded tracking). Provide exact filenames and a mapping of which variant to use on light/dark backgrounds. If icon backgrounds are baked in, also provide transparent variants and specify safe-area padding. Do not deliver only mockups or flattened PNGs.
- Show wrong uses: don't stretch, rotate, add glow/shadows, recolor status hues, place low-contrast versions on busy imagery, substitute a generic Ω font character for the approved mark, or use the symbol alone where people need to learn the name. Define when full lockup, wordmark and symbol are appropriate. Avoid resemblance to an existing product mark; flag similarities for human review rather than asserting trademark clearance.

## Acceptance checklist for Jari

- [ ] The explanation matches a browser doorway to *native* per-user work, not a new agent/model or a security certification.
- [ ] One recommended direction and a meaningfully different fallback are compared at 16 px, header size, and headline size; name legible without a tagline.
- [ ] Headline, compact lockup, small mark, favicon (16/32), app icon (192/512) and monochrome/reverse variants shown on both themes.
- [ ] Measured text/non-text contrast pairs, grayscale check and 200% zoom/narrow-header examples provided; no critical detail disappears at favicon size.
- [ ] Editable vector originals, optimized SVGs, raster/ICO exports, font rights and concrete usage/avoidance rules included.
- [ ] Taglines identified as candidates, including Finnish options; no unverified capability/availability/security claims.
- [ ] Jari approves the direction and wordmark separately before anyone replaces production UI or renames source.

## Ready-to-paste external designer prompt

> Design an **exploratory identity handoff, not production code or a final approved asset**, for **Omega Habitat**. It is a desktop-first browser doorway to AI agents running natively inside each signed-in person's own Linux account: users can continue their native workspaces and agent conversations through the browser as well as SSH/tmux. The browser is not a new AI platform, model, cloud IDE or separate history store. Initial scope is one host and Pi; don't promise every agent, mobile support, availability guarantees or certified security. The name pairs “native habitat” with Ω as a possible arch/gateway metaphor. The UI is Finnish, with a quiet light/dark design using neutral surfaces and muted teal accents (light #2b7f8c, dark #4fa6b4). These colors are context, not mandatory logo colors.
>
> Recommend one coherent identity direction: an ownable, minimal Ω-derived **open doorway** with a highly legible “Omega Habitat” wordmark. Compare it against a genuinely different, grounded O/H monogram alternative, and explain which is stronger at 16 px and in a desktop header. Avoid generic Greek font glyphs, houses, padlocks, robot heads, clouds, terminals, cosmic effects or imitating existing brands. Provide a large web headline lockup, compact header lockup, independent small navigation mark, 16/32 px favicon and 192/512 px app icon; include light/dark and monochrome/reverse variants. Show actual-pixel tests, 200% browser zoom and narrow desktop header use. Try short English tagline candidates “Your agents, in their native habitat” and “The browser door to native agents”; suggest natural Finnish alternatives, but keep taglines removable and out of small icons.
>
> Return **editable vector originals**, not just mockups or PNGs: clean layered/source vectors (e.g. SVG + editable AI/Figma/Inkscape source), optimized static web SVGs, outlined and editable text versions with font names/licensing, transparent PNG exports, and favicon ICO or multi-size PNG. Include color values, minimum size, clear space, padding/safe area, variant filenames and usage/do-not-use guidance. Measure and report WCAG AA text contrast (4.5:1 normal, 3:1 qualifying large) and relevant non-text contrast (3:1) on actual light/dark backgrounds; check grayscale. Avoid scripts/external resources in web SVGs. Explain any resemblance risk without claiming trademark clearance. Show the choices and ask for approval before treating anything as final.

## Source notes for maintainers (not claims for publication)

Product scope and honest limitations: `docs/product.md` (MVP, native continuity, first-version exclusions) and root `AGENTS.md` (Unix separation and native components). Name meaning and collision note: `issues/rename-omega-habitat/item.md` (the rename is separate work). UI fit: `design-system/AGENTS.md`, `design-system/production-v1.md` and `design-system/tokens/colors.css` (desktop-first, Finnish UI, light/dark theme, restrained accent, accessibility); the token values are current integration context and may change. This brief makes no claim of a verified trademark, approved tagline or completed product capability.
