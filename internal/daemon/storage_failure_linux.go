//go:build linux

package daemon

import (
	"bytes"
	"errors"
	"os"
	"sync"
	"syscall"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

func storageFailure(err error) string {
	if errors.Is(err, syscall.EDQUOT) {
		return "quota_full"
	}
	if errors.Is(err, syscall.ENOSPC) {
		return "storage_full"
	}
	return ""
}

func logStorageFailure(operation string, err error) {
	if reason := storageFailure(err); reason != "" {
		diagnostic.New(os.Stderr, "daemon").Warn("native_storage", "outcome", "failed", "operation", operation, "reason", reason)
	}
}

// Drain native diagnostics without retaining lines or logging content. A short
// overlap recognizes errno tokens split across writes. One signal per child is
// enough; provider errors and paths must never appear in service diagnostics.
type storageDiagnostics struct {
	mu        sync.Mutex
	tail      []byte
	logged    bool
	operation string
}

func (d *storageDiagnostics) Write(p []byte) (int, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	n := len(p)
	if d.logged {
		return n, nil
	}
	// Bound scratch even when a subprocess emits a very large chunk.
	for len(p) > 0 {
		size := min(len(p), 4096)
		b := append(d.tail, p[:size]...)
		var err error
		if bytes.Contains(b, []byte("EDQUOT")) || bytes.Contains(b, []byte("disk quota exceeded")) {
			err = syscall.EDQUOT
		} else if bytes.Contains(b, []byte("ENOSPC")) || bytes.Contains(b, []byte("no space left on device")) {
			err = syscall.ENOSPC
		}
		if err != nil {
			logStorageFailure(d.operation, err)
			d.logged = true
			d.tail = nil
			break
		}
		d.tail = append([]byte(nil), b[max(0, len(b)-32):]...)
		p = p[size:]
	}
	return n, nil
}
