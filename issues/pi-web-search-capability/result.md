# Research step result (2026-11-10)

The report is [research.md](research.md). The issue stays open with
`preparation: pending` until Jari's design discussion; the questions for him are at
the end of the report.

## Decisions for later review

- **A live probe instead of a desk-only answer.** I ran one throwaway Pi
  extension against the release's own Pi on Birch, using Jari's Codex
  subscription with no session saved. It settles whether Pi can pass Codex's
  native search through. A desk answer could only have guessed at that.
  Alternative: report it as unverified. No product code changed.
- **The report recommends owning a small native-search extension rather than
  adopting `pi-web-access`.** That package's keyless `auto` fallback (Exa MCP)
  sends queries to a party nobody chose and shares one per-IP limit across
  everyone on an installation. Alternatives: pin `pi-web-access` with a fixed
  provider, or adopt `pi-web-search` (separate-request design). Both are listed
  in the report for Jari.
- **Brave is named as the default key-based backend.** The reasons are its own
  index, its ZDR statement and its price. Staan (EU jurisdiction) is offered as
  the alternative, because its coverage could not be verified first-hand.
