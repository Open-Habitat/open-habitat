//go:build linux

package daemon

import (
	"context"
	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
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
	// Broker accounts' passwd shell is nologin; tmux under Taskfleet takes SHELL.
	t.Setenv("SHELL", "/usr/sbin/nologin")
	for _, home := range homes {
		script := filepath.Join(home, "fake-pi")
		// Fake Pi invokes a child through PATH. The process must find only
		// this fixture home's executable, regardless of the daemon's own PATH.
		body := "#!/bin/sh\nagent-probe > \"$HOME/probe-result\"\nprintf '%s\\n' \"$PATH\" > \"$HOME/observed-path\"\ncommand -v node > \"$HOME/shared-result\"\nprintf '%s\\n' \"$SHELL\" > \"$HOME/observed-shell\"\n"
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
		if shell, err := os.ReadFile(filepath.Join(home, "observed-shell")); err != nil || string(shell) != "/bin/bash\n" {
			t.Fatalf("Pi children's SHELL = %q, %v", shell, err)
		}
		path, err := os.ReadFile(filepath.Join(home, "observed-path"))
		if err != nil {
			t.Fatal(err)
		}
		executable, err := os.Executable()
		if err != nil {
			t.Fatal(err)
		}
		release := filepath.Dir(executable)
		// The test binary's directory ships no Claude Code; a host selector's
		// runtime may (as on an installed developer host).
		selected := ""
		if runtime, err := core.LoadSharedPiRuntime(); err == nil {
			selected = filepath.Dir(filepath.Dir(runtime.Node))
		}
		want := filepath.Join(home, ".local", "bin") + ":" + filepath.Join(home, ".cargo", "bin") + ":/usr/local/bin:/usr/bin:/bin:" + release
		if dir := agentClaudeCodeDir(release, selected); dir != "" {
			want += ":" + dir
		}
		want += "\n"
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

// A release's agent PATH reaches the Claude Code its Claude sign-in runs, so a
// worker shares the sign-in's version and native store. A person's own
// installation keeps precedence.
func TestAgentPathFindsSignInClaudeCode(t *testing.T) {
	release := t.TempDir()
	login := &claudeLogin{device: &PiDevice{Node: filepath.Join(release, "payloads", "core", "runtime", "bin", "node")}}
	if err := os.MkdirAll(filepath.Dir(login.binary()), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(login.binary(), []byte("#!/bin/sh\nprintf shipped\n"), 0700); err != nil {
		t.Fatal(err)
	}
	home := t.TempDir()
	run := func() string {
		cmd := exec.Command("/bin/sh", "-c", "command -v claude && claude")
		cmd.Env = []string{"HOME=" + home, agentPathWith(home, release, "")}
		out, _ := cmd.CombinedOutput()
		return string(out)
	}
	if got := run(); got != login.binary()+"\nshipped" {
		t.Fatalf("claude = %q, want sign-in binary %s", got, login.binary())
	}
	own := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(own, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(own, "claude"), []byte("#!/bin/sh\nprintf own\n"), 0700); err != nil {
		t.Fatal(err)
	}
	if got := run(); got != filepath.Join(own, "claude")+"\nown" {
		t.Fatalf("person's own Claude Code lost precedence: %q", got)
	}
}

// An installation whose operator selects the core runtime outside the release
// (pi-runtime.json naming another tree, as Fleetrepo's test server does) has no
// payloads in its release. The agent PATH then names the selected runtime's
// Claude Code, the one its sign-in runs, and never a directory that is absent.
// A host-applied generation's own payload wins, as it follows upgrades.
func TestAgentPathNamesOnlyExistingClaudeCode(t *testing.T) {
	home := t.TempDir()
	release := t.TempDir()
	selected := t.TempDir()
	shipped := claudeCodeDir(filepath.Join(release, "payloads", "core", "runtime"))
	beside := claudeCodeDir(selected)
	path := func() []string {
		return filepath.SplitList(strings.TrimPrefix(agentPathWith(home, release, selected), "PATH="))
	}
	install := func(dir string) {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, "claude"), []byte("#!/bin/sh\n"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	// A directory without the binary is not Claude Code either.
	if err := os.MkdirAll(shipped, 0700); err != nil {
		t.Fatal(err)
	}
	for _, dir := range path() {
		if dir == shipped || dir == beside {
			t.Fatalf("absent Claude Code on PATH: %s", dir)
		}
	}
	install(beside)
	if got := path(); got[len(got)-1] != beside || got[len(got)-2] != release {
		t.Fatalf("selected runtime's Claude Code not last: %q", got)
	}
	login := &claudeLogin{device: &PiDevice{Node: filepath.Join(selected, "bin", "node")}}
	if filepath.Dir(login.binary()) != beside {
		t.Fatalf("PATH %s differs from sign-in %s", beside, login.binary())
	}
	install(shipped)
	got := path()
	if got[len(got)-1] != shipped {
		t.Fatalf("release payload not preferred: %q", got)
	}
	for _, dir := range got {
		if dir == beside {
			t.Fatal("two Claude Code directories on PATH")
		}
	}
}

// Taskfleet, workmux and the release's Pi launcher reach every agent from the
// core runtime, after everything a person installed: their own Taskfleet keeps
// precedence, and a release without the tools adds no directory.
func TestAgentPathFindsCoreTaskfleet(t *testing.T) {
	home := t.TempDir()
	release := t.TempDir()
	tools := coreToolsDir(filepath.Join(release, "payloads", "core", "runtime"))
	run := func() string {
		cmd := exec.Command("/bin/sh", "-c", "command -v taskfleet")
		cmd.Env = []string{"HOME=" + home, agentPathWith(home, release, "")}
		out, _ := cmd.CombinedOutput()
		return strings.TrimSpace(string(out))
	}
	if got := agentPathWith(home, release, ""); strings.Contains(got, tools) {
		t.Fatalf("absent tools on PATH: %s", got)
	}
	if err := os.MkdirAll(tools, 0700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"taskfleet", "workmux", "pi"} {
		if err := os.WriteFile(filepath.Join(tools, name), []byte("#!/bin/sh\n"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	if got := run(); got != filepath.Join(tools, "taskfleet") {
		t.Fatalf("taskfleet = %q, want the core runtime's", got)
	}
	parts := filepath.SplitList(strings.TrimPrefix(agentPathWith(home, release, ""), "PATH="))
	if parts[len(parts)-1] != tools {
		t.Fatalf("core tools must come last: %v", parts)
	}
	own := filepath.Join(home, ".local", "bin")
	if err := os.MkdirAll(own, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(own, "taskfleet"), []byte("#!/bin/sh\n"), 0700); err != nil {
		t.Fatal(err)
	}
	if got := run(); got != filepath.Join(own, "taskfleet") {
		t.Fatalf("person's own Taskfleet lost precedence: %q", got)
	}
}

// A browser conversation loads the Taskfleet skills extension of the same
// core runtime tree whose taskfleet is on the agent PATH, and none without it.
func TestTaskfleetSkillsExtensionFollowsAgentTools(t *testing.T) {
	release := t.TempDir()
	selected := t.TempDir()
	if got := taskfleetSkillsExtension(release, selected); got != nil {
		t.Fatalf("runtime without tools: %v", got)
	}
	install := func(runtime string) string {
		for _, f := range []string{"agent-bin/taskfleet", "taskfleet/extension.mjs"} {
			if err := os.MkdirAll(filepath.Join(runtime, filepath.Dir(f)), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(filepath.Join(runtime, f), nil, 0700); err != nil {
				t.Fatal(err)
			}
		}
		return filepath.Join(runtime, "taskfleet", "extension.mjs")
	}
	beside := install(selected)
	if got := taskfleetSkillsExtension(release, selected); !slices.Equal(got, []string{"--extension", beside}) {
		t.Fatalf("selected runtime: %v", got)
	}
	shipped := install(filepath.Join(release, "payloads", "core", "runtime"))
	if got := taskfleetSkillsExtension(release, selected); !slices.Equal(got, []string{"--extension", shipped}) {
		t.Fatalf("release payload must win, as for the agent PATH: %v", got)
	}
}
