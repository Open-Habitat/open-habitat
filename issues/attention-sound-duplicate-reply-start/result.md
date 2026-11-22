# Resolution

`ad6c59fec` removes the unnecessary five-second browser-clock jump immediately after the rail's completion observation. Playback is immediate; jumping while reply history arrives artificially expires the two-second burst coalescing between rail observations. The initial settle-window advance still happens before releasing the held synthetic agent. The exact expected sound arrays remain unchanged.

The entire `attention-sound.spec.ts` passed 15 repetitions (120/120 cases), two workers and 60 ms response jitter. This is a test-sequence repair, not evidence that real history can never arrive beyond the burst window. Details are in `issues/attention-sound-status-all-reasons/result.md`.
