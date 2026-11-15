//go:build linux

package main

import (
	"context"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// An own-UID agent socket against the invented home. This exercises production
// peer and preference handling, not systemd socket trust or distinct-UID isolation.
func experimentalAgentClient(home string, cfg transport.Config) (*http.Client, error) {
	cfg.Home, cfg.UID = home, os.Geteuid()
	cfg.Socket = filepath.Join(home, "daemon.sock")
	path := transport.AgentPath(cfg)
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		return nil, err
	}
	go func() {
		if err := transport.ServeAgent(context.Background(), ln, cfg, daemon.AgentExperimentalHandler(cfg)); err != nil {
			log.Fatal("experimental agent fixture: ", err)
		}
	}()
	return &http.Client{Timeout: 5 * time.Second, Transport: &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", path) }}}, nil
}
