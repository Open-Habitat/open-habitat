# alice-01-whats-waiting

Alice · 08:04 · What’s waiting today.

## What changed and why

- **The result is now a page in the view (`today.html`)**, not a numbered
  list in the reply. The page is laid out for a founder reading it with her
  first coffee. At the top is the day as one bar from 08 to 18: a “now” tick
  at 08:04, planning at 10:15 (“record it”, which came from the calendar note)
  and packing at 15:40. Below it are the five things in order of urgency, with
  the date ones tagged (`By Friday`, `Today`, `1 Dec`). A last line says why
  the other 12 mails can wait.
- **Every line is traceable.** Each item carries a source tag in mono:
  `Kirsi · 06:50`, `Bob · 07:31 · csv`, `open.md:4`, `17 files`,
  `Calendar · 2 events`, `12 more`. Each tag matches a row in the work
  (`notes/open.md` line numbers, the mail list, the calendar output, the grep).
- **The work is worth opening**: one thought and five tools. The notes file
  is shown verbatim. The mail search lists all 14 messages (the 12 that can
  wait are really in it). Then the calendar, a
  `grep -rl "14 days" handbook/ site/ | cut -d/ -f1 | uniq -c` showing
  1 handbook file + 16 site files (this matches alice-08’s “17 pages”), and
  the written `today.html`.
- The reply is two lines; the page is the result. The left-hand copy says
  what the reader gets: one short page, and beside every line where it came
  from.
- **Sized to the sticky screen.** The engine anchors the sticky screen to its
  bottom, and below 640 px of container width a view stacks under the
  conversation. So the page is kept short enough that the summary row
  (“Show work”), the reply and the whole view fit at 1440 × 900.

## Assets

None. The view is HTML/CSS in `block.js` and `block.css` (design-system
tokens only). It stands for an HTML view the agent wrote, which the product
shows in its sandboxed view frame (`web/src/components/ViewPanel.tsx`).

## Assumptions about the product

- `gog` (a Google Workspace CLI) is installed and signed in to Alice’s own
  mail and calendar, as in round 6; its output here is abridged and plausible,
  not captured.
- The agent can write an HTML file and open it as a view.

## Sources and licenses

No third-party files.

## Engine needs

- **Sticky screen anchoring with a stacked view.** `client.js` scrolls the
  sticky screen to `scrollHeight`. When a view stacks below the conversation
  (container < 640 px, which is the case at 1440 px), a tall view pushes the
  summary row and the reply out of sight. I sized my view to fit, but a
  general fix would help other blocks: anchor so the last turn’s summary row
  stays visible, or scroll to the view’s top.
