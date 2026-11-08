# Result

## Step 1: where size can break a conversation

Read from the code on `fb1c9c0db` and from the installed Pi
(`@earendil-works/pi-coding-agent` 1.3.0 under `/opt/open-habitat/core`).
Pi paths are given relative to that package's `dist/`. "Measured" marks a
number taken on Birch. Everything else comes from reading the code.

The cause found in `recheck-button-unexplained`: Pi writes every image
attachment into the person's message record as base64. One 80 MB record
exceeded the 64 MiB read bound, and the whole history was refused. That
bound now equals the send limit. The remaining cliffs are listed below.

| Path | Limit today | What happens past it | Where the host could notice first |
|---|---|---|---|
| **Attachment, one file** | 20 MiB: `internal/daemon/attachments_linux.go:23`, the browser's own copy at `web/src/app/attachments.ts:20,30` | Refused at upload; the composer shows a bare line (*Valitse 1 tavun – 20 MiB:n tiedosto*), which `proto-attachment-refusal` redesigns | Already at file selection (browser). |
| **Attachments, one message** | 30 files, 100 MiB total: `attachments_linux.go:24,246,267` | Every file uploads first. Then the send is refused with `invalid_attachments` (`conversation_linux.go:1012`), and the draft is kept with the generic text *enintään 30 tiedostoa, yhteensä 100 MiB* | The browser knows every uploaded chip's size and could sum them and say so before Send. No server change needed. |
| **Attachment store** | 1 GiB per person: `attachments_linux.go:25,154` | Upload refused (503/`attachments_unavailable` path); person sees *Liitettä ei tallennettu. Tarkista koko ja vapaa tila.* | Store usage is known at upload; could warn near the quota. |
| **Image in the Pi record** | Pi shrinks each prompt image to at most 2000 px and 4.5 MB of base64 (`core/agent-session.js:1574`, `utils/image-resize-core.js:9-13`), so one message record is at most about 30 × 4.5 MB ≈ 135 MB plus text. Daemon read bound `maxNativeLine = piFrameLimit` ≈ 137 MiB (`native_stream_linux.go:27`, `pi_rpc_linux.go:267`) | Now consistent: whatever the daemon admits stays readable. Before 8.11. a record over 64 MiB made the whole history 503. The image also stays in the session file for good, alongside its copy in `~/attachments` | n/a (bounds agree). |
| **Session file as a whole** | **512 MiB**: `maxHistoryFile`, `history_linux.go:28` | The conversation becomes `unavailable` (`history_linux.go:226`, `conversation_linux.go:1272`). History, recap, notices, archive (`close_linux.go:25`) and rewind (`rewind_linux.go:197`) all refuse it, and once Pi stops (idle stop, daemon restart, upgrade), resume answers `unproven` (`continuation_linux.go:88`). **The conversation is then stuck for good.** The product's own limits reach this: four maximal sends (4 × ~133 MiB), about six of Jari's 20-screenshot messages (80 MB each), or roughly 115 images the agent reads at 4.5 MB each. Pi's compaction does not shrink the file, which only grows | The size is in every snapshot already (`info.Size()`). The host could warn at, say, 75 %, refuse a send that would cross the line (its base64 size is known at admission), and read the tail instead of refusing the whole file. **Filed for scheduling, see below.** |
| **History page** | Browser body ≤ 2 MiB (`web/src/app/history.ts:145`); page budget `historyPageBudget` 2 MiB − 128 KiB, 1000 entries, 200 messages (`history_linux.go:522-524`); entry text cut to a 16 KiB prefix with *read more* (`history_blocks_linux.go:241-252`); images are references, read separately in 1 MiB chunks (`history_linux.go:525,728`) | A huge entry does not overflow a page. It costs time and memory instead: every page decodes the whole record (measured earlier: 0.9 s and 480 MiB allocated for the 80 MB record; a bare `encoding/json` decode measured here at 0.4 s/187 MiB for 93 MiB and 1.1 s/280 MiB for 140 MiB). Each page also hashes the whole file (`history_window_linux.go:78`), so a page costs O(file size) | Skip image `data` while decoding (stream the record and keep only `mimeType`), and remember the hash for an unchanged file stamp. Both are engineering work and invisible to the person. |
| **Large tool output, file read by the agent** | Pi truncates `read`, `bash`, `grep`, `find`, `ls` output to 2000 lines or 50 KB (`core/tools/truncate.js:10-11`); an image read by the agent is shrunk like a prompt image. Live: 4 KiB deltas, 16 KiB per tail frame, 1 MiB tail (`events_linux.go:304-308`); a Pi frame over 1 MiB is reduced before the browser (`pi_rpc_linux.go:308,470-480`) | Text never grows huge, either in history or live. **Images do:** every screenshot or image the agent opens is up to 4.5 MB in the session for good, and that is the realistic way a long agent run reaches the 512 MiB cliff. MCP tool results: `@earendil-works/pi-mcp` has no truncation of its own (not measured) | Habitat sees each image-bearing tool result in the live stream and the session size in the snapshot, so it can count image bytes per turn. Telling the agent (a notice) is possible. Pi itself offers no hook to refuse. |
| **Model request** | Provider request-size limits (Anthropic answers `request_too_large`, HTTP 413). Pi recognizes it as context overflow (`pi-ai/dist/utils/overflow.js:38`) and compacts | Every request after a big image message re-sends all images in context until compaction, so 80 MB of screenshots exceeds the request limit at the next turn. Pi compacts and the images drop out of context. Not reproduced here (would need a real provider) | Host could show that the agent "dropped the images" when it sees compaction after an image turn. Low value until observed. |
| **File and folder offers** | 200 files, 512 MiB, 20 sources (`fileoffers_linux.go:53-55`); text counted up to 16 MiB (`:60`); HTML views 500 files, 50 MiB (`views_linux.go:43-44`) | The agent's `offer` command gets `413 file_offer_too_large`/`file_offer_too_many_files` and must explain it. The person sees nothing (no card). A large offer is copied into the person's file store, so its disk cost is paid at once | Already refused up front, before anything is copied; fine. |
| **Native Pi frame** | `piFrameLimit` ≈ 137 MiB (`pi_rpc_linux.go:267,291`); aggregate end events are drained without keeping the line | An oversized frame ends the Pi channel (*an oversized frame from Pi*): the turn stops and the conversation must be woken again. Since the frame bound equals the admitted send, it is reachable only through a Pi echo larger than the send | n/a. |
| **Gateway** | Request 32 MiB in general, 8/20 MiB on named routes, responses 8–32 MiB (`internal/gateway/proxy_linux.go:22,165-171,287-294`) | 413 at the gateway. Attachments go one file at a time (≤ 20 MiB), so the person cannot hit this through normal use | n/a. |
| **Host memory** | The daemon unit has no memory limit (no `Memory*` in `systemd/`). Pi holds the whole session in memory (`core/session-manager.js:325`) | A history page allocates about 6× the largest record (480 MiB for 80 MB). Parallel readers (history page, recap, tail proof, snapshot) add up. Pi with a 500 MiB session holds roughly that much again on its heap. Birch has 32 GB; the test VM's memory was not checked | Reading the tail and skipping image payloads (above) removes most of it. No new store or cache is needed. |
| **Disk** | The person's ext4 quota (Birch 64 GiB) | A full quota cuts Pi's write mid-record; the daemon now removes such a cut tail on resume (`history_tail_linux.go`) | Storage pressure is already shown (`web/src/app/StoragePressure.tsx`). |

### What follows

- The person mostly meets the problem through **pictures**: their own
  attachments and the agent's screenshots. Text is cut short by Pi and
  bounded again by the host at every step.
- The only remaining hard cliff in a conversation is the **512 MiB session
  file**. Past it the conversation cannot be read, archived or continued.
  This is a defect independent of the design question, filed through intake
  as `session-over-512mib-stuck` (unlaned) for the conductor.
- The second visible point is the **send-time refusal**, which comes only
  after every file has been uploaded.
- The cost of a huge record (time and memory per history page) is invisible
  engineering. Fix it when it bites; no design needed.

## Step 2: prototype round 1

`prototype/index.html` is a single self-contained page (tokens and fonts
inlined, built by `prototype/build.mjs` from `prototype/src.html`). It shows
the same conversation three times. One line per direction at the top says
what differs. Each direction shows the same four moments: the huge entry in
history, the agent bringing in many images, sending too much, and a
conversation that is already too heavy. Light and dark follow the system,
with a toggle at the top. It works at 1440 and at 390. Screenshots:
`evidence/round-1-*.avif`. Headless Chromium at 1440 and 390, light and
dark: no console errors and no horizontal overflow. Offered with
`open-habitat agent view offer --current` (view `vhdb33wzc3ogoxknnlccm57lxpp`,
in the conversation that launched this run).

Axis: **when Habitat steps in about size.**

- **A Ennakoi**: sizes are always visible (attachment total, the
  conversation's size against its limit in the header), and Habitat warns
  in advance at 75 %.
- **B Siirrä sivuun**: Habitat keeps heavy content out of the conversation.
  A large batch of pictures goes to the agent as a folder it opens when
  needed, so the send is not refused. History shows image runs collapsed
  into one strip, and Habitat tells the agent when its pictures pile up.
- **C Vasta rajalla**: no meters. Habitat says nothing until something
  actually stops, and then it says exactly what, for which file and what to
  do. History always opens, from the newest messages if need be.

Host facts the views assume: session file size and the 512 MiB line
(already in the snapshot); the attachment chips' sizes (already in the
browser); image bytes per turn (counted from the live stream, new). B
assumes a new send mode in which attachments over a threshold reach Pi as
paths, not inline images; Pi already reads image files through its `read`
tool. C assumes the host can read a conversation over its limit from its
tail, which the filed defect would provide.

## Decisions for later review

- **Prototype page without the picker.** Alternative: the library's picker
  (`design-system/prototypes/lib/picker.js`), one direction at a time.
  Chosen: the three directions stacked one after another, because the round
  must show every difference on the default view. The picker would have
  hidden two of them.
- **Hand-built page on the tokens, not production components.** The views
  are new states of existing components (`WarningBanner`, the attachment
  chips, the history bubble). Building them through the lab would have
  needed product code changes, which this task excludes.
- **Overlap with `proto-attachment-refusal`.** The look and wording of the
  refusal belong to that round. Here the refusal is only one of the four
  moments, and every direction uses the shared danger warning so the two
  rounds do not contradict each other.
- **Filed the 512 MiB cliff as a defect** rather than leaving it only as a
  question, because it strands a conversation for good with the product's
  own limits, whichever direction Jari picks.

## Kysymykset Jarille

1. Kumpi suunta: **A Ennakoi** (koot aina näkyvissä ja varoitus etukäteen),
   **B Siirrä sivuun** (isot kuvaerät agentille kansiona, historiassa kuvat
   kokoon taitettuna) vai **C Vasta rajalla** (ei mittareita, tarkka viesti
   vasta kun jokin pysähtyy)?
2. Saako Habitat lähettää ison kuvaerän agentille kansiona eikä kuvina
   viestissä (B)? Silloin agentti ei välttämättä katso jokaista kuvaa, ellei
   sitä pyydetä.
3. Pitääkö keskustelun koko näkyä otsakkeessa koko ajan (A), vai vain kun
   raja lähestyy?
4. Kun keskustelu on liian suuri: riittääkö "näytetään uusimmat viestit,
   jatka uudessa keskustelussa", vai haluatko vanhemmatkin viestit esiin
   jollakin tavalla?

**Suositus: C, ja siihen A:sta lähetyksen esitarkistus.** Kuvien
yhteiskoko lasketaan selaimessa jo ennen Lähetä-painiketta, ja yksi
varoitus tulee, kun keskustelu on lähellä rajaa. Perustelu: koko tulee
vastaan harvoin, ja silloinkin melkein aina kuvien takia. Pysyvä mittari
olisi jatkuvaa hälyä harvinaisen asian vuoksi. B:n kansiolähetys muuttaisi
sitä, mitä agentti viestistä näkee, ja se on isompi päätös kuin tämä
ongelma vaatii. 512 MiB:n raja on joka tapauksessa korjattava
(`session-over-512mib-stuck`).

## Jarin päätös (8.11.2026)

Suosituksen mukaan: **C Vasta rajalla, ja siihen A:sta lähetyksen
esitarkistus**. Siis ei kansiolähetystä (B), ei pysyvää kokomittaria;
yksi varoitus kun keskustelu lähestyy rajaa; liian suuri keskustelu avautuu
uusimmista viesteistä ja ohjaa jatkamaan uudessa keskustelussa. Tämä
prototyyppi on toteutuksen määrittely (`large-content-graceful`).
