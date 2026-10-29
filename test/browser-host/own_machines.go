package main

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/daemon/tailnetfake"
)

// ownMachinesHost stands in for one person's user manager, tailscaled and
// own machines: starting the unit starts a fake LocalAPI at the unit's
// socket, and a fake ssh answers per machine as a spec sets it. Nothing
// joins a tailnet or opens a network connection.
type ownMachinesHost struct {
	mu      sync.Mutex
	runtime string
	sshDir  string
	node    *tailnetfake.Node
	// open are the agents' SSH connections to machines (ControlMaster
	// sockets), by machine name.
	open map[string]net.Listener
}

var ownMachineHosts = map[string]*ownMachinesHost{}

func newOwnMachinesHost(tmp, user string) (*ownMachinesHost, daemon.OwnMachinesFixture, error) {
	h := &ownMachinesHost{runtime: filepath.Join(tmp, "rt-"+user), sshDir: filepath.Join(tmp, "ssh-"+user)}
	bin := filepath.Join(tmp, "ts-"+user)
	for _, d := range []string{h.runtime, h.sshDir, bin} {
		if err := os.MkdirAll(d, 0700); err != nil {
			return nil, daemon.OwnMachinesFixture{}, err
		}
	}
	// The profile's programs only need to exist: the fake user manager
	// starts the node and the fake ssh never runs the ProxyCommand.
	for _, name := range []string{"tailscale", "tailscaled"} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\nexit 1\n"), 0700); err != nil {
			return nil, daemon.OwnMachinesFixture{}, err
		}
	}
	ssh, err := tailnetfake.WriteSSH(h.sshDir)
	if err != nil {
		return nil, daemon.OwnMachinesFixture{}, err
	}
	ownMachineHosts[user] = h
	return h, daemon.OwnMachinesFixture{
		RuntimeDir: h.runtime, Tailscale: filepath.Join(bin, "tailscale"), Tailscaled: filepath.Join(bin, "tailscaled"),
		SSH: ssh, SSHKeygen: "/usr/bin/ssh-keygen", UserManager: h.userManager,
		Comment: "habitat:" + user + "@habitat.example.org",
	}, nil
}

func (h *ownMachinesHost) userManager(_ context.Context, args ...string) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	switch args[0] {
	case "start", "restart":
		if h.node == nil {
			dir := filepath.Join(h.runtime, "habitat-tailscale")
			if err := os.MkdirAll(dir, 0700); err != nil {
				return err
			}
			n, err := tailnetfake.Start(filepath.Join(dir, "ts.sock"), tailnetfake.DefaultPeers())
			if err != nil {
				return err
			}
			h.node = n
		}
	case "disable":
		if h.node != nil {
			h.node.Close()
			h.node = nil
		}
	}
	return nil
}

// fixture serves /fixture/own-machines?do=approve|machine|hostkey|open|close
// for alice.
func ownMachinesFixture(w http.ResponseWriter, r *http.Request) {
	h := ownMachineHosts["alice"]
	q := r.URL.Query()
	if h == nil {
		http.Error(w, "fixture failed", 400)
		return
	}
	var err error
	switch q.Get("do") {
	case "approve":
		h.mu.Lock()
		if h.node == nil {
			err = os.ErrNotExist
		} else {
			h.node.Approve()
		}
		h.mu.Unlock()
	case "machine":
		err = tailnetfake.SetMachine(h.sshDir, q.Get("address"), q.Get("mode"))
	case "hostkey":
		seed := q.Get("seed")
		if len(seed) != 1 {
			err = os.ErrInvalid
		} else {
			err = tailnetfake.SetHostKey(h.sshDir, q.Get("address"), seed[0])
		}
	case "open", "close":
		name := q.Get("name")
		h.mu.Lock()
		if l := h.open[name]; l != nil {
			l.Close()
			delete(h.open, name)
		}
		if q.Get("do") == "open" {
			var l net.Listener
			if l, err = net.Listen("unix", filepath.Join(h.runtime, "habitat-tailscale", "ssh-"+filepath.Base(name))); err == nil {
				if h.open == nil {
					h.open = map[string]net.Listener{}
				}
				h.open[name] = l
			}
		}
		h.mu.Unlock()
	default:
		err = os.ErrInvalid
	}
	if err != nil {
		http.Error(w, "fixture failed", 400)
		return
	}
	w.WriteHeader(204)
}
