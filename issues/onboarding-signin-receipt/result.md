# Result

The receipt the gateway already wrote at the account-creating sign-in
(`onboarding_receipts` in administration state, with `ai_key`) is now shown
to administrators. No second store was added.

- **Käyttäjät ja pääsy rows:** `GET /api/v1/server/access` entries carry
  `onboarding` (contract `server-access.schema.json` `$defs/receipt`). A row
  reads, for example, "Käyttöönotto 24.10.: 2/3 oletusrepoa · ei pääsyä:
  `org/infra` · AI-avain annettu". Only the defaults that were not handed
  over are named. Handed-over defaults (`queued`, `already_present`) are only
  counted. In preselected mode the count reads "tarjolla". Story:
  `Settings/Käyttäjät ja pääsy` › EveryState and ReceiptProblems.
- **Root:** `admin users list` and `admin access list` JSON include the same
  `onboarding` object.
- **Person side:** no person-side read carries the receipt. A gateway test
  reads every gateway-answered GET as a non-administrator, and a browser case
  checks that the person gets 403 on the access list while the administrator
  sees the receipt.
- `internal/AGENTS.md` gains the receipt rule.

Fixed along the way:
- `admin settings show` carried `onboarding_receipts` into a strict CLI
  decode, so it failed once any receipt existed.
- The CLI access entry lacked `last_seen`, so `admin access list` failed
  whenever someone had a live session. A test now decodes the contract
  example strictly.
- Review finding: list replies that carry receipts exceeded the 128 KiB
  control-socket read in the CLI and in `host apply` at about 90 people, and
  the browser's 512 KiB access-list read further out. All three readers now
  read up to 4 MiB, above the 3 MiB administration-state bound.

## Evidence

- Go: `./scripts/test-focused.sh --area go` for `./internal/gateway`,
  `./internal/cli` and `./internal/host`, all passing. New tests cover the
  daemon's answer (`already_present`, wrong length, wrong order, an unknown
  outcome → `unknown`), the admin-only receipt and the person-side absence,
  and root's lists. Earlier tests already covered the lost reply and that
  later logins write nothing.
- Contracts: `--area contracts` clean.
- Web: `--area web` passing (109 files). The component test checks which
  defaults are named.
- Browser: `onboarding-default-repos.spec.ts` (5/5) and
  `server-access.spec.ts` (2/2). The sibling case "auto: the readable
  defaults…" fails when run alone, on main too; filed as
  `terribly-vulgar-verse`.
- Review: `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1, two
  calls). It made one should-fix finding (the reader limits), which was fixed.
  For the disclosure boundary the verifier found no path to another person's
  receipt. The model-performance entry was not logged because alder refused
  its own SSH (known).
- Not tested: the 4 MiB limit through a real root socket, because
  `socketRoundTrip` requires euid 0.

## Decisions for later review

- **Where the receipt shows:** on the access list (the Käyttäjät ja pääsy
  rows and `admin access list`) and on `admin users list`. It is not on
  `GET /api/v1/server/administration`, which is not where these rows come
  from. The alternative was a separate receipt endpoint, which would be one
  more admin read for the same rows.
- **Wording:** "N/M oletusrepoa" counts `queued` + `already_present`.
  `no_access` → "ei pääsyä", `check_failed` → "ei tarkistettu", `unknown` →
  "ei vastausta", each followed by the names. Preselected mode reads
  "N/M oletusrepoa tarjolla". AI key: "AI-avain annettu", "oma AI-avain",
  "AI-avain epäonnistui", "AI-avain: ei vastausta", and nothing when it was
  not offered. A receipt with no defaults and no key shows only
  "Käyttöönotto D.M.". The alternative was listing every default by name,
  which is long with 20 defaults.
- **Older receipts without `ai_key`** are shown as `not_offered`, rather
  than being made invalid and failing administration state closed on the
  test server.
- **Reader limits raised to 4 MiB** rather than giving `host apply` a lean
  users reply without receipts. That is the smaller change. The leaner
  control reply remains an option if the receipts grow.
