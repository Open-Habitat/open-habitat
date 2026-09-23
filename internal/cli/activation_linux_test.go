//go:build linux

package cli

import (
	"errors"
	"golang.org/x/sys/unix"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestActivationChild(t *testing.T) {
	if os.Getenv("ACTIVATION_HELPER") != "1" {
		return
	}
	path := os.Getenv("ACTIVATION_PATH")
	pid := strconv.Itoa(os.Getpid())
	if os.Getenv("ACTIVATION_CASE") == "stale" {
		pid = "1"
	}
	_ = os.Setenv("LISTEN_PID", pid)
	_ = os.Setenv("LISTEN_FDS", os.Getenv("ACTIVATION_COUNT"))
	_ = os.Setenv("LISTEN_FDNAMES", os.Getenv("ACTIVATION_NAME"))
	cfg := transport.Config{Socket: path}
	if os.Getenv("ACTIVATION_CASE") == "wrong-path" {
		cfg.Socket += "-wrong"
	}
	ln, err := activatedSocketWith(cfg, func(c transport.Config, l *net.UnixListener) error {
		if c.Socket != path || l.Addr().String() != path {
			return errors.New("wrong path")
		}
		return nil
	})
	wantOK := os.Getenv("ACTIVATION_CASE") == "valid"
	if (err == nil) != wantOK {
		t.Fatalf("activation success=%v expected=%v", err == nil, wantOK)
	}
	if ln != nil {
		defer ln.Close()
		if _, e := net.Dial("unix", path); e != nil {
			t.Fatal(e)
		}
	}
	for _, key := range []string{"LISTEN_PID", "LISTEN_FDS", "LISTEN_FDNAMES"} {
		if os.Getenv(key) != "" {
			t.Fatalf("inherited %s", key)
		}
	}
}

func TestActivatedSocketFD3(t *testing.T) {
	for _, tc := range []struct{ name, kind, count, fdname string }{
		{"valid", "unix", "1", "daemon"}, {"stale", "unix", "1", "daemon"},
		{"wrong-path", "unix", "1", "daemon"}, {"zero", "unix", "0", "daemon"},
		{"multiple", "unix", "2", "daemon"}, {"name", "unix", "1", "other"},
		{"tcp", "tcp", "1", "daemon"}, {"datagram", "datagram", "1", "daemon"},
		{"not-listening", "unbound", "1", "daemon"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir, e := os.MkdirTemp("/tmp", "nah-act-")
			if e != nil {
				t.Fatal(e)
			}
			defer os.RemoveAll(dir)
			path := filepath.Join(dir, "sock")
			var f *os.File
			if tc.kind == "tcp" {
				l, e := net.Listen("tcp", "127.0.0.1:0")
				if e != nil {
					t.Fatal(e)
				}
				defer l.Close()
				f, e = l.(*net.TCPListener).File()
				if e != nil {
					t.Fatal(e)
				}
			} else if tc.kind == "datagram" {
				l, e := net.ListenUnixgram("unixgram", &net.UnixAddr{Name: path, Net: "unixgram"})
				if e != nil {
					t.Fatal(e)
				}
				defer l.Close()
				f, e = l.File()
				if e != nil {
					t.Fatal(e)
				}
			} else if tc.kind == "unbound" {
				fd, e := unix.Socket(unix.AF_UNIX, unix.SOCK_STREAM, 0)
				if e != nil {
					t.Fatal(e)
				}
				f = os.NewFile(uintptr(fd), "unbound")
			} else {
				l, e := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
				if e != nil {
					t.Fatal(e)
				}
				defer l.Close()
				f, e = l.File()
				if e != nil {
					t.Fatal(e)
				}
			}
			defer f.Close()
			cmd := exec.Command(os.Args[0], "-test.run=^TestActivationChild$")
			cmd.ExtraFiles = []*os.File{f}
			cmd.Env = append(os.Environ(), "ACTIVATION_HELPER=1", "ACTIVATION_PATH="+path, "ACTIVATION_CASE="+tc.name, "ACTIVATION_COUNT="+tc.count, "ACTIVATION_NAME="+tc.fdname)
			out, e := cmd.CombinedOutput()
			if e != nil {
				t.Fatalf("%v: %s", e, strings.TrimSpace(string(out)))
			}
		})
	}
}
