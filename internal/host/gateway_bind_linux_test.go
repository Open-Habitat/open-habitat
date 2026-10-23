//go:build linux

package host

import (
	"net"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"testing"

	"golang.org/x/sys/unix"
)

// Disposable container only: exercise the kernel boundary independently of
// systemd rendering. This is not installed-systemd or pilot acceptance.
func TestGatewayNativeLowPort(t *testing.T) {
	if os.Getenv("HOST_BIND_CONTAINER") != "1" {
		t.Skip("isolated network namespace with privileged-port threshold 1024 only")
	}
	if os.Getenv("HOST_BIND_CHILD") == "1" {
		if os.Geteuid() == 0 {
			t.Fatal("gateway child is root")
		}
		if e := unix.Prctl(unix.PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0); e != nil {
			t.Fatal(e)
		}
		addr := os.Getenv("HOST_BIND_ADDR")
		ln, e := net.Listen("tcp", addr)
		if os.Getenv("HOST_BIND_DENIED") == "1" {
			if e == nil {
				ln.Close()
				t.Fatal("unprivileged low-port bind unexpectedly succeeded")
			}
			return
		}
		if e != nil {
			t.Fatal(e)
		}
		defer ln.Close()
		status, e := os.ReadFile("/proc/self/status")
		if e != nil {
			t.Fatal(e)
		}
		want := "CapEff:\t0000000000000000"
		if strings.HasSuffix(addr, ":443") {
			want = "CapEff:\t0000000000000400"
		}
		if !strings.Contains(string(status), want) {
			t.Fatal("unexpected effective authority")
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("container parent must be root")
	}
	threshold, e := os.ReadFile("/proc/sys/net/ipv4/ip_unprivileged_port_start")
	if e != nil || strings.TrimSpace(string(threshold)) != "1024" {
		t.Fatal("fixture must require privileged-port authorization", e)
	}
	exe, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	for _, c := range []struct {
		addr        string
		cap, denied bool
	}{{"127.0.0.1:443", false, true}, {"127.0.0.1:443", true, false}, {"127.0.0.1:8443", false, false}} {
		cmd := exec.Command(exe, "-test.run=^TestGatewayNativeLowPort$", "-test.v")
		cmd.Env = append(os.Environ(), "HOST_BIND_CHILD=1", "HOST_BIND_ADDR="+c.addr)
		if c.denied {
			cmd.Env = append(cmd.Env, "HOST_BIND_DENIED=1")
		}
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 65534, Gid: 65534}}
		if c.cap {
			cmd.SysProcAttr.AmbientCaps = []uintptr{unix.CAP_NET_BIND_SERVICE}
		}
		if out, e := cmd.CombinedOutput(); e != nil {
			t.Fatalf("%+v: %v: %s", c, e, out)
		}
	}
}
