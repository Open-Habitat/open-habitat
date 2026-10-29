//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"
)

// TestTailnetNodeDistinctUIDs runs the pinned tailscaled with the product's
// own command line and config as one Unix user and proves, with a second
// one, the two things its defaults get wrong on a shared host: its LocalAPI
// (whose dial endpoint checks no permission) is reachable only by the owner
// once the socket sits in a 0700 runtime directory, and shields up holds
// and cannot be turned off through it. scripts/test-tailscale-uids.sh runs
// it in a disposable networkless container, as root there.
func TestTailnetNodeDistinctUIDs(t *testing.T) {
	if os.Getenv("TAILNET_UID_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("runs in scripts/test-tailscale-uids.sh")
	}
	tailscaled, tailscale := os.Getenv("OH_TAILSCALED"), os.Getenv("OH_TAILSCALE")
	const owner, other = 21001, 21002
	home := "/home/agent-a"
	runtime := "/run/user/21001"
	// systemd makes the unit's RuntimeDirectory with RuntimeDirectoryMode=0700
	// (TestOwnMachinesUnitAndConfig holds the unit to it); here it is made
	// the same way by hand.
	for _, d := range []string{home, home + "/.config", home + "/.config/habitat-tailscale", home + "/.local", home + "/.local/state", home + "/.local/state/habitat-tailscale", "/run/user", runtime, runtime + "/" + tailnetRuntimeName} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
		if d != "/run/user" {
			if err := os.Chown(d, owner, owner); err != nil {
				t.Fatal(err)
			}
		}
	}
	os.Chmod("/run/user", 0755)
	env := ownMachineEnv{home: home, username: "agent-a", runtimeDir: runtime}
	config := filepath.Join(home, tailnetConfigRel, tailnetConfigName)
	if err := os.WriteFile(config, env.tailnetConfig(), 0600); err != nil {
		t.Fatal(err)
	}
	os.Chown(config, owner, owner)
	state := filepath.Join(home, tailnetStateRel)
	as := func(uid int, prog string, args ...string) *exec.Cmd {
		cmd := exec.Command(prog, args...)
		cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "TS_LOGS_DIR=" + state}
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		return cmd
	}
	var log bytes.Buffer
	node := as(owner, tailscaled, tailscaledArgs(env.socket(), state, config)...)
	node.Stdout, node.Stderr = &log, &log
	if err := node.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		node.Process.Kill()
		node.Wait()
		if t.Failed() {
			t.Log(log.String())
		}
	}()
	var st os.FileInfo
	for i := 0; i < 100; i++ {
		if st, _ = os.Lstat(env.socket()); st != nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	if st == nil {
		t.Fatal("no socket")
	}
	// tailscaled makes its socket world-writable; only the directory keeps
	// others out, and tailscaled leaves the directory as it found it.
	if st.Mode().Perm() != 0666 {
		t.Logf("socket mode %v (tailscaled made it 0666 when this test was written)", st.Mode().Perm())
	}
	if dir, err := os.Stat(filepath.Dir(env.socket())); err != nil || dir.Mode().Perm() != 0700 || dir.Sys().(*syscall.Stat_t).Uid != owner {
		t.Fatalf("runtime directory: %v %v", dir.Mode(), err)
	}

	// The owner reads its node and its preferences.
	var prefs struct {
		ShieldsUp, CorpDNS, RouteAll, RunSSH, WantRunning bool
	}
	for i := 0; ; i++ {
		out, err := as(owner, tailscale, "--socket="+env.socket(), "debug", "prefs").Output()
		if err == nil && json.Unmarshal(out, &prefs) == nil {
			break
		}
		if i == 50 {
			t.Fatalf("owner cannot read prefs: %v %s", err, out)
		}
		time.Sleep(100 * time.Millisecond)
	}
	if !prefs.ShieldsUp || prefs.CorpDNS || prefs.RouteAll || prefs.RunSSH || !prefs.WantRunning {
		t.Fatalf("prefs: %+v", prefs)
	}
	if out, err := as(owner, tailscale, "--socket="+env.socket(), "status", "--json").Output(); err != nil || !strings.Contains(string(out), `"BackendState"`) {
		t.Fatalf("owner status: %v %s", err, out)
	}
	// Shields stay up: the locked config refuses the owner's own change.
	if out, err := as(owner, tailscale, "--socket="+env.socket(), "set", "--shields-up=false").CombinedOutput(); err == nil {
		t.Fatalf("shields turned down: %s", out)
	}
	if out, _ := as(owner, tailscale, "--socket="+env.socket(), "debug", "prefs").Output(); !strings.Contains(string(out), `"ShieldsUp": true`) {
		t.Fatalf("shields after refused change: %s", out)
	}

	// Another Unix user reaches nothing: not the status, not a dial into the
	// tailnet, not a preference.
	for _, args := range [][]string{{"status", "--json"}, {"nc", "100.100.100.100", "22"}, {"set", "--shields-up=false"}, {"debug", "prefs"}} {
		cmd := as(other, tailscale, append([]string{"--socket=" + env.socket()}, args...)...)
		out, err := cmd.CombinedOutput()
		if err == nil {
			t.Fatalf("other user ran %v: %s", args, out)
		}
		if !strings.Contains(strings.ToLower(string(out)), "permission denied") {
			t.Fatalf("other user %v failed for another reason: %s", args, out)
		}
	}

	// No TCP listener of the owner's: no SOCKS5 or HTTP proxy, nothing a
	// local user could connect to instead of the socket.
	for _, table := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		f, err := os.Open(table)
		if err != nil {
			continue
		}
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			fields := strings.Fields(sc.Text())
			if len(fields) > 7 && fields[3] == "0A" && fields[7] == "21001" {
				t.Fatalf("listener of the owner: %s", sc.Text())
			}
		}
		f.Close()
	}
}
