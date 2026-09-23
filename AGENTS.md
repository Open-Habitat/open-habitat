# native-agent-host

Multi-user web platform for hosting native AI agent sessions and application-specific agent interfaces.

## CLI Design Principles

This project follows the AI-first CLI conventions — strict input validation, `--json` output, JSONL logs, no interactive prompts, informative errors, and composable commands. Use the `/ai-first-cli-canon` skill installed by `project-canon skill install` whenever designing or changing CLI surface. The installed, versioned skill is authoritative; do not maintain a repo-local canon copy.

## Gitignored directories

- `history/` — agent scratchpad and ephemeral planning docs (not tracked)
- `/target` — Rust build artifacts

## Documentation Pattern

Every directory follows this structure:

- `CLAUDE.md` — symlink to `AGENTS.md`
- `AGENTS.md` — all AI-relevant info (consolidated)
- `AGENTS-<TOPIC>.md` — complex topics split out (optional)

Do not create `README.md` files in subdirectories. Normalize incoming README
content into the governing `AGENTS.md`, the relevant issue `item.md`, or another
canonical owner. A repository-root `README.md` is allowed only as the public
GitHub front door.

Project documentation lives directly in `docs/`, starting at `docs/index.md`.
Read [docs/AGENTS.md](docs/AGENTS.md) before documentation work. This directory
follows the normal AGENTS.md/CLAUDE.md convention. Glasspad is a viewer of this
documentation; its rendering constraints must not determine the source layout.
Do not maintain a separate site source tree.

## UI design

The shared UI tokens, guidelines and component references live under
`design-system/`; read that directory's `AGENTS.md` before UI work. The first
conversation design and clickable prototypes live under
`issues/receive-designer-v1/design/` and remain under Jari's review.

Treat the included JSX as design reference, not chosen production architecture.
Do not turn prototype behavior into v1 requirements until the review and Pi
adapter probe explicitly accept it. Current design work is desktop-first; revisit
mobile after a working desktop version.

## Issues & Planning

Issue tracking is managed by [`issuectl`](https://github.com/example-org/issuectl). Use the `/issue` skill (installed by `issuectl init`) to create, search, update, and close issues.

- `issues/<slug>/item.md` — every issue and epic (flat layout — no numeric prefix, no `open/closed/` split)
- Status lives in the `status:` frontmatter field, not in the path

All planning documents belong under their parent issue directory — not as standalone files. **Open an issue before building a feature**; keep this file describing the repo, not pre-designing the tool.

## Conformance

`CONFORMANCE.md` tracks this repo against the AI-first CLI canon — flip each row to `pass` as the surface lands. Verify mechanically with `project-canon doctor`.

## Work-session handoff

`TODO.md` is the root handoff narrative for `/stint-start`: current context,
external design work, local changes and verification/deployment guidance.
Detailed plans stay under their parent issue. Issuectl lane/dependency metadata
is the only execution schedule; do not derive a second queue from TODO.md.
External designer delivery has no executable lane. Accepted post-MVP UI work is
scheduled after the MVP review and begins with an explicit design/review task before
any implementation is activated. See the current handoff before starting a stint.

Read [AGENTS-WORKFLOW.md](AGENTS-WORKFLOW.md) before a work-session round. It
defines this repo's prepared MVP path, shared-file ownership, human-review
handling, verification and deployment boundaries. `human-review` issues are
handled by the conductor with Jari, have no executable lane, and remain blockers
until the actual review decision is recorded.

## Application foundation

The production scaffold is one Go 1.27.1 module/binary plus one locked browser
package in `web/`. Runtime authority is explicit:

- `internal/gateway` owns same-origin HTTP, OAuth/session/CSRF and mapped
  daemon routing; it must not read user homes or run agents.
- `internal/daemon` runs as one Unix UID and owns native discovery and
  agent children; it never chooses a web identity.
- `contracts/v1/` is authoritative. `internal/contracts/` and
  `web/src/contracts/` are deterministic derivatives.
- `web/src/components/` contains production components imported by both the app
  and Storybook. Test fixtures are enabled only by the explicit Vite test env.
- `systemd/`, `sysusers.d/` and `tmpfiles.d/` are package templates, not evidence
  of a deployed host. No Fleetrepo or machine state is changed here.

A clean environment must provide Node 22.23.2 and Go 1.27.1. CI reads
`web/.node-version` and pins Go explicitly. A developer without Go may run
`./scripts/bootstrap-tools.sh` and then use the printed repository-local PATH;
it never installs a machine binary.

Required commands from the repository root:

```sh
export PATH="$PWD/.tools/go/bin:$PATH" # only after optional local bootstrap
go version
node --version
npm --version
npm ci --prefix web
npm run format:check --prefix web
npm run lint --prefix web
npm run typecheck --prefix web
npm run test:unit --prefix web
npm run test:component --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm exec --prefix web playwright install chromium
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:e2e --prefix web
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:a11y --prefix web
npm run build --prefix web
npm run build-storybook --prefix web
go fmt ./...
go vet ./...
go test -race ./...
CGO_ENABLED=0 go build -trimpath ./cmd/native-agent-host
go generate ./internal/contracts
./scripts/check-generated.sh
python3 issues/define-host-contracts/validate_contracts.py
python3 issues/plan-v1-implementation/validate_plan.py
python3 scripts/validate-project-view.py
python3 scripts/check-licenses.py
./scripts/vm-test.sh self-test --json
./scripts/package-release.sh --version 0.0.0-test --target linux-amd64 --web-dir web/dist --output dist/
./scripts/verify-release.sh --archive dist/native-agent-host-0.0.0-test-linux-amd64.tar.gz --json
issuectl doctor --json
git diff --check
```

`./scripts/ci-local.sh --clean --json` runs the complete bare-CI approximation,
including locked/offline-after-fetch npm installation, generated drift,
reproducible packaging and a clean-tree assertion. For focused development use
`npm run dev --prefix web -- --host 127.0.0.1`,
`npm run storybook --prefix web -- --no-open`, or the package-level test commands
above. The clean gate's offline VM self-test demonstrates only recipe validity.
The explicit `./scripts/vm-test.sh two-user-routing --json` boots a private guest
and proves actual product OAuth/session, per-UID systemd UDS routing, native-gh
adapter and workspace snapshots against guest-local synthetic fixtures. It does
not prove real GitHub credentials, Pi control, histories, browser visuals,
live-host isolation or deployment.
