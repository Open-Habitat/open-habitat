//go:build linux

package daemon

import (
	"context"
	"errors"
	"os"
	"testing"
)

// A first-use home has no Pi credentials. Environment validation happens once
// before any request; status and device operations do not re-read the selector
// or walk the release tree.
func TestPiStartupChecksNotRepeated(t *testing.T) {
	p, home := piFixture(t)
	_ = home
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
	if id == "" || selector != 1 || tree != 1 {
		t.Fatalf("startup checks repeated: selector=%d runtime=%d id=%q", selector, tree, id)
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
