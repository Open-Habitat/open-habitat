//go:build linux

package nativegh

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	dbus "github.com/godbus/dbus/v5"
)

type metadataBus struct {
	t          *testing.T
	calls      int
	paths      []dbus.ObjectPath
	attrs      map[string]string
	locked     bool
	itemLocked bool
	fail       int
	wrong      bool
}

func (b *metadataBus) Close() error { return nil }
func (b *metadataBus) Call(ctx context.Context, path dbus.ObjectPath, method string, args ...any) ([]any, error) {
	b.calls++
	if ctx.Err() != nil || b.calls == b.fail {
		return nil, errors.New("sentinel-secret dbus error")
	}
	if strings.Contains(method, "Secret") || strings.Contains(method, "Unlock") || method == "org.freedesktop.Secret.Item.GetSecret" { // SearchItems is allowed.
		if method != collectionInterface+".SearchItems" {
			b.t.Fatalf("secret API called: %s", method)
		}
	}
	switch b.calls {
	case 1:
		if path != secretRoot || method != propertiesGet {
			b.t.Fatal("collections call")
		}
		return []any{dbus.MakeVariant([]dbus.ObjectPath{"/org/freedesktop/secrets/collection/login"})}, nil
	case 2:
		if path != "/org/freedesktop/secrets/collection/login" || method != propertiesGet {
			b.t.Fatal("collection lock")
		}
		return []any{dbus.MakeVariant(b.locked)}, nil
	case 3:
		if method != collectionInterface+".SearchItems" || path != "/org/freedesktop/secrets/collection/login" {
			b.t.Fatal("search call")
		}
		attrs, ok := args[0].(map[string]string)
		if !ok || attrs["service"] != "gh:github.com" || attrs["username"] != "alice" || len(attrs) != 2 {
			b.t.Fatal("wrong search key")
		}
		return []any{b.paths}, nil
	case 4:
		if method != propertiesGet || path != b.paths[0] {
			b.t.Fatal("item lock")
		}
		if b.wrong {
			return []any{"wrong-type"}, nil
		}
		return []any{dbus.MakeVariant(b.itemLocked)}, nil
	case 5:
		if method != propertiesGet || path != b.paths[0] {
			b.t.Fatal("attributes")
		}
		return []any{dbus.MakeVariant(b.attrs)}, nil
	}
	b.t.Fatal("extra bus request")
	return nil, nil
}
func TestMetadataOnlyAttestation(t *testing.T) {
	item := dbus.ObjectPath("/org/freedesktop/secrets/collection/login/1")
	for _, tc := range []struct {
		name   string
		mutate func(*metadataBus)
		want   bool
	}{
		{"exact", nil, true},
		{"absent", func(b *metadataBus) { b.paths = nil }, false},
		{"duplicate", func(b *metadataBus) { b.paths = append(b.paths, item) }, false},
		{"wrong-service", func(b *metadataBus) { b.attrs["service"] = "other" }, false},
		{"wrong-login", func(b *metadataBus) { b.attrs["username"] = "bob" }, false},
		{"extra-attribute", func(b *metadataBus) { b.attrs["extra"] = "value" }, false},
		{"locked-collection", func(b *metadataBus) { b.locked = true }, false},
		{"locked-item", func(b *metadataBus) { b.itemLocked = true }, false},
		{"bad-path", func(b *metadataBus) { b.paths = []dbus.ObjectPath{"/"} }, false},
		{"foreign-collection", func(b *metadataBus) { b.paths = []dbus.ObjectPath{"/org/freedesktop/secrets/collection/other/1"} }, false},
		{"bad-property", func(b *metadataBus) { b.wrong = true }, false},
		{"bus-error", func(b *metadataBus) { b.fail = 3 }, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			b := &metadataBus{t: t, paths: []dbus.ObjectPath{item}, attrs: map[string]string{"service": "gh:github.com", "username": "alice"}}
			if tc.mutate != nil {
				tc.mutate(b)
			}
			evidence := secretServiceEvidence{dial: func(context.Context) (keyringBus, error) { return b, nil }}
			if got := evidence.Keyring(context.Background(), "alice"); got != tc.want {
				t.Fatalf("attestation %v", got)
			}
			if b.calls > 5 {
				t.Fatal("unbounded calls")
			}
		})
	}
}
func TestKeyringTimeoutAndRedaction(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	evidence := secretServiceEvidence{dial: func(ctx context.Context) (keyringBus, error) {
		<-ctx.Done()
		return nil, errors.New("sentinel-secret path")
	}}
	if evidence.Keyring(ctx, "alice") {
		t.Fatal("timed out evidence accepted")
	}
}

func TestKeyringCancellationAndLoginBinding(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	b := &metadataBus{t: t}
	evidence := secretServiceEvidence{dial: func(context.Context) (keyringBus, error) { return b, nil }}
	if evidence.Keyring(ctx, "alice") || b.calls != 0 || evidence.Keyring(context.Background(), "%") {
		t.Fatal("cancel/invalid login accepted")
	}
	a, f, _ := fixture(t, true)
	f.logged = true
	var observed string
	a.evidence = loginEvidence{func(_ context.Context, login string) bool { observed = login; return true }}
	r, e := a.Install(context.Background(), f.token, false)
	if e != nil || r.Storage != Keyring || observed != "alice" {
		t.Fatalf("login binding: %+v %v %s", r, e, observed)
	}
	f.id = "43"
	observed = ""
	_, _ = a.Install(context.Background(), f.token, false)
	if observed != "" {
		t.Fatal("wrong numeric identity reached keyring")
	}
}

type loginEvidence struct {
	fn func(context.Context, string) bool
}

func (l loginEvidence) Keyring(ctx context.Context, s string) bool { return l.fn(ctx, s) }
func TestProtectedFileWinsOverKeyring(t *testing.T) {
	a, f, _ := fixture(t, false)
	f.logged = true
	called := false
	a.evidence = loginEvidence{func(context.Context, string) bool { called = true; return true }}
	_, _, storage, ok := a.observe(context.Background())
	if !ok || storage != ProtectedFile || called {
		t.Fatalf("file precedence: %s %v %v", storage, ok, called)
	}
}
func TestUnsafeFilePrecedesKeyring(t *testing.T) {
	a, f, home := fixture(t, true)
	f.logged = true
	path := filepath.Join(home, ".config", "gh")
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(path, "hosts.yml")
	if err := os.WriteFile(file, []byte("oauth_token: sentinel-secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(file, 0644); err != nil {
		t.Fatal(err)
	}
	called := false
	a.evidence = loginEvidence{func(context.Context, string) bool { called = true; return true }}
	_, _, storage, ok := a.observe(context.Background())
	if ok || storage != Unknown || called {
		t.Fatalf("unsafe plaintext masked: storage=%s ok=%v called=%v", storage, ok, called)
	}
}
