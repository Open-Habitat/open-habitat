# alice-05-shipping-banner

Alice · 09:44 · “Who put that banner on the site, and why?”

## What the reader sees

A view beside the conversation with Example Studio's shop page in a small
browser frame, the green banner on top now reading “Free shipping over €30
until Sunday 22 November”, and under it the site's history as four entries:
whose agent, when, what, and the person's own words. Bob's reason from Tuesday
is the marked one; Alice's change from this morning is on top.

## What changed and why

- **The view is new.** Round 6 had only the conversation. The question is
  about a page and its history, so both are now shown: the page so the reader
  sees what “the banner” is, the history because it is the answer.
- **The history is a real one.** `assets.mjs` builds a Git repository with the
  shop page and four commits (Carol twice, Bob's agent on Tue 17 Nov 16:42,
  Alice's agent on Thu 19 Nov 09:49). Names, dates and messages are fixed, so
  the hashes are the same on every run. The tool outputs in `block.js` (`git
  log -S`, `git show`, `git commit`, `git push`) are git's own output from that
  repository, pasted. One line is not: `To gitea.example.org:studio/shop.git`
  replaces the path of the local bare repository the script pushes to.
- **The pictures are that repository's page at HEAD**, rendered with Chromium.
  The banner text in the picture is the committed `site/_includes/banner.html`.
- **Copy.** The left-hand text now leads with the point (“Nobody remembers,
  but the site does”) and ends on the yes. The first reply quotes Bob's words
  from the commit instead of paraphrasing them. The second reply shows the
  one-line diff in the reply card (visible without Show work) and says that
  only she sees the change so far. The last reply says what the history now
  holds.
- **Times.** The first message moved from 09:40 to 09:43 and the durations are
  now 38 s, 46 s and 21 s: looking up a line in a Git history does not take
  five minutes. The reply still lands at 09:44.
- **Work worth opening.** Turn 1: one thought, `git log -S` and `git show` of
  Bob's commit. Turn 2: the edit and `git diff --stat`. Turn 3: the commit and
  the push.

## Assets

`node blocks/alice-05-shipping-banner/assets.mjs` (needs git, ImageMagick,
`PROTO_WEB` for Playwright's Chromium; `TMPDIR` set to scratch) writes into
`$ETUSIVU_ASSETS/alice-05-shipping-banner/`:

| File | What | Made with |
|---|---|---|
| `shop-wide.webp` | 1200 × 1000, 95 KB | the page at 600 CSS px, device scale 2, Chromium 1243 (Playwright), `convert -quality 86` |
| `shop-narrow.webp` | 720 × 1120, 57 KB | the same page at 360 CSS px |

The script also prints the git output that `block.js` quotes. If the page or
a commit message changes, the hashes change: paste the new output into
`block.js` (`LOG`, `SHOWN`, `COMMIT`, `PUSH`, `HISTORY`).

The shop page is drawn for this block: HTML and CSS in `assets.mjs`, four
block-print repeats (Fern, Rowan, Birch, Frost) as SVG patterns on a woven
ground made with `feTurbulence`. It is a mock of a shop, rendered for real.

## Sources and licenses

- Instrument Sans in the shop page: the repository's own bundled copy
  (`design-system/fonts/instrument-sans-latin.woff2`, SIL Open Font License
  1.1, `design-system/fonts/instrument-sans-OFL.txt`). It is rendered into the
  pictures; the font file is not shipped by this block.
- No other third-party material.

## Assumptions about the product

- The agent's commits carry the author “Bob (agent)”, and the person's request
  is quoted in the commit body. That is a convention of a well-configured
  environment (an instruction in the workspace's `AGENTS.md`), not something
  Open Habitat does by itself: git records whatever identity the account uses.
- The view shows a preview the agent built of the site; “Published 09:50” in
  the frame is the state at the end of the conversation.
- Publishing is a `git push` to the shop's own Gitea, on her “Yes”.

## For the owner of `alice-day`

The sidebar's first segment for this conversation starts at 09:40 (“Reading
the site's history”). The message is now at 09:43; `['09:43', 'run', …]`
would match. Nothing breaks if it stays.

## For Jari

- On the desktop the sticky screen is anchored to its bottom, and this view is
  about as tall as the screen, so on arrival the reader sees the page and the
  history, and scrolls up for the conversation. If the conversation should
  show first, the history could lose Carol's two entries.

## Engine needs

- A view cannot say it is a page preview: `view()` always shows the file icon
  and “View · Only for you”. A `kind` with its own icon (a globe for a site)
  would let the frame inside the view go.
