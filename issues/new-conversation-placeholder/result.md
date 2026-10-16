# Result

## Cause and change

The shared sidebar/home/workspace creation handler waited for the create RPC before navigating. During a slow Pi startup the previous page therefore remained visible. Creation now immediately selects a temporary `?conversation=new` route with the production conversation frame, header, empty thread and disabled composer. A validated native session replaces that route; opening status/history uses the same frame rather than briefly returning to a heading-only loader. The placeholder reserves the empty conversation's model-pill space so the composer does not jump when startup completes.

The pending view is presentation only: it does not invent a native agent ID, add history or send a message. Failed/lost replies remain in the conversation, with no automatic create retry. Reloading the temporary route reports uncertainty instead of replaying creation. Identity reset clears the temporary views. Leaving the view during startup is respected; completion updates the conversation list without navigating the person away from their new destination.

The process tray previously deliberately rendered `Ei prosesseja` for a successfully read empty inventory. It now disappears when the inventory is available and empty, including after clearing finished processes. Unavailable inventories still explain that the information could not be obtained: missing information is not evidence of zero processes. Running and finished process controls remain intact.

## Synthetic reproduction and visual evidence

Started the lab with `OH_PORT_BASE=28500 scripts/lab.sh start` and explored with `web/lab/session.mjs`. A held browser create request makes startup latency deterministic. Process screenshots use an explicit browser wire fixture for an available empty inventory (the lab's fake Pi may otherwise report an unavailable bridge).

Paired PNG and offline HTML snapshots:
- `before-creation.*` / `after-creation.*`: the workspace remains visible before the fix; the pending conversation appears immediately afterwards.
- `before-processes.*` / `after-processes.*`: empty process bar before; no bar after.

These are invented lab identities/workspaces and fake Pi, not captures or proof from the live test server.

## Validation

Before integration, the new placeholder spec passed 3/3, the process spec passed 3/3, and fast web checks passed. The wider conversation spec passed 71/73; its two old assertions expected the former workspace-page failure and heading-only loader. Updated those to assert the same uncertainty/guard and status-before-history invariants in the pending frame; both passed in isolation.

Regression sensitivity was checked explicitly: the original creation implementation fails the held-request navigation assertion. Removing only the empty-inventory guard makes the process case fail its tray-absence assertion (not an unrelated timeout).

One startup was blocked by the shared host's inotify limit (`EMFILE` from Vite). Retried with `CHOKIDAR_USEPOLLING=true` and `OH_BROWSER_WORKERS=2`; no machine-wide limits or other workers' processes were changed.

Rebased onto `origin/main` at `f04d0bd0`, including the parallel reconnect fix. Resolved the single App creation-error conflict by keeping its revised uncertainty wording and recovery guard while placing the error inside the pending frame. The pending view now exposes the same **Tarkista luonnin tulos** read-only recheck. Only a successful snapshot/catalog recheck releases the guard and returns to the workspace list to choose the actual native conversation; failure remains in place. Existing reconnect tests cover both “created but reply lost” and “not created”, failed recheck, reload and no automatic repost in this new route.

Final integrated focused checks and full gate are recorded below.

Focused self-review covered identity fencing, no speculative native state, navigation away/back, lost replies/reload, empty versus unavailable inventories, and composer geometry. Moving the existing process accessibility check before clearing the tray exposed its skipped heading level; process group headings now use h2 under the conversation h1.
