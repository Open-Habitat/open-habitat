//go:build linux

package daemon

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// A first-use home has no Pi credentials. Environment validation happens once
// before any request; status and device operations do not re-read the selector
// or walk the release tree.
func TestPiStartupChecksNotRepeated(t *testing.T) {
	p, home := piFixture(t)
	selector, tree := 0, 0
	p.TrustedRuntime = true
	p.selectorCheck = func() error { selector++; return nil }
	p.runtimeCheck = func() error { tree++; return nil }
	if err := p.validate(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(p.Home + "/.pi/agent/auth.json"); !os.IsNotExist(err) {
		t.Fatalf("expected new user: %v", err)
	}
	if got := p.StatusContext(context.Background()); got != "missing" {
		t.Fatalf("onboarding status: %s", got)
	}
	id, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	} // mock device-code login and follow-up status
	start := time.Now()
	if _, err := p.models(context.Background(), ""); err != nil {
		t.Fatal(err)
	}
	t.Logf("native models read: %.3f s", time.Since(start).Seconds())
	if _, err := p.credentials(context.Background(), "read", ""); err != nil {
		t.Fatal(err)
	}
	// Claude fallback status used to repeat the same tree walk too.
	binary := filepath.Join(home, "native-claude")
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nprintf '%s\\n' '{\"loggedIn\":false}'\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p.FixtureHome = true
	if state := (&claudeLogin{device: p, executable: binary}).status(context.Background()); state != "missing" {
		t.Fatalf("Claude status: %s", state)
	}
	if id == "" || selector != 1 || tree != 1 {
		t.Fatalf("startup checks repeated: selector=%d runtime=%d id=%q", selector, tree, id)
	}
	// Removing repeated release walks must not remove the cheap HOME fence.
	p.FixtureHome = false
	t.Setenv("HOME", t.TempDir())
	if _, err := p.models(context.Background(), ""); err == nil {
		t.Fatal("models accepted foreign HOME")
	}
	if _, err := p.credentials(context.Background(), "read", ""); err == nil {
		t.Fatal("credentials accepted foreign HOME")
	}
	if state := (&claudeLogin{device: p}).status(context.Background()); state != "unavailable" {
		t.Fatalf("Claude accepted foreign HOME: %s", state)
	}
}

func TestPiStartupRejectsUnsafeSelectorAndRuntime(t *testing.T) {
	p, _ := piFixture(t)
	p.selectorCheck = func() error { return errors.New("unsafe selector") }
	if err := p.validate(); err == nil {
		t.Fatal("unsafe selector accepted")
	}
	p.selectorCheck = func() error { return nil }
	p.TrustedRuntime = true
	p.runtimeCheck = func() error { return errors.New("unsafe runtime") }
	if err := p.validate(); err == nil {
		t.Fatal("unsafe runtime accepted")
	}
}
