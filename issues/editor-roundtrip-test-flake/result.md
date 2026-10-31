# Result

**Cause.** The test's last stale-save check reused the version token from the
very first read, after two byte-identical saves. Each save writes a temporary
file and renames it over the original, which frees the previous inode. On ext4
the second save's temporary file often gets the original's freed inode number.
With the same size, mode and bytes, and mtime/ctime in the same 1 ms kernel
timestamp tick (Linux 6.8, HZ=1000, coarse timestamps), the file's token is
again exactly the first read's token, so the "stale" save was accepted with
200. It reproduced in 655 of 3000 isolated runs on Birch. No load is needed;
the flake was simply frequent. No leftover process was involved (the
f9b90949 pattern does not apply: this test starts no process).

**Fix (test side).** The product is right. The token names the observed state,
and in the failing case the file really was in that state again, so accepting
the save cannot lose anyone's change. The test now uses the first save's token
as the stale base. That inode was still live when the second save created its
replacement, so the two can never share an inode number.

**Proof.** 3000 of 3000 `TestEditorFiles*` runs passed (each run covers every
editor file test). 2×200 runs of `TestEditorFilesRoundTripAndConflict` passed
under load: 8 CPU burners on 8 cores plus a full `internal/daemon` loop in
parallel, Go under `umask 077`. The focused `./internal/daemon` run passed.
Review: focused self-review (test-only change).

## Decisions for later review

- Version token semantics left as is (state identity, not history). The
  alternative was adding a generation counter or the creation time
  (`statx` btime) to the token so it changes on every save. That would also
  reject saves whose base matches the current bytes and metadata exactly. Those
  saves are harmless, and native editors' stat-based checks accept them too.
