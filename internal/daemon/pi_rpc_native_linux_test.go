//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Exercises the pinned real Pi RPC parser with a disposable HOME and no
// provider credentials, prompts or network. It proves launch and acknowledgement,
// not a model response or a web control.
func TestPiRPCNativeState(t *testing.T) {
	binary, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", ".bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(binary); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "synthetic")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(binary, home, cwd, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	ok, err := p.request("get_state", "", 15*time.Second)
	if err != nil || !ok {
		t.Fatalf("real Pi get_state: %v %v", ok, err)
	}
}
