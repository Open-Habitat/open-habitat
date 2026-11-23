Verdict: hold

# podman-compose 1.5.0 → 1.6.0

Assessed 2026-11-23 against repository revision `136cfe997`. **Do not raise the
pin automatically:** the published 1.6.0 wheel reproduces an interpolation
regression on a Compose file accepted by 1.5.0. Packaging remains compatible;
that does not make the native workflow safe. No product pins were changed.

## 1. Installability, behavior and supply chain

### Confirmed blocker: numeric environment interpolation crashes

The following synthetic file succeeds with the pinned wheel and fails with the
candidate, before any container operation:

```yaml
services:
  app:
    image: example.invalid/app:1
    environment:
      PORT: 8080
    command: echo ${PORT}
```

Run each wheel's `podman_compose.py` with
`--podman-path ./fake-podman --in-pod=false -f compose.yaml config`, with
`PORT` absent from the process environment. The executable `fake-podman` is:

```sh
#!/bin/sh
[ "$1" = "--version" ] || exit 90
printf 'podman version 4.9.3\n'
```

Observed with Python 3.12.3, PyYAML 6.0.1 and python-dotenv 1.0.1:

| Wheel | Result |
| --- | --- |
| 1.5.0 | Exit 0; command becomes the list `echo`, `'8080'`. |
| 1.6.0 | Exit 1; `TypeError: sequence item 0: expected str instance, int found`. |

Both wheels were downloaded from PyPI and SHA-256 verified. Execution used
isolated Python with only the scratch dependency directory explicitly added,
a disposable HOME, and the fake Podman above; no images or native containers
were used. This is CLI parsing evidence, not mapped-user runtime acceptance.

**Cause:** `rec_subs` includes service-local environment values when substituting
commands. In 1.5.0 its replacement function applies `str(value)`; 1.6.0's new
`var_interpolate` returns the integer from `VarToken.resolve`, then passes it to
`''.join(resolved_parts)`. `normalize_service` does not stringify dictionary
values. The failure is therefore reachable through ordinary CLI parsing, not
just an unsupported direct Python API call. Quoting the numeric YAML value is a
workaround, not grounds to silently break existing workspaces. This finding is
recorded in this existing pin issue rather than filed as a duplicate.

Sources: [1.5.0 source][old-code], [1.6.0 source][new-code], [complete tag diff][diff],
and the differential execution described above. The candidate wheel's Python
source was also byte-identical to the upstream v1.6.0 tag source.

### Requirements and other changes

- Both distributions declare Python `>=3.9` and the same two runtime
  dependencies, `python-dotenv` and `pyyaml`; development extras are unchanged.
  This is Python, not npm: no Node engine requirement or native Node module.
  The product wrapper uses `/usr/bin/python3 -I`, not the optional Python profile.
  The core's actual Node lock here is 22.21.1, unrelated to this component.
  The tested Python 3.12 stack matches the relevant Ubuntu baseline.
  Sources: [old metadata][old-json], [new metadata][new-json],
  `runtime/core/artifact-lock.json`, `scripts/profile-runtime-build.py`.
- Upstream still documents Podman >=3.4 for the modern branch. The containers
  profile requires Podman `4.9.3+ds1-1ubuntu0.2` or newer, python3-dotenv
  `1.0.1-1` and python3-yaml `6.0.1-2build2` or newer, supplied by Ubuntu.
  Source: [upstream README][readme],
  `runtime/profiles/containers/ubuntu-packages.json`.
- Important observable changes beyond the blocker: `up` switches from
  project-wide to per-service configuration hashes; existing 1.5.0 hashes can
  trigger recreation on the first 1.6.0 `up`. Selected-service `down` now follows
  dependents instead of dependencies. Logs gain colored service prefixes;
  `--no-color --no-log-prefix` is the closest raw-output choice. `pull` now returns
  failures. `--pull` takes an optional policy argument and `--pull-always` is
  deprecated, so scripts should use explicit `--pull=always` rather than put a
  service name immediately after the option. Bind `create_host_path: false` is
  enforced, and symlink bind sources are no longer canonicalized with `realpath`.
  Sources: [tagged changelog][changelog] and [source diff][diff].
- Pre-teardown pulling is guarded by Podman >=5.6.0; it is skipped on the declared
  4.9.3 baseline. `--wait` requires >=4.6.0. Newer mount/health/build options still
  need feature-specific Podman qualification; a Python version check is not
  evidence for them. Source: `prepare_images` and
  `wait_for_container_running_healthy` in [candidate source][new-code].

### Licensing and provenance

The licence remains `GPL-2.0-only`; the complete LICENSE bytes are identical
between wheels (SHA-256
`8177f97513213526df2cf6184d8ff986c675afb514d4e68a404010521b880643`).
Each wheel contains only the main Python module and six distribution metadata
files: no vendored dependency tree, native extension, `.pth` startup hook or
new dependency payload. Ubuntu still supplies the dependency closure under
its existing package/source obligations. The product retains the source wheel,
extracted module, LICENSE and METADATA; preserve those rather than replacing the
copyleft notice with a product licence. Sources: downloaded wheel inventories,
[old metadata][old-json], [new metadata][new-json], and
`scripts/profile-runtime-build.py`.

PyPI reports 1.6.0 as latest and non-yanked on the assessment date. It was uploaded
2026-06-03, 173 calendar days earlier. The release has **no PyPI provenance
attestation and was not uploaded with Trusted Publishing**; uploads identify
Twine 6.2.0. This is also not an npm package, so npm registry signatures and npm
provenance are inapplicable. GitHub marks the release tag signature verified,
but that does not cryptographically bind the uploaded wheel to its build.
Sources: [PyPI release details][pypi], [current registry metadata][latest-json],
[GitHub release][release].

Both version records name the same upstream repository; no repository move or
runtime-dependency change appeared in the tag diff. Historical registry role
changes cannot be established from present-day metadata, so this is not a claim
that publisher ownership was independently audited. The diff changes release
workflow action versions and documents manual Twine publication, not a new
runtime install hook. The product extracts selected files from a digest-checked
wheel; it runs neither pip installation nor upstream build/install scripts.
Sources: [tag diff][diff], `scripts/build-profile-runtime.sh`,
`scripts/profile-runtime-build.py`.

### Both archive targets

The same `py3-none-any` wheel serves linux-amd64 and linux-arm64; there are no
per-target downloads or bundled native modules. Ubuntu resolves native package
architectures separately. Sources: [registry files][new-json],
`runtime/profiles/AGENTS.md`, `scripts/profile-runtime-build.py`.

| Measurement | 1.5.0 | 1.6.0 |
| --- | ---: | ---: |
| PyPI wheel bytes | 47,129 | 53,722 |
| Main Python module bytes | 157,325 | 185,464 |
| Locally sealed containers archive bytes, either target | 94,908 | 107,496 |
| Expanded tar bytes, either target | 245,760 | 276,480 |
| Inventory entries | 10 | 10 |

The latter three rows were measured by invoking the unchanged product builder
with scratch copies of the two locks and verified wheels, once per target.
The archive bytes are identical across targets because the payload is portable;
the descriptor's Ubuntu requirement architectures differ. These are file-only
builder results, not native arm64 execution or the outer containerized fetch
script. Archive size can vary with builder/compression environment.

Candidate wheel SHA-256:
`98e48af25d44c10ecef948163bfcca002e32aa8bbb7e66593fbd4faff7270c30`.
Its exact download URL is in [the version-specific PyPI record][new-json].
The sdist is 53,935 bytes, but is not the product's selected artifact.

## 2. What a later bump must update and prove

If the regression is fixed in an acceptable upstream release:

1. Change only the relevant version, official wheel URL and SHA-256 in
   `runtime/profiles/containers/artifact-lock.json`; retain the stable local
   filename `podman_compose.whl`. Keep `deb_dependencies` synchronized with
   `ubuntu-packages.json`; no new minimum is justified by this release alone.
2. Rebuild both containers archives and regenerate their `artifact.json`
   descriptors and release manifest. The builder regenerates `compose-lock.json`,
   source wheel/module, METADATA/LICENSE copies, component version/digest,
   file digests, archive digest and sizes. Do not hand-edit these records or
   reuse an old containers archive with the new pin.
3. No npm package-lock, browser lock, Cargo.lock/crate licence record, web lock,
   core version constant or generated browser contract needs changing for this
   Python wheel. `internal/host/release_closure_linux.go` has no accepted
   podman-compose version constant. The synthetic 1.5.0 wheel in
   `scripts/test-profile-runtime-build.py` is a fixture, not a second live pin.
4. There is no carried podman-compose source patch. Preserve the product wrapper
   (`initialize-netns`, fixed system Python, `--in-pod=false`) and the container
   user service. Adopting a local upstream fix would introduce a new carried
   patch and is **not** authorized as a mechanical bump.

Repository sources: `scripts/profile-runtime-build.py`,
`scripts/build-profile-runtime.sh`, `runtime/profiles/containers/config/`,
`internal/host/release_closure_linux.go`, `TESTING.md`, and
`docs/operations.md` (Build and verify runtime archives).

Focused acceptance for that future change:

- Re-run the differential fixture above against the fixed candidate, retaining
  the original unquoted integer; also check nested/default substitution,
  ordinary build/up/down, explicit pull policies and log flags.
- Run `python3 scripts/test-profile-runtime-build.py` for inventory, digest,
  dependency and wrapper checks. It uses synthetic inputs and cannot catch the
  candidate's parser regression by itself.
- Build with `scripts/build-profile-runtime.sh --target linux-amd64 containers
  NEW_OUTPUT` and the corresponding `linux-arm64` command. Verify both complete
  release descriptors using `runtime-release manifest`/verification, including
  this optional artifact rather than just core/integrations.
- Run affected host closure tests (`go test ./internal/host -run
  'TestReleaseClosure|TestReleaseOptionalClosureRequiresLocks'`) with the
  repository's documented prerequisites. Test native rootless Compose under
  mapped users on the qualified platform, including upgrading an existing
  1.5.0 stack and observing recreation. Existing repository profile tests do
  not establish that workflow; `TESTING.md` explicitly distinguishes it.

## 3. Product features and code paths touched

This is the **optional containers profile** used for native workspace/agent
Compose commands, not the Pi SDK or browser protocol.

- `scripts/profile-runtime-build.py:build` packages and wraps the executable.
- `runtime/profiles/containers/config/initialize-netns` and
  `open-habitat-containers.service` prepare the per-user rootless environment;
  the wrapper invokes the helper before Compose.
- `internal/host/apply_generation_linux.go` publishes profile selectors and
  `runtimeUserPolicies` installs the selected container user-service file.
- `internal/host/runtime_payload_linux.go` and
  `internal/host/release_closure_linux.go` provide payload/inventory acceptance.

No product code imports `podman_compose` or parses its log format. Thus most
upstream CLI changes require native-workflow qualification rather than a browser
contract migration. The reproduced parse failure nevertheless affects users'
existing workspace commands directly. These conclusions come from the listed
sources and repository searches for `podman-compose`/`podman_compose`.

## 4. New capabilities — proposals, not bump scope

The [1.6.0 changelog][changelog] adds readiness waiting, environment-selected
Compose profiles, nested interpolation, image/glob mounts, environment-sourced
build secrets, service-image additional build contexts and healthcheck startup
intervals.

- **Readiness-aware workspace recipes:** qualify `up/start --wait` and bounded
  `--wait-timeout` with healthy, unhealthy and timeout cases before recommending
  them. Do not infer reliable readiness from the presence of the CLI flag.
- **Composable development stacks:** test `COMPOSE_PROFILES`, nested variables
  and inter-service build contexts in synthetic recipes. Existing native CLI
  exposure needs no new product UI; guided templates would be separate work.
- **Build secrets and richer mounts:** qualify actual Podman option support on
  the minimum Ubuntu platform, secret non-disclosure and mount behavior before
  advertising recipes. Environment-sourced secrets are build-only in 1.6.0;
  runtime use is explicitly rejected by `get_secret_args` in [source][new-code].

Do not raise the Podman minimum, add a secret broker, or change workspace
orchestration as part of this pin update. None is required merely to package
this wheel, and none is authorized by this research.

## 5. Verdict and evidence limits

**Hold 1.6.0; retain 1.5.0.** Prefer an upstream fix and a subsequent released
wheel, then repeat the reproducer and focused qualification. Packaging succeeds
on both targets, but a confirmed user-facing regression prevents `safe-to-bump`.
No independent supply-chain or licence-change blocker was observed.

Performed: upstream metadata/tag/diff and wheel inspection; SHA-256 comparisons;
old/new CLI reproducer; four file-only archive builds; all 16
`test-profile-runtime-build.py` tests; `validate-project-view.py`; and
`git diff --check`. No native container lifecycle, mapped-user acceptance,
arm64 execution, full release manifest verification, or whole-product gate was
run. Successful synthetic packaging is not a substitute for those claims.

[old-json]: https://pypi.org/pypi/podman-compose/1.5.0/json
[new-json]: https://pypi.org/pypi/podman-compose/1.6.0/json
[latest-json]: https://pypi.org/pypi/podman-compose/json
[pypi]: https://pypi.org/project/podman-compose/1.6.0/
[release]: https://github.com/containers/podman-compose/releases/tag/v1.6.0
[changelog]: https://github.com/containers/podman-compose/blob/v1.6.0/docs/Changelog-1.6.0.md
[readme]: https://github.com/containers/podman-compose/blob/v1.6.0/README.md
[old-code]: https://github.com/containers/podman-compose/blob/v1.5.0/podman_compose.py
[new-code]: https://github.com/containers/podman-compose/blob/v1.6.0/podman_compose.py
[diff]: https://github.com/containers/podman-compose/compare/v1.5.0...v1.6.0
