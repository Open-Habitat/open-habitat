//go:build linux

package daemon

import (
	"context"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// These are two disposable homes under one UID. They prove path construction and
// process inheritance, not Linux cross-UID permissions (tested by the UID suite).
func TestAgentCommandPathIsPerHomeAndInherited(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("Pi launch requires nonroot UID")
	}
	base := t.TempDir()
	homes := []string{filepath.Join(base, "alice"), filepath.Join(base, "bob")}
	for _, home := range homes {
		bin := filepath.Join(home, ".local", "bin")
		if err := os.MkdirAll(bin, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(bin, "agent-probe"), []byte("#!/bin/sh\nprintf '%s\\n' '"+filepath.Base(home)+"'\n"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	// The daemon's inherited environment points at the other home; the
	// explicit child environment must override it for every Pi launch.
	t.Setenv("PATH", filepath.Join(homes[1], ".local", "bin")+":"+os.Getenv("PATH"))
	t.Setenv("HOME", homes[1])
	for _, home := range homes {
		script := filepath.Join(home, "fake-pi")
		// Fake Pi invokes a child through PATH. The process must find only
		// this fixture home's executable, regardless of the daemon's own PATH.
		body := "#!/bin/sh\nagent-probe > \"$HOME/probe-result\"\nprintf '%s\\n' \"$PATH\" > \"$HOME/observed-path\"\ncommand -v node > \"$HOME/shared-result\"\n"
		if err := os.WriteFile(script, []byte(body), 0700); err != nil {
			t.Fatal(err)
		}
		p, err := launchPiRPC(script, home, home, "", []string{agentPath(home), "USER=fixture"})
		if err != nil {
			t.Fatal(err)
		}
		select {
		case <-p.exited:
		case <-time.After(3 * time.Second):
			_ = p.close()
			t.Fatal("fake Pi did not exit")
		}
		_ = p.close()
		got, err := os.ReadFile(filepath.Join(home, "probe-result"))
		if err != nil {
			t.Fatal(err)
		}
		if strings.TrimSpace(string(got)) != filepath.Base(home) {
			t.Fatalf("wrong executable: %s", got)
		}
		path, err := os.ReadFile(filepath.Join(home, "observed-path"))
		if err != nil {
			t.Fatal(err)
		}
		executable, err := os.Executable()
		if err != nil {
			t.Fatal(err)
		}
		want := filepath.Join(home, ".local", "bin") + ":" + filepath.Join(home, ".cargo", "bin") + ":/usr/local/bin:/usr/bin:/bin:" + filepath.Dir(executable) + "\n"
		if string(path) != want {
			t.Fatalf("PATH = %q, want %q", path, want)
		}
		other := homes[0]
		if home == other {
			other = homes[1]
		}
		if strings.Contains(string(path), other) {
			t.Fatal("other user's home reached Pi")
		}
	}
	// Pi's own child discovers the administrator's shared tool when installed.
	// The fixture must not write to /usr/local/bin on the developer's host.
	if _, err := os.Stat("/usr/local/bin/node"); err == nil {
		for _, home := range homes {
			out, err := os.ReadFile(filepath.Join(home, "shared-result"))
			if err != nil || strings.TrimSpace(string(out)) != "/usr/local/bin/node" {
				t.Fatalf("shared tool for %s: %q, %v", home, out, err)
			}
		}
	}
}

func TestHostGitCommandIgnoresAgentPath(t *testing.T) {
	home := t.TempDir()
	bin := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(bin, 0700); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(home, "shadow-ran")
	t.Setenv("PATH", bin+":"+os.Getenv("PATH"))
	if err := os.WriteFile(filepath.Join(bin, "git"), []byte("#!/bin/sh\ntouch "+marker+"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	// The fixture program is given by absolute path, as the production callers
	// pass /usr/bin/git. Its environment is separately constrained.
	fixture := filepath.Join(home, "fixed-git")
	if err := os.WriteFile(fixture, []byte("#!/bin/sh\nprintf '%s\\n' \"$PATH\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	out, err := runIdentityGit(context.Background(), home, fixture, "config", "--global", "--get", "user.name")
	if err != nil || string(out) != "/usr/bin:/bin\n" {
		t.Fatalf("host git env: %q, %v", out, err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Fatalf("user git shadow executed: %v", err)
	}
}

// Environments are constructed before installation, as in a conversation that
// downloads uv. No profile or daemon restart should be needed to discover it.
func TestUserWorkFindsToolsInstalledAfterEnvironmentCreation(t *testing.T) {
	home := t.TempDir()
	t.Setenv("PATH", "/nonexistent-daemon-path")
	terminal := &terminalHost{cfg: transport.Config{Home: home}}
	editor := &editorHost{cfg: transport.Config{Home: home}}
	envs := map[string][]string{"pi/taskfleet": {"HOME=" + home, agentPath(home)}, "shell": terminal.env(), "editor": editor.env(t.TempDir())}
	for _, dir := range []string{".local/bin", ".cargo/bin"} {
		bin := filepath.Join(home, dir)
		if err := os.MkdirAll(bin, 0700); err != nil {
			t.Fatal(err)
		}
		name := "installed-local-probe"
		if dir == ".cargo/bin" {
			name = "installed-cargo-probe"
		}
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\nprintf 'installed-ok'\n"), 0700); err != nil {
			t.Fatal(err)
		}
		for surface, env := range envs {
			t.Run(surface+"/"+name, func(t *testing.T) {
				cmd := exec.Command("/bin/bash", "--noprofile", "--norc", "-c", name)
				cmd.Env = env
				if out, err := cmd.CombinedOutput(); err != nil || string(out) != "installed-ok" {
					t.Fatalf("tool lookup: %q %v", out, err)
				}
			})
		}
	}
}

func TestAgentReleasePathFollowsLaunchSelector(t *testing.T) {
	root := t.TempDir()
	generation := filepath.Join(root, "generations", "one")
	if err := os.MkdirAll(generation, 0700); err != nil {
		t.Fatal(err)
	}
	executable := filepath.Join(generation, "open-habitat")
	if err := os.WriteFile(executable, []byte("fixture-one"), 0700); err != nil {
		t.Fatal(err)
	}
	current := filepath.Join(root, "current")
	if err := os.Symlink(generation, current); err != nil {
		t.Fatal(err)
	}
	invoked := filepath.Join(current, "open-habitat")
	if got := agentReleaseBin(executable, invoked); got != current {
		t.Fatalf("selector lost: %s", got)
	}
	// Unverified/relative argv must not redirect a native work environment.
	foreign := filepath.Join(root, "other", "open-habitat")
	if err := os.MkdirAll(filepath.Dir(foreign), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(foreign, []byte("other"), 0700); err != nil {
		t.Fatal(err)
	}
	for _, bad := range []string{"open-habitat", "./open-habitat", foreign, filepath.Join(root, "missing"), current + "/./open-habitat"} {
		if got := agentReleaseBin(executable, bad); got != generation {
			t.Fatalf("unverified launch %q redirected PATH to %q", bad, got)
		}
	}
}
