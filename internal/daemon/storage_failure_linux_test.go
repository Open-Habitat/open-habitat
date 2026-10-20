//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"strings"
	"syscall"
	"testing"
)

func TestStorageFailureClassifiesWrappedErrno(t *testing.T) {
	for _, tc := range []struct {
		err  error
		want string
	}{
		{&os.PathError{Op: "write", Path: "synthetic-secret", Err: syscall.EDQUOT}, "quota_full"},
		{&os.PathError{Op: "fsync", Path: "synthetic-secret", Err: syscall.ENOSPC}, "storage_full"},
		{syscall.EACCES, ""}, {errors.New("EDQUOT in user text"), ""}, {nil, ""},
	} {
		if got := storageFailure(tc.err); got != tc.want {
			t.Fatalf("got %q want %q", got, tc.want)
		}
	}
}

// A tiny synthetic storage budget: the writer fails with the kernel's quota
// errno after the budget, without changing any host quota or another UID.
type quotaWriter struct{ remaining int }

func (w *quotaWriter) Write(p []byte) (int, error) {
	n := min(w.remaining, len(p))
	w.remaining -= n
	if n < len(p) {
		return n, &os.PathError{Op: "write", Path: "synthetic-secret", Err: syscall.EDQUOT}
	}
	return n, nil
}

func captureStorageLog(t *testing.T, run func()) string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	old := os.Stderr
	os.Stderr = w
	defer func() { os.Stderr = old; r.Close(); w.Close() }()
	run()
	w.Close()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestTinyQuotaFailureAndRecoveryDiagnostic(t *testing.T) {
	log := captureStorageLog(t, func() {
		w := &quotaWriter{remaining: 8}
		_, err := w.Write([]byte("synthetic message"))
		logStorageFailure("message_write", err)
		w.remaining = 64
		_, err = w.Write([]byte("recovered"))
		if err != nil {
			t.Fatal(err)
		}
		logStorageFailure("message_write", err)
	})
	var event struct{ Event, Reason, Operation string }
	if json.Unmarshal([]byte(log), &event) != nil || event.Event != "native_storage" || event.Reason != "quota_full" || event.Operation != "message_write" {
		t.Fatalf("unexpected diagnostic %s", log)
	}
	if strings.Contains(log, "synthetic-secret") {
		t.Fatal("native path leaked")
	}
}

func TestStorageDiagnosticsBoundedSplitAndRedacted(t *testing.T) {
	for _, code := range []string{"EDQUOT", "ENOSPC", "disk quota exceeded", "no space left on device"} {
		t.Run(code, func(t *testing.T) {
			log := captureStorageLog(t, func() {
				d := &storageDiagnostics{operation: "pi_runtime"}
				_, _ = d.Write(bytes.Repeat([]byte("sensitive-"), 1<<16))
				if len(d.tail) > 32 {
					t.Fatal("unbounded native diagnostic")
				}
				_, _ = d.Write([]byte(code[:3]))
				_, _ = d.Write([]byte(code[3:] + ": synthetic-secret"))
				_, _ = d.Write([]byte(code)) // one diagnostic, not an unbounded log flood
			})
			if strings.Count(log, "native_storage") != 1 || strings.Contains(log, "sensitive") || strings.Contains(log, "synthetic-secret") {
				t.Fatalf("unexpected diagnostic %s", log)
			}
		})
	}
}

func TestStorageRPCFailureDoesNotClassifyUserMessages(t *testing.T) {
	log := captureStorageLog(t, func() {
		r, w, err := os.Pipe()
		if err != nil {
			t.Fatal(err)
		}
		defer r.Close()
		p := &piRPC{in: r, out: r, frames: make(chan json.RawMessage, 8), events: make(chan json.RawMessage, 8), done: make(chan struct{})}
		_, err = io.WriteString(w, `{"type":"message_end","message":{"role":"user","errorMessage":"EDQUOT"}}`+"\n"+
			`{"type":"response","success":false,"error":"ENOSPC: synthetic-secret"}`+"\n"+
			`{"type":"message_end","message":{"role":"assistant","stopReason":"error","errorMessage":"EDQUOT: synthetic-secret"}}`+"\n")
		if err != nil {
			t.Fatal(err)
		}
		w.Close()
		p.read()
	})
	if strings.Count(log, "native_storage") != 2 || !strings.Contains(log, "quota_full") || !strings.Contains(log, "storage_full") || strings.Contains(log, "synthetic-secret") {
		t.Fatalf("unexpected diagnostic %s", log)
	}
}
