//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestModelGrouping(t *testing.T) {
	ids := []string{"gpt-6-sol", "gpt-6.9-sol", "gpt-6.10-sol", "gpt-6-nova", "gpt-5.5", "custom-model", "gpt-6.1-astra", "gpt-6-astra", "gpt-4.1", "gpt-50", "gpt-5.6-terra", "gpt-5.4-terra", "gpt-5.4-mini"}
	models := make([]piModel, len(ids))
	for i, id := range ids {
		models[i].ID = id
	}
	groupModels(models)
	want := []bool{true, true, false, false, true, false, false, true, true, false, false, true, true}
	for i, m := range models {
		if m.Older != want[i] {
			t.Errorf("%s older=%v", m.ID, m.Older)
		}
	}
}
func observationFixture(t *testing.T, home, id string, rows ...map[string]any) string {
	t.Helper()
	dir := filepath.Join(home, historyRoot, "workspace")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, id+".jsonl")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": id, "cwd": "/synthetic", "timestamp": "2026-01-01T00:00:00Z"})
	for _, row := range rows {
		if err := enc.Encode(row); err != nil {
			t.Fatal(err)
		}
	}
	return path
}
func observationRow(model, stop, text, errorText, at string) map[string]any {
	return map[string]any{"type": "message", "timestamp": at, "message": map[string]any{"role": "assistant", "provider": "openai-codex", "model": model, "stopReason": stop, "errorMessage": errorText, "content": []map[string]any{{"type": "text", "text": text}}}}
}
func TestModelObservationsNativeOnly(t *testing.T) {
	home := t.TempDir()
	old := "2026-01-01T00:00:00Z"
	recent := "2026-01-02T00:00:00Z"
	id := "11111111-1111-4111-8111-111111111111"
	path := observationFixture(t, home, id,
		observationRow("sol", "stop", "answer", "", old),
		observationRow("sol", "error", "", "This model is not supported with this ChatGPT account secret=DO-NOT-EXPOSE", recent),
		observationRow("rate", "error", "", "429 rate limited", recent),
		observationRow("aborted", "aborted", "partial", "", recent),
		observationRow("empty", "stop", "", "", recent),
		observationRow("answer", "stop", "hello", "", recent),
	)
	start := time.Now()
	got := modelObservations(context.Background(), home)
	t.Logf("synthetic history read: %s", time.Since(start))
	if len(got) != 2 || got["sol"].Outcome != "refused" || got["sol"].At != recent || got["answer"].Outcome != "answered" {
		t.Fatalf("observations=%+v", got)
	}
	// Freshly derive again: no process-local cache can hide a native change.
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	_ = json.NewEncoder(f).Encode(observationRow("sol", "stop", "works now", "", "2026-01-03T00:00:00Z"))
	_ = f.Close()
	if got = modelObservations(context.Background(), home); got["sol"].Outcome != "answered" {
		t.Fatal("stale observation cache")
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	outside := observationFixture(t, t.TempDir(), id, observationRow("foreign", "stop", "secret", "", recent))
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if got = modelObservations(context.Background(), home); len(got) != 0 {
		t.Fatal("followed history symlink")
	}
}
func TestModelObservationsBoundedTail(t *testing.T) {
	home := t.TempDir()
	id := "11111111-1111-4111-8111-111111111111"
	path := observationFixture(t, home, id, observationRow("old", "stop", "answer", "", "2026-01-01T00:00:00Z"))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 12000; i++ {
		fmt.Fprintln(f, `{"type":"custom","padding":"synthetic synthetic synthetic synthetic"}`)
	}
	_ = json.NewEncoder(f).Encode(observationRow("new", "stop", "answer", "", "2026-01-02T00:00:00Z"))
	_ = f.Close()
	start := time.Now()
	got := modelObservations(context.Background(), home)
	t.Logf("%d bytes bounded scan: %s", mustSize(t, path), time.Since(start))
	if len(got) != 1 || got["new"].Outcome != "answered" {
		t.Fatalf("tail observations=%+v", got)
	}
}
func mustSize(t *testing.T, path string) int64 {
	t.Helper()
	s, e := os.Stat(path)
	if e != nil {
		t.Fatal(e)
	}
	return s.Size()
}

func BenchmarkModelObservations32Sessions(b *testing.B) {
	home := b.TempDir()
	dir := filepath.Join(home, historyRoot, "workspace")
	_ = os.MkdirAll(dir, 0700)
	padding := strings.Repeat(" ", 4000)
	for i := 0; i < 32; i++ {
		id := fmt.Sprintf("11111111-1111-4111-8111-%012d", i)
		f, _ := os.Create(filepath.Join(dir, id+".jsonl"))
		enc := json.NewEncoder(f)
		_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": id, "cwd": "/synthetic", "timestamp": "2026-01-01T00:00:00Z"})
		for j := 0; j < 132; j++ {
			_, _ = fmt.Fprintf(f, "{\"padding\":%q}\n", padding)
		}
		_ = enc.Encode(observationRow("sol", "stop", "answer", "", "2026-01-02T00:00:00Z"))
		_ = f.Close()
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if got := modelObservations(context.Background(), home); got["sol"].Outcome != "answered" {
			b.Fatal("missing observation")
		}
	}
}

func TestModelObservationsRecentActivityWindow(t *testing.T) {
	home := t.TempDir()
	paths := make([]string, 33)
	for i := range paths {
		paths[i] = observationFixture(t, home, fmt.Sprintf("11111111-1111-4111-8111-%012d", i), observationRow(fmt.Sprintf("m%d", i), "stop", "answer", "", "2026-01-02T00:00:00Z"))
		at := time.Unix(int64(i), 0)
		if err := os.Chtimes(paths[i], at, at); err != nil {
			t.Fatal(err)
		}
	}
	got := modelObservations(context.Background(), home)
	if len(got) != 32 || got["m0"].Outcome != "" || got["m1"].Outcome != "answered" {
		t.Fatalf("wrong recent window: %+v", got)
	}
	// An old session with recent native activity belongs in the recent window.
	now := time.Now()
	if err := os.Chtimes(paths[0], now, now); err != nil {
		t.Fatal(err)
	}
	got = modelObservations(context.Background(), home)
	if len(got) != 32 || got["m0"].Outcome != "answered" || got["m1"].Outcome != "" {
		t.Fatalf("creation time used instead of native activity: %+v", got)
	}
}
