# ADR draft: who holds the site onboarding, admission and site-key authority

**Status: proposal for Jari, 2026-10-24. Not accepted; nothing implemented.**
It replaces the 2026-10-23 version of this file, which predates Jari's
prototype rounds 2–6 of `proto-admin-server-onboarding` and was built around
invitations and a delegation to invite. Both are gone from the product. The
Finnish summary and the questions are in [result.md](result.md).

## What the product already settled

These are Jari's decisions from rounds 1–6 (issue `proto-admin-server-onboarding`,
Decisions, 2026-10-23/24). This proposal takes them as given and only asks
where the authority for each lives.

- **Onboarding** has a fixed order: GitHub → Repot → one step per added
  integration → AI-tili. It is edited on its own Settings tab *Käyttöönotto*,
  with a preview of what a new person sees.
- **Repositories**: a start mode `preselected | auto | skip` and one list of
  default repositories that is the same in every mode. In `skip` the defaults
  are still imported in the background. A default the person cannot read is
  silently left out for them. Only the administrator sees it, in the user list
  ("2/3 oletusrepoa haettu · ei pääsyä: `northstar-demo/infra`"). In `auto` the
  defaults already being fetched are locked rows in the person's chooser.
  `skip` without defaults removes Repot from the route.
- **Integrations**: a list of `{provider, required}`. Each is its own step.
- **AI account**, as chosen in round 3 ("Kolme tapaa"): *Henkilö valitsee / Oletus
  (one of five) / Sivuston avain*. A site key removes the AI step. It applies
  only to new onboardings, already-joined people are not changed, the key's own
  account pays, and finer actions on existing people belong to the CLI.
  Anthropic and DeepSeek keys are now in the product (`api-keys-anthropic-deepseek`,
  done).
- **Access** (*Käyttäjät ja pääsy*, "Yksi lista"): no invitations. There is a list of
  allowed GitHub accounts, bound to the numeric GitHub id (shown when added),
  with one row per person: *Ei vielä kirjautunut / Käyttäjä / Ylläpitäjä /
  Pääsy poistettu*. The browser requests and the server confirms. Removal ends
  sign-in and sessions, but the Unix account and files stay and the row stays.
  A restored person returns to the same Unix account. Account deletion is a
  CLI matter. Administrators come from `site.json` and cannot be removed in
  the browser.

## The code this has to fit

The places that constrain the answer:

1. **The daemon serves the gateway's UID.** `internal/transport/transport_linux.go`
   accepts the configured `GatewayUID` as its peer, and the gateway picks the
   daemon from the session binding (`internal/AGENTS.md`). So a compromised gateway
   can already act as every bound person through that person's daemon,
   including their `gh` and Pi `auth.json`. Each trust change below is measured
   against this. The question is what a gateway compromise *adds*. "Is the
   gateway trusted?" has the answer yes already.
2. **Admission today is one exhaustive, root-published set.** `site.json`
   `identities.admission` is published by `host apply`
   (`internal/host/apply_control_linux.go`, `converge`) through
   `provision.PublishAdmission`, a compare-and-publish transaction that is not
   on the broker listener. Removing someone revokes their sessions under the
   old admission, behind the closed entry gate, and then waits for the broker
   to observe the new epoch. The broker checks `authorize` at every login
   (`internal/gateway/auth.go`). `RevokeSubject`
   (`internal/gateway/revoke.go`) itself requires that `authorize` still
   succeeds, which is why revocation must come before publication.
3. **Broker protocol** (`internal/provision/protocol.go`): `ensure`,
   `authorize`, `lookup`, `list`, `quota_*`. There is no admission write, and
   nothing in a reply says that `ensure` just created the binding. Revoked
   bindings are kept (`Writer.startupBindings`), so restoring someone to the
   same account is a matter of admission, not account adoption.
4. **Gateway administration state** (`internal/gateway/administration.go`,
   `serverSettings`): name, administrators and default quota, one writer lock,
   and the same validated operations from the browser (session + admin + CSRF)
   and from root's local control socket (`admin` CLI). Today the browser
   can grant and remove the administrator role (`changeRoleFor`). The next
   `host apply` then converges the administrators back to `site.json`
   exhaustively. That is a live drift the r6 rule removes.
5. **Rules** (`internal/AGENTS.md`): model-provider keys live only in the
   person's Pi `auth.json`, and the host keeps no credential store and no token
   copy. The GitHub token is transient in the gateway. The broker has no
   network and no OAuth credentials, and never writes into homes (it only
   checks whether `sync-at-boot` exists). There is no parallel store of
   native state, and nothing is repeated automatically.
6. `admission: "any"` is the disposable test installation's open mode.

## Decision 1 · Where the onboarding configuration lives

Shape (vocabulary from the prototypes; the order is derived, not stored):

```json
{
  "version": 7,
  "repositories": { "mode": "auto", "defaults": ["northstar-demo/product", "northstar-demo/infra"] },
  "integrations": [ { "provider": "google", "required": false } ],
  "ai_account": { "offer": "chatgpt" }
}
```

`offer` is `all`, one of `chatgpt | claude | openai_key | anthropic_key |
deepseek_key`, or `site_key`. The invariant is that `offer` is `site_key` exactly while
a site key is stored (decision 3).

| Option | Why | Why not |
|---|---|---|
| A. In `site.json`, applied by `host apply` | Declarative, root-owned | The browser is the product's editing surface. Either `apply` overwrites browser edits or there are two truths |
| **B. Gateway administration state (recommended)** | The place where browser- and root-CLI-edited settings already live, with one writer, a version and the same validation from both paths. `host apply` never touches it | The installing agent sets it with `admin onboarding update` after `apply`, not in the site file |
| C. Seed from `site.json`, then runtime | Single install input | Two owners. The administrator cannot tell which value wins after the next apply |

**How the daemon gets it without trusting the browser.** The daemon reads no
gateway file, and nothing is world-readable. A readable file would show the
names of private default repositories to every Unix user, which round 5
ruled out. The gateway puts only the part each request needs into requests it
builds itself, never from browser fields:

- The **first-login handoff** carries the repository plan (`mode` and only
  the defaults this person can read, filtered by the gateway first; see
  decision 4) and, in decision 3, the site key.
- The person's **repository-list request** in `preselected` and `auto` mode carries
  the same filtered subset, taken from the person's onboarding receipt
  (decision 5). The daemon marks the matching rows as preselected or locked.
  A default the person cannot read never crosses into their UID at all.
- The **integrations and AI steps** are presentation. The browser gets the
  steps and the offer from the gateway's onboarding read for a signed-in
  person. That read never includes `defaults`.

The daemon may act on this input because it cannot widen what the person can
do. Clones run with the person's own `gh`, into their own `~/src`, and are
limited by the GitHub name grammar `owner/repo`, a fixed count (proposed:
at most 20) and the person's quota. The worst a forged configuration can do is make a
person clone repositories they can already read.

`required: true` means only that the onboarding step has no skip action. It is
not an access gate: neither the gateway nor the daemon blocks workspaces
until the integration is connected, and the person can reach their work by URL or
SSH anyway. An integration the installation does not offer (its catalog entry
is not `Available`) is left off the route and shown to the administrator as
not installed.

Configuration is read when a person's onboarding uses it. Changing it never
touches people who have finished onboarding.

**Authority changes:** none for the broker or daemon authority. Gateway
administration state gains `onboarding`. The daemon gains gateway-built inputs
on two existing request types.

## Decision 2 · Admission without invitations

| Option | Trust | Fit with r6 |
|---|---|---|
| A. `site.json` only. The browser files a request, and a root operator runs `host apply` | No change | "Odottaa palvelinta" lasts until a human acts, and the request queue is itself a new store |
| B. Gateway owns the allowed list, and the broker asks the gateway | The broker trusts the gateway for all admission. Root can no longer limit it | Fits, but gives up the root boundary entirely |
| **C. Two sources in the broker (recommended)** | Root keeps its own source and an off switch. The gateway's admin check can add and withdraw *only* runtime entries | Fits exactly: the browser requests, and the broker's commit is the server confirmation |

**C in detail.** The broker keeps two durable sources in its own locked state.
One is `operator`: `site.json` through `host apply`, exhaustive within its
source, unchanged. The other is `site_admin`: runtime entries written only by two
new operations on the existing gateway socket, `admit` and `withdraw`. The
effective admission is their union. `host apply` converges only `operator`,
and `host plan` lists the runtime entries as information. `site.json` gains
`identities.runtime_admission: true | false` (default `false`; Fleetrepo's
test site sets `true`). While it is false the broker refuses `admit`, while
`withdraw` keeps working and existing runtime entries stay as they are.

- **Adding.** The administrator types a login. The gateway resolves it to the numeric id
  with GitHub's public users API, authenticated as the OAuth app only for the
  rate limit (no person's token). It rejects organisations and unknown names, and
  shows name and id. A failed lookup creates nothing, and the broker never gets
  network access. On confirmation the gateway checks session, CSRF and the
  administrator role as current, then sends `admit {id, login_hint, actor}`. The broker
  checks the switch and whether the id is already admitted, commits durably, advances its
  epoch and replies. The browser shows the row as in effect only after that
  reply. An uncertain reply leaves the row "tila epävarma" with a refresh
  action, and nothing is retried automatically. `admit` is idempotent on the id.
  The Unix account is still created only at the person's first login (`ensure`).
- **Withdrawing.** It is refused for every `operator`-source id, which includes all
  administrators. The r6 rule "administrators are not removable in the
  browser" therefore becomes "anyone the site file admits is not
  removable in the browser". The gateway starts every runtime withdrawal, so
  it can close its own side first, and the order is chosen so that every crash
  point stays closed. Ordinary requests authenticate locally, and live relays
  only watch their session (`internal/gateway/session.go`, `live.go`), so a
  rule like "re-check when the broker epoch moves" would have nothing to
  observe it with. (1) The gateway durably records a per-subject *deny* in
  its administration state. The login callback and every session lookup
  refuse that subject from then on. (2) Under the same lock it removes the
  subject's sessions, which cancels their terminal and editor relays, using
  today's `RevokeSubject` while the broker still authorizes the binding.
  (3) It sends `withdraw`. The broker durably marks the entry `withdrawn`,
  after which `authorize` and `ensure` deny. (4) Only a confirmed reply shows
  *Pääsy poistettu*. A lost reply leaves the subject denied by the gateway
  and the row "tila epävarma". `withdraw` is idempotent, so the administrator
  can repeat it, but nothing repeats it automatically. The deny can only refuse access, never grant it.
  It stays until a confirmed restore.
- **What withdrawal is not.** The Unix account, home, `gh`/Pi credentials,
  SSH keys, tmux sessions, running Pi processes and user services stay. Anyone
  with SSH access keeps it. It ends web access only, as Jari decided. Account
  removal stays the deferred CLI need of ADR 0007.
- **Restore** is `admit` for an id whose committed binding still exists. The gateway
  first durably removes any session record of that subject left over from before the
  withdrawal, so an old cookie can never come back to life. Then it sends `admit`, and
  only after the broker's confirmed reply does it clear its deny. The broker
  authorizes that same binding, so the person returns to the same Unix
  account, and nothing is created or adopted. A binding that fails verification
  is refused and left for the CLI to diagnose.
- **The list** comes from a new read-only broker operation returning `{id,
  source, state, username?, login_hint, actor, at}`. The gateway joins
  administrators and last-seen. A withdrawn id that was never bound is deleted
  (its row disappears), and a withdrawn bound id stays as *Pääsy poistettu*.
- **Administrators** come only from `site.json`. Remove the browser's
  administrator-role write; `host apply` already reverts it.
- **`admission: "any"`** (test mode): the runtime list has no meaning. The tab says
  access is open and disables adding and removal.

**Authority changes, explicitly.** The gateway's administrator check can now
make the broker admit a new GitHub id, and so cause a Unix account to be created at that
person's login, within the UID pool and default quota. Today's compromised
gateway already acts as every bound person. What this adds is the ability to *mint
new accounts that outlive the compromise*, a durable foothold, and to use up UIDs
and disk. The broker still takes the gateway's word for who the administrator
is. `actor` is provenance, not proof. Mitigations: root's off switch, a cap on the
runtime set (proposed: 256), and runtime entries with actor and time
visible in `host plan` and `admin access list`. Account creation, the UID
pool, quota and home isolation stay with the broker.

## Decision 3 · The site AI key

Whatever the storage, Jari's product choice has consequences that no option removes,
and they should be said first. The key ends up in each new person's Pi
`auth.json`, the native per-user credential the rules require, so that person
and every program their agents run can read it. It is shared with every new
person, anyone can copy it off the server, and removing it from the site
recalls no copy. Only revoking it at the provider stops its use, and that breaks
every seeded person at once.

| Option | Where the master copy is | Verdict |
|---|---|---|
| **K1. Gateway private file (recommended)** | A separate gateway-UID `0600` file, not in administration state. Written by a browser administrator or root's CLI, never read back except provider and a four-character suffix, never logged | Fits the r3/r4 browser flow. A new holder, but no broker (below) |
| K2. Root-owned site input, like `oauth_secret_file` | Set through `host` | Not settable in the browser, which contradicts the chosen flow |
| K3. Broker writes it into homes at account creation | Root | Gives the broker credential and home-write authority. Rejected |
| K4. Shared group-readable file or variable referenced by everyone's Pi | Shared | Every person reads the live key, "joined people unchanged" becomes impossible, and it breaks "configured references are never resolved". Rejected |
| K5. LLM proxy holding the key, per-person tokens | A new service | This is the credential broker the rules forbid. It is the only option with recall, per-person revocation and usage accounting. Rejected for now |

**K1 delivery.** The key is seeded only in the handoff of the login in which
the broker *created* the binding. `ensure`'s reply gains `created: true`, a fact
only the broker owns. The daemon writes it with a seed-specific *write only if
absent* operation inside Pi's own file lock (the helper's `modify` callback keeps a
present entry). Today's save replaces an existing key
(`internal/daemon/pi_credentials_helper.mjs`), and a second concurrent login could
save the person's own key before the creating login's seed lands. Once it is
written, the AI step is skipped by the existing rule that usable Pi credentials
end onboarding. Later logins never seed, so a person whose
own credentials lapsed is not silently moved onto the site's bill. Nothing is
retried. Whether the person then sees the AI step is decided by the daemon's
native Pi credential status, not by the receipt. The helper commits the key
before its later settings step, which can fail, so a reported failure may still
have left a usable, billable key. When the step is shown, it shows `all`.

**Rotation and removal.** Replacing the key changes future seeds only, and seeded
people keep their copy. Removing it requires a new `offer` in the same operation
(Kolme tapaa), and the copies remain. Jari's "the CLI handles already-joined
people" becomes `admin ai-key seed --subject <id>`, a later root-only step. It writes
only if the person's Pi has no key for that provider, or has exactly a key
the site seeded earlier. The gateway keeps salted fingerprints of seeded keys,
never old keys. It never overwrites a key the person added. This is root deciding
to write into another person's credentials, and the output says so.

**Authority changes, explicitly.** Yes, this is a new authority: the gateway
becomes the persistent holder of one provider credential. Today it holds none
persistently, and the GitHub token is transient. It is not a credential broker:
it never mediates use, proxies requests or issues per-person tokens. It hands
each copy over once, at that person's onboarding, and afterwards the copy is
the person's native credential and the site has no hold on it. Holding the key
in the gateway adds little confidentiality exposure, because a gateway compromise already reaches
every seeded `auth.json` through the daemons. The `internal/AGENTS.md` rule
"the host keeps no credential store" must still be amended to name this one
exception, or K1 is not allowed.

## Decision 4 · Importing defaults for a person who never chose them

**Who starts the clone:** the person's own daemon, as the person, with the
person's `gh` that the same first-login handoff has just installed. The gateway
adds the repository plan from its administration state to that handoff.

1. **Access check, in the gateway, before the handoff.** In the login, the gateway
   holds the person's GitHub token transiently anyway. It uses that token for
   one read-only `GET /repos/{owner}/{repo}` per default (concurrent, at most
   20, with a short deadline). Not found or forbidden means `no_access`, and a
   timeout or error means `check_failed`. Neither kind is sent to the daemon,
   so an inaccessible name never enters the person's UID. A failed check fails
   closed on the name: that default is left out for this person, and the
   administrator sees why.
2. **In the daemon, for each default it received:** it skips one for which a
   matching workspace already exists (`already_present`). Otherwise it enqueues
   an ordinary clone job (ADR 0024), the same as one the person chose. Progress
   shows on the route's Repot row, and in `auto` mode as a locked chooser row.

`skip` with defaults does the same without a chooser. `preselected` imports
nothing by itself; the chooser preselects (decision 1).

**Once only.** The plan travels only with the binding-creating login, so later
logins never import again. A person who deletes a default workspace does not get
it back, which matches "destruction is explicit" and "nothing repeats
automatically". A handoff that fails before the plan runs is not retried. The
receipt (decision 5) then says the plan did not run.

| Rejected alternative | Why |
|---|---|
| Re-check the defaults at every login | Re-imports deleted workspaces. Changing the config would change joined people |
| Root or the broker clones into the home | Root writing in homes, with whose GitHub identity? |
| A shared deploy key or bot token | A shared credential instead of the person's own identity |
| The gateway clones | It cannot reach homes |

**Why the check is in the gateway.** If the daemon checked access with the person's `gh`, the
full defaults list would have to enter the person's UID. Any program running as
that person could then read it (from the request, from the daemon's process or
from the `gh` arguments). That would break round 5's "only the administrator
sees it" below the UI. **Authority change:** the gateway now uses a person's
GitHub token for something besides login: read-only checks of the site's own
default repositories, inside the same transient window. The token is still not
persisted, logged or returned. The simpler alternative, checking in the daemon,
is acceptable only if Jari decides that default repository *names* need not be
hidden from a person's own Unix account.

## Decision 5 · The administrator's view of each person's onboarding outcome

| Option | Verdict |
|---|---|
| R0. Drop it. The administrator checks GitHub team access themselves | No new path. Loses r5's "only the administrator sees it" |
| R1. Live: the admin view asks each person's daemon | The daemon would answer an administrator, a new principal. It costs N×M GitHub calls and needs every daemon running. Rejected |
| R2. Root reads a record in the home | Home access. Rejected |
| **R3. Onboarding receipt (recommended)** | Below |

**R3.** The first login produces a fixed-shape result indexed by the site's own
defaults. The gateway's own access check gives `no_access | check_failed`, and
the daemon's handoff reply gives `queued | already_present` for the rest, plus
`ai_key: seeded | not_offered | failed`. A missing or ambiguous reply makes every
daemon-side entry `unknown`, never `failed`. A lost acknowledgement does not
show that nothing happened. The gateway stores it in its administration state keyed by
subject, with the date, and the user list shows "Käyttöönotto 24.10.: 2/3
oletusrepoa · ei pääsyä: `northstar-demo/infra`". There is no new listener and
no home read, and nothing about the person's other repositories or work: the receipt
holds only facts about the site's own configuration, produced by an event the
gateway directed.

It is a new per-subject gateway record. That is justified because it exists
nowhere else: the daemon keeps nothing and the person never sees it. It has
limits. It is a snapshot from the onboarding moment, so access granted later
still shows as missing until the row is cleared. It reports clones as
started, not finished, since finishing would need R1. So the wording should be
"2/3 oletusrepoa" or "haussa", not "haettu". What the administrator learns is the
fact Jari chose in round 5: that person P had no GitHub access to site default X.

## CLI surface

Everything is root-local under `open-habitat admin`, over the gateway's control
socket with root peer credentials, with the same validation as the browser.
Per the AI-first CLI canon: one JSON envelope, `--dry-run` with
`known_effects` on every mutation, `--expected-version` where a document is
replaced, secrets only via stdin or a file, unavailable/uncertain as their own
exit codes (never an empty list or a success), and no automatic retries.

```text
open-habitat admin onboarding show
open-habitat admin onboarding update --file <path|-> --expected-version <n> [--dry-run]
open-habitat admin access list [--state allowed|joined|withdrawn]
open-habitat admin access lookup --login <github-login>      # read-only, returns id/type/name
open-habitat admin access add --github-id <id> [--dry-run]   # dry-run says "restore to <username>" if bound
open-habitat admin access remove --github-id <id> [--dry-run]
open-habitat admin ai-key show                               # provider, suffix, set_at
open-habitat admin ai-key set --provider openai|anthropic|deepseek --key-file - [--dry-run]
open-habitat admin ai-key delete --offer <offer> [--dry-run]
open-habitat admin ai-key seed --subject <id> [--dry-run]    # later step, see decision 3
open-habitat admin users list                                # gains the onboarding receipt
```

`access add` takes only the numeric id. The agent resolves names with `lookup`
first, so the id being admitted is always explicit. `access remove` on an
`operator` id fails with a usage error naming `site.json` as the owner.
`site.json` gains `identities.runtime_admission`, and `host plan` reports the
runtime entries. The administrator-role write is removed from the browser API, and
the control-socket `role` operation stays for `host apply` only.

Installing agent's order: `host plan/apply` (site with
`runtime_admission`) → `admin onboarding update` → `admin ai-key set` if wanted → the
first administrator signs in → `host apply` again for the deferred role → `admin
access add` per person.

## Rules that would move into `internal/AGENTS.md` on acceptance

- The onboarding configuration is gateway administration state, reaches a
  daemon only inside gateway-built requests, and can only select among the
  person's own native actions. It is never world-readable.
- The broker owns both admission sources. The gateway may only `admit` and
  `withdraw` runtime entries, and only while root's switch allows `admit`. Withdrawal
  denies at the broker before sessions are removed. A session whose subject the
  gateway first records a durable deny for the subject and removes its sessions; restore
  removes leftover sessions before readmitting.
- The gateway holds exactly one persistent provider credential, the site AI
  key. It seeds it once into a new person's Pi credentials, only on the login
  in which the broker created the binding, and never proxies or recalls it.
- Default repositories are imported once, by the person's daemon with the person's
  own `gh`, at that first login. The gateway checks access first with the
  transient login token, so an inaccessible default never enters the person's
  UID.
- The onboarding receipt is the only cross-user onboarding fact. It is about the site's
  defaults only and comes from the handoff reply, never from a home read or a
  daemon query on an administrator's behalf.

## Evidence the implementation must bring

- Runtime and operator sources: `host apply` neither removes runtime entries
  nor lets the browser remove operator entries. The switch-off refuses `admit`
  even from the gateway UID.
- Withdrawal racing a login, a token handoff and an open terminal/editor; a
  gateway or broker restart at each durable step stays closed; restore returns the
  same UID; a never-bound withdrawal leaves nothing.
- `created: true` only once per binding, so neither the plan nor the key is replayed on a
  second login, after a failed handoff or after a broker restart.
- An inaccessible default is never in the person's UI or the receipt shown to
  them. Two real UIDs (VM test), not a same-UID mock.
- The site key never appears in logs, replies (beyond the suffix) or
  administration state. `seed` never overwrites a person's own key.

## Order if accepted

1. Broker: two sources, `admit`/`withdraw`/list, `created`, the switch, plus
   the gateway's durable per-subject deny.
2. Gateway: onboarding state and the *Käyttöönotto* tab; access tab; role write removed.
3. Handoff: repository plan, chooser defaults and locked rows, receipt.
4. Site key (K1), then `ai-key seed` as a separate later item.
