# The block contract (landing page v1)

You polish one block of the Open Habitat landing page. The page goes live
soon, and about twenty people like you work on it at the same time, one
block each. That only works if you touch nothing but your own block's files.
This page is everything you need; `NOTES.md` beside it says how the page as a
whole is put together.

## What a block is and what you own

The page is a demo of a well-used, well-configured Open Habitat at a small
fictional company, Example Studio. It runs top to bottom: the hero, Alice's
Thursday (twelve glimpses under one sticky product screen), her six
colleagues (“Same place, other work”), the capability groups after the
library intro, and the install stub. Each of these pieces is a block, and
`blocks/index.js` holds their order.

Your block is the directory `blocks/<your-id>/`, and you own exactly these
files in it:

| File | What it is |
|---|---|
| `block.js` | The block's content: its data and the functions that draw its screen. Required. |
| `block.css` | Your styles. Every selector starts with `[data-block="<your-id>"]`; a `@keyframes` name contains your id. The build refuses anything else. |
| `client.js` | Optional browser behaviour (a button in your view). Listen on `document` and match only inside `[data-block="<your-id>"]`: your screen also appears as a copy in the sticky screen. |
| `assets.mjs` | Optional script that makes your binary files (below). |
| `NOTES.md` | What you made and how, the source and licence of every third-party file, and “Engine needs”. |

Everything else is shared and not yours to edit: `engine/` (kit, story
engine, CSS), `blocks/index.js`, `build.mjs`, `check.mjs`, this file,
`NOTES.md`, other blocks. If the engine lacks something, write it into your
NOTES.md under **Engine needs** and solve it inside your block as far as you
can (your own markup and `block.css`, your own `client.js`). The conductor
collects those and changes the engine once.

## The kinds of block

All block files are ES modules that run at build time in Node. Every draw
function returns an HTML string; the page is rendered before it reaches the
browser, so its text reads without JavaScript.

- **Glimpse** (`alice-01` … `alice-12`): one moment of Alice's day.
  `{ id, kind: 'glimpse', day: 'alice', s, at, ask, did, screen }`. `s` is the
  conversation it belongs to and `at` the time shown; `ask` is the request in
  her words (the big quote), `did` the story under it, `screen()` the product
  screen. The conversations and their sidebar states belong to `alice-day`
  (`person.sess`); ask its owner if your sidebar line must change.
- **Role** (`role-bob` … `role-frank`): one person's whole day,
  `{ id, kind: 'role', day: { id, name, role, org, color, blurb, places, sess, g } }`.
  `g` holds their glimpses; `pick: 1` marks the three the page shows, the others are
  reached by clicking the sidebar. `hand` is the line about a file passed to a colleague.
- **Capability group** (`caps-*`): `{ id, kind: 'caps', group, caps, show, full, inDay }`.
  `caps` rows are `[n, group, title, program, who, org, ask, result]`; `show`
  lists the ones drawn in full (in order) and `full[n]()` draws each screen;
  `inDay` maps a capability already shown in someone's day to
  `[person, conversation]`, and the page draws a line pointing there; the
  rest go into the list the reader opens.
- **Section** (`hero`, `roles-intro`, `library-intro`, `install`): `{ id, kind: 'section', html(ctx) }`.
- **Day** (`alice-day`): Alice herself, her places and conversations, the intro and the end.

## Drawing the screen: the kit

Import from `../../engine/kit.mjs`. The pieces copy the product's own markup
and CSS, so the page looks like Open Habitat, not like a drawing of it. Do
not draw messages, turns or tool rows yourself.

```js
import { screen, you, turn, tool, thought, offer, workers, view, att, diff, drafts, image, video, assets } from '../../engine/kit.mjs';
const asset = assets(import.meta.url);

screen: () => screen('Market video',
  you('08:20', 'Cut Saturday’s clips into a 30-second video…', att('stall.mov', 'Video · 4K')) +
  turn({
    thoughts: ['Checking whether ffmpeg is installed'],
    tools: [
      tool('bash', 'ffmpeg -version', 'bash: ffmpeg: command not found'),
      tool('write', 'video/captions.srt', '5 captions', 'new · 12 lines'),
    ],
    time: '42 min 10 s',
    reply: 'A 30-second cut with five captions. It is open beside this conversation.',
    extra: offer('market-30s.mp4', 'Video · 30 s · 14 MB'),
  }),
  view('market-30s.mp4', video(asset('market-30s.mp4'), { poster: asset('market-30s.webp'), w: 1280, h: 720, label: 'The market video' })),
)
```

- `screen(title, body, view?, org?)`: one conversation in a slim product window, with a view beside it.
- `you(time, text, extra?, note?)`: the person's message (Markdown). `note` is a quiet line under it, such as `${MIC_IC}Dictated` or “Sent while it worked”.
- `turn({ thoughts, tools, time, summary, reply, extra, interim, panel })`: one
  settled agent turn, **closed as in the product**. The reader sees the summary
  row (“1 thought · 3 tools · 42 min 10 s”, counted for you; `summary`
  overrides the count) and the reply card; clicking the row shows the
  timeline, where each tool row is closed again and opens on its own.
  `interim: { thoughts, tools, time, text }` is an earlier stage that ended
  in an interim reply. `tools` may also hold plain HTML (`diff()`, `drafts()`).
  `extra` goes inside the reply card (an offered file, a diff); `panel` under
  the turn, open (`workers()`). Write `time` in the product's format:
  `14 s`, `3 min 05 s`, `1 h 32 min`.
- `tool(name, target, output?, stat?)`: a finished tool row. `stat` is the quiet file stat (“new · 45 lines”).
- `thought(text)`: one line of reasoning (also accepted as a plain string in `thoughts`).
- `offer(name, meta)`: the file the agent offers for download.
- `workers([[state, name, task, progress], …])`: the workers panel; state `done` or `run`.
- `view(title, html, kind?)`: the panel beside the conversation (`kind` “View”, “Live”…).
- `att(name, meta)`, `diff(file, lines, label?)`, `drafts(rows)`, `reply(text)`, `working(time, ask, line)`.
- `image(src, alt, w, h)` and `video(src, { poster, w, h, label })`: your assets in the view.
- `md`, `esc`, `inline`, `mark(px, state)` and the icons `FILE_IC`, `MAIL_IC`, `MIC_IC`, `SKILL_IC`.

`engine/views.mjs` holds the few round-6 mock views several blocks share
(`sw`, `toggles`, `sheetMock`…), and `engine/views.css` the round-6 view
styles. Views only your block used have been moved into your `block.js`;
change or replace them freely. A replacement gets new class names styled in
your `block.css`. A toggle inside a view works without code: a container
with `data-view data-state="a"` and buttons `data-set="a|b"` (see `toggles()`).

The product's reference: `docs/assets/readme/agent-at-work.png`, `view.png`,
`workers.png`, `your-turn.png`, and `web/src/components/` (`AgentTurn.tsx`,
`Conversation.tsx`, `OfferCard.tsx`, `AdaptiveRail.tsx`). If something in the
kit looks different from those, that is an engine need, not something to
patch in your block.

## Assets: real files, outside git

The repository is public and does not take binaries. Your files live in
`$ETUSIVU_ASSETS/<your-id>/` (default
`~/src/open-habitat-dev/worker-results/etusivu-assets/<your-id>/`). Refer to
them only through `asset('name.ext')`; the build copies the directory to
`<out>/assets/<your-id>/` and fails if a referenced file is missing. Nothing
big is inlined into the HTML.

`assets.mjs` makes them reproducibly: it reads its inputs, runs the real
program and writes into `$ETUSIVU_ASSETS/<your-id>/`. Commit the script, never
its output. `blocks/hero/assets.mjs` is a small example. The build runs your
script when the directory does not exist yet.

**Budgets**, enforced by `check.mjs`:

| What | Format | Limit |
|---|---|---|
| Image | WebP or AVIF (SVG for drawings) | 300 KB each |
| Video | MP4, H.264, with a WebP poster; `-movflags +faststart`, no audio track unless it matters | 2 MB each |
| Other (`.vtt`, `.glb`, `.json`, `.csv`, `.pdf`) | | 500 KB each |
| Whole block | | 4 MB |

Every file in your asset directory must be used by the block (it ships
otherwise). Size images for the view they sit in: the view is at most about
600 CSS px wide, so 1200 px wide is plenty.

## Building and checking your block

```
cd design-system/prototypes/rounds/2026-11-23-etusivu-v1
S=/var/tmp/agent-scratch/<your-unique-dir>; mkdir -p $S
export TMPDIR=$S PROTO_WEB=<a web/ dir with node_modules, e.g. ~/src/open-habitat/web>
node build.mjs --only <your-id> $S/out
node check.mjs --only <your-id> $S/out $S/shots
```

`--only` builds a page with your block alone (no hero). The check opens it at
1440 and 390 px with reduced motion, clicks every stage (Show work and Hide
work), every tool row and every button in your screen, checks that nothing
is open on arrival, that the console is clean, that nothing loads from
outside, that the text reads without JavaScript, and your asset budget. It
writes screenshots of every step closed and open at both widths: look at
them at full size before you stop. Without `--only` the same commands build
and check the whole page.

## The content rules (binding)

These come from round 6's NOTES and the conductor. They are not style
preferences.

- **The page is a demo and marketing material.** It shows what a well-used
  and well-configured environment can do, also beyond what ships, but never
  anything it cannot do. No comparison with other products or with other ways
  of using AI: it shows, it does not argue.
- No onboarding, installation or connecting a subscription in the scenes.
  Nothing is sent outside without the person's yes. No writes to Trello,
  Slack, Teams, Jira, Confluence or SharePoint. No scheduled runs. English.
- **Fictional frame only:** Example Studio, its seven people (Alice, Bob,
  Kirsi, Carol, Dave, Erin, Frank), invented shops, schools and clubs,
  `example.org`. Nothing from the private use-case reports beyond their
  fictional examples. No real people, customers, hosts or addresses.
- **Graphics and media are real and look good.** When a block shows what a
  program does (Blender, ffmpeg, R, Tesseract, QGIS, rembg…), the picture or
  video is made by that program wherever possible: download the program into
  your scratch directory (Blender's official Linux tarball; ffmpeg is
  installed; R via micromamba) and render with `assets.mjs`. Not an endless
  farm of programs, but the showpiece is real.
- Third-party material (a project's own marketing images, demo files, stock
  footage) only with a licence that permits reuse and modification (CC0,
  CC-BY, the project's explicit permission). Source, licence and attribution
  go into your NOTES.md. Never hotlink: the page loads nothing from anywhere
  else.
- **Style:** the block sells. The story first, then the result shown at its
  best. Keep to the design-system tokens (`var(--ah-…)`) and the product's
  look; your own visual inside the view may have its own style (a render is a
  render).
- A claim that a program leads its field only with a source and a quoted
  sentence (round 6 NOTES, “Claims to verify”: FFmpeg, SQLite, QGIS, Git). No
  new claim without a source and a quotation.
- Scratch under `/var/tmp/agent-scratch/<unique>` with `TMPDIR` set there,
  never `/tmp`. Never commit binaries or anything under `worker-results/`.
- Do not touch shared files (above). Engine needs go into your NOTES.md.
