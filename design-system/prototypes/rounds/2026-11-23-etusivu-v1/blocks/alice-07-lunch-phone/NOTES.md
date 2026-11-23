# alice-07-lunch-phone

Alice · 12:38 · October receipts, continued on her phone at lunch. The morning
half is `alice-03-october-receipts`.

## What the reader sees, and why

- **It looks like the product on a phone.** The ported mock put kit pieces
  outside a `.scr`. `product.css` is scoped to `.scr`, so its icons rendered
  at full width (a giant check mark and copy icon). The phone is now a frame
  (status bar with 12:38, island, home bar) around a `.scr` that holds:
  - the product's slim mobile header: a menu button whose badge says three
    conversations wait for her (the drawer, as in `AdaptiveRail`), the
    conversation's mark in its waiting state, the title and the organisation;
  - the conversation, drawn with the kit (`reply`, `you`, `turn`, `tool`,
    `drafts`);
  - the composer, with the dictation mic and the send button.
- **Summary on return.** The morning's reply waits at the top of the
  conversation: 23 of 26 filed, the folder as one line, and the three
  questions. No invented "while you were away" panel was added, because the
  product has none. Returning means reading the last reply.
- **Dictated answer.** Alice's message carries the product's quiet "Dictated"
  note.
- **The second mailbox.** Show work, 3 tools · 1 min 52 s, holds four rows:
  - `himalaya envelope search -a info from:fjord` finds invoice FF-10291 in
    the info@ mailbox;
  - the matcher from the morning runs with `--mail ~/Mail/info --only "Fjord
    Fonts"`, and prints its real output (`RUNS.fjord`, checked by
    alice-03's `assets.mjs`);
  - a one-line `no-receipt.txt` records the parking charge;
  - the mail to Bob is shown as sent. Alice's "ask him" is her yes.
- The final reply ends on **24 of 26**, with one waiting for Bob. The ported
  version said "25 of 26 done", which counted the parking charge with no
  receipt as filed.
- The phone has a fixed height. Its feed is anchored to the bottom
  (`column-reverse`), so the newest message shows on arrival without script,
  and it scrolls inside the phone. Tool output scrolls sideways.
- The story is tightened. The returns job working since ten with no open tab
  stays in as the quiet second point. The desktop sidebar shows it running.

## Assets

None of its own. The matcher output comes from alice-03 (see its NOTES).
The himalaya listing is written by hand to agree with the generated Maildir
(one message from Fjord Fonts, invoice FF-10291, 28 Oct); himalaya cannot run
against a fictional account. The listing gives only the date and time and
does not reproduce himalaya's exact table borders.

No third-party material is used.

## Engine needs

None. If the kit gains a phone frame, this block's `lp-*` frame could move
there; the inside is already kit markup.
