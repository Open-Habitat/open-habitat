//go:build linux

package host

import (
	"context"
	"github.com/open-habitat/open-habitat/internal/provision"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApplyUnitOverridesAreNotAdopted(t *testing.T) {
	for _, name := range []string{"open-habitat-gateway.service.d", "open-habitat-daemon@.service.d", "open-habitat-daemon@person.service.d", "open-habitat-.service.d", "open-.service.d", "service.d", "socket.d"} {
		t.Run(name, func(t *testing.T) {
			root, owner := operationFixture(t)
			root = filepath.Dir(root)
			if e := unitOverridesSafe([]string{root, root + "/absent"}, root, owner); e != nil {
				t.Fatal(e)
			}
			path := filepath.Join(root, name)
			if e := os.Mkdir(path, 0755); e != nil {
				t.Fatal(e)
			}
			if e := unitOverridesSafe([]string{root}, root, owner); e != nil {
				t.Fatal("empty directory treated as an override", e)
			}
			if e := os.WriteFile(path+"/foreign.conf", []byte("[Service]\nAmbientCapabilities=CAP_DAC_READ_SEARCH\n"), 0644); e != nil {
				t.Fatal(e)
			}
			if e := unitOverridesSafe([]string{root}, root, owner); e == nil {
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
			if e := unitOverridesSafe([]string{root}, root, owner); e == nil {
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
	if e := unitOverridesSafe([]string{root}, root, owner); e != nil {
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
	if e = unitOverridesSafe(paths, unitDir, 0); e != nil {
		t.Fatal("base Ubuntu unit lookup policy", e)
	}
}

func TestGatewayBindAuthorityAndRollForward(t *testing.T) {
	for _, endpoint := range []string{"0.0.0.0:443", "[::]:443", "127.0.0.1:1023", "0.0.0.0:1024", "127.0.0.1:8443"} {
		t.Run(endpoint, func(t *testing.T) {
			s := Site{}
			s.Gateway.Listen = endpoint
			want := applyUnitPolicies(s)[2]
			low := !strings.HasSuffix(endpoint, ":1024") && !strings.HasSuffix(endpoint, ":8443")
			caps := ""
			if low {
				caps = "CAP_NET_BIND_SERVICE"
			}
			if !strings.Contains(want.Content, "\nAmbientCapabilities="+caps+"\nCapabilityBoundingSet="+caps+"\n") || !strings.Contains(want.Content, "\nUser=open-habitat-gateway\n") || !strings.Contains(want.Content, "\nNoNewPrivileges=yes\n") {
				t.Fatal("excess or missing authority", want.Content)
			}
			otherSite := Site{}
			otherSite.Gateway.Listen = "0.0.0.0:443"
			if low {
				otherSite.Gateway.Listen = "0.0.0.0:8443"
			}
			other := applyUnitPolicies(otherSite)[2]
			if !recognizedUnitPolicy(policySnapshot{Content: other.Content, Mode: 0644}, want) {
				t.Fatal("declared port class change refused at preflight")
			}
			root, owner := operationFixture(t)
			old := legacyApplyUnitPolicies()[2]
			if e := installPolicy(root, old, owner); e != nil {
				t.Fatal(e)
			}
			if e := rollForwardGatewayPolicy(root, owner, s); e != nil {
				t.Fatal(e)
			}
			if !policiesMatch(root, []policyFile{want}, owner) {
				t.Fatal("repair not published")
			}
			if e := rollForwardGatewayPolicy(root, owner, s); e != nil {
				t.Fatal("retry", e)
			}
			foreign := old
			foreign.Content += "\nAmbientCapabilities=CAP_DAC_READ_SEARCH\n"
			if e := installPolicy(root, foreign, owner); e != nil {
				t.Fatal(e)
			}
			if e := rollForwardGatewayPolicy(root, owner, s); e == nil {
				t.Fatal("foreign policy overwritten")
			}
			if !policiesMatch(root, []policyFile{foreign}, owner) {
				t.Fatal("refusal changed bytes")
			}
		})
	}
}

func TestGatewayListenQualification(t *testing.T) {
	if gatewayListenReady("192.0.2.123:443") == nil {
		t.Fatal("nonlocal bind accepted")
	}
	if gatewayListenReady("127.0.0.1:8443") != nil {
		t.Fatal("high loopback port refused")
	}
	for _, status := range []string{"", "CapBnd:\tgarbage\n", "CapBnd:\t0000000000000000\n", "CapEff:\t0000000000000400\n", "CapBnd:\t0000000000000400\n", "CapBnd:\t0000000000000400\nCapPrm:\t0\n"} {
		if managerCanBindLowPort(status) {
			t.Fatal("unavailable capability accepted", status)
		}
	}
	if !managerCanBindLowPort("Name:\tsystemd\nCapBnd:\t0000000000000400\nCapPrm:\t0000000000000400\n") {
		t.Fatal("bind capability refused")
	}
}

func TestGatewayRaisedPrivilegedPortThreshold(t *testing.T) {
	for _, tc := range []struct {
		port      int
		threshold string
		want      bool
	}{
		{1024, "1024\n", true}, {1024, "2048\n", false}, {2047, "2048", false},
		{2048, "2048", true}, {8443, "0", true}, {8443, "65535", false},
		{8443, "unknown", false}, {8443, "65536", false},
	} {
		if got := unprivilegedPortAllowed(tc.port, tc.threshold); got != tc.want {
			t.Fatalf("%+v: %v", tc, got)
		}
	}
}

// The broker's slice drop-in on a person's daemon is the one product drop-in
// accepted, only where the broker writes it and only with its exact bytes.
func TestApplyAcceptsOnlyTheBrokerDaemonSliceDropIn(t *testing.T) {
	setup := func(t *testing.T, name, content string) (string, uint32) {
		root, owner := operationFixture(t)
		root = filepath.Dir(root)
		dir := filepath.Join(root, name)
		if e := os.Mkdir(dir, 0755); e != nil {
			t.Fatal(e)
		}
		file := filepath.Join(dir, provision.DaemonSliceFile)
		if e := os.WriteFile(file, []byte(content), 0644); e != nil {
			t.Fatal(e)
		}
		if e := os.Chmod(file, 0644); e != nil { // whatever the test's umask
			t.Fatal(e)
		}
		return root, owner
	}
	exact := provision.DaemonSliceContent("person", 32000)
	if _, ok := provision.ParseDaemonSlice(probeInstance, []byte(provision.DaemonSliceContent(probeInstance, 32000))); ok {
		t.Fatal("a person could own the verifier's probe instance")
	}
	root, owner := setup(t, "open-habitat-daemon@person.service.d", exact)
	if e := unitOverridesSafe([]string{root}, root, owner); e != nil {
		t.Fatal("broker drop-in refused", e)
	}
	if e := unitOverridesSafe([]string{root}, root+"/other", owner); e == nil {
		t.Fatal("drop-in accepted outside the product unit directory")
	}
	if e := os.WriteFile(filepath.Join(root, "open-habitat-daemon@person.service.d", "budget.conf"), []byte("[Service]\nMemoryMax=1G\n"), 0644); e != nil {
		t.Fatal(e)
	}
	if e := unitOverridesSafe([]string{root}, root, owner); e == nil {
		t.Fatal("foreign drop-in beside the broker's accepted")
	}
	for _, tc := range []struct{ name, dir, content string }{
		{"other_person", "open-habitat-daemon@other.service.d", exact},
		{"tampered", "open-habitat-daemon@person.service.d", exact + "AmbientCapabilities=CAP_DAC_READ_SEARCH\n"},
		{"socket", "open-habitat-daemon@person.socket.d", exact},
		{"agent_socket", "open-habitat-agent@person.socket.d", exact},
		{"template", "open-habitat-daemon@.service.d", exact},
	} {
		t.Run(tc.name, func(t *testing.T) {
			root, owner := setup(t, tc.dir, tc.content)
			if e := unitOverridesSafe([]string{root}, root, owner); e == nil {
				t.Fatal("foreign drop-in accepted under the broker's name")
			}
		})
	}
	root, owner = setup(t, "open-habitat-daemon@person.service.d", exact)
	if e := os.Chmod(filepath.Join(root, "open-habitat-daemon@person.service.d", provision.DaemonSliceFile), 0664); e != nil {
		t.Fatal(e)
	}
	if e := unitOverridesSafe([]string{root}, root, owner); e == nil {
		t.Fatal("group-writable drop-in accepted")
	}
}

// The real unit search paths with a person's slice drop-in written by the
// broker, in a disposable systemd container only.
func TestApplyUnitLookupWithDaemonSliceWhenSystemdInstalled(t *testing.T) {
	if os.Geteuid() != 0 || os.Getenv("OH_SLICE_SYSTEMD_CONTAINER") != "1" {
		t.Skip("disposable systemd container only")
	}
	paths, e := unitSearchPaths(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	if e = unitOverridesSafe(paths, unitDir, 0); e != nil {
		t.Fatal("broker slice drop-in refused on a real host", e)
	}
	if e = verifyUnitPolicies(context.Background(), nil); e != nil {
		t.Fatal("effective product fragments", e)
	}
}
