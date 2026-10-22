//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"io"
	"math"
	"time"
)

// SyncProgress is a bounded projection of rclone's native stats, never its
// messages or filenames. It is transient process observation, not a job store.
type SyncProgress struct {
	Service        string `json:"service,omitempty"`
	Phase          string `json:"phase"`
	ElapsedSeconds uint64 `json:"elapsed_seconds"`
	Bytes          uint64 `json:"bytes"`
	TotalBytes     uint64 `json:"total_bytes"`
	Files          uint64 `json:"files"`
	TotalFiles     uint64 `json:"total_files"`
}
type syncProgressKey struct{}

// rclone emits one JSON object per line on stderr. Retain at most one small
// line, discard oversized diagnostics, and consume the entire stream even
// after a malformed event. Raw output never crosses the daemon boundary.
type statsOutput struct {
	line      []byte
	oversized bool
	emit      func(SyncProgress)
	started   time.Time
	service   string
}

func (w *statsOutput) Write(data []byte) (int, error) {
	for _, b := range data {
		if b == '\n' {
			if !w.oversized {
				w.event()
			}
			w.line, w.oversized = w.line[:0], false
		} else if len(w.line) < 16384 && !w.oversized {
			w.line = append(w.line, b)
		} else {
			w.oversized = true
		}
	}
	return len(data), nil
}
func (w *statsOutput) event() {
	var e struct {
		Stats *struct {
			Bytes          uint64 `json:"bytes"`
			TotalBytes     uint64 `json:"totalBytes"`
			Transfers      uint64 `json:"transfers"`
			TotalTransfers uint64 `json:"totalTransfers"`
		} `json:"stats"`
	}
	if json.Unmarshal(w.line, &e) != nil || e.Stats == nil {
		return
	}
	s := e.Stats
	const max = uint64(1<<53 - 1)
	if s.Bytes > max || s.TotalBytes > max || s.Transfers > max || s.TotalTransfers > max {
		return
	}
	phase := "preparing"
	if s.TotalBytes > 0 || s.TotalTransfers > 0 {
		phase = "transferring"
	}
	w.emit(SyncProgress{Service: w.service, Phase: phase, ElapsedSeconds: uint64(math.Max(0, time.Since(w.started).Seconds())), Bytes: s.Bytes, TotalBytes: s.TotalBytes, Files: s.Transfers, TotalFiles: s.TotalTransfers})
}
func (env Env) runInitialSync(ctx context.Context, c Command, service string) error {
	emit, ok := ctx.Value(syncProgressKey{}).(func(SyncProgress))
	if !ok {
		_, err := env.run(ctx, c, nil)
		return err
	}
	c.Args = append(c.Args, "--use-json-log", "--stats", "1s", "--stats-log-level", "NOTICE")
	out := &statsOutput{emit: emit, started: time.Now(), service: service}
	emit(SyncProgress{Service: service, Phase: "preparing"})
	cmd := env.command(ctx, c)
	cmd.Stdout, cmd.Stderr = io.Discard, out
	err := cmd.Run()
	killGroup(cmd)
	return err
}
