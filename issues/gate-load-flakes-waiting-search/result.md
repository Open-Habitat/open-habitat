# Result

The settings-search failure was a product defect and is fixed in the
product. In the next-waiting-row case I found and fixed a spec race that
load exposes. The gate's own failure in that case (Stop stays, line 266)
did not reproduce. Its evidence and what I ruled out are in
`status-stuck-working-after-release`, filed unlaned.

## 1. settings-search `:70`: the arrows leave the preview behind

**Cause (product).** React Router 8 applies each navigation in
`startTransition`, so Settings' routed `section`/`row` props are drawn
after the URL has moved, and a loaded page can hold that back over several
key presses. The search preview skipped navigating when the target equalled
the *drawn* place. Pressing the arrows back to the place still drawn left
the URL on the place the route had already moved to. The selection moved but
the preview did not. In the gate the list was stable and "Oletusmalli" was
selected (error context), yet the page stayed at `/settings/recap#recap-model`
for 5 s. A person on a slow machine sees the same: the open section is no
longer the highlighted result, and Enter lands somewhere other than where the
preview showed.

**Evidence.** The list for "malli" is fixed (`searchSettings` is pure;
admin or not: `recap-model, default-model, tekoaly, chatgpt, claude,
recap-response`), so the list did not reorder. A probe with Chromium at
100× CPU throttle showed the URL at `#default-model` while the old section
stayed drawn for 4–5 s. ArrowDown then ArrowUp, which should end at the first
result `#recap-model`: **6/6 fail before** (URL stuck at
`#default-model` for 20 s), **6/6 pass after**. The new unit case in
`Account.test.tsx` holds the route props still while the URL moves, as the
router does. It fails before (`#default-model`) and passes after.

**Fix.** The preview compares the target with the URL, which the router
moves at once, instead of the drawn section. The spec stays strict. Its
comment claiming a recap read could add rows was wrong: only the
administrator check can, so I corrected it.

## 2. next-waiting-row `:228`: the question shows and goes by chance

**Cause (spec).** The case injects `pending_question` by rewriting status
responses. That change brings no event, and this view reads status only on
an event, so the question appeared and went only if the held turn's
remaining events happened to trigger a later read. Under load the last read
came before `asks = false` (trace: no status request after it). Line 254
then failed **18/18 at heavy and 16/18 at mild load before**. In the
product, a question's resolution comes with `question.resolved`, so this is
not a product gap.

**Fix.** After each rewrite the spec uses the person's explicit check
(Tiedot › Tarkista, `conversation-recheck`), as its first case already did.
The assertions are unchanged. After: 18/18 mild, 30/30 heavy, and the
whole file 32/32 heavy (`--repeat-each 8`).

**The gate's failure at `:266`** (Stop still shown 30 s after release) did
not reproduce in any of those runs, nor with reordered, delayed status
replies or a CPU-throttled page. The error context shows the page held
a status from before the delivered "queued" turn, while that turn's history
had arrived. So events reached the page and `refresh` applied no status.
The details are in `status-stuck-working-after-release`.

## 3. lab-workspace-trash `:49` (from `suite-flakes-settings-trash`)

The failure was not reproduced: 18/18 under heavy load. Outright deletion
takes 0.2–0.5 s there, so the 5 s wait was not too short. That gate (r43)
kept no error context, so I can't tell which of the dialog's non-notice
outcomes happened (a fresh check, `workspace_changed` or
`workspace_not_clean`). `suite-flakes-settings-trash` stays open for this
half only; its settings-search half is the fix above.

## Pass counts

Load: `OH_BROWSER_WORKERS=6`, Playwright at `nice 5`, ten
`timeout … sh -c 'while :; do :; done'` busy loops on 8-core Birch ("mild":
five).

| Case | Before | After |
| --- | --- | --- |
| settings-search arrows, load alone | 30/30 (`--repeat-each 30`) | — |
| settings-search arrows, 100× throttle probe | 0/6 | 6/6 |
| whole settings-search spec, heavy | — | 50/50 (`--repeat-each 10`) |
| next-waiting-row `:228`, heavy | 0/18 (line 254) | 30/30 |
| next-waiting-row `:228`, mild | 2/18 (line 254) | 18/18 |
| whole next-waiting-row spec, heavy | — | 32/32 (`--repeat-each 8`) |
| lab-workspace-trash `:49`, heavy | 18/18 | (unchanged) |

Unloaded, `OH_BROWSER_WORKERS=2`: settings-search, settings-three-pages,
account-settings 32/32, and next-waiting-row as well 36/36. Web fast checks
1227/1227.

Under heavy load, settings-three-pages' `@a11y tekoaly` case times out in its
axe runs (5/12 with this change, 11/12 on HEAD's `Account.tsx`). It never
searches, passes unloaded, and passed in both gates. That is my synthetic
load, not a gate flake, so I didn't file it.

## Decisions for later review

- **Preview against the URL, not the drawn section.** Alternatives: always
  navigate (a redundant replace navigation, and a full routed re-render, on
  every keystroke whose first result is unchanged), or remember the last
  place the search asked for (wrong after a section link or Back, which
  bypass it). `choose` (Enter) still compares with the drawn place. If the
  route is still behind, it navigates again to the same URL, and the landing
  effect focuses the row when the section is drawn.
