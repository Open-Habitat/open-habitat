//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPiExitDrainsDiagnosticsWithoutWaitingForInheritedStderr(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nsleep 2 >&2 &\nprintf 'Error: /home/synthetic/private secret' >&2\nexit 0\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	select {
	case <-p.exited:
	case <-time.After(time.Second):
		t.Fatal("reaping waited on inherited stderr")
	}
	if got := p.stderrDiagnostics.lastClass(); got != "error_text" {
		t.Fatal(got)
	}
	if p.inputEndCause() != "" || p.cmd.ProcessState.ExitCode() != 0 {
		t.Fatal("not an unasked zero exit")
	}
}

func TestPiDiagnosticsBoundedClasses(t *testing.T) {
	d := &piDiagnostics{}
	if got := d.lastClass(); got != "none" {
		t.Fatal(got)
	}
	for _, chunk := range []string{"Error: /home/synthetic/private token=secret", "\n", "War", "ning: secret"} {
		_, _ = d.Write([]byte(chunk))
	}
	if got := d.lastClass(); got != "error_text" {
		t.Fatal(got)
	}
	_, _ = d.Write([]byte("\n"))
	d.at = time.Now().Add(-3 * time.Second)
	_, _ = d.Write([]byte(strings.Repeat("sensitive", 10000)))
	if len(d.line) > 1024 || d.lastClass() != "oversized" {
		t.Fatal("unbounded or raw diagnostics")
	}
	_, _ = d.Write([]byte("\nordinary secret\n"))
	if got := d.lastClass(); got != "unclassified" {
		t.Fatal(got)
	}
	_, _ = d.Write([]byte("ENOS"))
	_, _ = d.Write([]byte("PC: /home/synthetic/private"))
	if got := d.lastClass(); got != "storage_full" {
		t.Fatal(got)
	}
}

func TestPiDiagnosticsTrailersAndRecency(t *testing.T) {
	d := &piDiagnostics{}
	_, _ = d.Write([]byte("Warning: synthetic startup\n"))
	d.at = time.Now().Add(-3 * time.Second)
	d.markReaped()
	if d.freshness() != "earlier" {
		t.Fatal(d.freshness())
	}
	_, _ = d.Write([]byte("Error: synthetic\n at f (private:1)\n\nNode.js v22\n"))
	d.markReaped()
	if d.lastClass() != "error_text" || d.freshness() != "within_2s" {
		t.Fatal(d.lastClass(), d.freshness())
	}
	if len(d.line) != 0 {
		t.Fatal("raw final line retained")
	}
}
