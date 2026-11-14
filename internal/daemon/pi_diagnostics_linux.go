//go:build linux

package daemon

import (
	"bytes"
	"io"
	"os"
	"sync"
	"time"
)

// Only fixed classes survive a line. Keep the strongest class of the last
// burst (no quiet gap over two seconds). This is evidence of stderr activity,
// not proof of the exit cause: Pi can shut down without writing stderr.
type piDiagnostics struct {
	mu        sync.Mutex
	line      []byte
	oversized bool
	last      string
	at        time.Time
	reaped    time.Time
	storage   storageDiagnostics
}

func (d *piDiagnostics) Write(p []byte) (int, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	_, _ = d.storage.Write(p)
	if len(p) > 0 {
		now := time.Now()
		if now.Sub(d.at) > 2*time.Second && len(d.line) == 0 && !d.oversized {
			d.last = ""
		}
		d.at = now
	}
	for _, b := range p {
		if b == '\n' {
			d.finishLine()
		} else if len(d.line) < 1024 {
			d.line = append(d.line, b)
		} else {
			d.oversized = true
		}
	}
	return len(p), nil
}

func (d *piDiagnostics) finishLine() {
	if len(d.line) != 0 || d.oversized {
		d.last = strongerPiClass(d.last, piStderrClass(d.line, d.oversized))
	}
	d.line = nil
	d.oversized = false
}

func piStderrClass(line []byte, oversized bool) string {
	if oversized {
		return "oversized"
	}
	switch {
	case bytes.Contains(line, []byte("EDQUOT")), bytes.Contains(line, []byte("disk quota exceeded")):
		return "quota_full"
	case bytes.Contains(line, []byte("ENOSPC")), bytes.Contains(line, []byte("no space left on device")):
		return "storage_full"
	case bytes.Contains(line, []byte("Error")):
		return "error_text"
	case bytes.Contains(line, []byte("Warning")):
		return "warning_text"
	default:
		return "unclassified"
	}
}

func (d *piDiagnostics) lastClass() string {
	if d == nil {
		return "unavailable"
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	// Include a final unterminated line, also when a descendant kept stderr open.
	if len(d.line) != 0 || d.oversized {
		return strongerPiClass(d.last, piStderrClass(d.line, d.oversized))
	}
	if d.last == "" {
		return "none"
	}
	return d.last
}

// Keep error headers when Node follows them with stack frames or a version.
func strongerPiClass(a, b string) string {
	rank := func(c string) int {
		switch c {
		case "quota_full", "storage_full":
			return 4
		case "error_text":
			return 3
		case "warning_text":
			return 2
		case "unclassified", "oversized":
			return 1
		default:
			return 0
		}
	}
	if rank(b) >= rank(a) {
		return b
	}
	return a
}

func (d *piDiagnostics) markReaped() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.reaped = time.Now()
	// No raw unterminated text needs to survive the drain.
	d.finishLine()
}

func (d *piDiagnostics) freshness() string {
	if d == nil {
		return "unavailable"
	}
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.at.IsZero() {
		return "none"
	}
	if d.reaped.IsZero() {
		return "running"
	}
	if d.reaped.Sub(d.at) > 2*time.Second {
		return "earlier"
	}
	return "within_2s"
}

// Direct descriptors let us reap Pi independently of a descendant holding
// stderr open; the reap goroutine bounds the final drain with a deadline.
func piDiagnosticPipe() (*os.File, *os.File, <-chan struct{}, *piDiagnostics, error) {
	r, w, err := os.Pipe()
	if err != nil {
		return nil, nil, nil, nil, err
	}
	d := &piDiagnostics{storage: storageDiagnostics{operation: "pi_runtime"}}
	done := make(chan struct{})
	go func() { defer close(done); _, _ = io.Copy(d, r) }()
	return r, w, done, d, nil
}
