//go:build linux

package transport

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"testing"
	"time"
)

func TestAgentActivationQueue(t *testing.T) {
	for _, count := range []int{0, 1, 8, 64, 65} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			path := shortDir(t) + "/agent.sock"
			ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
			if err != nil {
				t.Fatal(err)
			}
			defer ln.Close()
			cfg := Config{UID: os.Geteuid(), Socket: path[:len(path)-len("agent.sock")] + "daemon.sock"}
			conns := []net.Conn{}
			for i := 0; i < count; i++ {
				c, err := net.Dial("unix", path)
				if err != nil {
					t.Fatal(err)
				}
				defer c.Close()
				conns = append(conns, c)
			}
			// Queued owner calls deliberately have not written anything. A byte-reading
			// challenge would wait then fail on the first activation request.
			err = probeAgentListener(cfg, ln)
			if count == 65 {
				if err == nil {
					t.Fatal("overload accepted")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if count == 0 {
				return
			}
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			done := make(chan error, 1)
			go func() {
				done <- ServeAgent(ctx, ln, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					if !AgentPeer(r) {
						t.Error("missing own peer")
					}
					s := &Server{cfg: Config{GatewayUID: cfg.UID}}
					if s.TrustedPeer(r) {
						t.Error("agent acquired gateway authority")
					}
					w.WriteHeader(204)
				}))
			}()
			for _, c := range conns {
				c.SetDeadline(time.Now().Add(2 * time.Second))
				fmt.Fprint(c, "GET / HTTP/1.1\r\nHost: unix\r\nConnection: close\r\n\r\n")
				var b [256]byte
				n, e := c.Read(b[:])
				if e != nil || n == 0 {
					t.Fatalf("lost activation request: %v", e)
				}
			}
			cancel()
			if err := <-done; err != nil {
				t.Fatal(err)
			}
		})
	}
}
