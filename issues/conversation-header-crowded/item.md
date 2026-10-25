---
created: 2026-10-20
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
lane: header
lane_seq: 2
collision: [conversation-header]
closed: 2026-10-20
---

# Conversation header is overcrowded: move Editori to the tools, shorter model pill, longer title

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (screenshot: title 'Mistä projektista tarkoitat? Lähetä p…', workspace, Odottaa sinua, Editori button, git pill, 'claude-opus-5-5 · medium', terminal/heading/archive/info icons): too full. 1) Move Editori among the tool icons with its own icon (not the terminal glyph). 2) Model pill: just 'Opus 5.5' and 'Medium' with a small thinking/level icon, human model names. 3) Opening the pill shows information, not a choice form: the model and its alternatives as a ribbon/segmented row, and the thinking level as a ribbon — it clarifies the state rather than offering a lot of choices. 4) The title gets the space freed up; currently only a couple of words show before the ellipsis. Desktop and phone, light and dark; lab before/after captures.

## Acceptance Criteria

- [x] Editor is an icon among the tools, distinct from the terminal.
- [x] Header uses human-readable model and thinking labels, with read-only model/level ribbons.
- [x] Title fills available desktop space and its own phone row; light/dark layout, accessibility and Escape focus are checked.
- [x] Fast web and affected browser specs pass, including the phone composer regression.

## Result

Recovered preserved commit `0086cfec` onto current main, then fixed phone composer label wrapping (`white-space: nowrap`, clipping only the summary). Browser checks also exposed stale test assumptions: mobile navigation reserves header space, the attachment button precedes the model disclosure, and workspace route focus must settle before keyboard navigation. Updated these assertions and the remaining old model-label expectation. No authority, authentication, contracts or installation changes.

Final checks ran with `TMPDIR=/var/tmp`, `umask 077`, remotely and serially, against committed revision `7cf4d4be358c85a41499a629c8d5007d82a244eb`, tree `c79ce355eed353bb2201cfd93cd3c618df54989d` (including main's command cards and terminal fixes):

| Command | Outcome | Runner job |
| --- | --- | --- |
| `./scripts/test-focused.sh --area web` | passed | `d4b84e61aac22e53958682ae416f9bc38048b970a99a83e69eaf0c4f85822cfa` |
| `./scripts/test-focused.sh --area browser --spec title-regeneration.spec.ts` | 3 passed, includes header Axe/focus/layout checks in light/dark at desktop/phone widths | `884d9fbed0efdd750b42ee71b7eabfbbd1cb34de7a94346d57851ef01bb91147` |
| `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts` | 67 passed | `5d39adc3fe0c99df71484b3635d0d16d260249c9a4b8e8b09bc141344c7fe799` |
| `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts` | 5 passed | `da82f7d12aada3ddb038977570088e77292ea0c42844b5324375b4640a1e2d62` |

Runner responses and fetched receipts remain outside source in `/var/tmp/oh-browser-h2fsat07`, `/var/tmp/oh-browser-r8m1cfk6`, `/var/tmp/oh-browser-ef1pyzcb`, `/var/tmp/oh-browser-_y18w9gq`. These are synthetic same-UID browser checks, not live-provider or UID-isolation proof. No full gate/clean-gate receipt claimed. No push or test-server operation performed.

Before/after lab captures remain deferred under Alder policy, as instructed. Focused self-review is proportionate for presentation-only changes: checked native model/provider fallback, information-only semantics, keyboard handling, title allocation, summary clipping without clipping menus, and editor naming. The previous result recorded self-review, not an independent review; no independent security review is required for this surface.

Failure inventory: the previous worker's quota-blocked checks were superseded by passing runs. This run's first title spec failed its fixed 300px assumption (276px available); the next browser spec failed wrapping, attachment tab order and a route-focus race. All were repaired and the complete focused set passed, then passed twice more after main integration. A diagnostic `git show` for a nonexistent separate result file and an ambiguous trace glob failed; the result was read from `item.md` and specific traces were successfully inspected. Exploratory searches for wrongly guessed component paths were corrected. No required step remains failing. Issue doctor, project-view validation and `git diff --check` also passed; doctor retains repository-wide legacy-image advisories unrelated to this issue.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
