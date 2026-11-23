//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

func sliceFixture(t *testing.T) (string, uint32) {
	t.Helper()
	root, owner, _ := installFixture(t)
	base := filepath.Join(root, "units")
	if err := os.Mkdir(base, 0755); err != nil {
		t.Fatal(err)
	}
	return base, owner
}

func TestDaemonSliceDropInIsWrittenOnceAndNeverRepaired(t *testing.T) {
	base, owner := sliceFixture(t)
	dir := filepath.Join(base, "open-habitat-daemon@person.service.d")
	file := filepath.Join(dir, DaemonSliceFile)
	changed, err := ensureDaemonSliceAt(base, owner, "person", 32000)
	if err != nil || !changed {
		t.Fatal("first write", changed, err)
	}
	b, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	if uid, ok := ParseDaemonSlice("person", b); !ok || uid != 32000 {
		t.Fatalf("written drop-in not recognized: %q", b)
	}
	for path, mode := range map[string]os.FileMode{dir: 0755, file: 0644} {
		if st, err := os.Lstat(path); err != nil || st.Mode().Perm() != mode {
			t.Fatal("mode", path, st.Mode(), err)
		}
	}
	if changed, err = ensureDaemonSliceAt(base, owner, "person", 32000); err != nil || changed {
		t.Fatal("exact drop-in rewritten or refused", changed, err)
	}
	// Same name, another UID: a stale drop-in from another binding.
	if _, err = ensureDaemonSliceAt(base, owner, "person", 32001); err == nil {
		t.Fatal("drop-in for another UID adopted")
	}
	// systemd ignores a name without .conf; anything it would load is foreign.
	if err = os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = ensureDaemonSliceAt(base, owner, "person", 32000); err != nil {
		t.Fatal("ignored file refused", err)
	}
	if err = os.WriteFile(filepath.Join(dir, "budget.conf"), []byte("[Service]\nMemoryMax=1G\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = ensureDaemonSliceAt(base, owner, "person", 32000); err == nil {
		t.Fatal("foreign drop-in beside the product's accepted")
	}
	if err = removeDaemonSliceAt(base, owner, "person"); err == nil {
		t.Fatal("directory with a foreign drop-in removed")
	}
	if _, err = os.Stat(filepath.Join(dir, "budget.conf")); err != nil {
		t.Fatal("removal deleted a foreign file", err)
	}

	// An interrupted write leaves only the staging name, which is ours.
	other := filepath.Join(base, "open-habitat-daemon@other.service.d")
	if err = os.Mkdir(other, 0755); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(other, "."+DaemonSliceFile+".next"), []byte("[Serv"), 0644); err != nil {
		t.Fatal(err)
	}
	if changed, err = ensureDaemonSliceAt(base, owner, "other", 32002); err != nil || !changed {
		t.Fatal("interrupted write not completed", changed, err)
	}
	if err = os.WriteFile(filepath.Join(other, DaemonSliceFile), []byte(DaemonSliceContent("other", 32002)+"ExecStartPre=+/bin/true\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err = ensureDaemonSliceAt(base, owner, "other", 32002); err == nil {
		t.Fatal("tampered product drop-in accepted")
	}
	if err = removeDaemonSliceAt(base, owner, "other"); err != nil {
		t.Fatal(err)
	}
	if _, err = os.Lstat(other); !os.IsNotExist(err) {
		t.Fatal("drop-in directory left", err)
	}
	if err = removeDaemonSliceAt(base, owner, "other"); err != nil {
		t.Fatal("repeated removal", err)
	}

	// A link in the product's place is never followed.
	if err = os.Symlink(dir, filepath.Join(base, "open-habitat-daemon@linked.service.d")); err != nil {
		t.Fatal(err)
	}
	if _, err = ensureDaemonSliceAt(base, owner, "linked", 32003); err == nil {
		t.Fatal("linked drop-in directory followed")
	}
}

func TestParseDaemonSliceAcceptsOnlyTheExactText(t *testing.T) {
	want := DaemonSliceContent("person", 32000)
	if uid, ok := ParseDaemonSlice("person", []byte(want)); !ok || uid != 32000 {
		t.Fatal("exact text refused")
	}
	for _, tc := range []struct{ name, text string }{
		{"other", want},
		{"Person", want},
		{"person", want + "\n"},
		{"person", want + "ExecStartPre=+/bin/sh\n"},
		{"person", "[Service]\nSlice=user-32000.slice\n"},
		{"person", DaemonSliceContent("person", 999)},
		{"person", DaemonSliceContent("person", 60001)},
		{"person", DaemonSliceContent("person", 32000)[:len(want)-len("32000.slice\n")] + "032000.slice\n"},
	} {
		if _, ok := ParseDaemonSlice(tc.name, []byte(tc.text)); ok {
			t.Errorf("accepted %q for %s", tc.text, tc.name)
		}
	}
}

func TestDaemonSliceShownNeedsTheSliceAndOnlyTheProductDropIn(t *testing.T) {
	i := ExecutorIdentity{provider: "github", id: "123", username: "person", uid: 32000}
	path := "/etc/systemd/system/open-habitat-daemon@person.service.d/" + DaemonSliceFile
	if !daemonSliceShown([]byte("Slice=user-32000.slice\nDropInPaths="+path+"\n"), i) {
		t.Fatal("product slice refused")
	}
	for _, b := range []string{
		"Slice=system-open\\x2dhabitat\\x2ddaemon.slice\nDropInPaths=\n",
		"Slice=user-32001.slice\nDropInPaths=" + path + "\n",
		"Slice=user-32000.slice\nDropInPaths=" + path + " /run/systemd/system/open-habitat-daemon@person.service.d/x.conf\n",
		"Slice=user-32000.slice\nDropInPaths=/etc/systemd/system.control/open-habitat-daemon@person.service.d/50-MemoryMax.conf\n",
		"Slice=user-32000.slice\n",
	} {
		if daemonSliceShown([]byte(b), i) {
			t.Errorf("accepted %q", b)
		}
	}
}

func TestEnsureDaemonSlicesCoversCommittedBindingsNotUnderRemoval(t *testing.T) {
	root, owner, p := installFixture(t)
	if _, err := initializeBroker(context.Background(), root, "broker", p, []string{"123"}, owner, nil); err != nil {
		t.Fatal(err)
	}
	state := filepath.Join(root, "broker")
	for name, body := range map[string]string{
		"bindings.json":  `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"person"},{"id":"50","uid":32001,"username":"leaving"}]}`,
		"head.json":      `{"version":1,"epoch":2,"generation":2}`,
		"allowlist.json": `{"version":1,"epoch":2,"ids":[{"id":"123"}],"runtime_admission":true,"runtime":[{"id":"50","state":"withdrawn","login_hint":"leaving","actor":"123","at":"2026-10-24T09:30:00Z"}],"removals":[{"id":"50","uid":32001,"username":"leaving","due":"2026-11-07T09:30:00Z","actor":"123","at":"2026-10-24T09:30:00Z","stage":"closed"}]}`,
	} {
		if err := os.WriteFile(filepath.Join(state, name), []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
	}
	base := filepath.Join(root, "units")
	if err := os.Mkdir(base, 0755); err != nil {
		t.Fatal(err)
	}
	fd, err := lockedDir(context.Background(), state, owner)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	if err = ensureDaemonSlicesAt(context.Background(), fd, owner, base); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(base, DaemonSliceDir("person"), DaemonSliceFile))
	if err != nil || string(b) != DaemonSliceContent("person", 32000) {
		t.Fatal("committed binding without its drop-in", err)
	}
	if _, err = os.Lstat(filepath.Join(base, DaemonSliceDir("leaving"))); !os.IsNotExist(err) {
		t.Fatal("drop-in written for a binding under removal", err)
	}
	if err = ensureDaemonSlicesAt(context.Background(), fd, owner, base); err != nil {
		t.Fatal("repeat", err)
	}
	if err = os.WriteFile(filepath.Join(state, "pending.json"), []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = ensureDaemonSlicesAt(context.Background(), fd, owner, base); err == nil {
		t.Fatal("uncommitted ledger read")
	}
}

// TestDaemonSliceLiveSystemd runs only as root in a disposable systemd
// container with the product's units and the account in place: the broker's
// write, systemd's reload and the effective-property check, against the
// distribution's real systemd.
func TestDaemonSliceLiveSystemd(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("OH_SLICE_SYSTEMD_CONTAINER") != "1" {
		t.Skip("disposable systemd container only")
	}
	i := ExecutorIdentity{provider: "github", id: "123", username: os.Getenv("OH_SLICE_USER"), uid: 32000}
	e := &LinuxHostExecutor{GatewayUID: 31000, GatewayGID: 31000, run: linuxCommand}
	ctx := context.Background()
	if err := e.ensureDaemonSlice(ctx, i); err != nil {
		t.Fatal(err)
	}
	b, err := e.command(ctx, systemctl, "show", "open-habitat-daemon@"+i.username+".service", "--property=Slice,DropInPaths", "--no-pager")
	if err != nil || !daemonSliceShown(b, i) {
		t.Fatalf("effective slice: %q %v", b, err)
	}
	if os.Getenv("OH_SLICE_REMOVE") == "1" {
		if err := removeDaemonSliceAt(unitBase, 0, i.username); err != nil {
			t.Fatal(err)
		}
	}
}
