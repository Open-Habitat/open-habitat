package main

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestReleaseInputBoundsAndSpecialFiles(t *testing.T) {
	dir := t.TempDir()
	regular := filepath.Join(dir, "regular")
	if err := os.WriteFile(regular, []byte("signed"), 0600); err != nil {
		t.Fatal(err)
	}
	if b, err := readInput(regular, 6); err != nil || string(b) != "signed" {
		t.Fatalf("exact bound: %q %v", b, err)
	}
	if _, err := readInput(regular, 5); err == nil {
		t.Fatal("accepted oversized manifest/key/signature")
	}
	fifo := filepath.Join(dir, "fifo")
	if err := syscall.Mkfifo(fifo, 0600); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{fifo, dir} {
		if f, err := openInput(path); err == nil {
			f.Close()
			t.Fatal("accepted non-regular release input")
		}
	}
}

func TestArtifactListIsComplete(t *testing.T) {
	dir := t.TempDir()
	for _, input := range []string{`[]`, `null`, `[{}]`, `[{"closure":{"files":[],"components":[]},"unknown":1}]`, `[] {}`} {
		p := filepath.Join(dir, "artifacts.json")
		if e := os.WriteFile(p, []byte(input), 0600); e != nil {
			t.Fatal(e)
		}
		if _, e := readArtifacts(p, true); e == nil {
			t.Fatalf("accepted %s", input)
		}
	}
}
