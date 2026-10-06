package diagnostic

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

type brokenWriter struct{}

func (brokenWriter) Write([]byte) (int, error) { return 0, errors.New("synthetic-secret-marker") }

func TestEnvelope(t *testing.T) {
	var b bytes.Buffer
	New(&b, "broker").Warn("broker_guard", "outcome", "rejected", "reason", "availability_error")
	var record map[string]any
	if err := json.Unmarshal(b.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	for key, want := range map[string]any{"schema_version": float64(1), "component": "broker", "event": "broker_guard", "outcome": "rejected", "reason": "availability_error", "level": "WARN"} {
		if record[key] != want {
			t.Fatalf("%s: %v", key, record)
		}
	}
	if record["time"] == "" || strings.Count(b.String(), "\n") != 1 {
		t.Fatalf("not JSONL: %s", b.String())
	}
	// slog ignores a failed diagnostic write; no error contents enter a record.
	New(brokenWriter{}, "gateway").Error("service_failed", "outcome", "failed", "reason", "config_io")
}
