//go:build linux

package daemon

import (
	"context"
	"os"
	"os/user"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func cloneFixture(t *testing.T) (transport.Config, string) {
	t.Helper()
	u, e := user.Current()
	if e != nil {
		t.Fatal(e)
	}
	uid, _ := strconv.Atoi(u.Uid)
	home := t.TempDir()
	return transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock", Provider: "github", Subject: "42"}, home
}
func TestCloneCommandPinnedCheckout(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "checkout")
	if e := os.Mkdir(dir, 0700); e != nil {
		t.Fatal(e)
	}
	fd, e := os.Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	defer fd.Close()
	// This tests actual subprocess cwd/descriptor plumbing without a provider.
	out, e := cloneCommand(context.Background(), "/bin/pwd", home, strconv.Itoa(int(fd.Fd())))
	if e != nil || strings.TrimSpace(string(out)) != dir {
		t.Fatalf("pinned cwd: %q %v", out, e)
	}
}
