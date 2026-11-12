//go:build linux

package daemon

import (
	"context"
	"sync"
	"time"
)

// briefWriterWait bounds how long a short, person-initiated write queues
// behind another holder of the writer. Archive, rename, hide and the other
// annotation writes take milliseconds, and checkout observations and state
// fsyncs are brief too, so the person should not have to redo a click
// because two of them met. A holder still running after this long is a real
// operation (a clone, a deletion), and the refusal names it.
const briefWriterWait = 2 * time.Second

// workspaceWriter keeps the existing daemon-wide exclusion for ~/src and
// annotations. Its reason is a fixed product code, never a path or native text.
// Closing released lets a bounded waiter continue without retrying any write.
type workspaceWriter struct {
	mu       sync.Mutex
	released chan struct{}
	reason   string
}

func (m *workspaceWriter) TryLock(reason ...string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.released != nil {
		return false
	}
	m.released = make(chan struct{})
	m.reason = "workspace_busy"
	if len(reason) > 0 {
		m.reason = reason[0]
	}
	return true
}

// Lock is used by tests that simulate an overlapping native operation.
func (m *workspaceWriter) Lock() {
	if code := m.wait(context.Background(), "workspace_busy"); code != "" {
		panic(code)
	}
}

func (m *workspaceWriter) Unlock() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.released == nil {
		panic("unlock of unlocked workspace writer")
	}
	close(m.released)
	m.released = nil
	m.reason = ""
}

// waitBriefly takes the writer, queueing behind the current holder for at
// most briefWriterWait. It returns "" when held (the caller must Unlock), or
// the product code of the holder that was still running.
func (m *workspaceWriter) waitBriefly(ctx context.Context, reason string) string {
	ctx, cancel := context.WithTimeout(ctx, briefWriterWait)
	defer cancel()
	return m.wait(ctx, reason)
}

func (m *workspaceWriter) wait(ctx context.Context, reason string) string {
	for {
		m.mu.Lock()
		// Cancellation must not turn a timed-out send into a later creation.
		if ctx.Err() != nil {
			code := m.reason
			if code == "" {
				code = "workspace_busy"
			}
			m.mu.Unlock()
			return code
		}
		if m.released == nil {
			m.released, m.reason = make(chan struct{}), reason
			m.mu.Unlock()
			return ""
		}
		released := m.released
		m.mu.Unlock()
		select {
		case <-released:
		case <-ctx.Done():
		}
	}
}

var cloneWriter workspaceWriter
