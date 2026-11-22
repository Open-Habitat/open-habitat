---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: open
priority: normal
provenance: other
provenance_detail: real-runtime lab during server-browser-control-clipboard-impl
source_ref: taskfleet:01m812bqrqz6a8y0gyx613k596/lab:non-us-keys
originating_run: 01m812bqrqz6a8y0gyx613k596
originating_run_kind: spinoff
lane: server-browser-control
lane_seq: 3
preparation: ready
---

# Server browser: characters outside the US layout typed on the picture never arrive

## Description

## Observed

Typing on the server browser's live picture with a non-US keyboard layout loses
every character the remote US keyboard does not have. In a lab with the real
runtime (TigerVNC Xvnc 1.13.1 and Chromium 153 through the browser host), key
events for `a`, `ä` (code `Quote`), `ö` (code `Semicolon`) and `b` sent to the
focused noVNC canvas arrived in the remote omnibox as `ab`: `ä` and `ö`
vanished.

The same happens to the viewer's "Type as keystrokes" for any non-ASCII
character, sent as a bare keysym: Xvnc maps the keysym to a spare keycode on
demand, but Chrome keeps the keyboard map it started with and never produces
the character. "Type as keystrokes" now refuses such text and points to
paste, which carries UTF-8 correctly through the extended clipboard.

## Impact

A person whose password or one-time text contains ä, ö, å, €, ß and so on
cannot type it on the picture; they must paste it, which goes through the
remote clipboard (cleared when they give control back). Ordinary text fields
on Finnish sites are equally affected.

## Reproduce

Synthetic: run the server-browser spec setup with
`BROWSER_HOST_REAL_BROWSER=<Xvnc>:<Chrome>`, take control, focus the omnibox
and dispatch keydown/keyup with `key: "ä", code: "Quote"` on the canvas
(e.g. CDP `Input.dispatchKeyEvent`); copy the omnibox back.

## Directions (not decided)

- Start Xvnc with a keyboard layout that matches the person (or a broad one)
  so the keysyms already exist when Chrome starts.
- Make Chrome pick up keymap changes (check whether its X11/XKB layout engine
  refreshes on XkbNewKeyboardNotify that Xvnc could trigger).

## Decisions

### 2026-11-22T08:17:21Z · @conductor

Conductor 22.11.2026: laned as a defect in accepted behaviour (typing on the server browser must work for a Finnish user; ä/ö in passwords and ordinary fields). Fix directly; Jari is told.
