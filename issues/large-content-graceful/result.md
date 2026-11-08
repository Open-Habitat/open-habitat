# Result

Direction C with A's pre-send check, as Jari chose on 8.11.2026
(`proto-large-content-graceful`). Nothing shows size until something
stops. When it does, the message names what stopped and what the person
can do.

## The moments

- **Attachments do not fit one message (③).** Pressing Lähetä checks the
  draft's attachments in the browser before anything is sent. The limits
  are 30 files and 100 Mt counted together, and a file attached twice counts
  once, as the host counts it. A refused send shows the danger warning
  *Viestiä ei lähetetty* above the field with the actual numbers (*6
  liitettä ovat yhteensä 102 Mt, ja yhteen viestiin mahtuu 100 Mt…*). The
  draft and its chips stay. The numbers update as chips are removed, and
  the warning goes once the attachments fit. Picking more than 30 files is
  still refused when they are added, now with the count. A single file
  over 20 Mt is named with its size, and an empty file by name. A full
  1 Gt attachment store gets its own message.
- **The host's refusals got their own codes.** The daemon used to send
  `invalid_attachments` for four different causes. It now sends
  `attachments_too_many`, `attachments_too_large`, `message_too_long`, and
  `invalid_attachments` for an attachment that is no longer stored. The
  browser words each one. The two limit messages say that queued messages'
  attachments count too, because the daemon admits held messages as one
  prompt.
- **The conversation approaches the advised size.** The snapshot now
  carries each conversation's Pi session size (`native_bytes`, read with
  `changed_at`). At 384 MiB the conversation shows one neutral warning,
  *Keskustelu on kasvamassa suureksi*, with *Uusi keskustelu* and *Selvä*.
  Once dismissed, it stays away for that conversation until the page is
  loaded again.
- **A very large conversation (④).** From 512 MiB the warning reads
  *Keskustelu on hyvin suuri*: it opens from the newest messages, older ones
  load slowly, and the agent takes longer to wake. The primary action is
  *Uusi keskustelu*, and the warning cannot be dismissed. The conversation
  stays continuable. History always opened from its newest page with
  *Lataa vanhemmat*, and `session-over-512mib-stuck` removed the size
  cliff.
- **A huge single entry (①).** History image blocks now carry their
  decoded size (`bytes`). The daemon reads it from the base64 length
  without copying the payload. An entry whose pictures total at least
  16 MiB across two or more shows as one dashed row, *20 kuvaa, yhteensä
  60 Mt*, with *Avaa kuvat*. Opening it gives the ordinary per-picture
  rows, each loaded on its own. A person's own attachments keep their
  thumbnails, as before.
- **Defect found and fixed: a large conversation's history timed out.**
  The daemon's Unix server has a five-second write deadline. In the lab a
  530 MiB conversation's history page took 3–7 s to read, so a slower page
  failed as *Historiaa ei saada*. Measured in a unit run: a 640 MiB file
  took 4.1 s for one page, whether read alone or three at once. The
  history handler now gives a read 60 s before its reply, as other long
  native reads already do. The read is still bounded by the record bound
  and the page budget.

Explain-mode cards in both languages: K26 *Keskustelun koko* (the
warning), K27 *Uusi keskustelu*, K28 *Selvä*, K29 *Avaa kuvat*, and V28
*Viestiä ei lähetetty*.

## Evidence

`evidence/` holds synthetic lab captures at device scale factor 2: AVIF
screenshots, each with its static HTML twin. The moments are
`01-kuvat-koottuina`, `03-liikaa-liitteita`, `04-lahestyy-rajaa` and
`05-liian-suuri`, in fi and en-US at 1440 and 390. Two Explain-mode cards,
`06` and `07`, are fi at 1440. `web/lab/capture-large-content-graceful.mjs`
reproduces them. It grows one browser conversation with invented picture
data through the test host's `/fixture/heavy` seam, to 400 MiB and then
530 MiB. Moment ② (the agent opens many pictures) has no notice by
design, so it needs no capture.

Checks: `test-focused.sh` areas web (196 files, 1473 tests), contracts,
`go test` of the history, native, snapshot, attachment and prompt tests of
`internal/daemon`, and the browser spec `attachments.spec.ts`. That spec
now covers the browser refusal and, after a reload when the tab no longer
knows the sizes, the host's own `attachments_too_large` refusal. A full
`internal/daemon` run fails only `TestAgentCommandPathIsPerHomeAndInherited`.
That test compares PATH against this Birch agent account's inherited
`agent-bin` entry, which comes from the environment; this change does not
touch it.

## Decisions for later review

- **What the "history limit" is.** `session-over-512mib-stuck` removed
  the hard limit. I kept 512 MiB as the size where Habitat *advises* a new
  conversation, with the single warning at 75 % (384 MiB), and nothing is
  refused there. The alternative was to refuse sends past it, as the
  prototype's ④ did (*Tätä keskustelua ei voi jatkaa*), but that would put
  back the cliff the previous issue removed. Above about 500 MiB a page
  takes seconds (measured above) and a wake reads the whole file, so the
  advice is real.
- **Pre-send sizes come from this tab's uploads only.** The browser
  remembers each upload's size in memory. A draft restored after a reload
  counts unknown sizes as zero, and the host's refusal, now specific,
  names the limit. Other options were persisting sizes in session storage
  or asking the host for every chip's size. Both add a store or a request
  for a rare case.
- **Size refused at Lähetä, count refused when adding.** Adding beyond 30
  files was already refused, which I kept. The total size is allowed while
  adding and refused at Lähetä, as in the prototype, so the person sees
  every chip and can remove some. The alternative was refusing at upload,
  which would avoid uploading bytes that cannot be sent at once.
- **The near warning's dismissal is in memory.** It returns after a page
  load. A remembered dismissal (session or local storage) would be a new
  kind of browser-held state for a one-line warning.
- **The pictures fold everywhere, not only in very large conversations.**
  The fold depends on the entry, not on the conversation: 16 MiB over at
  least two pictures. Folding only past 512 MiB would make the same message
  look different depending on the conversation's size. Own attachments keep
  their thumbnails, which is moment ① *kuten nyt*.
- **No placeholder for a record over the daemon's record bound.** The
  prototype's ④ placeholder was drawn when an 80 MB record broke a 64 MiB
  bound. The bound now equals the send bound (about 137 MiB), and only a
  Pi echo larger than an admitted send can exceed it. A placeholder would
  need every reader (page, forward, rewind, archive, continuation) to skip
  such a record while still keeping the tree whole. Left as the journal's
  `record_over_bound`.
- **The size reaches the browser as a snapshot fact**
  (`agents[].native_bytes`), not through a new endpoint. Discovery already
  stats the file for `changed_at`.
