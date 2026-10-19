//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// bootUIDHost looks at real homes with the production walk and records the
// daemon starts it is asked for.
type bootUIDHost struct {
	*fakeHost
	base string
}

func (h *bootUIDHost) SyncAtBoot(ctx context.Context, i ExecutorIdentity) (bool, error) {
	h.mu.Lock()
	h.syncCalls = append(h.syncCalls, call("sync-at-boot", i))
	h.mu.Unlock()
	return bootSignalAt(h.base, i.Username(), i.UID(), nil)
}

// TestBootSyncDistinctUIDs runs only inside scripts/test-broker-boot-uids.sh's
// disposable, networkless rootless container, as the container's root. Three
// committed people own their homes under three actual kernel UIDs and a
// fourth home has no binding. Restore starts exactly the daemon of the person
// whose signal is a chain of their own directories; a signal linked to
// another person's, a component owned by another person, and an uncommitted
// home start nothing, and nothing inside any home is read or opened.
func TestBootSyncDistinctUIDs(t *testing.T) {
	if os.Getenv("PROVISION_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container with distinct synthetic UIDs")
	}
	if os.Geteuid() != 0 {
		t.Fatal("the container proof runs as the container's root, like the broker")
	}
	w, h := writerFixture(t)
	w.UIDMax = 2103
	put(t, w.Dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"},{"id":"43"},{"id":"44"}]}`)
	for _, u := range []struct{ id, name string }{{"42", "carol"}, {"43", "dana"}, {"44", "erin"}} {
		if r := handle(w, "ensure", u.id, u.name); r.Route == nil {
			t.Fatal(r)
		}
	}
	base, err := os.MkdirTemp("/var/tmp", "boot-uids-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(base) })
	if err := os.Chmod(base, 0755); err != nil {
		t.Fatal(err)
	}
	uids := map[string]int{"carol": 2100, "dana": 2101, "erin": 2102, "mallory": 2103}
	signals := map[string]string{}
	var watched []string
	for name, uid := range uids {
		home := filepath.Join(base, name)
		path := home
		for _, c := range bootSignal {
			path = filepath.Join(path, c)
		}
		if err := os.MkdirAll(path, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(path, "kept"), []byte("synthetic"), 0600); err != nil {
			t.Fatal(err)
		}
		for p := path; ; p = filepath.Dir(p) {
			if err := os.Lchown(p, uid, uid); err != nil {
				t.Fatal(err)
			}
			if p == home {
				break
			}
		}
		if err := os.Lchown(filepath.Join(path, "kept"), uid, uid); err != nil {
			t.Fatal(err)
		}
		signals[name] = path
		watched = append(watched, home, path)
	}
	// Dana's signal is a link to Carol's; Erin's state directory is Carol's.
	dana := signals["dana"]
	if err := os.Remove(filepath.Join(dana, "kept")); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(dana); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(signals["carol"], dana); err != nil {
		t.Fatal(err)
	}
	if err := os.Lchown(dana, uids["dana"], uids["dana"]); err != nil {
		t.Fatal(err)
	}
	var kept []string
	for _, p := range watched {
		if p != dana {
			kept = append(kept, p)
		}
	}
	if err := os.Lchown(filepath.Join(base, "erin", ".local", "state"), uids["carol"], uids["carol"]); err != nil {
		t.Fatal(err)
	}
	host := &bootUIDHost{fakeHost: h, base: base}
	w.Executor = host
	bindings, err := w.startupBindings(context.Background())
	if err != nil || len(bindings) != 3 {
		t.Fatalf("startup: %v %+v", err, bindings)
	}
	for _, b := range bindings {
		if b.UID() != uint32(uids[b.Username()]) {
			t.Fatalf("binding %s has UID %d", b.Username(), b.UID())
		}
	}
	watch := watchReads(t, kept...)
	outcomes := map[string]error{}
	var started []string
	w.restoreSockets(context.Background(), bindings, func(user string, err error) {
		if err != nil {
			t.Fatalf("socket restore for %s: %v", user, err)
		}
	}, func(user string, ok bool, err error) {
		outcomes[user] = err
		if ok {
			started = append(started, user)
		}
	})
	watch.none(t)
	if len(started) != 1 || started[0] != "carol" {
		t.Fatalf("started %v", started)
	}
	if len(h.startCalls) != 1 || h.startCalls[0] != (hostCall{"start-daemon", "github", "42", "carol", 2100}) {
		t.Fatalf("daemon starts: %+v", h.startCalls)
	}
	for _, name := range []string{"dana", "erin"} {
		if err, ok := outcomes[name]; !ok || !errors.Is(err, errBootSignalUnsafe) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	for _, c := range h.syncCalls {
		if c.username == "mallory" {
			t.Fatal("looked into a home without a committed binding")
		}
	}
	if len(h.syncCalls) != 3 {
		t.Fatalf("signal checks: %+v", h.syncCalls)
	}
}
