//go:build linux

package nativegh

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	dbus "github.com/godbus/dbus/v5"
)

const (
	secretDestination   = "org.freedesktop.secrets"
	secretRoot          = dbus.ObjectPath("/org/freedesktop/secrets")
	collectionInterface = "org.freedesktop.Secret.Collection"
	itemInterface       = "org.freedesktop.Secret.Item"
	propertiesGet       = "org.freedesktop.DBus.Properties.Get"
)

// keyringBus exposes only metadata calls; no secret or unlock operation is in
// this interface. It is deliberately injectable without a real user bus.
type keyringBus interface {
	Call(context.Context, dbus.ObjectPath, string, ...any) ([]any, error)
	Close() error
}
type keyringDial func(context.Context) (keyringBus, error)

type secretServiceEvidence struct{ dial keyringDial }

// LinuxSecretService provides metadata-only production evidence. No live bus
// connection is made during daemon construction.
func LinuxSecretService() Evidence { return secretServiceEvidence{dial: dialUserBus} }

func (s secretServiceEvidence) Keyring(ctx context.Context, login string) bool {
	if !loginPattern.MatchString(login) || s.dial == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	bus, err := s.dial(ctx)
	if err != nil || ctx.Err() != nil {
		if bus != nil {
			_ = bus.Close()
		}
		return false
	}
	defer bus.Close()
	// go-keyring v0.2.4 chooses collection/login when listed; otherwise
	// aliases/default. We refuse ambiguous/malformed collection metadata.
	values, err := bus.Call(ctx, secretRoot, propertiesGet, "org.freedesktop.Secret.Service", "Collections")
	if err != nil || len(values) != 1 {
		return false
	}
	variant, ok := values[0].(dbus.Variant)
	if !ok {
		return false
	}
	collections, ok := variant.Value().([]dbus.ObjectPath)
	if !ok || len(collections) > 64 {
		return false
	}
	collection := dbus.ObjectPath("/org/freedesktop/secrets/aliases/default")
	seen := map[dbus.ObjectPath]bool{}
	for _, p := range collections {
		if !p.IsValid() || seen[p] {
			return false
		}
		seen[p] = true
		if p == "/org/freedesktop/secrets/collection/login" {
			collection = p
		}
	}
	if !propertyBool(ctx, bus, collection, collectionInterface, "Locked", false) {
		return false
	}
	values, err = bus.Call(ctx, collection, collectionInterface+".SearchItems", map[string]string{"service": "gh:github.com", "username": login})
	if err != nil || len(values) != 1 {
		return false
	}
	paths, ok := values[0].([]dbus.ObjectPath)
	if !ok || len(paths) != 1 || !paths[0].IsValid() || paths[0] == "/" || paths[0] == collection || !strings.HasPrefix(string(paths[0]), "/org/freedesktop/secrets/collection/") {
		return false
	}
	item := paths[0]
	if !propertyBool(ctx, bus, item, itemInterface, "Locked", false) {
		return false
	}
	values, err = bus.Call(ctx, item, propertiesGet, itemInterface, "Attributes")
	if err != nil || len(values) != 1 {
		return false
	}
	variant, ok = values[0].(dbus.Variant)
	if !ok {
		return false
	}
	attrs, ok := variant.Value().(map[string]string)
	// No other attributes: require exact gh v2.46.0 / go-keyring v0.2.4 shape.
	return ok && len(attrs) == 2 && attrs["service"] == "gh:github.com" && attrs["username"] == login && ctx.Err() == nil
}

func propertyBool(ctx context.Context, bus keyringBus, path dbus.ObjectPath, iface, name string, expected bool) bool {
	values, err := bus.Call(ctx, path, propertiesGet, iface, name)
	if err != nil || len(values) != 1 {
		return false
	}
	v, ok := values[0].(dbus.Variant)
	if !ok {
		return false
	}
	b, ok := v.Value().(bool)
	return ok && b == expected && ctx.Err() == nil
}

// linuxKeyringBus connects only to the mapped UID's fixed runtime bus. Do not
// use SessionBus: its autolaunch can spawn a process and its environment can
// redirect the bus to a different principal. A private socket has a deadline
// across authentication, Hello and all metadata calls, and closes on cancel.
type linuxKeyringBus struct {
	conn   *dbus.Conn
	socket net.Conn
	stop   func() bool
}

func (b *linuxKeyringBus) Close() error { b.stop(); return b.conn.Close() }
func (b *linuxKeyringBus) Call(ctx context.Context, path dbus.ObjectPath, method string, args ...any) ([]any, error) {
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	call := b.conn.Object(secretDestination, path).CallWithContext(ctx, method, dbus.FlagNoAutoStart, args...)
	return call.Body, call.Err
}
func dialUserBus(ctx context.Context) (keyringBus, error) {
	runtime := "/run/user/" + strconv.Itoa(os.Geteuid())
	st, err := os.Lstat(runtime)
	if err != nil || !ownedMode(st, true, 0700) {
		return nil, denied
	}
	path := filepath.Join(runtime, "bus")
	st, err = os.Lstat(path)
	if err != nil || !ownedMode(st, false, 0) || st.Mode()&os.ModeSocket == 0 {
		return nil, denied
	}
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", path)
	if err != nil {
		return nil, denied
	}
	stop := context.AfterFunc(ctx, func() { _ = conn.Close() })
	closeEarly := func() { stop(); _ = conn.Close() }
	deadline, ok := ctx.Deadline()
	if !ok {
		closeEarly()
		return nil, denied
	}
	if err = conn.SetDeadline(deadline); err != nil {
		closeEarly()
		return nil, denied
	}
	bus, err := dbus.NewConn(conn)
	if err != nil {
		closeEarly()
		return nil, denied
	}
	if err = bus.Auth(nil); err == nil {
		err = bus.Hello()
	}
	if err != nil || ctx.Err() != nil {
		_ = bus.Close()
		closeEarly()
		return nil, denied
	}
	return &linuxKeyringBus{bus, conn, stop}, nil
}
func ownedMode(st os.FileInfo, dir bool, mode os.FileMode) bool {
	sys, ok := st.Sys().(*syscall.Stat_t)
	if !ok || int(sys.Uid) != os.Geteuid() || st.Mode()&os.ModeSymlink != 0 {
		return false
	}
	if dir {
		return st.IsDir() && st.Mode().Perm() == mode
	}
	return !st.IsDir()
}
