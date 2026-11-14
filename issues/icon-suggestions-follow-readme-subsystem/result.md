# Result

README facts now separate the opening title and paragraph from later detail.
The helper instruction makes the workspace name and opening identity primary,
and restricts letters to the workspace name or README title's subject, not a
mentioned tool, directory or dependency. Facts remain reference data, never
instructions. The original 2 KiB read budget is partitioned, not duplicated.

## Verification

- `umask 077; OH_PORT_BASE=15500 timeout 900 ./scripts/test-focused.sh --area go --go-package ./internal/daemon` passed (212.603 s).
- Regression uses a synthetic Northstar monorepo README with one opening
  description followed by long Ledgerbot bookkeeping sections. The request
  reaching the suggester keeps title, summary and later text separate and
  within the combined byte budget.
- Empty/title-only/no-title/no-summary and CRLF/setext openings are covered.
  Existing symlink, invalid-output and pinned-runtime helper tests passed.
- Focused self-review: checked partition bounds, README presence reporting,
  unchanged file-read protections, and facts-as-data instruction placement.
  No authority or browser/host contract changes; no browser tests needed.
- `git diff --check` passed.

## Real-model smoke check

Ran the actual modified helper once with synthetic facts only: workspace
`northstar-monorepo`, title `Northstar`, summary “Monorepo for **Northstar** —
data + tooling, file-as-database, agent-driven.”, then the remainder of a
2 KiB prefix dominated by Ledgerbot bookkeeping text. No wish, history or
avoided icons. Model: `openai-codex/gpt-6-luna`.

Reply: “Nämä kuvakkeet viittaavat Northstarin suuntaan, tietoon ja
agenttivetoiseen työskentelyyn.”

| Icon | Reason |
| --- | --- |
| 🧭 | Northstar ohjaa suuntaa |
| ⭐ | Tähtimäinen Northstar-viittaus |
| N | Northstarin alkukirjain |
| 🗃️ | Tiedostoihin perustuva data |
| 🤖 | Agenttivetoinen työskentely |

This is one successful semantic smoke check, not a guarantee of every model
answer. Automated tests require no real model or credentials.

## Decisions for later review

- Partition the prefix into title, summary and remaining text instead of
  duplicating the title/summary beside the original prefix. This preserves
  the combined 2 KiB content budget without losing useful later context.
- Use a small opening-structure parser (leading Markdown H1 or equals-underlined
  title, then the first paragraph), rather than adding a full Markdown parser.
  Unfamiliar markup remains data; missing opening identity falls back to the
  workspace name in the instruction. No search through later headings promotes
  a subsystem to the workspace title.
- Keep semantic letter attribution in the prompt, not a hard initial-letter
  filter: a README title's subject can legitimately differ from the directory
  name. Existing flat-icon validation still governs accepted output.

Live check: after deployment, open icon suggestions for a monorepo whose README
starts with its own identity but spends most of its opening 2 KiB on one tool.
Ask without a wish: suggestions should describe the whole workspace, and any
letters should come from its name/title rather than that tool.
