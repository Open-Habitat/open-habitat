---
created: 2026-11-24
updated: 2026-11-24
type: bug
reporter: conductor
status: open
priority: normal
lane: website
---

# check.mjs --only reports missing assets of other blocks

`node check.mjs --only <block-id> <out> <shots>` in
`design-system/prototypes/rounds/2026-11-23-etusivu-v1/` reports
`Failed to load resource: net::ERR_FILE_NOT_FOUND` for blocks that are fine.

Cause: a one-block build copies only that block's assets, but the page's
sidebar `<template>`s (Alice's day, the roles) still reference the other
glimpses' images and videos (`alice-02-northside-prices/*.webp`,
`alice-03-october-receipts/r*.webp`, `alice-04-market-video/*`, …), so the
browser requests files that are not in the one-block output. The whole-page
check passes.

Effect: block workers and the conductor see failures that are not real, and
a real missing asset in the block under check would be hidden among them.

Fix: either copy the assets of every block the rendered page references in
`--only` builds, or have `check.mjs --only` ignore failed requests for
assets outside the checked block (and report them as such).
