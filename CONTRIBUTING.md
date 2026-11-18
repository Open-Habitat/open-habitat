# Contributing to Open Habitat

Open Habitat is a multi-user web host for native AI agents: each person
signs in through the browser and works with their own agent as their own
Linux user. Thank you for wanting to help with it.

The project has one maintainer and is in pre-release. That shapes what is
below: small, focused changes are easy to take, and a change of direction
needs a conversation first.

## Reporting problems and asking questions

- **Questions and ideas** go to
  [Discussions](https://github.com/Open-Habitat/open-habitat/discussions).
- **Bugs and feature requests** go to
  [GitHub Issues](https://github.com/Open-Habitat/open-habitat/issues).
- **Vulnerabilities** never go to a public issue. Follow
  [SECURITY.md](SECURITY.md).

Describe the steps that reproduce a problem on a fresh installation, with
made-up accounts and paths. Do not post logs, screenshots, hostnames,
account names or conversations from a real installation: an issue is public
the moment it is posted.

The `issues/` directory in the repository is not a second place to report.
It is the maintainers' tracker of accepted work and needs commit rights. A
report that is accepted is mirrored there, so your GitHub issue may be
closed with a note that the work continues in the tree.

## What to discuss before writing code

Bug fixes and documentation fixes are welcome as pull requests without
asking first.

Open an issue or a Discussion before building any of these, and wait for
the maintainer's answer:

- a change to which component holds which authority (`internal/gateway`,
  `internal/daemon`, `internal/provision`), or anything else in the security
  model;
- a change to the browser/host contract in `contracts/v1/`;
- a new dependency, store, service or abstraction;
- a new feature or a change to how an existing one behaves.

The reason is the project's two founding ideas, described in
[AGENTS.md](AGENTS.md): Unix users are the security boundary, and native
tools keep the truth. Moving authority between components is an
architecture change however small the diff, and a pull request that does it
unannounced is likely to be declined even when the code is good.

## Development setup

You need Go 1.27.1 and Node 22.23.2. If Go is missing,
`./scripts/bootstrap-tools.sh` installs it locally and prints the `PATH`
export. Install the browser package's dependencies once:

```sh
npm ci --prefix web
```

All tests use synthetic homes, accounts and credentials. Nothing in the
test suite needs, or should be pointed at, a real installation.

## Checks before a pull request

Run the checks that match what you changed:

```sh
./scripts/test-focused.sh --area web
./scripts/test-focused.sh --area go --go-package ./internal/gateway
./scripts/test-focused.sh --area contracts
./scripts/test-focused.sh --area browser --spec <spec-file>
```

A change to shared fixtures, the contract, authentication or build inputs
needs the full gate, which wants a committed tree with no untracked files:

```sh
./scripts/ci-local.sh --clean --json
```

There is no hosted CI. [TESTING.md](TESTING.md) says which checks prove
what, and what a new test has to be worth. Say in the pull request which
checks you ran.

A change to the wire starts in the schema: `internal/contracts/` and
`web/src/contracts/` are generated from `contracts/v1/`, and
`scripts/check-generated.sh` fails on drift.

## Pull requests

Branch from `main` and open the pull request against `main`. Keep one
logical change per pull request. Say what the change does for a person
using or running Open Habitat, and how you checked it: for anything visible
in the browser or on a host, a screenshot or command output from a synthetic
setup tells more than passing unit tests.

## Commit messages

Write a short subject that names the area and the effect, as the log does
(`fix(web): ...`, `daemon: ...`), and use the body for the reason. The
version is not derived from commit types.

## Working with AI agents

Agent-written changes are welcome; much of this project is written that
way. The same rule applies as to any other change: you understand it, you
have run it, and you answer for it. Write issues, pull request descriptions
and review replies in your own words.

[AGENTS.md](AGENTS.md), and the `AGENTS.md` in each directory, hold the
project's rules for people and agents alike. Run your agent from the
repository root so that it reads them.

## Changelog

The maintainer writes the entries in [CHANGELOG.md](CHANGELOG.md) at
release time. Nothing is asked of you beyond a pull request description
that says what changes for the person upgrading.

## Sign-off

Contributions are accepted under the
[Developer Certificate of Origin](https://developercertificate.org/). Sign
off each commit to certify that you wrote the change or have the right to
submit it:

```sh
git commit -s
```

This adds a `Signed-off-by:` line with your name and address to the commit
message.

## License

Contributions are licensed under the project's [MIT license](LICENSE).
