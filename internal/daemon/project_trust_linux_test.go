//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func trustHome(t *testing.T) string {
	t.Helper()
	// The test directory itself may sit below a symlink; Pi and the kernel
	// see canonical paths, and so does the decision.
	home, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range []string{"src/project", "src/project__worktrees/feature", "elsewhere/repo"} {
		if err := os.MkdirAll(filepath.Join(home, d), 0700); err != nil {
			t.Fatal(err)
		}
	}
	return home
}

func trustFor(t *testing.T, home, open, cwd string) []string {
	t.Helper()
	f, err := os.Open(open)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	return projectTrustArgs(home, cwd, f)
}

func writeTrustStore(t *testing.T, home, body string) {
	t.Helper()
	dir := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "trust.json"), []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
}

type trustDirCase struct {
	name, open, cwd string
	approve         bool
}

// trustDirCases are the directories the daemon and the launcher judge alike.
func trustDirCases(t *testing.T, home string) []trustDirCase {
	t.Helper()
	src := filepath.Join(home, "src")
	if err := os.Symlink(filepath.Join(home, "elsewhere", "repo"), filepath.Join(src, "escape")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(src, "project"), filepath.Join(home, "alias")); err != nil {
		t.Fatal(err)
	}
	return []trustDirCase{
		{"workspace", filepath.Join(src, "project"), filepath.Join(src, "project"), true},
		{"helper without cwd", filepath.Join(src, "project"), "", true},
		{"worktree", filepath.Join(src, "project__worktrees", "feature"), filepath.Join(src, "project__worktrees", "feature"), true},
		{"symlink into src", filepath.Join(home, "alias"), filepath.Join(home, "alias"), true},
		{"source root", src, src, false},
		{"outside src", filepath.Join(home, "elsewhere", "repo"), filepath.Join(home, "elsewhere", "repo"), false},
		{"symlink escaping src", filepath.Join(src, "escape"), filepath.Join(src, "escape"), false},
		{"cwd elsewhere", filepath.Join(src, "project"), filepath.Join(home, "elsewhere", "repo"), false},
	}
}

// A workspace and a worktree below ~/src get Pi's --approve; ~/src itself,
// a directory elsewhere in the home and a symlink in ~/src that leads out
// of it keep Pi's default. A cwd that is not the held directory gets none.
func TestProjectTrustBelowSourceOnly(t *testing.T) {
	home := trustHome(t)
	for _, tc := range trustDirCases(t, home) {
		if got := trustFor(t, home, tc.open, tc.cwd); (got != nil) != tc.approve || got != nil && !slices.Equal(got, []string{"--approve"}) {
			t.Errorf("%s: %q, want approve=%v", tc.name, got, tc.approve)
		}
	}
	if got := projectTrustArgs(home, "", nil); got != nil {
		t.Errorf("no held directory: %q", got)
	}
}

// --approve outranks Pi's saved decisions, so the person's own saved false
// for the directory or its nearest ancestor leaves the flag out and Pi
// applies it. A closer true, a saved true or a null entry do not.
func TestProjectTrustHonoursSavedDistrust(t *testing.T) {
	home := trustHome(t)
	ws := filepath.Join(home, "src", "project")
	for _, tc := range trustStoreCases(home) {
		setTrustStore(t, home, tc.store)
		if got := trustFor(t, home, ws, ws) != nil; got != tc.approve {
			t.Errorf("%s: approve=%v, want %v", tc.name, got, tc.approve)
		}
	}
}

type trustStoreCase struct {
	name, store string
	approve     bool
}

// trustStoreCases are the saved stores, judged for ~/src/project, that the
// daemon and the launcher read alike.
func trustStoreCases(home string) []trustStoreCase {
	ws := filepath.Join(home, "src", "project")
	wt := filepath.Join(home, "src", "project__worktrees", "feature")
	return []trustStoreCase{
		{"no store", noTrustStore, true},
		{"saved false here", `{"` + ws + `": false}`, false},
		{"saved false on src", `{"` + home + `/src": false}`, false},
		{"closer true wins", `{"` + home + `/src": false, "` + ws + `": true}`, true},
		{"closer false wins", `{"` + home + `/src": true, "` + ws + `": false}`, false},
		{"null is no decision", `{"` + ws + `": null, "` + home + `/src": true}`, true},
		{"saved true", `{"` + home + `": true}`, true},
		{"other directory", `{"` + wt + `": false}`, true},
		{"byte order mark", "\ufeff" + `{"` + ws + `": false}`, false},
		// A store that cannot be judged here, such as one Pi is rewriting,
		// is left to Pi's own locked read.
		{"malformed", `{"` + ws + `": "no"}`, false},
		{"not an object", `[]`, false},
		{"partial write", ``, false},
		{"null", `null`, false},
		{"oversized", `{"` + ws + `": false, "x": "` + strings.Repeat("x", maxTrustStore) + `"}`, false},
	}
}

// noTrustStore stands for a home without Pi's trust store.
const noTrustStore = "\x00none"

func setTrustStore(t *testing.T, home, store string) {
	t.Helper()
	if store == noTrustStore {
		if err := os.Remove(filepath.Join(home, ".pi", "agent", "trust.json")); err != nil && !os.IsNotExist(err) {
			t.Fatal(err)
		}
		return
	}
	writeTrustStore(t, home, store)
}

// The pinned Pi itself: a skill committed in a workspace's .agents/skills
// reaches the list-only helper's get_commands below ~/src, but not in a
// directory outside it, nor where the person saved "do not trust". Nothing
// is written to Pi's trust store.
func TestListOnlyPinnedPiLoadsTrustedWorkspaceSkills(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}
	home := trustHome(t)
	for _, d := range []string{filepath.Join(home, "src", "project"), filepath.Join(home, "elsewhere", "repo")} {
		skill := filepath.Join(d, ".agents", "skills", "repo-skill")
		if err := os.MkdirAll(skill, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(skill, "SKILL.md"), []byte("---\nname: repo-skill\ndescription: A synthetic skill committed in the repository.\n---\n\nDo nothing.\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	list := func(dir string) bool {
		t.Helper()
		f, err := os.Open(dir)
		if err != nil {
			t.Fatal(err)
		}
		defer f.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()
		commands, ok := listOnlyPi(ctx, node, []string{cli}, home, f, []string{"PATH=/usr/bin:/bin"})
		if !ok {
			t.Fatalf("the pinned Pi did not answer get_commands in %s", dir)
		}
		for _, c := range commands {
			if c.Name == "skill:repo-skill" && c.Source == "skill" && c.Scope == "project" {
				return true
			}
		}
		return false
	}
	if !list(filepath.Join(home, "src", "project")) {
		t.Fatal("the workspace's own skill is missing below ~/src")
	}
	if list(filepath.Join(home, "elsewhere", "repo")) {
		t.Fatal("a directory outside ~/src was trusted")
	}
	if _, err := os.Stat(filepath.Join(home, ".pi", "agent", "trust.json")); !os.IsNotExist(err) {
		t.Fatalf("Pi's trust store was written: %v", err)
	}
	writeTrustStore(t, home, `{"`+filepath.Join(home, "src", "project")+`": false}`)
	if list(filepath.Join(home, "src", "project")) {
		t.Fatal("the person's saved distrust was overridden")
	}
}

// launcherRuntime lays out a core runtime around this repository's `pi`
// launcher, with the given Node and Pi modules.
func launcherRuntime(t *testing.T, node, modules string) string {
	t.Helper()
	runtime, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	src, err := os.ReadFile(filepath.Join("..", "..", "runtime", "core", "agent-bin", "pi"))
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range []string{"agent-bin", "bin"} {
		if err := os.MkdirAll(filepath.Join(runtime, d), 0700); err != nil {
			t.Fatal(err)
		}
	}
	launcher := filepath.Join(runtime, "agent-bin", "pi")
	if err := os.WriteFile(launcher, src, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(node, filepath.Join(runtime, "bin", "node")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(modules, filepath.Join(runtime, "node_modules")); err != nil {
		t.Fatal(err)
	}
	return launcher
}

// launcherArgs runs the launcher in dir with a stand-in Pi that prints the
// arguments it was given.
func launcherArgs(t *testing.T, launcher, home, dir string, env []string, args ...string) []string {
	t.Helper()
	cmd := exec.Command(launcher, args...)
	cmd.Dir = dir
	cmd.Env = append([]string{"HOME=" + home, "PATH=/usr/bin:/bin"}, env...)
	out, err := cmd.Output()
	if err != nil {
		t.Fatalf("launcher in %s: %v", dir, err)
	}
	var got []string
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("launcher output %q: %v", out, err)
	}
	return got
}

// The release's `pi` launcher, which Taskfleet's Pi workers and a Habitat
// terminal run, applies the daemon's rule to its working directory and to
// Pi's trust store, and leaves an explicit trust choice, a session that may
// live elsewhere and Pi's subcommands alone. Taskfleet's own --session form
// is judged by the directory the session opens in.
func TestLauncherAppliesDaemonTrustRule(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatalf("the launcher's decision runs on node: %v", err)
	}
	modules := t.TempDir()
	cli := filepath.Join(modules, "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js")
	if err := os.MkdirAll(filepath.Dir(cli), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(cli, []byte("console.log(JSON.stringify(process.argv.slice(2)))\n"), 0600); err != nil {
		t.Fatal(err)
	}
	launcher := launcherRuntime(t, node, modules)
	home := trustHome(t)
	approved := func(args []string) bool { return slices.Contains(args, "--approve") }
	for _, tc := range trustDirCases(t, home) {
		if tc.cwd != tc.open {
			continue // the launcher has one directory, its own
		}
		if got := approved(launcherArgs(t, launcher, home, tc.open, nil)); got != tc.approve {
			t.Errorf("directory %s: approve=%v, want %v", tc.name, got, tc.approve)
		}
	}
	ws := filepath.Join(home, "src", "project")
	for _, tc := range trustStoreCases(home) {
		setTrustStore(t, home, tc.store)
		if got := approved(launcherArgs(t, launcher, home, ws, nil)); got != tc.approve {
			t.Errorf("store %s: approve=%v, want %v", tc.name, got, tc.approve)
		}
	}
	setTrustStore(t, home, noTrustStore)

	// Pi reads its store from PI_CODING_AGENT_DIR when that is set.
	custom := filepath.Join(home, "custom-agent")
	if err := os.MkdirAll(custom, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(custom, "trust.json"), []byte(`{"`+ws+`": false}`), 0600); err != nil {
		t.Fatal(err)
	}
	for _, dir := range []string{custom, "~/custom-agent", "file://" + custom} {
		if approved(launcherArgs(t, launcher, home, ws, []string{"PI_CODING_AGENT_DIR=" + dir})) {
			t.Errorf("saved false in PI_CODING_AGENT_DIR=%s was overridden", dir)
		}
	}

	for _, tc := range []struct {
		args, want []string
	}{
		{[]string{"-p", "hi"}, []string{"--approve", "-p", "hi"}},
		{[]string{"--approve"}, []string{"--approve"}},
		{[]string{"-a"}, []string{"-a"}},
		{[]string{"--no-approve"}, []string{"--no-approve"}},
		{[]string{"-na"}, []string{"-na"}},
		{[]string{"--session", "other.jsonl"}, []string{"--session", "other.jsonl"}},
		{[]string{"--resume"}, []string{"--resume"}},
		{[]string{"-r"}, []string{"-r"}},
		// Pi opens an existing session by id in the directory it was
		// recorded for, which need not be this one.
		{[]string{"--session-id", "a2b96202"}, []string{"--session-id", "a2b96202"}},
		{[]string{"--continue"}, []string{"--approve", "--continue"}},
		// Pi reads this `--` as the prompt and still opens the session.
		{[]string{"--system-prompt", "--", "--session", "other.jsonl"}, []string{"--system-prompt", "--", "--session", "other.jsonl"}},
		{[]string{"--", "hello"}, []string{"--approve", "--", "hello"}},
		{[]string{"list"}, []string{"list"}},
	} {
		if got := launcherArgs(t, launcher, home, ws, nil, tc.args...); !slices.Equal(got, tc.want) {
			t.Errorf("pi %q: Pi got %q, want %q", tc.args, got, tc.want)
		}
	}

	// Taskfleet starts every Pi worker in its worktree with one absolute
	// --session file of its own, whose header it may already have written
	// with the worker's cwd. Pi opens that session in the header's cwd, or in
	// its own while the file is new, and applies --approve there.
	wt := filepath.Join(home, "src", "project__worktrees", "feature")
	sessions := filepath.Join(home, ".taskfleet", ".creating", "pi-sessions", "run")
	if err := os.MkdirAll(sessions, 0700); err != nil {
		t.Fatal(err)
	}
	session := func(name, body string) string {
		t.Helper()
		p := filepath.Join(sessions, name+".jsonl")
		if err := os.WriteFile(p, []byte(body), 0600); err != nil {
			t.Fatal(err)
		}
		return p
	}
	header := func(cwd string) string {
		b, err := json.Marshal(map[string]any{"type": "session", "version": 3, "id": "a2b96202", "cwd": cwd})
		if err != nil {
			t.Fatal(err)
		}
		return string(b) + "\n"
	}
	worker := func(path string) []string {
		return []string{"--model", "m", "--extension", "/x/message.ts", "--session", path}
	}
	fresh := filepath.Join(sessions, "fresh.jsonl")
	here := session("here", header(wt)+`{"type":"model_change"}`+"\n")
	for _, tc := range []struct {
		name    string
		args    []string
		approve bool
	}{
		{"new worker session", worker(fresh), true},
		{"worker session recorded here", worker(here), true},
		{"session recorded elsewhere", worker(session("elsewhere", header(filepath.Join(home, "elsewhere", "repo")))), false},
		{"session recorded in the workspace", worker(session("workspace", header(ws))), false},
		{"header not first", worker(session("late", `{"type":"model_change"}`+"\n"+header(wt))), false},
		{"header without id", worker(session("noid", `{"type":"session","cwd":"`+wt+`"}`+"\n")), false},
		{"unterminated header", worker(session("partial", strings.TrimSuffix(header(wt), "\n"))), false},
		{"session is a directory", worker(sessions), false},
		{"relative path", worker("fresh.jsonl"), false},
		{"session id", worker("a2b96202"), false},
		{"two sessions", append(worker(fresh), "--session", here), false},
		{"session without a value", append(worker(fresh)[:4], "--session"), false},
		{"empty session", worker(""), false},
		{"equals form", []string{"--session=" + fresh}, false},
		{"with resume", append(worker(fresh), "-r"), false},
		// Pi reads this --session as the model and opens the id's session.
		{"session as a value, with an id", []string{"--model", "--session", fresh, "--session-id", "a2b96202"}, false},
	} {
		got := launcherArgs(t, launcher, home, wt, nil, tc.args...)
		if approved(got) != tc.approve {
			t.Errorf("%s: Pi got %q, want approve=%v", tc.name, got, tc.approve)
		}
		if tc.approve && !slices.Equal(got[len(got)-len(tc.args):], tc.args) {
			t.Errorf("%s: Taskfleet's argv was changed: %q", tc.name, got)
		}
	}
	// The person's saved "do not trust" for the worktrees still stands, and
	// a worker outside ~/src keeps Pi's default.
	writeTrustStore(t, home, `{"`+filepath.Dir(wt)+`": false}`)
	if got := launcherArgs(t, launcher, home, wt, nil, worker(here)...); approved(got) {
		t.Errorf("saved false on the worktrees was overridden for a worker: %q", got)
	}
	setTrustStore(t, home, noTrustStore)
	if got := launcherArgs(t, launcher, home, filepath.Join(home, "elsewhere", "repo"), nil, worker(fresh)...); approved(got) {
		t.Errorf("a worker outside ~/src was approved: %q", got)
	}
	if _, err := os.Stat(fresh); !os.IsNotExist(err) {
		t.Fatalf("the launcher created the session file: %v", err)
	}
}

// launcherCommands asks the launcher's Pi in dir for its commands over RPC,
// without a session unless args name one.
func launcherCommands(t *testing.T, launcher, home, dir string, args ...string) []piCommand {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if len(args) == 0 {
		args = []string{"--no-session"}
	}
	cmd := exec.CommandContext(ctx, launcher, append([]string{"--mode", "rpc"}, args...)...)
	cmd.Dir = dir
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin"}
	cmd.WaitDelay = 2 * time.Second
	stdin, err := cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = cmd.Process.Kill(); _ = cmd.Wait() }()
	if _, err := stdin.Write([]byte(`{"id":"oh-list","type":"get_commands"}` + "\n")); err != nil {
		t.Fatal(err)
	}
	scanner := bufio.NewScanner(stdout)
	scanner.Buffer(make([]byte, 4096), 1<<20)
	for scanner.Scan() {
		var response struct {
			ID      string          `json:"id"`
			Type    string          `json:"type"`
			Success bool            `json:"success"`
			Data    json.RawMessage `json:"data"`
		}
		if json.Unmarshal(scanner.Bytes(), &response) != nil || response.Type != "response" || response.ID != "oh-list" {
			continue
		}
		commands, ok := parsePiCommands(response.Data)
		if !response.Success || !ok {
			t.Fatalf("get_commands in %s failed", dir)
		}
		return commands
	}
	t.Fatalf("the launcher's Pi did not answer get_commands in %s", dir)
	return nil
}

// The pinned Pi through the launcher: a workspace's own .agents/skills load
// below ~/src without Pi's trust prompt, which would otherwise hold the
// interactive worker, and stay out elsewhere and under a saved false.
func TestLauncherPinnedPiTrustsWorkspaceSkills(t *testing.T) {
	modules, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(modules, "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js")); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}
	launcher := launcherRuntime(t, node, modules)
	home := trustHome(t)
	ws := filepath.Join(home, "src", "project__worktrees", "feature")
	elsewhere := filepath.Join(home, "elsewhere", "repo")
	for _, d := range []string{ws, elsewhere} {
		skill := filepath.Join(d, ".agents", "skills", "repo-skill")
		if err := os.MkdirAll(skill, 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(skill, "SKILL.md"), []byte("---\nname: repo-skill\ndescription: A synthetic skill committed in the repository.\n---\n\nDo nothing.\n"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	has := func(dir string, args ...string) bool {
		for _, c := range launcherCommands(t, launcher, home, dir, args...) {
			if c.Name == "skill:repo-skill" && c.Source == "skill" && c.Scope == "project" {
				return true
			}
		}
		return false
	}
	if !has(ws) {
		t.Fatal("the worktree's own skill is missing below ~/src")
	}
	if has(elsewhere) {
		t.Fatal("a directory outside ~/src was trusted")
	}
	// A Taskfleet worker: Pi opens its own session file, new or with the
	// header Taskfleet wrote for the worktree, in the worktree.
	sessions := filepath.Join(home, ".taskfleet", "pi-sessions")
	if err := os.MkdirAll(sessions, 0700); err != nil {
		t.Fatal(err)
	}
	recorded := filepath.Join(sessions, "recorded.jsonl")
	if err := os.WriteFile(recorded, []byte(`{"cwd":"`+ws+`","id":"a2b96202","timestamp":"2026-01-01T00:00:00Z","type":"session","version":3}`+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, session := range []string{filepath.Join(sessions, "new.jsonl"), recorded} {
		if !has(ws, "--session", session) {
			t.Fatalf("the worktree's own skill is missing for a worker session %s", filepath.Base(session))
		}
	}
	if has(elsewhere, "--session", filepath.Join(sessions, "elsewhere.jsonl")) {
		t.Fatal("a worker outside ~/src was trusted")
	}
	if _, err := os.Stat(filepath.Join(home, ".pi", "agent", "trust.json")); !os.IsNotExist(err) {
		t.Fatalf("Pi's trust store was written: %v", err)
	}
	writeTrustStore(t, home, `{"`+ws+`": false}`)
	if has(ws) || has(ws, "--session", recorded) {
		t.Fatal("the person's saved distrust was overridden")
	}
}
