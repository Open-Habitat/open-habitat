# Result

The race was in the test. The spec replaces `EventSource` with a stand-in
that never delivers the controller's own events. After creation the journal
normally holds two `snapshot.invalidated` events. When another one is
journalled after the page's last snapshot (seq 3 in the gate failure), the
page has no reason to read a new snapshot and keeps cursor `…:2`. The test's
own later snapshot carries `…:3`, so a poll waiting for the page's stream to
carry exactly that cursor could never succeed. In the real product the
stream would deliver the event and trigger the snapshot, so the product is
correct.

The spec now clicks the manual refresh after reading its own snapshot. That
snapshot read is no older than the test's, and `journal.resume` reconnects
from it without rewinding. The spec then waits until the stream cursor is on
the same server instance and at least the test snapshot's sequence, instead
of equal to it. The injected frames were already numbered from the page's
own cursor.

Evidence on Cedar's slots: the fixed spec passed 80/80
(`--repeat-each 80 --workers 6`) while the conversation spec ran in parallel,
and the whole lab suite passed 262/262 at `--repeat-each 2`. At this load the
unfixed spec did not reproduce (150/150). A journal probe confirmed the
two-event baseline that the failure's cursor `…:3` went beyond.
