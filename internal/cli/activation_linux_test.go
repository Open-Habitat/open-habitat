//go:build linux

package cli

import (
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

func TestActivatedPair(t *testing.T) {
	if os.Getenv("PAIR_CHILD") == "1" {
		os.Setenv("LISTEN_PID", strconv.Itoa(os.Getpid()))
		if os.Getenv("PAIR_STALE") == "1" {
			os.Setenv("LISTEN_PID", "1")
		}
		cfg := transport.Config{Socket: os.Getenv("PAIR_PATH")}
		check := func(transport.Config, *net.UnixListener) error { return nil }
		d, a, err := activatedSocketsWith(cfg, check, check)
		want := os.Getenv("PAIR_VALID") == "1"
		if (err == nil) != want {
			t.Fatalf("success=%v want=%v", err == nil, want)
		}
		if d != nil {
			defer d.Close()
		}
		if a != nil {
			defer a.Close()
		}
		for _, key := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
			if os.Getenv(key) != "" {
				t.Fatal("activation env inherited")
			}
		}
		return
	}
	for _, tc := range []struct {
		name, names, count string
		swap, valid        bool
	}{
		{"gateway-first", "daemon:agent", "2", false, true},
		{"agent-first", "agent:daemon", "2", true, true},
		{"swapped", "agent:daemon", "2", false, false},
		{"missing", "daemon", "1", false, false},
		{"stale", "daemon:agent", "2", false, false},
		{"extra", "daemon:agent:other", "3", false, false},
		{"duplicate", "agent:agent", "2", false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "daemon.sock")
			d, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
			if e != nil {
				t.Fatal(e)
			}
			defer d.Close()
			a, e := net.ListenUnix("unix", &net.UnixAddr{Name: filepath.Join(dir, "agent.sock"), Net: "unix"})
			if e != nil {
				t.Fatal(e)
			}
			defer a.Close()
			df, _ := d.File()
			af, _ := a.File()
			defer df.Close()
			defer af.Close()
			files := []*os.File{df, af}
			if tc.swap {
				files = []*os.File{af, df}
			}
			c := exec.Command(os.Args[0], "-test.run=^TestActivatedPair$")
			c.ExtraFiles = files
			stale := "0"
			if tc.name == "stale" {
				stale = "1"
			}
			valid := "0"
			if tc.valid {
				valid = "1"
			}
			c.Env = append(os.Environ(), "PAIR_CHILD=1", "PAIR_STALE="+stale, "PAIR_PATH="+path, "PAIR_VALID="+valid, "LISTEN_FDNAMES="+tc.names, "LISTEN_FDS="+tc.count)
			if b, e := c.CombinedOutput(); e != nil {
				t.Fatalf("%v: %s", e, b)
			}
		})
	}
}

func TestActivatedFDRejectsWrongSocketTypes(t *testing.T) {
	cfg := transport.Config{Socket: "/not-the-activated-path"}
	tcp, err := net.ListenTCP("tcp", &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1)})
	if err != nil {
		t.Fatal(err)
	}
	defer tcp.Close()
	tf, err := tcp.File()
	if err != nil {
		t.Fatal(err)
	}
	defer tf.Close()
	udp, err := net.ListenUnixgram("unixgram", &net.UnixAddr{Name: filepath.Join(t.TempDir(), "dgram"), Net: "unixgram"})
	if err != nil {
		t.Fatal(err)
	}
	defer udp.Close()
	uf, err := udp.File()
	if err != nil {
		t.Fatal(err)
	}
	defer uf.Close()
	fd, err := unix.Socket(unix.AF_UNIX, unix.SOCK_STREAM|unix.SOCK_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	nf := os.NewFile(uintptr(fd), "not-listening")
	defer nf.Close()
	for _, file := range []*os.File{tf, uf, nf} {
		called := false
		if ln, err := activatedFD(int(file.Fd()), cfg, cfg.Socket, func(transport.Config, *net.UnixListener) error { called = true; return nil }); err == nil {
			ln.Close()
			t.Fatal("unsafe fd accepted")
		}
		if called {
			t.Fatal("validator called before kernel socket checks")
		}
	}
}
