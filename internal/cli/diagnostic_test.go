package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestServiceStartupDiagnosticRedactsConfigError(t *testing.T) {
	var out, log bytes.Buffer
	marker := "synthetic-secret-marker"
	code := Run([]string{"gateway", "exec", "--config", "/nonexistent/" + marker}, &out, &log)
	if code != 2 || out.Len() != 0 || strings.Contains(log.String(), marker) {
		t.Fatalf("exit=%d out=%q log=%q", code, out.String(), log.String())
	}
	var record map[string]any
	if err := json.Unmarshal(log.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	if record["component"] != "gateway" || record["event"] != "service_failed" || record["outcome"] != "failed" || record["reason"] != "config_io" {
		t.Fatal(record)
	}
}

// A daemon whose startup check refuses logs which check it was, as a fixed
// word beside server_failed, and nothing of the refusal's own text.
func TestDaemonServeFailureLogsDetailCode(t *testing.T) {
	refusal := daemon.ServeHTTP(context.Background(), nil, transport.Config{}, nil, nil, nil)
	if refusal == nil {
		t.Fatal("ServeHTTP accepted a missing adapter")
	}
	var log bytes.Buffer
	if code := logServiceFailure(&log, "daemon", daemonServeFailure(refusal)); code != 2 {
		t.Fatalf("exit=%d", code)
	}
	var record map[string]any
	if err := json.Unmarshal(log.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	if record["event"] != "service_failed" || record["reason"] != "server_failed" || record["detail"] != daemon.RefusalAdapterUnavailable {
		t.Fatal(record)
	}
	if strings.Contains(log.String(), refusal.Error()) {
		t.Fatalf("refusal text reached the journal: %s", log.String())
	}
	// An untagged error still names its code, and a detail is never invented.
	log.Reset()
	logServiceFailure(&log, "daemon", system("config_io", "synthetic /path"))
	record = nil
	if err := json.Unmarshal(log.Bytes(), &record); err != nil {
		t.Fatal(err)
	}
	if _, ok := record["detail"]; ok || record["reason"] != "config_io" || strings.Contains(log.String(), "/path") {
		t.Fatal(record)
	}
	if got := daemonServeFailure(errors.New("untagged")).detail; got != daemon.RefusalUnclassified {
		t.Fatalf("untagged detail: %s", got)
	}
}
