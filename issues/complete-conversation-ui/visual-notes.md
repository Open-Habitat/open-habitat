# Synthetic conversation lab — visual notes

Before/final screenshots (`start`, `answered`, `rejected`, `narrow`) were captured with the standalone lab: production web bundle, real conversation controller, fake Pi, Alice's invented home. Desktop is 1440×900; narrow is 390px. **Not yet reviewed by Jari.** The lab cannot prove real Pi/provider behavior, separate Unix UIDs or behavior on the internet-facing host.

Before: opening a conversation left workspace read-only facts above the feed; every new history in navigation said “Uusi keskustelu”. Rejected send cleared the draft and blocked further sends. Tool results were expanded and raw live events appeared beneath the feed. Narrow-width assistant text clipped horizontally.

Final (after CSS and navigation changes): conversation is the main view; the first user prompt names the sidebar entry; rejected text is retained and can be deliberately resent; tool results are collapsed; raw live events no longer dominate the feed. `final-narrow.png` shows the final text-wrap CSS correction and named navigation links. The final Playwright regression covers reloading, reopening from navigation, a slow second turn, rejection, and crash. Other acceptance criteria (queue/steering, title generation, Markdown/diff rendering, real Pi samples and live disposable agent) remain open under this issue.
