# Result: a bell in the top bar for announcements

Round 1, 29.10.2026. Prototype:
`issues/proto-notification-bell/prototypes/kello/index.html` (hand-written source
`page.html`, assembled by `build.mjs`, checked by `verify.mjs`), with Jari's
guide in [NOTES.md](prototypes/kello/NOTES.md). Screenshots (AVIF, device scale
factor 2) are in `prototypes/kello/evidence/`.

## What the product announces today

| Announcement | Where it shows now | Scope | Behind the bell? |
| --- | --- | --- | --- |
| Storage near full / full | App-wide strip above the shell (`StoragePressureNotice`, `web/src/app/StoragePressure.tsx`, mounted in the `connection` slot at `web/src/app/App.tsx:2728`) | Account | **Yes** |
| New version available | Same slot (`NewVersionBanner`, `web/src/components/Status.tsx:276`; check in `web/src/app/bundleRelease.ts`) | This tab | **Yes**, keeps *Myöhemmin* |
| GitHub connection expired / missing / failing | Same slot outside conversations; above the composer inside one (`web/src/app/GitHubConnectionNotice.tsx`) | Account | **Yes**, and it stays above the composer too |
| Server quotas exceed the disk (admin) | Only on Asetukset › Palvelin (`web/src/app/ServerAdministration.tsx:178`) | Server | **Yes, admins only** (new placement) |
| Connection lost / stale / sign-in needed | Same slot (`ConnectionBanner`, `web/src/components/Status.tsx:162`) | This tab | **No.** When the page is offline, the bell's own facts are stale too |
| Archive / Trash / mode undo | Top-bar notice row (`web/src/components/NoticeArea.tsx`) | One action | **No.** Undo is time-bound and already sits in the top bar |
| Pi restarted (restart card) | In the conversation history (`web/src/components/RestartNotice.tsx`, payload from `internal/daemon/events_linux.go:652`) | One conversation | **No.** It belongs at the point in the thread where it happened |
| Agent notice (`oh-agent-notice`) | In the conversation history (`web/src/components/AgentNotice.tsx`, `internal/daemon/notices_linux.go`) | One conversation | **No**, same reason |
| Extension `notify` | Live card in the conversation (`extension.visible`, `internal/daemon/pi_events_linux.go:363`, `web/src/app/conversationEvents.ts:363`) | One conversation | **No.** Jari ruled plugin status out of the top bar |

So the bell gathers **account- and server-wide conditions**, the ones that
today stack as strips above everything. Conversation-scoped events stay in
the conversation.

## Axis and directions

**Axis: how an announcement shows up and how it is dismissed.** Content, top
bar, panel layout and actions are the same in every direction. A page control
switches between nothing, storage near full, storage full, and several at
once. Event buttons publish a version, fill the disk or free space, so you can
see an arrival and a resolution.

| Direction | Bell present | Unread | Dismissal | Serious item (storage full, GitHub expired) |
| --- | --- | --- | --- | --- |
| **Tila** | Only while something holds | None; the number counts what holds now; the bell swings once when something arrives | None. An item leaves when its condition clears (version keeps *Myöhemmin*) | The bell turns into a red pill with words (*Tila täynnä*) |
| **Saapuneet** | Always | Count of unseen; opening marks them seen; *Uusi* tag once | × hides it until the condition changes (near full → full returns it); resolved items stay listed with a time until cleared | Red count only |
| **Nosto** | While something holds | Dot when something folded into the bell has not been opened | The top item peeks as a row under the top bar; warnings and info fold into the bell after 8 s (paused on hover/focus), *Kelloon* folds at once | Row stays until resolved or folded by hand |
| **Nykyinen** (comparison) | — | — | Today's strips | Today's strips |

`verify.mjs` builds the file and runs every direction at 1280 and 390 px in
light and dark. It checks:

- the panel opens; Esc closes it and returns focus to the bell
- no horizontal overflow
- Tila: no bell when nothing holds, resolution empties the panel and removes
  the bell, danger in words, the admin groups, the workspace page placement,
  and an arrival adds to the count
- Saapuneet: unseen counts, ×, resolved entries, and a changed state counting
  as unread again
- Nosto: danger peeks first, the fold, the unread dot, the warning folding
  itself after 8 s, and danger staying put
- Nykyinen: three strips
- the picker passes `picker-check`
- no console errors and no network requests

Result: pass, 16 direction/size/theme cases and 35 screenshots.

## Host facts each direction needs

All three directions show the same items, and every item is a native fact the
browser already reads or the host already serves:

| Fact | Exists? | Where |
| --- | --- | --- |
| Own storage use and limit (or the shared disk without quotas) | Yes, polled every 10 s | `GET /api/v1/account/storage` (`internal/gateway/quota.go:159`), read by `web/src/app/StoragePressure.tsx` |
| Storage full (block-exact) | Yes, derived | `full` in `StoragePressureProvider` (`web/src/app/StoragePressure.tsx:71`) |
| Newer bundle served | Yes, derived | `web/src/app/bundleRelease.ts` compares the served `/` with this tab |
| *Myöhemmin* for this version | Yes, tab memory | `dismissBundlePrompt` (`web/src/app/bundleRelease.ts:108`) |
| GitHub connection state | Yes | Snapshot `auth.native_github` (`web/src/app/App.tsx:1021`), mapped by `githubFault` (`web/src/app/githubConnection.ts:94`) |
| Server quota overcommit (admin) | Endpoint exists; **new read in the shell** | `GET /api/v1/server/storage` (`internal/gateway/server.go:61`), today read only by `ServerAdministration.tsx`; the shell would poll it for administrators |
| Time an item appeared ("klo 14.06") | **No.** The host does not say when a condition began | The prototype shows the time the browser first saw it. Production can show that, or drop the time |

Per direction:

- **Tila** needs nothing else. The bell is a function of the facts above, and
  nothing is stored.
- **Nosto** needs per-tab memory of which items have been folded (React
  state). Nothing persists across reloads; a reload peeks again.
- **Saapuneet** needs a *seen* and *dismissed* set and a *resolved* list. In the
  browser they would be `localStorage` per device, so a phone and a laptop
  would disagree about what is unread. Making them agree would need a
  host-side notification store, and we do not add one without a concrete
  need. This direction has none: every item is a live condition with its own
  truth.

**No notification store is added in any direction.**

## Recommendation

**Tila.** Reasons:

- It is what Jari described: a bell that is there when there is something to
  say and opens what it is about.
- It is the only direction where the bell is pure presentation of native
  facts: no seen state, no history, nothing that can drift from the host.
- Storage-full stays readable without opening anything. That matters because
  when storage is full the conversation hides its own error notices on
  purpose (`web/src/app/BrowserConversation.tsx:1240,1753,1967,2119`) and
  leans on the app-wide notice for the cause. The red pill now carries that
  explanation.
- On a phone the bar costs one button instead of half the screen
  (Nykyinen, *Useita*).

Nosto is the runner-up. It suits a person who never looks at the bar, but its
timer and motion add a moving part for conditions that usually change slowly.
Its persistent danger row brings the strip back exactly when the screen is
most crowded. Saapuneet treats conditions as messages, so it needs a record
and a dismissal model that the facts do not need. A dismissed "storage full"
is still full.

Implementation sketch if chosen: one `NotificationBell` in the conversation
header's right group (`web/src/components/Navigation.tsx`, before the info
button) and in the page heads that replace the top bar (workspace page
`web/src/app/WorkspacePage.tsx`, Etusivu, Asetukset). It reads the existing
`useStoragePressure`, bundle state and GitHub fault. The three strips leave
the `connection` slot; `ConnectionBanner` stays there.

## Decisions for later review

- **What goes behind the bell:** storage, new version, GitHub, and
  server overcommit for admins. Alternative: storage only, as in Jari's
  example. All four are account- or server-wide conditions that stack the
  same way today.
- **The GitHub warning stays above the composer too.** Alternative: only in
  the bell. The composer placement explains a failing push at the point of
  use.
- **Server overcommit enters the bell for administrators.** Alternative: keep
  it only in Asetukset › Palvelin. It is the one item that needs a new read
  in the shell.
- **The connection banner stays a strip.** The bell cannot vouch for itself
  while the page is offline.
- **The bell lives in each page's own head** (conversation top bar, workspace
  page head; on a phone in the top bar). Alternative: the sidebar head next to
  "open-habitat-test · Yhdistetty", which is the same place on every desktop
  page but is hidden on a phone.
- **Tones follow production:** warning neutral, info accent, danger red. The
  badge is accent unless something is serious. Red stays reserved for errors.
- **Myöhemmin for a new version is kept** in every direction. It is the only
  dismissal that exists today.
- **The 90 % threshold and the texts are production's.** The shared-disk case
  (`limits: not_in_use`, "Palvelimen levy…") is not drawn separately; it is
  the same item with a different title.
- **Time on each item** is when the browser first saw it, because the host
  does not say when a condition started.
- **Nosto folds after 8 s.** Alternative: the undo notices' 20 s
  (`NOTICE_LIFETIME_MS`, `web/src/components/ArchiveNotice.tsx:9`). A fold
  loses nothing, because the item is still in the bell, so it can be
  shorter than an undo window.
- **The bell icon is already used** in the background strip for "agent waits
  for this process" (`web/src/components/BackgroundStrip.tsx:500`). The two
  meanings live in different places. Asked in NOTES.
- **Single-word variant names** (Tila, Saapuneet, Nosto) because the shared
  picker must not wrap at phone width.
