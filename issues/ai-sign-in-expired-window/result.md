# Result

Implemented the accepted prototype (round 2 B2 window and short row, round 3 R1).
Not experimental: it changes how an existing failure is shown and repaired.

## What changed

- **Daemon.** `modelAuthFailure` also matches Claude's "Failed to authenticate"
  (recorded bridge text). Branch scans record per provider the latest refusal and
  the latest working reply; the snapshot carries `auth.ai_refused`
  (provider, since): a refusal newer than any later reply from that provider and
  than the provider's credential store (`~/.claude/.credentials.json`, or Pi's
  `auth.json`). History and live entries carry `refused_by` on a refused reply.
  A completed Claude sign-in and a saved key now clear the conversations'
  `pi_auth_failed` and invalidate the snapshot, as the ChatGPT attempt already did.
- **Browser.** Warning above the composer per provider (GitHub warning shape),
  bell item, sign-in window over the conversation (Claude steps start at once;
  ChatGPT device code; key field for OpenAI/Anthropic/DeepSeek) listing the
  waiting messages. Failed turn is one short row. The refused message comes back
  into the field, waits with a line under the field, and goes by itself once the
  provider takes the person back (signed in here, elsewhere, or answering again),
  edited ones as edited, other conversations' from the app even if not open.
  A send while refused waits in the field. Settings: Claude and ChatGPT rows say
  *Hylätty* instead of *Kirjautunut* while the stored sign-in is refused.
- No authority change: same routes, same gateway/daemon/provision split.

## Decisions for later review

- **Refusal end from credential-store mtime.** Pi keeps all its providers in one
  `auth.json`, so saving another key or a ChatGPT token refresh also ends a key
  provider's reported refusal. Alternative: in-memory sign-in records in the
  daemon — rejected because after a restart the refusal would stick and block
  sends. Cost of the chosen error: at most one more refused turn, after which
  the refusal is reported again.
- **Waiting message is a browser draft plus a session-storage marker**, as the
  prototype assumed; no daemon store. Cross-tab duplicates are prevented by the
  send's command ID: a restored message's ID is derived from the conversation,
  the refused reply and the text sent, so two tabs sending the same text send
  once (the daemon never replays a spent ID); differently edited copies both go.
- **Unrelated draft at restore.** If the field already held other text, the
  refused message is put in front and the line says *Muokattu · lähtee itse
  tällaisenaan*, so the whole field going is visible (R1: what the field holds
  goes). Alternative: not arming it — rejected as contrary to R1.
- **Refusal after the agent already worked** (tool calls before the refused
  reply): the message is not restored for automatic resending, since that would
  redo work; the warning and short row still show.
- **Overload/outage (round 2 grey warning) not implemented**: the brief lists
  only sign-in; Pi's own retry handles overload and the classifier does not call
  it a refusal.
- **Rail label "Viesti odottaa kirjautumista" not implemented**; the rail keeps
  its failed mark. Window shows the list of waiting messages (round 3 Q2 was
  unanswered; R1 picture shows it).
- **Claude key through the bridge** (`ANTHROPIC_API_KEY` in Claude Code) is
  reported as the Claude subscription, since the bridge is the provider.

## Verification

- Go: `go test ./internal/daemon/ ./test/browser-host/` pass (new
  `ai_refusal_linux_test.go`); contracts regenerated, `test-focused --area
  contracts` pass.
- Web (after rebase on main): typecheck, biome, 173 files / 1309 tests pass.
- Browser (`OH_PORT_BASE=13400`, 2 workers): `ai-sign-in-window` (2, new),
  `auth-failed-turn` (2), `browser-conversation` auth/unsupported cases (2) pass.
- Evidence (synthetic browser host, AVIF): `evidence/1-odottaa-1440-light`,
  `1-odottaa-390-light`, `2-ikkuna-1440-light`, `3-lahti-1440-light`,
  `4-asetukset-1440-light`.
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) + `/assess-findings`: 6 confirmed defects fixed (background
  send records, text-bound resend ID, held send ID, unrelated draft marking,
  mid-turn replay, Claude cancel during in-flight write); 1 dropped as the
  trade-off above. No issues filed.
- Not verified: real Claude/OpenAI providers, two live tabs, test-server install.
