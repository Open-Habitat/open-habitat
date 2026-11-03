---
created: 2026-11-02
updated: 2026-11-03
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed in a targeted synthetic browser stress run
source_ref: taskfleet:01m6edmkt230ekrntx2d59mngd/observed:recap-first-read
originating_run: 01m6edmkt230ekrntx2d59mngd
originating_run_kind: spinoff
lane: recap-draft
lane_seq: 1
preparation: ready
closed: 2026-11-03
---

# First automatic recap can interrupt an unsent draft after the quiet timer

## Description

## Description

An automatic recap first read while the person is composing can appear after the 60-second quiet timer expires, despite an unsent draft. This interrupts composition and depends on whether an earlier empty recap read reached the browser.

Observed during the race-spec-signals worker on Birch, product base 9aea36fd. With reply jitter 0–250 ms, seed `race-spec-signals`, CPU 4× and timeouts ×4, the first-turn variant failed 1/2 at the assertion after advancing the browser clock five minutes: recap-card count was 1, expected 0. This is distinct from a recap already visible before typing, which is intentionally retained.

## Reproduction

In the synthetic lab, start a new conversation in `pi-recap`. Hold browser GET `/api/v1/agents/*/recap` replies until the first turn has finished and a new unsent draft has been typed. Release those reads, observe the card initially hidden, then advance `page.clock` by five minutes without clearing the draft. The recap appears. The intermediate run's JSON is `/var/tmp/race-spec-lab-final.json` on Birch (disposable).

The maintained lab-conversation long-message test now establishes a native turn and an empty recap read in `ready`, then enables `pi-recap` for a second turn. That existing-conversation path passes; it does not cover this first-read edge.

## Likely cause and fix boundary

`web/src/app/BrowserConversation.tsx` uses `recapHold.active` (including a draft) when `recapSeen.key === recapKey`, but only `recapHold.recent` when no recap has been seen. While a first recap is held, the effect refuses to set `recapSeen`. Once `recent` expires the card can appear although `active` remains true. Preserve the distinction between a recap known to be present on opening and one first delivered after composition began. Pin both orders in a component/controlled-clock test before changing the product.

## Acceptance Criteria

- [x] A first automatic recap arriving during composition stays hidden until the unsent draft is cleared and the person pauses; a recap already displayed before typing remains displayed.
