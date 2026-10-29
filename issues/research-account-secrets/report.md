# Research: SOPS, age and SSH keys on a Habitat account

Research date 2026-10-29, at this run's branch base. Method: reading the
product source, the Northwind monorepo and Fleetrepo (both read-only), primary
documentation, and one disposable spike with throwaway keys under
`/var/tmp/oh-research.*` on Birch (Ubuntu 24.04 arm64). Nothing was decrypted
from a real repository, no private key was read, and no other machine was
touched. Everything below is a recommendation. Jari decides.

## 0. Premise and question

On 29.10 Jari decided (the decision is recorded in `research-ville-feedback`)
that **the same secrets may be on a person's Habitat account as on their
laptop**. This report does not reopen that. The question is *how* a person
brings a laptop's secret setup to the account, and whether the product should
help with a UI, with CLIs plus an agent skill, or with both. Two rules hold
throughout:

- the Unix user is the boundary;
- there is no credential broker of our own. Private keys are created on the
  account and never leave it, and the product shows only public halves.

## 1. What a laptop has, and what the account needs

The concrete case is a Northwind team member. Read from
`~/src/northwind-monorepo` (`.sops.yaml`, `operations/secrets/AGENTS.md`,
`operations/ssh-keys/`, `scripts/ssh-keys.sh`).

| Piece | On the laptop | On the Habitat account | Who acts |
| --- | --- | --- | --- |
| age identity | `age-keygen -o ~/.config/sops/age/keys.txt`, done by `setup-mac.sh` | Same command in the account. On Linux, sops finds that path with no environment variable (sops docs; confirmed in the spike). The macOS `SOPS_AGE_KEY_FILE` trap does not apply | Person (or their agent) |
| Recipient on the org's tiers | The admin pastes the public key (sent "via Slack") into the tier rules in `.sops.yaml` and runs `sops-admin.sh update-<tier>` or `sops updatekeys` per file. Some tiers have no update command and need a manual `updatekeys` (Northwind's own lesson, 24.9.2026) | Same, as a **new device entry**: the file already names keys per device ("Jari Mustonen (jari) - pöytäkone", "... - läppäri", "Laura Maria - uusi kone") | Org admin |
| `sops` binary | `brew install age sops` | **Not shipped.** Ubuntu 24.04 has no `sops` package. Upstream publishes signed `linux.amd64`/`linux.arm64` binaries (v3.13.3, with sigstore-signed checksums, in-toto provenance and SBOMs) | Product (runtime profile) |
| `age` binary | brew | Shipped: `runtime/profiles/operations` declares `age` (Ubuntu 1.1.1) | Product, already |
| SSH key for servers | `scripts/ssh-keys.sh setup` generates `~/.ssh/acme-servers` and an `~/.ssh/config` block per server, and adds the public key to `authorized_keys.yaml` | `ssh-keygen -t ed25519` in the account, plus the same config block. The admin adds a new user entry (`<name>-habitat`) and runs `ssh-keys.sh deploy` | Person, then admin |
| Host key trust | The laptop's `known_hosts`, built up over time | Must be **copied as public data from an already trusted machine**, not keyscanned (Northwind's own rule in `operations/ssh-keys/AGENTS.md`) | Person / admin |
| `ssh` client | macOS built-in | Present on Ubuntu (`openssh-client`) but **not declared** in any product profile | Product (declare it) |
| Git transport | GitHub over SSH | Not needed. Habitat already gives `gh` and the Gitea/GitLab Git helpers over HTTPS. `gh ssh-key add` would fail anyway: the gateway asks GitHub only for `repo read:org gist` (`internal/gateway/github.go:24`), which lacks `write:public_key` | — |
| Other org tools | `media-cli`, `acme-cli` and similar, reading SOPS through the age key | Run from the person's clone of the monorepo once the age key decrypts | Person |

So the product's part of the account side is small: **ship `sops`, declare
`ssh`, and make sure the person knows how to generate keys and hand over the
right public half.** The rest is native tools in the person's home and the
org's own enrolment scripts.

### Northwind's enrolment model fits a "Habitat device"

- `authorized_keys.yaml` has per-user `servers:` lists and per-server
  `authorized_users:` lists (`user_has_access` in `scripts/ssh-keys.sh`).
  So a `ville-habitat` entry can already be limited to, say, `ai-acme`,
  without any new tooling.
- `from="<pilot address>"` would bind the key to the Habitat host. But
  `cmd_add` refuses a key line that does not start with `ssh-*`, so options
  can only be added by editing the YAML by hand. `cmd_generate` echoes the
  stored line verbatim, so a hand-edited line should deploy. **Not tested
  here.**
- **A caveat in Northwind's documentation, worth passing on to them.** It says
  rotation stops a revoked person from decrypting "old files from git
  history". It cannot. `sops rotate` re-encrypts the *current* files with a
  new data key. Old commits still hold the old data key wrapped to the old
  recipient. Real revocation means rotating the secret *values* (tokens,
  passwords). This matters more once a person has one more device to revoke.

### Fleetrepo is the opposite model

Fleetrepo's `infra/.sops.yaml` has one rule with two recipients. Its
`dotfiles/docs/ALDER_AGENT_HOST.md` says the conductor "placed the authorized
SOPS age identity" on Alder. In other words, one identity is *copied* to each
of Jari's machines, not generated per device. That works for one person who
owns every machine and is root on all of them. It does not carry over to an
org account on a server whose root is someone else. On the Northwind pilot, root
is Jari, not Ville. Jari's own Birch account already has
`~/.config/sops/age/keys.txt` and `~/.ssh/id_ed25519`. Their provenance was
not checked.

## 2. A server account is a weaker place for a key than a laptop

Jari's decision allows parity. The differences below therefore shape the
**guidance and the defaults**, not whether keys may be there:

1. **Agents run unattended as the person.** A key on the account is usable by
   every agent turn, including one steered by prompt injection through a
   repository, an email or a web page. Passphrases do not help: an
   unattended agent cannot type one, and the daemon has no SSH agent
   (`internal/daemon/workspace_git_fetch_linux.go:35`). In practice the keys
   are unencrypted at rest in a `0600` file. The same is true on most
   laptops.
2. **Root is the operator.** Any Linux root can read the key. That is
   ordinary, but a Northwind person should be told plainly that "the operator"
   is Jari.
3. **Backups.** `docs/operations.md` tells operators to back up `/home` with
   credentials protected. The key lives in those backups too.
4. **The transcript and the model provider.** When an agent runs `cat
   ~/.config/sops/age/keys.txt` or `sops -d …`, the output goes into Pi's
   session history on disk *and* to the model provider. Decrypted secrets
   already reach the provider this way on a laptop running Claude Code. The
   private age key would be a new and worse leak, because it unlocks every
   tier at once, now and in future commits.
5. **The public half is itself security-relevant.** Whoever the admin adds as
   a recipient can decrypt. If a person copies "their public key" from an
   **agent's chat reply**, a prompt-injected agent could print an attacker's
   `age1…` recipient instead. The admin would then enrol the attacker. This
   is the strongest argument for a product surface that reads the public half
   straight from the native file, with the agent out of that path. It also
   argues for showing a fingerprint the admin can compare.

Mitigations that need no product code: scope the device (a `-habitat` entry
limited by `servers:`, a separate SOPS path holding narrowly scoped tokens, as
in the previous report's A′), give dated tokens where the provider supports
them, and revoke the device on its own. These are the org's choices. With
parity allowed, the product's role is to make them easy to understand, not to
impose them.

## 3. Native tools, and how far each fits

| Tool | What it gives here | Fit |
| --- | --- | --- |
| `age` / `age-keygen` (shipped, 1.1.1) | Identity generation; `age-keygen -y` derives the public key without printing the private one | Core |
| `sops` 3.13.3 (not shipped) | Decrypt, edit and `updatekeys` by `.sops.yaml` rules. It also takes **`ssh-ed25519` keys as age recipients** and falls back to `~/.ssh/id_ed25519` when decrypting (sops docs; confirmed in the spike) | Core; ship it |
| OpenSSH `ssh-keygen`, `ssh` | Key generation and fingerprints. `authorized_keys` options (`from=`, `restrict`, `expiry-time=`); certificates (`ssh-keygen -s`, validity `-V`, `source-address`) | Core; certificates are a later org option |
| `gh` | GitHub over HTTPS already works; `gh ssh-key add` needs a scope Habitat does not ask for | No change |
| 1Password `op` (service accounts, `OP_SERVICE_ACCOUNT_TOKEN`) and Bitwarden `bws` (`BWS_ACCESS_TOKEN`, machine accounts) | Org-managed vault access from a server. The bearer token on the account *is* the credential, and the data lives in the vendor's cloud. 1Password's SSH agent is a desktop feature, reachable from a server only by agent forwarding, which a browser session cannot do | Valid if an org already uses them; Northwind does not. Do not ship now. A person can install either into `~/.local/bin` |
| age plugins (YubiKey, TPM) | Hardware-held identities | Hardware cannot be present on a shared VM, and a server TPM would be root's. Not applicable |
| `SOPS_AGE_KEY_CMD` / `SOPS_AGE_SSH_PRIVATE_KEY_CMD` | Fetch the identity from a command, for example a password manager | Escape hatch for orgs that want it; no product work |

## 4. What Open Habitat ships today

- `runtime/core/ubuntu-packages.json`: `acl adduser gh git passwd quota tmux`.
- `runtime/profiles/operations/ubuntu-packages.json`: **`age`, `ansible`,
  `rsync`**. Someone already intended this profile for "operations" work, but
  it stops before `sops`.
- `openssh-client` is on every Ubuntu server image but no profile declares
  it. The earlier software inventory (`issues/inventory-agent-software/result.md`)
  already rated "OpenSSH client … **Yes**" and "age / SOPS … Optional, OS /
  Artifact".
- `sops` has no Ubuntu package. The integrations profile already pins exact
  upstream artifacts per target (`gog`, `tea`, `glab`, `rclone`, `himalaya`),
  and `runtime/profiles/AGENTS.md` says non-Ubuntu components are exact signed
  archives. `sops` fits that pattern as an exact artifact in the operations
  profile, for amd64 and arm64.
- Agent guidance: `internal/daemon/host-context.md` says nothing about keys or
  secrets beyond "never display" model credentials and "never ask them to
  paste passwords or tokens". No skill covers SSH/age setup.
- Settings: `internal/uiroutes/settings.json` has no keys page. The name
  "Laitteet" (`devices`) is already taken by browser sessions, and
  "aiavain"/"saneluavain" by provider keys. A new page needs a name that does
  not collide: "Avaimet" next to "AI-avain" is ambiguous.

## 5. Options

| Option | What the person does | Product cost | Authority / rule fit | Weak points |
| --- | --- | --- | --- | --- |
| **S. Skill + CLI only** | Asks the agent ("set me up for Northwind deploys"). The agent generates keys, prints the public halves and writes `~/.ssh/config` | Ship `sops`, declare `ssh`, one skill section | No new route | Non-technical people cannot tell which string is safe to share. **The agent sits in the trust path of the public key** (§2.5). An agent that runs `cat keys.txt` leaks the identity into the transcript and to the provider |
| **U. Keys page (read-mostly)** | Opens Settings → "Tämän tilin avaimet". Sees each SSH public key and the age recipient with a fingerprint, a copy button and a short "give this to your admin" text. Optionally "Luo avain" when none exists | A daemon read route (and an optional create), a contract, a page, tests | Daemon reads the person's own files in their UID. Replies carry public halves only, which already holds for `raw credentials are never returned`. Precedent: Pi `auth.json` presence and suffix reads. No new authority across components | Does nothing about enrolment on the org side or decryption. "Where used" can only be inferred from local files |
| **U+S. Both** | The page is the trusted place to copy from; the agent does the rest (config, `sops`, deploy) | U + S | As U | — |
| **SOPS UI** (browse or decrypt secrets, edit recipients in the browser) | Clicks through tiers and files | Large | A browser view of plaintext secrets turns the daemon into a secret-returning service. That conflicts with `raw credentials are never returned` and starts a broker. A recipient editor is org-specific (Northwind's `.sops.yaml` comment conventions, tier scripts) | Rejected |
| **Import the laptop's key** (paste or upload the private key) | Pastes `AGE-SECRET-KEY-…` | Small | Private key leaves its device. Per-device revocation is lost. The key crosses browser, gateway and daemon | Rejected. A person can still do it by hand in the shell; the product should not invite it |
| **One SSH key as both SSH key and age recipient** | One key to enrol | Smaller UI | Native (sops supports it) | Couples SSH revocation to secret revocation. Northwind's tooling and docs speak `age1…`. A choice for orgs, not the product default |
| **Password-manager CLI** | `op`/`bws` with a service token | Profile entries | Vendor store, not ours | Not Northwind's setup. The token is one more bearer secret on the account |
| **CI deploy** (previous report's B) | Nothing on the account | None | Cleanest: no production key on the account | Org work. Complements this; does not replace it while deploys are laptop scripts |

## 6. Recommendation

**Both, kept thin: ship the CLIs, teach the agent, and add a small
read-mostly keys page that is the trusted place to copy public halves from.**

1. **Runtime:** add `sops` v3.13.3 to the operations profile as an exact
   upstream artifact for amd64 and arm64. Verify the checksum file and its
   sigstore bundle at build time, as other exact artifacts are verified.
   Declare `openssh-client` there or in core. Leave password-manager CLIs out
   until an org needs one.
2. **Agent guidance:** add a short "keys and secrets" section to the agent
   skill (`open-habitat skill print agent`) or to `host-context.md`:
   - create keys in the account with `age-keygen` and `ssh-keygen`;
   - get the public halves with `age-keygen -y` and `cat *.pub`, never by
     printing `keys.txt`, a private SSH key or a decrypted file into the
     conversation;
   - send the person to the keys page to copy the public key instead of
     copying it from chat;
   - take host keys from a trusted source;
   - use `sops edit`/`exec-env` rather than leaving decrypted copies on disk;
   - enrolment and revocation are the org admin's work.

   This is the S half, cheap and useful on its own.
3. **Keys page (prototype first, per the prototype rule):** one settings page
   per account showing:
   - each SSH public key (`~/.ssh/*.pub`) with its fingerprint and comment;
   - the age recipient derived by the native `age-keygen -y` from the default
     identity file;
   - a copy button and a one-line "anna tämä ylläpitäjälle" explanation;
   - optionally "where it is referenced", read from `~/.ssh/config`
     `IdentityFile` hosts and from workspaces whose `.sops.yaml` lists this
     recipient (inferred, never claimed as access);
   - "Luo avain" only where no key of that kind exists, never overwriting.

   No private key, import, decrypt or recipient editing. The own-machine
   access prototype (`proto-own-machine-access`) needs the same surface for
   its SSH key. **One page and one component should serve both.** The
   proposal is to give that prototype round this page's axis instead of
   opening a second one.
4. **Org side stays the org's:** a short section in `docs/operations.md`
   ("a Habitat account as a device"): a separate device entry, scoping with
   `servers:` and separate SOPS paths, revoking one device, and that rotation
   protects future values only. Northwind's own docs and scripts are theirs to
   change.

Why not UI only: the page cannot write `~/.ssh/config`, run `updatekeys` or
deploy, and the agent does those well. Why not skill only: a public key is the
input to an admin's trust decision, and it should come from a surface the
agent cannot rewrite. Copying from chat also teaches people to copy from chat,
which is the habit that goes wrong with private keys.

## 7. Limits

- No test on the Northwind pilot. The pilot's outbound SSH reach to
  `ai.acme.test` and others was not checked.
- `from=` through `ssh-keys.sh` was not tested.
- The spike used the personal `~/.local/bin/sops` on Birch, not a product
  build.
- No external model review was run (no consult tool used in this run).

## Sources

Product (this repository): `internal/AGENTS.md` (daemon reads, "raw
credentials are never returned", integration tokens only in native stores);
`internal/daemon/host-context.md`; `internal/daemon/workspace_git_fetch_linux.go:35`;
`internal/gateway/github.go:24`; `internal/uiroutes/settings.json`;
`runtime/core/ubuntu-packages.json`; `runtime/profiles/operations/ubuntu-packages.json`;
`runtime/profiles/integrations/artifact-lock.json`; `runtime/profiles/AGENTS.md`;
`docs/operations.md` (backups); `issues/inventory-agent-software/result.md`;
`issues/research-ville-feedback/{item,report,result}.md`;
`issues/research-own-machine-access/item.md`, `issues/proto-own-machine-access/item.md`.

Northwind (read-only, commit `566fb56fd`): `.sops.yaml` (tiers, per-device
comments; public keys not reproduced); `operations/secrets/AGENTS.md`
(enrolment, `sops-admin.sh`, rotation claim, macOS key path);
`operations/ssh-keys/AGENTS.md` and `authorized_keys.yaml` (root login,
per-server/per-user scoping, host-key rule); `scripts/ssh-keys.sh`
(`user_has_access`, `cmd_add` validation, `cmd_generate`);
`acme-creator-web/scripts/deploy.sh:119`.

Fleetrepo (read-only): `infra/.sops.yaml`; `infra/AGENTS.md` "Secrets";
`dotfiles/docs/ALDER_AGENT_HOST.md` (`package/alder-sops`, placed identity);
`issues/sops-age-key-noninteractive/item.md`.

External:
- SOPS age identities and SSH recipients:
  https://getsops.io/docs/ (source:
  https://github.com/getsops/docs/blob/main/content/en/docs/usage/identities/age/_index.md)
- SOPS v3.13.3 release assets: https://github.com/getsops/sops/releases/tag/v3.13.3
- Ubuntu 24.04 package availability: `apt-cache policy age openssh-client sops` on Birch
  (age 1.1.1-1ubuntu0.24.04.3, openssh-client 9.6p1, no sops)
- age: https://age-encryption.org/ and `age-keygen(1)`
- OpenSSH `sshd(8)` AUTHORIZED_KEYS FILE FORMAT (`from=`, `restrict`,
  `expiry-time=`); `ssh-keygen(1)` CERTIFICATES
- 1Password Service Accounts: https://developer.1password.com/docs/service-accounts/ ;
  SSH agent forwarding: https://developer.1password.com/docs/ssh/agent/forwarding/
- Bitwarden Secrets Manager CLI: https://bitwarden.com/help/secrets-manager-cli/

Spike (throwaway keys in a disposable `HOME`, scratch directory deleted
afterwards): `age-keygen` wrote a `0600` identity with a `# public
key:` comment; `age-keygen -y` returned the recipient; `sops -e -i`/`-d` with
an `age1…` rule worked with no environment variable; with an `ssh-ed25519`
rule and the age identity moved away, `sops -d` decrypted through
`~/.ssh/id_ed25519`, and the `age1…` file then failed as expected.

## spinoff_proposals

Proposed only; none filed.

```json
[
  {
    "title": "Operations profile ships sops (exact upstream artifact) and declares openssh-client",
    "type": "improvement",
    "why": "Ubuntu 24.04 has no sops package; age is already in the operations profile. Pin getsops/sops v3.13.3 linux amd64/arm64 with checksum + sigstore verification like the integrations artifacts; declare openssh-client, which agents already rely on but no profile names.",
    "authority_change": false
  },
  {
    "title": "Agent guidance: keys and secrets on a Habitat account",
    "type": "improvement",
    "why": "Generate in the account; get public halves with age-keygen -y / *.pub; never print keys.txt, a private key or decrypted files into the conversation (transcript and model provider); point the person to the keys page to copy; host keys from a trusted source; enrolment and revocation are the org admin's.",
    "authority_change": false
  },
  {
    "title": "Prototype: this account's public keys in Settings (SSH + age), shared with own-machine access",
    "type": "feature",
    "why": "A trusted place to copy public halves from, out of the agent's reach (a prompt-injected agent could print an attacker's recipient). Public halves, fingerprints, copy, optional create-if-absent, optional inferred 'where referenced'. Fold into proto-own-machine-access or run as a sibling round on the same component.",
    "authority_change": false
  },
  {
    "title": "docs/operations.md: a Habitat account as a device (enrol, scope, revoke)",
    "type": "task",
    "why": "Supersedes the previous report's 'bring your own deploy keys' guide proposal now that parity is allowed: separate device entry, servers:/separate SOPS paths as optional scoping, per-device revocation, rotation protects future values only.",
    "authority_change": false
  },
  {
    "title": "Northwind (outside this repository): correct the rotation claim and test from= in authorized_keys.yaml",
    "type": "task",
    "why": "operations/secrets/AGENTS.md says rotation stops a revoked user decrypting git history; it cannot, only rotating secret values does. ssh-keys.sh add rejects option-prefixed key lines; whether a hand-edited from= line deploys is untested. Northwind's call.",
    "authority_change": false
  }
]
```
