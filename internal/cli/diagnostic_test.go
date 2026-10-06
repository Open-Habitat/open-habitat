package cli

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
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
