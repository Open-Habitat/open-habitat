//go:build linux

package cli

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"syscall"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// Production descriptor validation with actual owner and gateway UIDs. Both
// first requests are queued before the daemon exists; no HTTP mock can prove
// that a startup probe did not eat one. PID 1 activation remains a live check.
func TestAgentActivatedPairDistinctUIDs(t *testing.T) {
	if os.Getenv("AGENT_UID_CONTAINER") != "1" {
		t.Skip("requires scripts/test-agent-uids.sh")
	}
	const dir = "/run/open-habitat/users/synthetic-agent"
	cfg := transport.Config{UID: 21001, GatewayUID: 21003, Username: "synthetic-agent", Home: "/nonexistent", Socket: dir + "/daemon.sock", Provider: "github", Subject: "42"}
	switch os.Getenv("ACT_PAIR_ROLE") {
	case "serve":
		os.Setenv("LISTEN_PID", strconv.Itoa(os.Getpid()))
		os.Setenv("LISTEN_FDS", "2")
		os.Setenv("LISTEN_FDNAMES", "daemon:agent")
		d, a, err := activatedSockets(cfg)
		if err != nil {
			t.Fatal(err)
		}
		defer d.Close()
		defer a.Close()
		server, err := transport.NewServer(cfg, func(context.Context, string) error { return nil })
		if err != nil {
			t.Fatal(err)
		}
		mux := http.NewServeMux()
		mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
			if !server.TrustedPeer(r) {
				t.Error("gateway peer lost")
			}
			w.WriteHeader(204)
		})
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go server.ServeMux(ctx, d, mux)
		if err := transport.ServeAgent(ctx, a, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !transport.AgentPeer(r) || server.TrustedPeer(r) {
				t.Error("peer authority confused")
			}
			w.WriteHeader(204)
		})); err != nil {
			t.Fatal(err)
		}
		return
	case "probe":
		c, err := net.DialTimeout("unix", os.Getenv("ACT_PAIR_PATH"), time.Second)
		if err != nil {
			t.Fatal(err)
		}
		defer c.Close()
		c.SetDeadline(time.Now().Add(5 * time.Second))
		if _, err := fmt.Fprint(c, "GET /healthz HTTP/1.1\r\nHost: unix\r\nConnection: close\r\n\r\n"); err != nil {
			t.Fatal(err)
		}
		ready := os.NewFile(3, "ready")
		ready.Write([]byte{1})
		ready.Close()
		r, err := http.ReadResponse(bufio.NewReader(c), nil)
		if err != nil {
			t.Fatal(err)
		}
		defer r.Body.Close()
		if r.StatusCode != 204 {
			t.Fatal(r.StatusCode)
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	for _, p := range []string{"/run/open-habitat", "/run/open-habitat/users", dir} {
		if err := os.Chmod(p, 0755); err != nil {
			t.Fatal(err)
		}
	}
	for _, trigger := range []string{"agent", "daemon", "simultaneous"} {
		t.Run(trigger, func(t *testing.T) {
			d, err := net.ListenUnix("unix", &net.UnixAddr{Name: cfg.Socket, Net: "unix"})
			if err != nil {
				t.Fatal(err)
			}
			defer d.Close()
			a, err := net.ListenUnix("unix", &net.UnixAddr{Name: dir + "/agent.sock", Net: "unix"})
			if err != nil {
				t.Fatal(err)
			}
			defer a.Close()
			os.Chown(cfg.Socket, 21001, 21003)
			os.Chmod(cfg.Socket, 0660)
			os.Chown(dir+"/agent.sock", 21001, 21001)
			os.Chmod(dir+"/agent.sock", 0600)
			var probes []*exec.Cmd
			for _, peer := range []struct {
				name string
				uid  uint32
			}{{"agent", 21001}, {"daemon", 21003}} {
				if trigger != "simultaneous" && peer.name != trigger {
					continue
				}
				r, w, err := os.Pipe()
				if err != nil {
					t.Fatal(err)
				}
				p := exec.Command(os.Args[0], "-test.run=^TestAgentActivatedPairDistinctUIDs$")
				p.Env = append(os.Environ(), "ACT_PAIR_ROLE=probe", "ACT_PAIR_PATH="+dir+"/"+peer.name+".sock", "GORACE=atexit_sleep_ms=0")
				p.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: peer.uid, Gid: peer.uid}}
				p.ExtraFiles = []*os.File{w}
				p.Stdout = os.Stdout
				p.Stderr = os.Stderr
				if err := p.Start(); err != nil {
					t.Fatal(err)
				}
				w.Close()
				defer p.Process.Kill()
				probes = append(probes, p)
				r.SetReadDeadline(time.Now().Add(3 * time.Second))
				var b [1]byte
				_, err = io.ReadFull(r, b[:])
				r.Close()
				if err != nil {
					t.Fatal(err)
				}
			}
			df, _ := d.File()
			af, _ := a.File()
			defer df.Close()
			defer af.Close()
			child := exec.Command(os.Args[0], "-test.run=^TestAgentActivatedPairDistinctUIDs$")
			child.Env = append(os.Environ(), "ACT_PAIR_ROLE=serve", "GORACE=atexit_sleep_ms=0")
			child.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21001, Gid: 21001}}
			child.ExtraFiles = []*os.File{df, af}
			child.Stdout = os.Stdout
			child.Stderr = os.Stderr
			if err := child.Start(); err != nil {
				t.Fatal(err)
			}
			defer func() { child.Process.Kill(); child.Wait() }()
			for _, p := range probes {
				if err := p.Wait(); err != nil {
					t.Fatal(err)
				}
			}
		})
	}
}
