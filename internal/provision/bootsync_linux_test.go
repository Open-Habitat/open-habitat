//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
)

func TestBootSignalNameMatchesIntegrations(t *testing.T) {
	if got := strings.Join(bootSignal[:], "/"); got != integrations.BootSignal {
		t.Fatalf("broker looks at %q, daemon keeps %q", got, integrations.BootSignal)
	}
}

// bootHome makes base/name with the signal chain, all owned by the runner.
func bootHome(t *testing.T, base, name string, signal bool) string {
	t.Helper()
	home := filepath.Join(base, name)
	path := home
	if signal {
		path = filepath.Join(append([]string{home}, bootSignal[:]...)...)
	}
	if err := os.MkdirAll(path, 0700); err != nil {
		t.Fatal(err)
	}
	return home
}

func bootBase(t *testing.T) string {
	t.Helper()
	base := t.TempDir()
	if err := os.Chmod(base, 0711); err != nil {
		t.Fatal(err)
	}
	return base
}

// Each component of the chain can be the thing that is wrong. A link, a
// non-directory or another owner anywhere is unsafe; a missing component is
// simply absent. The other chain the link points to is complete, so a walk
// that followed it would report the signal present.
func TestBootSignalAtComponents(t *testing.T) {
	uid := uint32(os.Getuid())
	if uid < 1000 {
		t.Skip("the walk refuses system UIDs; the container proof covers root-owned fixtures")
	}
	base := bootBase(t)
	home := bootHome(t, base, "carol", true)
	if present, err := bootSignalAt(base, "carol", uid, nil); !present || err != nil {
		t.Fatalf("complete signal: %v %v", present, err)
	}
	if present, err := bootSignalAt(base, "carol", uid+1, nil); present || !errors.Is(err, errBootSignalUnsafe) {
		t.Fatalf("another person's home: %v %v", present, err)
	}
	if present, err := bootSignalAt(base, "nobody", uid, nil); present || err != nil {
		t.Fatalf("missing home: %v %v", present, err)
	}
	if present, err := bootSignalAt(base, "../carol", uid, nil); present || !errors.Is(err, ErrInvalid) {
		t.Fatalf("path as a name: %v %v", present, err)
	}
	elsewhere := filepath.Join(bootHome(t, base, "elsewhere", true), ".local")
	for depth := 1; depth <= len(bootSignal); depth++ {
		component := filepath.Join(append([]string{home}, bootSignal[:depth]...)...)
		target := filepath.Join(append([]string{elsewhere}, bootSignal[1:depth]...)...)
		aside := component + ".aside"
		if err := os.Rename(component, aside); err != nil {
			t.Fatal(err)
		}
		if present, err := bootSignalAt(base, "carol", uid, nil); present || err != nil {
			t.Fatalf("%s missing: %v %v", bootSignal[depth-1], present, err)
		}
		if err := os.Symlink(target, component); err != nil {
			t.Fatal(err)
		}
		if present, err := bootSignalAt(base, "carol", uid, nil); present || !errors.Is(err, errBootSignalUnsafe) {
			t.Fatalf("%s as a link: %v %v", bootSignal[depth-1], present, err)
		}
		os.Remove(component)
		if err := os.WriteFile(component, nil, 0600); err != nil {
			t.Fatal(err)
		}
		if present, err := bootSignalAt(base, "carol", uid, nil); present || !errors.Is(err, errBootSignalUnsafe) {
			t.Fatalf("%s as a file: %v %v", bootSignal[depth-1], present, err)
		}
		os.Remove(component)
		// Opening a FIFO for reading would block; the walk must not.
		if err := unix.Mkfifo(component, 0600); err != nil {
			t.Fatal(err)
		}
		if present, err := bootSignalAt(base, "carol", uid, nil); present || !errors.Is(err, errBootSignalUnsafe) {
			t.Fatalf("%s as a FIFO: %v %v", bootSignal[depth-1], present, err)
		}
		os.Remove(component)
		if err := os.Rename(aside, component); err != nil {
			t.Fatal(err)
		}
	}
	// A home that is itself a link is not the person's home.
	if err := os.Symlink(filepath.Join(base, "elsewhere"), filepath.Join(base, "dana")); err != nil {
		t.Fatal(err)
	}
	if present, err := bootSignalAt(base, "dana", uid, nil); present || !errors.Is(err, errBootSignalUnsafe) {
		t.Fatalf("home as a link: %v %v", present, err)
	}
}

// The walk holds a descriptor for each checked component and descends from
// it, so swapping a path during the walk cannot redirect it. Replacing the
// next component with a link is caught; moving an already checked one aside
// leaves the walk on the original inodes, never on the replacement.
func TestBootSignalAtSwapDuringWalk(t *testing.T) {
	uid := uint32(os.Getuid())
	if uid < 1000 {
		t.Skip("the walk refuses system UIDs; the container proof covers root-owned fixtures")
	}
	for depth := 1; depth < len(bootSignal); depth++ {
		base := bootBase(t)
		home := bootHome(t, base, "carol", true)
		elsewhere := filepath.Join(bootHome(t, base, "elsewhere", true), ".local")
		next := filepath.Join(append([]string{home}, bootSignal[:depth+1]...)...)
		present, err := bootSignalAt(base, "carol", uid, func(n int) {
			if n != depth {
				return
			}
			if err := os.Rename(next, next+".aside"); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(filepath.Join(append([]string{elsewhere}, bootSignal[1:depth+1]...)...), next); err != nil {
				t.Fatal(err)
			}
		})
		if present || !errors.Is(err, errBootSignalUnsafe) {
			t.Fatalf("link swapped in after %s: %v %v", bootSignal[depth-1], present, err)
		}
	}
	for depth := 1; depth < len(bootSignal); depth++ {
		// A complete chain renamed away after its check is still the
		// person's own, and the walk stays in it.
		base := bootBase(t)
		home := bootHome(t, base, "carol", true)
		checked := filepath.Join(append([]string{home}, bootSignal[:depth]...)...)
		present, err := bootSignalAt(base, "carol", uid, func(n int) {
			if n == depth {
				if err := os.Rename(checked, checked+".aside"); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink("/nonexistent", checked); err != nil {
					t.Fatal(err)
				}
			}
		})
		if !present || err != nil {
			t.Fatalf("left the original %s: %v %v", bootSignal[depth-1], present, err)
		}
	}
	for depth := 1; depth < len(bootSignal); depth++ {
		// The original chain lacks the signal; the replacement has it. A
		// walk that went back to path names would find the replacement.
		base := bootBase(t)
		home := bootHome(t, base, "carol", true)
		os.Remove(filepath.Join(append([]string{home}, bootSignal[:]...)...))
		elsewhere := filepath.Join(bootHome(t, base, "elsewhere", true), ".local")
		checked := filepath.Join(append([]string{home}, bootSignal[:depth]...)...)
		present, err := bootSignalAt(base, "carol", uid, func(n int) {
			if n != depth {
				return
			}
			if err := os.Rename(checked, checked+".aside"); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(filepath.Join(append([]string{elsewhere}, bootSignal[1:depth]...)...), checked); err != nil {
				t.Fatal(err)
			}
		})
		if present || err != nil {
			t.Fatalf("followed a replacement of %s: %v %v", bootSignal[depth-1], present, err)
		}
	}
}

// The walk opens only O_PATH descriptors, which neither list a directory nor
// open anything inside it. inotify sees a readdir or an open; it must see
// nothing on the signal or on what the person keeps in it.
func TestBootSignalAtReadsNothing(t *testing.T) {
	uid := uint32(os.Getuid())
	if uid < 1000 {
		t.Skip("the walk refuses system UIDs; the container proof covers root-owned fixtures")
	}
	base := bootBase(t)
	home := bootHome(t, base, "carol", true)
	signal := filepath.Join(append([]string{home}, bootSignal[:]...)...)
	if err := os.WriteFile(filepath.Join(signal, "kept"), []byte("synthetic"), 0600); err != nil {
		t.Fatal(err)
	}
	watch := watchReads(t, home, signal)
	if present, err := bootSignalAt(base, "carol", uid, nil); !present || err != nil {
		t.Fatalf("signal with content: %v %v", present, err)
	}
	watch.none(t)
	if _, err := os.ReadDir(signal); err != nil {
		t.Fatal(err)
	}
	watch.some(t) // the watch itself works
}

type readWatch int

func watchReads(t *testing.T, paths ...string) readWatch {
	t.Helper()
	fd, err := unix.InotifyInit1(unix.IN_NONBLOCK | unix.IN_CLOEXEC)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { unix.Close(fd) })
	for _, p := range paths {
		if _, err := unix.InotifyAddWatch(fd, p, unix.IN_ACCESS|unix.IN_OPEN|unix.IN_CLOSE_NOWRITE|unix.IN_ATTRIB|unix.IN_MODIFY); err != nil {
			t.Fatal(err)
		}
	}
	return readWatch(fd)
}

func (w readWatch) none(t *testing.T) {
	t.Helper()
	buf := make([]byte, 4096)
	if n, err := unix.Read(int(w), buf); n > 0 || !errors.Is(err, unix.EAGAIN) {
		t.Fatalf("the walk read or opened something it watched (%d bytes of events, %v)", n, err)
	}
}

func (w readWatch) some(t *testing.T) {
	t.Helper()
	buf := make([]byte, 4096)
	if n, _ := unix.Read(int(w), buf); n <= 0 {
		t.Fatal("inotify saw no read at all")
	}
}

// Restore checks the signal only for a committed, admitted person whose
// socket was restored, and starts only the daemon of one whose signal is
// present. A revoked binding, a failed socket start or a missing signal
// starts nothing; a failed daemon start is reported, not hidden.
func TestRestoreStartsOnlySyncingDaemons(t *testing.T) {
	w, h := writerFixture(t)
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"},{"id":"44"}]}`)
	for _, u := range []struct{ id, name string }{{"42", "carol"}, {"43", "dana"}, {"44", "erin"}} {
		if r := handle(w, "ensure", u.id, u.name); r.Route == nil {
			t.Fatal(r)
		}
	}
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[{"id":"42"},{"id":"43"}]}`)
	// Erin is revoked; Mallory has no binding at all. Both keep a signal.
	h.syncing = map[string]bool{"carol": true, "erin": true, "mallory": true}
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 2 {
		t.Fatalf("startup: %v %+v", err, bindings)
	}
	type outcome struct {
		user    string
		started bool
		err     error
	}
	var got []outcome
	restore := func() {
		got = nil
		h.syncCalls, h.startCalls, h.lingerCalls = nil, nil, nil
		w.restoreSockets(context.Background(), bindings, func(string, error) {}, func(user string, started bool, err error) {
			got = append(got, outcome{user, started, err})
		})
	}
	restore()
	if len(h.lingerCalls) != 2 || h.lingerCalls[0] != (hostCall{"enable-linger", "github", "42", "carol", 2100}) || h.lingerCalls[1] != (hostCall{"enable-linger", "github", "43", "dana", 2101}) {
		t.Fatalf("linger included revoked or uncommitted account: %+v", h.lingerCalls)
	}
	if len(got) != 2 || got[0] != (outcome{"carol", true, nil}) || got[1] != (outcome{"dana", false, nil}) {
		t.Fatalf("outcomes: %+v", got)
	}
	if len(h.syncCalls) != 2 || h.syncCalls[0].username != "carol" || h.syncCalls[1].username != "dana" {
		t.Fatalf("looked into homes: %+v", h.syncCalls)
	}
	if len(h.startCalls) != 1 || h.startCalls[0] != (hostCall{"start-daemon", "github", "42", "carol", 2100}) {
		t.Fatalf("started: %+v", h.startCalls)
	}
	h.startErr = true
	restore()
	if len(got) != 2 || got[0].started || !errors.Is(got[0].err, errDaemonStart) {
		t.Fatalf("failed start: %+v", got)
	}
	h.startErr, h.readyErr = false, true
	restore()
	if len(got) != 0 || len(h.syncCalls) != 0 || len(h.startCalls) != 0 {
		t.Fatalf("checked a person whose socket was not restored: %+v %+v", got, h.syncCalls)
	}
}
