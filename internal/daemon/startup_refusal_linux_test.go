//go:build linux

package daemon

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestStartupRefusalCodeMapping(t *testing.T) {
	if got := StartupRefusalCode(errors.New("native text")); got != RefusalUnclassified {
		t.Fatalf("untagged error: %s", got)
	}
	if got := StartupRefusalCode(nil); got != RefusalUnclassified {
		t.Fatalf("nil error: %s", got)
	}
	tagged := fmt.Errorf("outer: %w", refuse(RefusalTransportConfig, errors.New("inner")))
	if got := StartupRefusalCode(tagged); got != RefusalTransportConfig {
		t.Fatalf("wrapped refusal: %s", got)
	}
	if refuse(RefusalTransportConfig, nil) != nil {
		t.Fatal("nil error tagged")
	}
	for _, c := range []struct {
		err  error
		want string
	}{
		{transport.ErrServeEnded, RefusalDaemonServeEnded},
		{errors.New("listener refused"), RefusalDaemonListener},
	} {
		if got := StartupRefusalCode(listenerRefusal(RefusalDaemonListener, RefusalDaemonServeEnded, c.err)); got != c.want {
			t.Fatalf("%v: %s, want %s", c.err, got, c.want)
		}
	}
	if listenerRefusal(RefusalAgentListener, RefusalAgentServeEnded, nil) != nil {
		t.Fatal("clean shutdown tagged as refusal")
	}
}

// Each startup check of the Pi device names itself, and a safe tree of the
// wrong version is told apart from an untrusted one.
func TestPiStartupRefusalCodes(t *testing.T) {
	p, _ := piFixture(t)
	p.TrustedRuntime = true
	p.selectorCheck = func() error { return errors.New("selector") }
	if got := StartupRefusalCode(p.validate()); got != RefusalPiSelector {
		t.Fatalf("selector: %s", got)
	}
	p.selectorCheck = func() error { return nil }
	p.runtimeCheck = func() error { return errors.New("unsafe runtime tree") }
	if got := StartupRefusalCode(p.validate()); got != RefusalPiRuntimeUntrusted {
		t.Fatalf("untrusted runtime: %s", got)
	}
	p.runtimeCheck = func() error { return fmt.Errorf("%w: Pi SDK", errRuntimeUnsupported) }
	if got := StartupRefusalCode(p.validate()); got != RefusalPiRuntimeVersion {
		t.Fatalf("runtime version: %s", got)
	}
	p.Home = "relative"
	if got := StartupRefusalCode(p.validate()); got != RefusalPiConfiguration {
		t.Fatalf("configuration: %s", got)
	}
}

func TestServeHTTPRefusesWithoutAdapterByCode(t *testing.T) {
	err := ServeHTTP(context.Background(), nil, transport.Config{}, nil, nil, nil)
	if got := StartupRefusalCode(err); got != RefusalAdapterUnavailable {
		t.Fatalf("missing adapter: %v (%s)", err, got)
	}
}
