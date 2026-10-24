# Result

## What changed

- `host apply`/`host upgrade` stage a generation in `/opt/open-habitat/staging`
  (root 0700), check by `st_dev` that it shares a filesystem with
  `/opt/open-habitat/generations` before any archive work, and publish with one
  `renameat2(RENAME_NOREPLACE)`. A cross-device layout is the typed CLI error
  `generation_staging_cross_device` (exit 1), not `host_observation_unavailable`.
- Pre-publication apply continuation: an apply fenced at `started`, `quiescing`
  or `staging` with nothing published or initialized (no generation, selector,
  profile link, Pi/editor selector, broker state, installation identity,
  gateway config, staged journal file) is reported by the successor's
  `host apply --dry-run` as `operation.fence: pass /
  apply_prepublication_continuation_verified`, with the record under
  `plan.continuation`. The plan ID binds that exact record. Under the lock the
  executor re-observes the plan, then rolls the same operation ID forward to the
  new approval, target and input binding (intent now carries `plan_id`) and runs
  the full apply. Crash windows: intent-only → same new approval repeats;
  receipt-first split → recovered by the new approval only.
- `docs/operations.md`: filesystem layout rule and the continuation procedure.

## Evidence

- `go test ./internal/host ./internal/cli` (focused script) green.
- `scripts/test-host-initialization-uids.sh` (root container) green, including a
  new run with `/var/lib/open-habitat` on its own tmpfs: the old `/var` staging
  parent is refused with the typed error, EXDEV on publication is typed, and
  staging/publishing within `/opt` succeeds.
- Journal tests: continuation predicate accepts only unpublished states; plan
  binds the record; roll-forward completes the same operation ID; original
  approval, missing/other continuation record and the old approval after an
  interrupted roll-forward refuse; a receipt-first split recovers.
- Review: critical rigor, `/llm-review` (GPT-6 Astra finder, Claude Fable
  verifier) + `/assess-findings`: two crash-window defects in the new journal
  code, both confirmed and fixed with regression tests; verifier found nothing
  further.

Not proven here: a real prepare/apply/upgrade on an installed host with split
filesystems. That proof is birch's live continuation of operation
1aefab95aef14e19812b579cc53dc980 after the successor release (KOKEILTAVAA).

## Decisions for later review

- Continuation takes over the same operation ID under a new approval rather
  than requiring the original approval: the original approval binds the
  pilot.8 product and release, which cannot be installed (its signed product
  inventory names the faulty binary).
- The eligibility proof is host state (nothing published or initialized), not
  the old inputs: the journal keeps only a hash of the old binding, so "only
  `site.release` changed" cannot be verified. The operator's fresh approval of
  the full new observation is the authority.
- The empty `/var/lib/open-habitat/staging` left by earlier releases is not
  removed automatically.
- Preparation is not repeated by the continuation; a successor that changes
  preparation policies leaves the plan blocked at `storage.boot_policy`
  (no change since pilot.8, so birch is unaffected).
