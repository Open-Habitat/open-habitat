//go:build linux

package daemon

import (
	"errors"
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
	good := `{"name":"@earendil-works/pi-coding-agent","version":"1.5.2","bin":{"pi":"dist/bundle/cli.js"},"exports":{".":{"import":"./dist/index.js"}}}`
	write(p.Manifest, good, 0644)
	if err := p.validateRuntime(); err != nil {
		t.Fatal(err)
	}
	// The pinned npm bundle includes internal symlinks (e.g. .bin/pi).
	link := filepath.Join(pkg, "valid.link")
	if err := os.Symlink("package.json", link); err != nil {
		t.Fatal(err)
	}
	if err := p.validateRuntime(); err != nil {
		t.Fatalf("safe internal link rejected: %v", err)
	}
	for name, mutate := range map[string]func(){
		"wrong version":   func() { write(p.Manifest, strings.Replace(good, "1.5.2", "0.85.2", 1), 0644) },
		"wrong export":    func() { write(p.Manifest, strings.Replace(good, "./dist/index.js", "./dist/other.js", 1), 0644) },
		"wrong node":      func() { write(p.Node, "#!/bin/sh\necho v23.0.0\n", 0755) },
		"writable parent": func() { os.Chmod(filepath.Join(root, "bin"), 0777) },
		"missing entry":   func() { os.Remove(p.Entry) },
		"symlink entry":   func() { os.Remove(p.Entry); os.Symlink(p.Manifest, p.Entry) },
		"writable imported module": func() {
			path := filepath.Join(pkg, "dist", "imported.js")
			write(path, "export {};", 0644)
			if err := os.Chmod(path, 0666); err != nil {
				t.Fatal(err)
			}
		},
		"escaping dependency link": func() { os.Symlink("/var/tmp", filepath.Join(pkg, "external")) },
		"external round trip": func() {
			alias := filepath.Join(t.TempDir(), "alias")
			if err := os.Symlink(pkg, alias); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(alias, filepath.Join(pkg, "external")); err != nil {
				t.Fatal(err)
			}
		},
	} {
		// Restore each fixture before the next substitution.
		write(p.Manifest, good, 0644)
		write(p.Node, "#!/bin/sh\necho v22.21.1\n", 0755)
		os.Chmod(filepath.Join(root, "bin"), 0755)
		os.Remove(filepath.Join(pkg, "dist", "imported.js"))
		os.Remove(filepath.Join(pkg, "external"))
		os.Remove(p.Entry)
		write(p.Entry, "export {};", 0644)
		t.Run(name, func(t *testing.T) {
			mutate()
			err := p.validateRuntime()
			if err == nil {
				t.Fatal("unsafe runtime accepted")
			}
			// Only a safe tree of the wrong version is reported as a
			// version mismatch; everything else stays untrusted.
			version := name == "wrong version" || name == "wrong node"
			if errors.Is(err, errRuntimeUnsupported) != version {
				t.Fatalf("version classification: %v", err)
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
