# Result

Local runtime VM admission is now **4012 MiB** (3500 MiB hard container cap +
512 MiB host margin), rather than 6 GiB. Both the Podman argument and admission
arithmetic use `memory_mib`, so changing the cap changes admission too. The
capacity error reports the computed KiB requirement. The external trusted runner
still owns its own admission; the shared guest lock is unchanged.

## Measurement

On Alder, Podman 5.7.0, a short networkless idle container using the existing
`localhost/open-habitat-vm-tools:prereq` image and the runtime launch flags
(`--userns=keep-id --security-opt=no-new-privileges --cap-drop=all
--memory=3500m --cpus=2`) measured:

| Process | `/proc/PID/status` VmRSS (KiB) |
| --- | ---: |
| Attached `podman run` | 47560 |
| Its conmon | 2492 |
| Container shell (inside cap) | 1672 |

The measurement used Python `subprocess.Popen` to launch `podman run -i --rm
--name <unique-name> ... sh -c 'echo READY; read line'`, waited for READY, read
`podman inspect <unique-name>` for `State.ConmonPid` and `State.Pid`, and read
VmRSS for those PIDs and the Popen PID. Sending a newline ended the shell;
Podman exited zero and removed the container. No QEMU guest was started.

Podman + conmon total **50052 KiB** outside the cap. Rounded up to **512 MiB**
(>10 times that sample) allows supervisor variation and unrelated host headroom.
This is a conservative margin based on one idle-container sample, not a measured
peak or a guarantee against concurrent unrelated allocation. QEMU guest RAM and
TCG allocations are already charged within the hard container cap; adding their
RSS again would double-count them. The existing guest serial log reports guest
memory, not host supervisor RSS, so it was not used as overhead evidence.

Searches across `scripts/` for `6291456`, `runtime_vm_capacity_unavailable`,
`6 GiB`, and `3500m` found only this production guard; there is no sibling copy
to update. The separate generic VM recipe has a different cap and no copied
capacity guard.

## Validation and review

Tested the changed scripts on base `bd5f55719ebbfb2346172196e89c542e06489878`:

- `python3 scripts/test-profile-runtime-build.py`: all 12 tests pass. The new
  test executes the real command-selection shell offline: one KiB below the
  boundary refuses, the exact boundary and 4 GiB admit, missing/malformed RAM
  refuses, changing the cap moves both admission and the Podman argument, and
  the external-runner branch bypasses the local check.
- `bash -n scripts/test-core-runtime-vm.sh`: pass.
- `git diff --check`: pass.
- `issuectl doctor --json`: pass.
- `test-focused.sh --help` offers web/browser/go/contracts, not a script area;
  ran the existing runtime script suite directly instead.
- Shellcheck is not installed and the repository scripts do not invoke it;
  not run.

Focused self-review checked units (Podman's `m` is MiB, `/proc` reports KiB),
cap/guard coupling, fail-closed malformed input, external-runner behavior and
unchanged locking. This bounded arithmetic/comment change needs no external
review. No full VM qualification was run, as requested; guest success and peak
supervisor memory remain unverified by this change.
