//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTrustedPiRuntime(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("root-owned synthetic runtime requires root; nonroot runners test fail-closed paths")
	}
	root, err := os.MkdirTemp("/root", "pi-runtime-test-")
	if err != nil {
		t.Skipf("no root-owned scratch: %v", err)
	}
	defer os.RemoveAll(root)
	pkg := filepath.Join(root, "node_modules/@earendil-works/pi-coding-agent")
	if err := os.MkdirAll(filepath.Join(pkg, "dist"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "bin"), 0755); err != nil {
		t.Fatal(err)
	}
	p := &PiDevice{Node: filepath.Join(root, "bin/node"), Entry: filepath.Join(pkg, "dist/index.js"), Manifest: filepath.Join(pkg, "package.json"), TrustedRuntime: true}
	write := func(path, data string, mode os.FileMode) {
		t.Helper()
		if err := os.WriteFile(path, []byte(data), mode); err != nil {
			t.Fatal(err)
		}
	}
	write(p.Node, "#!/bin/sh\nprintf 'v22.21.1\\n'\n", 0755)
	write(p.Entry, "export const ModelRuntime = {};\n", 0644)
	good := `{"name":"@earendil-works/pi-coding-agent","version":"0.85.1","exports":{".":{"import":"./dist/index.js"}}}`
	write(p.Manifest, good, 0644)
	if err := p.validateRuntime(); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(){
		"wrong version":   func() { write(p.Manifest, strings.Replace(good, "0.85.1", "0.85.2", 1), 0644) },
		"wrong export":    func() { write(p.Manifest, strings.Replace(good, "./dist/index.js", "./dist/other.js", 1), 0644) },
		"wrong node":      func() { write(p.Node, "#!/bin/sh\necho v23.0.0\n", 0755) },
		"writable parent": func() { os.Chmod(filepath.Join(root, "bin"), 0777) },
		"missing entry":   func() { os.Remove(p.Entry) },
		"symlink entry":   func() { os.Remove(p.Entry); os.Symlink(p.Manifest, p.Entry) },
	} {
		// Restore each fixture before the next substitution.
		write(p.Manifest, good, 0644)
		write(p.Node, "#!/bin/sh\necho v22.21.1\n", 0755)
		os.Chmod(filepath.Join(root, "bin"), 0755)
		os.Remove(p.Entry)
		write(p.Entry, "export {};", 0644)
		t.Run(name, func(t *testing.T) {
			mutate()
			if err := p.validateRuntime(); err == nil {
				t.Fatal("unsafe runtime accepted")
			}
		})
	}
}

func TestTrustedPiRuntimeRejectsUnconfiguredAndUserWritable(t *testing.T) {
	p := &PiDevice{Node: filepath.Join(t.TempDir(), "bin/node"), Entry: "/x", Manifest: "/y", TrustedRuntime: true}
	if err := p.validateRuntime(); err == nil {
		t.Fatal("invalid layout accepted")
	}
}
