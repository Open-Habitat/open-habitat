# Result

Pinned rclone 1.76.0 for both Linux architectures as the upstream fix for the conflict-winner deletion bug. Archive/member hashes, notices, required-tool acceptance and runtime assertions were updated together. ARM64 runtime build, sealed-package test, native bisync safety tests, focused host tests and contracts passed.

The detailed evidence, deployment requirement and decisions are in `issues/dropbox-conflict-winner-returns-after-delete/result.md`. No live-provider or AMD64 execution acceptance is claimed. Optional Microsoft native refresh qualification is blocked by a pre-existing fixture failure filed as `microsoft-native-refresh-fixture-stale`.
