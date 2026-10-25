//go:build linux

package daemon

import (
	"os/exec"
	"path/filepath"
	"testing"
)

// Resolve before restricting the child's PATH: the gate supplies Node on PATH,
// which need not be installed in a system directory.
func nativeNodePath(t *testing.T) string {
	t.Helper()
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatalf("native Pi tests require node on PATH: %v", err)
	}
	node, err = filepath.Abs(node)
	if err != nil {
		t.Fatalf("resolve native Pi node absolute path: %v", err)
	}
	return node
}
