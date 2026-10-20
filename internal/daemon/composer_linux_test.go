//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type composerStatus struct {
	State string `json:"state"`
	Ack   string `json:"ack"`
	Bash  *struct {
		CommandID string `json:"command_id"`
		Command   string `json:"command"`
		Exclude   bool   `json:"exclude_from_context"`
		State     string `json:"state"`
		ExitCode  *int   `json:"exit_code"`
	} `json:"bash"`
}

func (h *heldHarness) composerStatus(c *ConversationController, id string) composerStatus {
	w := httptest.NewRecorder()
	c.observe(w, httptest.NewRequest("GET", "http://unix/status", nil), id)
	var view composerStatus
	_ = json.Unmarshal(w.Body.Bytes(), &view)
	return view
}

func (h *heldHarness) bash(c *ConversationController, id, command, commandID string, exclude bool) *httptest.ResponseRecorder {
	b, _ := json.Marshal(map[string]any{"command": command, "command_id": commandID, "exclude_from_context": exclude})
	return h.post(func(w http.ResponseWriter, r *http.Request) { c.startCommand(w, r, id) }, string(b))
}

func (h *heldHarness) abortBash(c *ConversationController, id, commandID string) *httptest.ResponseRecorder {
	return h.post(func(w http.ResponseWriter, r *http.Request) { c.abortCommand(w, r, id) }, `{"command_id":"`+commandID+`"}`)
}

type commandListReply struct {
	AnsweredBy string           `json:"answered_by"`
	Commands   []map[string]any `json:"commands"`
}

func readCommandList(t *testing.T, w *httptest.ResponseRecorder) commandListReply {
	t.Helper()
	if w.Code != 200 {
		t.Fatalf("command list: %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "SKILL.md") || strings.Contains(w.Body.String(), "/.pi/") {
		t.Fatalf("command list carries a native path: %s", w.Body.String())
	}
	var reply commandListReply
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
		t.Fatal(err)
	}
	return reply
}

// The `/` list of a conversation without a running Pi comes from a list-only
// Pi in the workspace that writes no session and is gone afterwards; a running
// Pi answers itself and no helper starts. The daemon's own recap command and
// entries outside the command grammar are left out, and Pi's dialog commands
// are marked as terminal-only.
func TestCommandListUsesListOnlyPiWhenNoneRuns(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", WorkspaceCommandsPath+"?workspace_id="+h.workspace, nil)
	r.Host = "unix"
	c.WorkspaceCommands().ServeHTTP(w, r)
	reply := readCommandList(t, w)
	if reply.AnsweredBy != "helper" {
		t.Fatalf("answered by %q", reply.AnsweredBy)
	}
	names := map[string]map[string]any{}
	for _, command := range reply.Commands {
		names[command["name"].(string)] = command
	}
	if len(names) != 3 || names["skill:git-commit"] == nil || names["fix-tests"]["scope"] != "project" || names["mcp"]["terminal_only"] != true || names["mcp"]["scope"] != "builtin" || names["skill:git-commit"]["terminal_only"] != false {
		t.Fatalf("commands: %+v", reply.Commands)
	}
	launches := h.lines("launches.log")
	if len(launches) != 1 || launches[0] != "helper "+filepath.Join(h.root, "src", "project") {
		t.Fatalf("launches: %q", launches)
	}
	if entries, _ := filepath.Glob(filepath.Join(h.root, ".pi", "agent", "sessions", "*", "*.jsonl")); len(entries) != 0 {
		t.Fatalf("the list-only Pi wrote a session: %v", entries)
	}
	if out, _ := exec.Command("pgrep", "-f", "--", h.runtime.Node).Output(); strings.TrimSpace(string(out)) != "" {
		t.Fatalf("the list-only Pi is still running: %s", out)
	}

	id := h.create(c)
	h.eventually("idle", func() bool { return h.composerStatus(c, id).State == "idle" })
	w = httptest.NewRecorder()
	c.conversationCommands(w, httptest.NewRequest("GET", "http://unix/commands", nil), id)
	if reply := readCommandList(t, w); reply.AnsweredBy != "running" || len(reply.Commands) != 3 {
		t.Fatalf("running Pi list: %+v", reply)
	}
	if launches := h.lines("launches.log"); len(launches) != 2 || strings.HasPrefix(launches[1], "helper") {
		t.Fatalf("a running Pi must answer without a helper: %q", launches)
	}
}

// `!` and `!!` reach Pi as RPC bash. The command's reply comes only when it
// ends, so other requests must still be answered meanwhile; one command runs
// at a time; abort_bash cancels it and the outcome reaches the status.
func TestBashRelayRunsOneCommandAndAborts(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.eventually("idle", func() bool { return h.composerStatus(c, id).State == "idle" })

	if w := h.bash(c, id, "make serve forever", heldA, false); w.Code != 200 || !strings.Contains(w.Body.String(), `"running"`) {
		t.Fatalf("bash: %d %s", w.Code, w.Body.String())
	}
	if w := h.bash(c, id, "ls", heldB, false); w.Code != 409 || !strings.Contains(w.Body.String(), "command_running") {
		t.Fatalf("a second command while one runs: %d %s", w.Code, w.Body.String())
	}
	// A send is answered while the command still runs: the bash reply does not
	// hold the request queue, and its late reply does not poison the channel.
	if w := h.send(c, id, "Viesti komennon aikana", heldC); w.Code != 200 {
		t.Fatalf("send during command: %d %s", w.Code, w.Body.String())
	}
	h.eventually("send accepted during command", func() bool { return h.receipt(c, id, heldC) == "accepted" })
	if s := h.composerStatus(c, id); s.Bash == nil || s.Bash.State != "running" || s.Bash.Command != "make serve forever" || s.Bash.CommandID != heldA {
		t.Fatalf("status during command: %+v", s.Bash)
	}
	if w := h.abortBash(c, id, heldD); w.Code != 200 {
		t.Fatalf("abort: %d %s", w.Code, w.Body.String())
	}
	h.eventually("cancelled", func() bool { s := h.composerStatus(c, id); return s.Bash != nil && s.Bash.State == "cancelled" })
	if w := h.abortBash(c, id, heldE); w.Code != 409 {
		t.Fatalf("abort without a running command: %d", w.Code)
	}

	if w := h.bash(c, id, "fail now", heldF, true); w.Code != 200 {
		t.Fatalf("second command: %d %s", w.Code, w.Body.String())
	}
	h.eventually("finished", func() bool {
		s := h.composerStatus(c, id)
		return s.Bash != nil && s.Bash.State == "finished" && s.Bash.ExitCode != nil && *s.Bash.ExitCode == 3 && s.Bash.Exclude
	})
	log := h.lines("bash.log")
	if len(log) != 2 || !strings.Contains(log[1], `"exclude": true`) || !strings.Contains(log[0], `"exclude": false`) || !strings.Contains(log[0], filepath.Join(h.root, "src", "project")) {
		t.Fatalf("Pi's bash requests: %q", log)
	}
	if w := h.bash(c, id, "ls", heldF, false); w.Code != 409 {
		t.Fatalf("a spent command ID must not run again: %d", w.Code)
	}
	for _, body := range []string{`{"command":"","command_id":"` + heldB + `"}`, `{"command":"ls","command_id":"x"}`, `{"command":"ls","command_id":"` + heldB + `","cwd":"/"}`, `{"command":"a\u0000b","command_id":"` + heldB + `"}`} {
		if w := h.post(func(w http.ResponseWriter, r *http.Request) { c.startCommand(w, r, id) }, body); w.Code != 400 {
			t.Fatalf("invalid %s: %d", body, w.Code)
		}
	}
}

// A command typed while Pi is still starting waits for that Pi and then
// runs; one taken back before then never runs, and the Pi started only for
// it stops again.
func TestBashHeldUntilPiRunsAndCancelled(t *testing.T) {
	h := newHeldHarness(t)
	h.setFile("start-delay", "1")
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	if w := h.bash(c, id, "git status", heldA, false); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
		t.Fatalf("held bash: %d %s", w.Code, w.Body.String())
	}
	if s := h.composerStatus(c, id); s.Bash == nil || s.Bash.State != "held" {
		t.Fatalf("status: %+v", s.Bash)
	}
	h.eventually("held command ran", func() bool { s := h.composerStatus(c, id); return s.Bash != nil && s.Bash.State == "finished" })
	if log := h.lines("bash.log"); len(log) != 1 || !strings.Contains(log[0], "git status") {
		t.Fatalf("bash log: %q", log)
	}

	// Stop the child, then a command restarts it lazily; taking it back
	// before Pi is ready leaves it unrun and stops that Pi.
	w := httptest.NewRecorder()
	c.stop(w, httptest.NewRequest("POST", "http://unix/stop", nil), id)
	h.eventually("stopped", func() bool { return h.composerStatus(c, id).State == "stopped" })
	h.setFile("start-delay", "2")
	if w := h.bash(c, id, "ls", heldB, false); w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) {
		t.Fatalf("bash on a stopped conversation: %d %s", w.Code, w.Body.String())
	}
	h.eventually("relaunched", func() bool { return len(h.lines("launches.log")) == 2 })
	if w := h.abortBash(c, id, heldC); w.Code != 200 {
		t.Fatalf("abort held: %d %s", w.Code, w.Body.String())
	}
	h.eventually("stopped again", func() bool {
		s := h.composerStatus(c, id)
		return (s.State == "stopped" || s.State == "uncertain") && s.Bash != nil && s.Bash.State == "not_started"
	})
	if log := h.lines("bash.log"); len(log) != 1 {
		t.Fatalf("a command taken back must not run: %q", log)
	}
}

func composerWorkspaceID(t *testing.T, h *heldHarness, name string) string {
	t.Helper()
	for _, entry := range Discover(h.cfg).Entries {
		if entry.Name == name {
			return workspaceIDOf(h.cfg, entry)
		}
	}
	t.Fatalf("workspace %s not discovered", name)
	return ""
}

func composerGet(handler http.Handler, path string, query url.Values) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", path+"?"+query.Encode(), nil)
	r.Host = "unix"
	handler.ServeHTTP(w, r)
	return w
}

// The file list is the workspace's own: Git's tracked and unignored untracked
// files, changed ones first and marked, nothing reached through a symlink, and
// the preview only of a regular file beneath the workspace.
func TestComposerFilesStayInsideTheWorkspace(t *testing.T) {
	if _, err := os.Stat("/usr/bin/git"); err != nil {
		t.Skip("requires git")
	}
	h := newHeldHarness(t)
	secret := filepath.Join(h.root, "secret")
	ws := filepath.Join(h.root, "src", "project")
	plain := filepath.Join(h.root, "src", "notes")
	for _, d := range []string{secret, filepath.Join(ws, "docs"), filepath.Join(plain, "sub"), filepath.Join(plain, ".hidden")} {
		if err := os.MkdirAll(d, 0700); err != nil {
			t.Fatal(err)
		}
	}
	write := func(path, text string) {
		if err := os.WriteFile(path, []byte(text), 0600); err != nil {
			t.Fatal(err)
		}
	}
	write(filepath.Join(secret, "token.txt"), "salaisuus\n")
	write(filepath.Join(ws, "README.md"), "# Projekti\n")
	write(filepath.Join(ws, "docs", "guide.md"), "ohje\n")
	write(filepath.Join(ws, ".gitignore"), "build.log\n")
	git := func(args ...string) {
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", ws, "-c", "user.name=t", "-c", "user.email=t@example.invalid"}, args...)...)
		cmd.Env = []string{"HOME=" + h.root, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v %s", args, err, out)
		}
	}
	git("init", "-q")
	git("add", ".")
	git("commit", "-qm", "alku")
	write(filepath.Join(ws, "README.md"), "# Projekti\n\nMuutettu.\n")
	write(filepath.Join(ws, "notes.txt"), "uusi\n")
	write(filepath.Join(ws, "build.log"), "ignored\n")
	if err := os.Symlink(secret, filepath.Join(ws, "linked")); err != nil {
		t.Fatal(err)
	}
	write(filepath.Join(plain, "a.txt"), "a\n")
	write(filepath.Join(plain, "sub", "b.txt"), "b\n")
	write(filepath.Join(plain, ".hidden", "c.txt"), "c\n")
	if err := os.Symlink(secret, filepath.Join(plain, "linked")); err != nil {
		t.Fatal(err)
	}

	trusted := func(*http.Request) bool { return true }
	files := WorkspaceFilesHandler(h.cfg, trusted)
	id := composerWorkspaceID(t, h, "project")
	w := composerGet(files, WorkspaceFilesPath, url.Values{"workspace_id": {id}})
	var list struct {
		Files []composerFile `json:"files"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &list) != nil {
		t.Fatalf("files: %d %s", w.Code, w.Body.String())
	}
	got := map[string]string{}
	for _, f := range list.Files {
		got[f.Path] = f.Git
	}
	if strings.Contains(w.Body.String(), "token.txt") || strings.Contains(w.Body.String(), "build.log") || len(list.Files) != 5 || got["README.md"] != "modified" || got["notes.txt"] != "untracked" || got["docs/guide.md"] != "" {
		t.Fatalf("git file list: %+v", list.Files)
	}
	if _, ok := got["linked"]; !ok {
		t.Fatalf("the symlink itself is an untracked entry Git lists: %+v", list.Files)
	}
	w = composerGet(files, WorkspaceFilesPath, url.Values{"workspace_id": {id}, "query": {"guide"}})
	if json.Unmarshal(w.Body.Bytes(), &list) != nil || len(list.Files) != 1 || list.Files[0].Path != "docs/guide.md" {
		t.Fatalf("query: %s", w.Body.String())
	}

	plainID := composerWorkspaceID(t, h, "notes")
	w = composerGet(files, WorkspaceFilesPath, url.Values{"workspace_id": {plainID}})
	if json.Unmarshal(w.Body.Bytes(), &list) != nil || len(list.Files) != 2 || list.Files[0].Path != "a.txt" || list.Files[1].Path != "sub/b.txt" {
		t.Fatalf("plain directory walk: %s", w.Body.String())
	}

	preview := WorkspaceFilePreviewHandler(h.cfg, trusted)
	w = composerGet(preview, WorkspaceFilePreviewPath, url.Values{"workspace_id": {id}, "path": {"README.md"}})
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"kind":"diff"`) || !strings.Contains(w.Body.String(), "+Muutettu.") {
		t.Fatalf("diff preview: %d %s", w.Code, w.Body.String())
	}
	w = composerGet(preview, WorkspaceFilePreviewPath, url.Values{"workspace_id": {id}, "path": {"docs/guide.md"}})
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"kind":"text"`) || !strings.Contains(w.Body.String(), "ohje") {
		t.Fatalf("text preview: %d %s", w.Code, w.Body.String())
	}
	for _, path := range []string{"../secret/token.txt", "linked/token.txt", "/etc/passwd", "docs/../README.md", "docs//guide.md", "*", ":(glob)**"} {
		w = composerGet(preview, WorkspaceFilePreviewPath, url.Values{"workspace_id": {id}, "path": {path}})
		// Pathspec magic must not widen one path to other files' diffs.
		if w.Code == 200 || strings.Contains(w.Body.String(), "salaisuus") || strings.Contains(w.Body.String(), "Muutettu") {
			t.Fatalf("preview outside the workspace %q: %d %s", path, w.Code, w.Body.String())
		}
	}
	w = composerGet(preview, WorkspaceFilePreviewPath, url.Values{"workspace_id": {plainID}, "path": {"linked/token.txt"}})
	if w.Code == 200 || strings.Contains(w.Body.String(), "salaisuus") {
		t.Fatalf("plain preview through a symlink: %d %s", w.Code, w.Body.String())
	}
}

// A walk that leaves a subtree out at its depth bound says the list is not
// complete rather than presenting it as the whole workspace.
func TestComposerWalkReportsSkippedSubtrees(t *testing.T) {
	root := t.TempDir()
	deep := root
	for i := 0; i < 18; i++ {
		deep = filepath.Join(deep, "d")
	}
	if err := os.MkdirAll(deep, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(deep, "deep.txt"), []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "top.txt"), []byte("x"), 0600); err != nil {
		t.Fatal(err)
	}
	fd, err := os.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	defer fd.Close()
	files, truncated, err := walkComposerFiles(context.Background(), int(fd.Fd()))
	if err != nil || !truncated || len(files) != 1 || files[0].Path != "top.txt" {
		t.Fatalf("walk: %+v truncated=%v err=%v", files, truncated, err)
	}
}

// Stop before the request is written means the command never reaches Pi,
// and the one writer cannot write it later.
func TestBashStoppedBeforeWriteNeverRuns(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	id := h.create(c)
	h.eventually("idle", func() bool { return h.composerStatus(c, id).State == "idle" })
	c.mu.Lock()
	s := c.sessions[id]
	s.commands[heldA] = true
	run := &bashRun{commandID: heldA, command: "ls", state: "running", started: time.Now(), wrote: make(chan struct{})}
	s.bash = run
	c.mu.Unlock()
	if w := h.abortBash(c, id, heldB); w.Code != 200 {
		t.Fatalf("abort before write: %d %s", w.Code, w.Body.String())
	}
	c.runBash(s, run)
	if st := h.composerStatus(c, id); st.Bash == nil || st.Bash.State != "not_started" {
		t.Fatalf("status: %+v", st.Bash)
	}
	if log := h.lines("bash.log"); len(log) != 0 {
		t.Fatalf("a command stopped before its write reached Pi: %q", log)
	}
}

func TestFuzzyScoreRanksSubstringAndWordStarts(t *testing.T) {
	files := []composerFile{{Path: "scripts/status_rows.py"}, {Path: "tests/test_status_rows.py"}, {Path: "README.md"}, {Path: "src/main.go"}}
	got := matchComposerFiles(files, "status_r")
	if len(got) != 2 || got[0].Path != "scripts/status_rows.py" {
		t.Fatalf("matches: %+v", got)
	}
	if got := matchComposerFiles(files, "zz"); len(got) != 0 {
		t.Fatalf("no match expected: %+v", got)
	}
}

func TestComposerFilesMatchEveryTermInAnyOrder(t *testing.T) {
	files := []composerFile{
		{Path: "README.md"},
		{Path: ".pi/skills/triage/SKILL.md", Git: "modified"},
		{Path: ".pi/skills/review/SKILL.md"},
		{Path: "tests/trial.go"},
	}
	for _, query := range []string{"skill tr", "tr skill", "  SKILL\ttr  "} {
		got := matchComposerFiles(files, query)
		if len(got) != 1 || got[0].Path != ".pi/skills/triage/SKILL.md" {
			t.Fatalf("%q: %+v", query, got)
		}
	}
	if got := matchComposerFiles(files, "skill missing"); len(got) != 0 {
		t.Fatalf("every term must match: %+v", got)
	}
	for _, query := range []string{"", " \t "} {
		got := matchComposerFiles(files, query)
		if len(got) != len(files) || got[0].Path != "README.md" {
			t.Fatalf("blank query must preserve path order, not prioritize changes: %+v", got)
		}
	}
}
