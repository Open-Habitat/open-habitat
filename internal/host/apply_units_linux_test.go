//go:build linux

package host

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestApplyUnitOverridesAreNotAdopted(t *testing.T) {
	for _, name := range []string{"open-habitat-gateway.service.d", "open-habitat-daemon@.service.d", "open-habitat-daemon@person.service.d", "open-habitat-.service.d", "open-.service.d", "service.d", "socket.d"} {
		t.Run(name, func(t *testing.T) {
			root, owner := operationFixture(t)
			root = filepath.Dir(root)
			if e := unitOverridesSafe([]string{root, root + "/absent"}, owner); e != nil {
				t.Fatal(e)
			}
			path := filepath.Join(root, name)
			if e := os.Mkdir(path, 0755); e != nil {
				t.Fatal(e)
			}
			if e := unitOverridesSafe([]string{root}, owner); e != nil {
				t.Fatal("empty directory treated as an override", e)
			}
			if e := os.WriteFile(path+"/foreign.conf", []byte("[Service]\nAmbientCapabilities=CAP_DAC_READ_SEARCH\n"), 0644); e != nil {
				t.Fatal(e)
			}
			if e := unitOverridesSafe([]string{root}, owner); e == nil {
				t.Fatal("foreign actor privilege override accepted")
			}
		})
	}
	for _, name := range []string{"open-habitat-daemon@person.service", "open-habitat-daemon@person.socket", "open-habitat-agent@person.socket", "open-habitat-binding@person.service"} {
		t.Run(name, func(t *testing.T) {
			root, owner := operationFixture(t)
			root = filepath.Dir(root)
			if e := os.WriteFile(filepath.Join(root, name), []byte("foreign instance"), 0644); e != nil {
				t.Fatal(e)
			}
			if e := unitOverridesSafe([]string{root}, owner); e == nil {
				t.Fatal("full foreign instance adopted")
			}
		})
	}
	root, owner := operationFixture(t)
	root = filepath.Dir(root)
	for _, name := range []string{"open-habitat-daemon@.service", "open-habitat-daemon@.socket", "open-habitat-agent@.socket", "open-habitat-broker.service", "other-project.service"} {
		if e := os.WriteFile(filepath.Join(root, name), []byte("fixture"), 0644); e != nil {
			t.Fatal(e)
		}
	}
	if e := os.Mkdir(filepath.Join(root, "user-21032.slice.d"), 0755); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(root, "user-21032.slice.d", "budget.conf"), []byte("[Slice]\nMemoryMax=1G\n"), 0644); e != nil {
		t.Fatal(e)
	}
	if e := unitOverridesSafe([]string{root}, owner); e != nil {
		t.Fatal("templates or user slice budget rejected", e)
	}
}
func TestApplyUnitFragmentObservationIsStrict(t *testing.T) {
	want := "/etc/systemd/system/open-habitat-gateway.service"
	if !unitFragmentMatches([]byte("DropInPaths=\nFragmentPath="+want+"\n"), want) {
		t.Fatal("qualified fragment refused")
	}
	for _, b := range []string{"FragmentPath=" + want + "\nDropInPaths=/run/systemd/system/open-habitat-gateway.service.d/foreign.conf\n", "FragmentPath=/run/systemd/transient/open-habitat-gateway.service\nDropInPaths=\n", "FragmentPath=" + want + "\nFragmentPath=" + want + "\nDropInPaths=\n", "FragmentPath=" + want + "\n"} {
		if unitFragmentMatches([]byte(b), want) {
			t.Fatal("ambiguous or foreign effective policy accepted", b)
		}
	}
}

func TestApplyUnitLookupWhenSystemdInstalled(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("disposable Ubuntu tools container only")
	}
	if _, e := os.Stat("/usr/bin/systemd-analyze"); os.IsNotExist(e) {
		t.Skip("minimal root-filesystem test image has no systemd tools")
	} else if e != nil {
		t.Fatal(e)
	}
	paths, e := unitSearchPaths(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	if e = unitOverridesSafe(paths, 0); e != nil {
		t.Fatal("base Ubuntu unit lookup policy", e)
	}
}
