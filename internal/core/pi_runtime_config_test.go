package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPiRuntimeConfigAuthority(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root-owned config fixture requires root")
	}
	dir, err := os.MkdirTemp("/root", "pi-config-test-")
	if err != nil {
		t.Skipf("root-owned scratch unavailable: %v", err)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "daemon.json")
	valid := `{"component":"daemon","handoff":{},"pi_runtime":{"node":"/opt/example/bin/node","entry":"/opt/example/sdk/dist/index.js","manifest":"/opt/example/sdk/package.json"}}`
	// Parsing happens before handoff semantic validation; this test checks
	// that a wrong component and writable config never become trusted paths.
	os.WriteFile(path, []byte(valid), 0600)
	if cfg, err := LoadConfig(path, Daemon); err != nil || cfg.PiRuntime == nil {
		t.Fatalf("trusted binding rejected: %v", err)
	}
	if _, err := LoadConfig(path, Gateway); err == nil {
		t.Fatal("gateway accepted daemon runtime")
	}
	os.Chmod(path, 0666)
	if _, err := LoadConfig(path, Daemon); err == nil {
		t.Fatal("writable daemon runtime config accepted")
	}
}
