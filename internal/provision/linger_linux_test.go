//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLingerOnlyAfterCommitAndFailureIsNonfatal(t *testing.T) {
	w, h := writerFixture(t)
	var log bytes.Buffer
	w.LingerEvent = lingerLogger(slog.New(slog.NewJSONHandler(&log, nil)))
	h.lingerErr = true
	h.onLinger = func(i ExecutorIdentity) {
		if !fileAbsent(filepath.Join(w.Dir, "pending.json")) {
			t.Fatal("linger before journal cleared")
		}
		b, err := os.ReadFile(filepath.Join(w.Dir, "bindings.json"))
		var l ledgerFile
		if err != nil || json.Unmarshal(b, &l) != nil || len(l.Bindings) != 1 || l.Bindings[0].UID != i.UID() || l.Bindings[0].Username != i.Username() {
			t.Fatal("linger before durable binding", err)
		}
	}
	if r := handle(w, "ensure", "43", "mallory"); r.Failure != Denied {
		t.Fatal(r)
	}
	if len(h.lingerCalls) != 0 {
		t.Fatal("linger for denied account")
	}
	if r := handle(w, "ensure", "42", "carol"); r.Route == nil {
		t.Fatal("linger failure blocked login", r)
	}
	if !strings.Contains(log.String(), `"reason":"enable_failed"`) || strings.Contains(log.String(), "synthetic private") {
		t.Fatal(log.String())
	}
	// Reauthorize is read-only; a renamed candidate never selects the target.
	if r := handle(w, "authorize", "42", ""); r.Route == nil {
		t.Fatal(r)
	}
	if len(h.lingerCalls) != 1 {
		t.Fatal(h.lingerCalls)
	}
	h.lingerErr = false
	if r := handle(w, "ensure", "42", "mallory"); r.Route == nil {
		t.Fatal(r)
	}
	for _, c := range h.lingerCalls {
		if c != (hostCall{"enable-linger", "github", "42", "carol", 2100}) {
			t.Fatal(c)
		}
	}
	if len(h.lingerCalls) != 2 || !strings.Contains(log.String(), `"outcome":"enabled"`) {
		t.Fatal(log.String(), h.lingerCalls)
	}
}

func TestLingerNeverOnIncompleteProvision(t *testing.T) {
	for _, phase := range []string{"account", "home", "config", "socket", "unit", "verify"} {
		t.Run(phase, func(t *testing.T) {
			w, h := writerFixture(t)
			h.fail = phase
			if r := handle(w, "ensure", "42", "carol"); r.Route != nil {
				t.Fatal(r)
			}
			if len(h.lingerCalls) != 0 {
				t.Fatal("linger on partial account", h.lingerCalls)
			}
			if _, err := w.startupBindings(context.Background()); err == nil {
				t.Fatal("startup accepted pending journal")
			}
			if len(h.lingerCalls) != 0 {
				t.Fatal(h.lingerCalls)
			}
		})
	}
}

func TestRestoreLingerFailureDoesNotBlockOtherAccounts(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"}]}`)
	for _, u := range []struct{ id, name string }{{"42", "carol"}, {"43", "dana"}} {
		if r := handle(w, "ensure", u.id, u.name); r.Route == nil {
			t.Fatal(r)
		}
	}
	bindings, err := w.startupBindings(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	h.lingerCalls = nil
	h.readyCalls = nil
	h.lingerErr = true
	var log bytes.Buffer
	w.LingerEvent = lingerLogger(slog.New(slog.NewJSONHandler(&log, nil)))
	for n := 0; n < 2; n++ {
		w.restoreSockets(context.Background(), bindings, func(_ string, err error) {
			if err != nil {
				t.Fatal(err)
			}
		}, func(string, bool, error) {})
	}
	if len(h.lingerCalls) != 4 || len(h.readyCalls) != 4 || strings.Count(log.String(), `"reason":"enable_failed"`) != 4 {
		t.Fatal(h.lingerCalls, h.readyCalls, log.String())
	}
}
