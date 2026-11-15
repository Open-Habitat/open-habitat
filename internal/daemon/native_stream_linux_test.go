//go:build linux

package daemon

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestNativeTailProofDistinguishesDamageFromUncertainty(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	home := t.TempDir()
	path := filepath.Join(home, "history.jsonl")
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
	for _, tc := range []struct {
		name, tail       string
		ok, cut, damaged bool
	}{
		{name: "empty", ok: true},
		{name: "complete", tail: "{\"type\":\"message\",\"id\":\"entry1\"}\n", ok: true},
		{name: "repairable fragment", tail: "{\"type\":\"message\",\"id\":\"entry1\"", ok: true, cut: true},
		{name: "broken last line", tail: "{bad\n", damaged: true},
		{name: "invalid fragment", tail: "{bad", damaged: true},
		{name: "invalid record", tail: "{\"type\":\"message\"}\n", damaged: true},
		{name: "complete but unterminated", tail: "{\"type\":\"message\",\"id\":\"entry1\"}"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			content := header + tc.tail
			if err := os.WriteFile(path, []byte(content), 0600); err != nil {
				t.Fatal(err)
			}
			_, cut, ok, damaged := nativeTailProof(path, os.Geteuid(), id, home)
			if ok != tc.ok || cut != tc.cut || damaged != tc.damaged {
				t.Fatalf("ok=%v cut=%v damaged=%v", ok, cut, damaged)
			}
			_, _, ok, damaged = nativeTailProof(path, os.Geteuid(), id, home+"/other")
			if ok || damaged {
				t.Fatal("identity mismatch classified as proven or damaged")
			}
			data, err := os.ReadFile(path)
			if err != nil || string(data) != content {
				t.Fatal("proof changed native bytes")
			}
		})
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	_, _, ok, damaged := nativeTailProof(path, os.Geteuid(), id, home)
	if ok || damaged {
		t.Fatal("missing file classified as proven or damaged")
	}
}
