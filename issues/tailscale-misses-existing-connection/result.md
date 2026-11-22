# Result

Implemented in `16731c33b559a46e22d4a7377a8b9252d482adee`.

Setup now rereads the person's node when opened, rather than trusting the
settings page's earlier observation. A connected node takes setup directly to
machine selection, including when connection completes while the dialog is open.
Visible, unsaved computer peers are offered without telling the person to install
Tailscale again. The person still selects their machine; none is selected or saved
automatically. A read started before a connect write cannot overwrite its reply.

## What can actually be observed

The authority is `internal/daemon/own_machines_linux.go`, not the browser:

- `ownMachineEnv` addresses this Unix account's private userspace Tailscale node
  through its runtime-directory LocalAPI socket. Its systemd unit, state and
  configuration belong to this account. This is distinct from a host-wide
  Tailscale installation and from another account's Habitat node.
- `read` observes `BackendState`, the authentication URL, the node's name/address,
  tailnet/login, shields preference and the peers supplied by that node's status.
  The peer list is validated, sorted and bounded, with OS, address, online state
  and last-seen information. It is not an enumeration of every device in every
  tailnet the host or its administrator can access.
- Peer visibility depends on Tailscale's access policy and sharing. An online
  peer is not proof of TCP/22 reachability, SSH credentials or permission to use
  that computer. The existing check and host-key confirmation steps still prove
  those separately before saving access. `ssh: possible` classifies the OS; it
  does not report a successful SSH probe.
- No existing response identifies the computer running the browser. A public
  HTTPS request, browser platform, or matching-looking device name does not bind
  it to a peer. A visible peer may be another computer. We therefore offer the
  person's peer list, not a claim that a particular peer is “this computer”.
- If this account's node needs login, the QR authorizes **that Habitat node**.
  The laptop already being on a tailnet does not authorize the Habitat node.
  Neither another person's connection nor the host's network can be borrowed to
  skip that step. After approval, an already-visible laptop can be selected
  immediately without joining it again.

The original installation was not inspected, so this does not claim to establish
whether its account node was unauthenticated or whether the settings observation
was stale. Both cases now have accurate behavior and copy within existing authority.
No daemon, gateway, contract, LocalAPI read or authorization boundary changed.

External cross-check: Tailscale's documentation “Tailscale identity” explains
separate userspace clients as distinct nodes; “What devices can connect to or
know mine?” explains policy-filtered visibility. Consulted 2026-11-22:
`https://tailscale.com/docs/concepts/tailscale-identity` and
`https://tailscale.com/docs/concepts/device-visibility`.

## Decisions for later review

- Keep per-account node approval even when a laptop already has Tailscale.
  Alternatives were to borrow the host's or another user's node, or infer a
  browser-to-peer mapping; neither follows the existing security model.
- Advance to the machine list as soon as the account node is connected, even if
  its peer list is empty. An extra “Next” after authorization adds no choice.
  The empty-list case retains installation guidance; visible computers get a
  selection prompt. Do not preselect even a lone peer: visibility is not ownership.
- Keep connection probing in the existing SSH check step, rather than equating
  Tailscale's online flag with usable remote access or probing all peers on a read.

## Verification and review

All commands used `umask 077`, an outer timeout and the scratch lease. Tested
product/test sources match the commit above.

- `./scripts/test-focused.sh --area web`: final run passed static/catalog checks
  and 2,157 tests in 256 files. An earlier run failed two untouched Integrations
  component tests; those passed in a focused rerun (36 tests with the new own
  machines test) and the complete final web rerun. No Integrations code changed.
- `./scripts/test-focused.sh --area browser --spec own-machines.spec.ts --spec
  lab-own-machines-layout.spec.ts`: 5 ordinary and 3 lab cases passed during
  development. The first attempt lacked the pinned Pi SDK fixture; installed it
  with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` and reran.
- Final repeated named-spec runs: `npx playwright test tests/own-machines.spec.ts
  --repeat-each 3` (15 passed), and `npx playwright test --config
  playwright.lab.config.ts tests/lab-own-machines-layout.spec.ts --repeat-each 3`
  (9 passed). Both used two workers, port base 15300 and reply jitter 0–60 ms.
- The new two-tab case establishes a stale “off” page, connects the same account
  elsewhere, then opens setup and requires peer selection without a connect POST
  or QR. Existing journeys cover initial authorization, adding, SSH key checking,
  renewal, removal and phone/Windows behavior. The controlled unit test delivers
  an opening read after the connect reply and verifies it cannot regress login.
- Focused manual diff review: checked observation ownership, read/write ordering,
  explicit peer selection and continued SSH/key checks. Independent LLM review
  was not required: no host read, daemon state, session, contract or authority
  change. No new controls were introduced. Go tests were not run because no Go
  code or Go fixture was changed. No full browser suite or clean gate was run.
- Synthetic same-UID browser-host evidence, not real-tailnet reachability,
  distinct-UID isolation, deployment or live-account acceptance.

## Live check

After deployment, open Settings › Own machines in an account whose Habitat node
is already connected. Add a machine: the peer list should open without login.
For a new account node, approve Habitat once; setup should then move to the peer
list automatically. Select an already-connected laptop and complete the normal
SSH and host-key verification. A laptop alone being connected must not bypass
Habitat's own approval. This live check remains pending deployment.
