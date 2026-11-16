# Result

Both failures were test defects. Neither is a product race: no typed text is
lost or merged, and no notify join goes missing.

## Editor conflict typing (`browser-editor-concurrent.spec.ts:164`)

**Cause.** The spec double-clicked `getByTestId("editor-document").getByText("hei")`.
The Go grammar is a lazily imported chunk. Until it arrives, the line
`println("hei")` is one text node, so the text locator resolves to the whole
`.cm-line` block. At 1366 px that block is about 590 px wide, and its centre
lies past the end of the text. A double-click there selects the closing `")`
(CodeMirror's word group at the line end), and typing `minun` turns the line
into `println("heiminun`. That is exactly the gate's received text,
`println("heiminun	println("agentti")}`, before the agent's line was added.
Under host load the chunk arrives later than the editor mounts, which opens
the window.

**Reproduced.** Holding the grammar chunk with a test route reproduced the
gate's string character for character at both widths. Double-clicking the
`.cm-line` element directly reproduced it too. Every keystroke reached the
document. The editor did what a person's double-click past the line end asks
for.

**Fix.** The new helper `dblclickWord` double-clicks the centre of the word's
own glyphs, located with a DOM Range over the text node. That point is the
same with or without highlighting. The spec also asserts the typed line
(`println("minun")`) right after typing, so a wrong selection now fails at
its cause instead of three steps later.

**Evidence.** The case passed at both widths with the grammar chunk held,
with the line still plain at typing time. The whole spec file passed 25/25:
`--repeat-each=5`, `OH_CPU_THROTTLE=4`, `OH_BROWSER_WORKERS=2`.

## Pinned Pi bridge wake (`TestProcessPinnedPiBridgeAndWake`, "missing native notify join")

**Cause.** After the first settlement, the test asked for the inventory once,
with a 1 s budget, and read any answer as the content check. When the bridge
does not answer in time (a starved Pi node process), `piRPC.inventory`
returns `Availability: unavailable` with no processes. The test then
reported that as a missing notify join. The join itself is deterministic once
Pi answers. pi-processes replies to `request:list` synchronously. The start
result carrying `notify` is written to the session branch at its
`message_end`, well before `agent_settled`. The companion matches it on the
same `startTime` that the record holds. The product treats an unavailable
inventory as transient: the REST read has a 5 s budget, and clients
resnapshot and poll.

**Reproduced.** Stopping the Pi process (SIGSTOP) for 1.5 s before that
query reproduced the gate failure exactly:
`missing native notify join {... Availability:unavailable ... Processes:[]}`.
Plain load alone (up to 20 CPU hogs, two parallel test processes) never hit
it in 100+ runs. In those runs the query took at most about 11 ms, so the
gate needed a long stall, such as the full `-race ./...` suite plus the
browser phase plus another session's job.

**Fix.** The new helper `answered` waits for the first available inventory
(the same 15 s poll the test uses everywhere else), and the unchanged facts
are asserted on that answer. The single-shot queries during the wake turn
("list disturbed run": provider calls still 3) and after `clear` use the same
helper. A bridge that never answers still fails, now naming which query it
was.

**Evidence.** `go test -race -count=50 -run TestProcessPinnedPiBridgeAndWake`
passed 50/50 under 12 CPU hogs (load average about 21). The old test failed
and the new one passed under the same 1.5 s SIGSTOP.

## Not shared

`browser-conversation-repeat-flakes` (5 s `toBeVisible` timeouts in the
conversation spec) involves neither the editor's text targeting nor the
process bridge. It is left as filed.

## Decisions for later review

- **Editor: test fix only.** Alternatives: preload the language grammar with
  the editor chunk, or keep the line hidden until it is highlighted. The
  product behaviour is correct; a late grammar only delays colours, so changing
  the product to suit a test locator would be the wrong direction.
- **The gate log was not available.** The brief named a private log path that
  did not exist on either host. Both causes were derived from the failure
  text in the issue and reproduced as described above.
