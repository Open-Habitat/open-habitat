//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/nativegitea"
	"github.com/open-habitat/open-habitat/internal/nativegitea/giteafake"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// The read-only Gitea connector under distinct kernel UIDs (ADR 0031). Each
// person's daemon runs as that person behind the real transport server, with
// the production adapter, clone jobs, observation and fetch routes, the
// system trust store and real Git calling this binary as the native helper.
// The synthetic Gitea's CA is placed in the container's OS trust, as the
// operator does on a real host. agent-a holds ada's PAT and agent-b bob's;
// neither daemon, helper, Git nor shell may reach the other's tea state,
// connection IDs, jobs, checkouts or socket. Run only by
// scripts/test-repo-catalog-uids.sh in a disposable networkless container.

const giteaUIDGateway = 21003

var giteaUIDPeople = []struct {
	name, subject, login, token string
	uid                         int
	accountID                   int64
}{
	{"agent-a", "42", "ada", "tok-ada-0001", 21001, 7},
	{"agent-b", "43", "bob", "tok-bob-0002", 21002, 8},
}

// giteaUIDHome is the passwd home the script gives each person, shared with
// TestRepoCatalogDistinctUIDs, which runs after this test has removed it.
func giteaUIDHome(name string) string { return "/var/tmp/catalog-" + name }

func TestGiteaDistinctUIDs(t *testing.T) {
	if os.Getenv("REPO_UID_CONTAINER") != "1" {
		t.Skip("requires disposable rootless container")
	}
	if os.Getenv("GITEA_UID_ROLE") == "daemon" {
		serveGiteaUID(t)
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	work, err := os.MkdirTemp("/var/tmp", "gitea-uids-")
	must(err)
	t.Cleanup(func() { _ = os.RemoveAll(work) })
	srv, err := giteafake.Start(work, []giteafake.Account{{ID: 7, Login: "ada", Token: "tok-ada-0001"}, {ID: 8, Login: "bob", Token: "tok-bob-0002"}}, []giteafake.Repo{
		{ID: 101, Owner: "ada", Name: "notes", Private: true},
		{ID: 103, Owner: "bob", Name: "notes", Private: true},
		{ID: 104, Owner: "ada", Name: "shared", Private: true, Readers: []int64{8}},
	})
	must(err)
	t.Cleanup(srv.Close)
	// The operator's CA prerequisite: system trust, for Go and for Git alike.
	ca, err := os.ReadFile(srv.CAFile)
	must(err)
	bundle, err := os.OpenFile("/etc/ssl/certs/ca-certificates.crt", os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o644)
	must(err)
	_, err = bundle.Write(ca)
	must(err)
	must(bundle.Close())

	exe := "/var/tmp/repo-catalog-uid.test" // the 0755 copy every UID can run
	as := func(uid int, env []string, name string, args ...string) *exec.Cmd {
		cmd := exec.Command(name, args...)
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(uid), Gid: uint32(uid)}}
		cmd.Env = append([]string{"PATH=/usr/bin:/bin", "LANG=C"}, env...)
		return cmd
	}
	runtime := "/run/open-habitat/users"
	must(os.MkdirAll(runtime, 0711))
	homes := map[string]string{}
	sockets := map[string]string{}
	for _, p := range giteaUIDPeople {
		home := giteaUIDHome(p.name)
		homes[p.name] = home
		t.Cleanup(func() { _ = os.RemoveAll(home) })
		must(os.MkdirAll(filepath.Join(home, "src"), 0700))
		// Git commits a fetch's reflog under the person's identity.
		must(os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[user]\n\tname = "+p.login+"\n\temail = "+p.login+"@example.invalid\n"), 0600))
		must(exec.Command("chown", "-R", fmt.Sprintf("%d:%d", p.uid, p.uid), home).Run())
		must(os.Chmod(home, 0700))
		dir := filepath.Join(runtime, p.name)
		must(os.Mkdir(dir, 0710))
		must(os.Chown(dir, p.uid, giteaUIDGateway))
		cmd := exec.Command(exe, "-test.run=^TestGiteaDistinctUIDs$")
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(p.uid), Gid: uint32(p.uid)}}
		cmd.Env = append(os.Environ(), "GITEA_UID_ROLE=daemon", "GITEA_UID_NAME="+p.name, "GITEA_UID_SUBJECT="+p.subject, "GITEA_UID_EXE="+exe)
		var out bytes.Buffer
		cmd.Stdout, cmd.Stderr = &out, &out
		must(cmd.Start())
		t.Cleanup(func() {
			_ = cmd.Process.Kill()
			_ = cmd.Wait()
			if t.Failed() {
				t.Log(p.name, out.String())
			}
		})
		socket := filepath.Join(dir, "daemon.sock")
		for deadline := time.Now().Add(10 * time.Second); ; time.Sleep(20 * time.Millisecond) {
			if st, e := os.Lstat(socket); e == nil && st.Mode().Perm() == 0660 {
				break
			}
			if time.Now().After(deadline) {
				t.Fatal("daemon socket unavailable", out.String())
			}
		}
		must(os.Chown(socket, p.uid, giteaUIDGateway))
		sockets[p.name] = socket
	}

	// call is the gateway reaching a person's socket, as its own kernel UID.
	// Every request also carries the other person's identity header, which
	// must change nothing: the socket, not the header, picks the daemon.
	var replies []string
	callAs := func(uid int, person, method, path, body string) (int, map[string]any, string) {
		t.Helper()
		forged := "43"
		if person == "agent-b" {
			forged = "42"
		}
		cmd := as(uid, []string{"GITEA_UID_PROBE=1", "GITEA_PROBE_SOCKET=" + sockets[person], "GITEA_PROBE_METHOD=" + method, "GITEA_PROBE_PATH=" + path, "GITEA_PROBE_BODY=" + body, "GITEA_PROBE_FORGED=" + forged}, exe, "-test.run=^TestGiteaUIDProbe$")
		raw, err := cmd.Output()
		_, line, found := bytes.Cut(raw, []byte("GITEA_PROBE="))
		if err != nil || !found {
			return 0, nil, string(raw)
		}
		line, _, _ = bytes.Cut(line, []byte("\n"))
		var res struct {
			Status int    `json:"status"`
			Body   string `json:"body"`
		}
		if json.Unmarshal(line, &res) != nil {
			t.Fatalf("probe output %s", raw)
		}
		replies = append(replies, res.Body)
		var out map[string]any
		_ = json.Unmarshal([]byte(res.Body), &out)
		return res.Status, out, res.Body
	}
	call := func(person, method, path, body string) (int, map[string]any, string) {
		t.Helper()
		return callAs(giteaUIDGateway, person, method, path, body)
	}
	connections := map[string]string{}
	for _, p := range giteaUIDPeople {
		status, out, raw := call(p.name, "POST", integrations.GiteaPath, `{"action":"connect","base_url":"`+srv.URL+`","token":"`+p.token+`"}`)
		conn, _ := out["connection"].(map[string]any)
		if status != 200 || out["api"] != "ok" || conn["git"] != "registered" || conn["user"] != p.login || conn["owned"] != true {
			t.Fatalf("connect %s: %d %s", p.name, status, raw)
		}
		connections[p.name] = conn["id"].(string)
	}
	a, b := connections["agent-a"], connections["agent-b"]
	if a == b {
		t.Fatal("two people's connections share an ID", a)
	}
	// Each person's tea file is their own, private and holds only their PAT.
	teaFile := func(person string) string { return filepath.Join(homes[person], ".config", "tea", "config.yml") }
	for _, p := range giteaUIDPeople {
		st, err := os.Stat(teaFile(p.name))
		must(err)
		if s := st.Sys().(*syscall.Stat_t); int(s.Uid) != p.uid || st.Mode().Perm() != 0600 {
			t.Fatalf("%s tea file: uid %d mode %v", p.name, s.Uid, st.Mode())
		}
		content, _ := os.ReadFile(teaFile(p.name))
		other := giteaUIDPeople[0].token
		if p.name == "agent-a" {
			other = giteaUIDPeople[1].token
		}
		if !bytes.Contains(content, []byte(p.token)) || bytes.Contains(content, []byte(other)) {
			t.Fatalf("%s tea file holds the wrong tokens", p.name)
		}
		gitconfig, _ := os.ReadFile(filepath.Join(homes[p.name], ".gitconfig"))
		if !bytes.Contains(gitconfig, []byte(exe)) {
			t.Fatalf("%s helper not registered: %s", p.name, gitconfig)
		}
	}
	snapshot := func(person string) []byte {
		b, err := os.ReadFile(teaFile(person))
		must(err)
		return b
	}
	bTea := snapshot("agent-b")

	// Lists are each daemon's own, whatever the header claims.
	_, out, raw := call("agent-a", "GET", integrations.ListPath, "")
	gitea, _ := out["gitea"].(map[string]any)
	if list, _ := gitea["connections"].([]any); len(list) != 1 || !strings.Contains(raw, a) || strings.Contains(raw, b) {
		t.Fatalf("agent-a list: %s", raw)
	}
	repos := func(person string) map[string]any {
		t.Helper()
		status, out, raw := call(person, "GET", integrations.GiteaReposPath, "")
		sources, _ := out["sources"].([]any)
		if status != 200 || len(sources) != 1 {
			t.Fatalf("%s repos: %d %s", person, status, raw)
		}
		return sources[0].(map[string]any)
	}
	names := func(source map[string]any) string {
		var n []string
		for _, r := range source["repositories"].([]any) {
			n = append(n, r.(map[string]any)["full_name"].(string))
		}
		return strings.Join(n, ",")
	}
	if s := repos("agent-a"); s["state"] != "ok" || s["connection_id"] != a || names(s) != "ada/notes,ada/shared" {
		t.Fatalf("agent-a repositories: %v", s)
	}
	if s := repos("agent-b"); s["state"] != "ok" || s["connection_id"] != b || names(s) != "bob/notes,ada/shared" {
		t.Fatalf("agent-b repositories: %v", s)
	}

	// A connection ID is meaningful only in the daemon that derived it.
	start := func(connection string, id int) string {
		return `{"action":"start","source":"gitea","connection_id":"` + connection + `","repository_id":` + strconv.Itoa(id) + `,"mode":"full"}`
	}
	for _, try := range []struct{ method, path, body, code string }{
		{"POST", integrations.GiteaPath, `{"action":"check","connection_id":"` + a + `"}`, "connection_changed"},
		{"POST", integrations.GiteaPath, `{"action":"replace","connection_id":"` + a + `","token":"tok-ada-0001"}`, "connection_changed"},
		{"DELETE", integrations.GiteaPath, `{"action":"disconnect","connection_id":"` + a + `"}`, "connection_changed"},
		// 104 is readable with bob's own PAT too: only the ID refuses it.
		{"POST", RepoClonesPath, start(a, 104), "gitea_connection_unavailable"},
		{"POST", RepoClonesPath, start(a, 101), "gitea_connection_unavailable"},
	} {
		if status, out, raw := call("agent-b", try.method, try.path, try.body); status != 409 || code(out) != try.code {
			t.Fatalf("agent-b used agent-a's connection: %s → %d %s", try.body, status, raw)
		}
	}
	if !bytes.Equal(snapshot("agent-b"), bTea) {
		t.Fatal("a refused foreign request changed agent-b's tea file")
	}
	for _, name := range []string{"notes", "shared"} {
		if _, err := os.Lstat(filepath.Join(homes["agent-b"], "src", name)); err == nil {
			t.Fatal("a foreign connection cloned into agent-b's home", name)
		}
	}

	// A running clone of agent-a: agent-b's daemon cannot see, stream or
	// cancel it, and agent-a's own disconnect waits for it.
	jobs := func(person string) []any {
		t.Helper()
		status, out, raw := call(person, "GET", RepoClonesPath, "")
		if status != 200 {
			t.Fatalf("%s jobs: %d %s", person, status, raw)
		}
		j, _ := out["jobs"].([]any)
		return j
	}
	release := srv.Block()
	status, out, raw := call("agent-a", "POST", RepoClonesPath, start(a, 101))
	job, _ := out["job"].(map[string]any)
	if status != 200 || job["state"] != "running" {
		release()
		t.Fatalf("agent-a clone: %d %s", status, raw)
	}
	jobID := job["job_id"].(string)
	if len(jobs("agent-b")) != 0 {
		release()
		t.Fatal("agent-b sees agent-a's clone job")
	}
	if status, out, raw = call("agent-b", "POST", RepoClonesPath, `{"action":"cancel","job_id":"`+jobID+`"}`); status != 404 || code(out) != "job_not_found" {
		release()
		t.Fatalf("agent-b cancelled agent-a's job: %d %s", status, raw)
	}
	if status, _, raw = call("agent-b", "GET", RepoCloneEventsPath+"?job_id="+jobID, ""); status != 404 || strings.Contains(raw, "progress") {
		release()
		t.Fatalf("agent-b streamed agent-a's job: %d %s", status, raw)
	}
	if status, out, raw = call("agent-a", "DELETE", integrations.GiteaPath, `{"action":"disconnect","connection_id":"`+a+`"}`); status != 409 || code(out) != "clone_running" {
		release()
		t.Fatalf("disconnect during a running clone: %d %s", status, raw)
	}
	if status, _, raw = call("agent-a", "POST", RepoClonesPath, `{"action":"cancel","job_id":"`+jobID+`"}`); status != 200 {
		release()
		t.Fatalf("agent-a cancel: %d %s", status, raw)
	}
	release()
	waitJob := func(person, id string) map[string]any {
		t.Helper()
		for deadline := time.Now().Add(30 * time.Second); time.Now().Before(deadline); time.Sleep(50 * time.Millisecond) {
			for _, j := range jobs(person) {
				if job := j.(map[string]any); job["job_id"] == id && job["state"] != "running" {
					return job
				}
			}
		}
		t.Fatalf("%s job %s never settled", person, id)
		return nil
	}
	if done := waitJob("agent-a", jobID); done["state"] != "cancelled" {
		t.Fatalf("cancelled job: %v", done)
	}

	// Each person clones with their own grant; the checkout is theirs.
	clone := func(person, connection string, id int, dir string) {
		t.Helper()
		status, out, raw := call(person, "POST", RepoClonesPath, start(connection, id))
		job, _ := out["job"].(map[string]any)
		if status != 200 || job["state"] != "running" {
			t.Fatalf("%s clone %d: %d %s", person, id, status, raw)
		}
		if done := waitJob(person, job["job_id"].(string)); done["state"] != "confirmed" {
			t.Fatalf("%s clone %d: %v", person, id, done)
		}
		users := srv.GitUsers()
		want := map[string]string{"agent-a": "ada", "agent-b": "bob"}[person]
		if len(users) == 0 || users[len(users)-1] != want {
			t.Fatalf("%s clone authenticated as %v", person, users)
		}
		checkout := filepath.Join(homes[person], "src", dir)
		st, err := os.Stat(filepath.Join(checkout, ".git", "config"))
		must(err)
		uid := map[string]int{"agent-a": 21001, "agent-b": 21002}[person]
		if int(st.Sys().(*syscall.Stat_t).Uid) != uid {
			t.Fatalf("%s checkout owned by %d", person, st.Sys().(*syscall.Stat_t).Uid)
		}
		config, _ := os.ReadFile(filepath.Join(checkout, ".git", "config"))
		if bytes.Contains(config, []byte("tok-")) || !bytes.Contains(config, []byte("username = "+want)) {
			t.Fatalf("%s checkout config: %s", person, config)
		}
	}
	clone("agent-a", a, 101, "notes")
	clone("agent-b", b, 104, "shared")
	gitAs := func(person string, args ...string) ([]byte, error) {
		uid := map[string]int{"agent-a": 21001, "agent-b": 21002}[person]
		cmd := as(uid, []string{"HOME=" + homes[person], "GIT_TERMINAL_PROMPT=0"}, "/usr/bin/git", args...)
		return cmd.CombinedOutput()
	}

	// The browser's fetch and the person's own shell use the same grant.
	must(srv.AddCommit("ada", "notes", "second.txt", "two\n"))
	workspace := opaque("ws_", "github:42:notes")
	if status, _, raw = call("agent-a", "POST", WorkspaceGitFetchPath, `{"workspace_id":"`+workspace+`"}`); status != 200 {
		t.Fatalf("agent-a browser fetch: %d %s", status, raw)
	}
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "rev-list", "--count", "origin/HEAD"); err != nil || strings.TrimSpace(string(out)) != "2" {
		t.Fatalf("fetched history: %s %v", out, err)
	}
	if status, out, raw = call("agent-b", "POST", WorkspaceGitFetchPath, `{"workspace_id":"`+workspace+`"}`); status != 404 || code(out) != "workspace_unavailable" {
		t.Fatalf("agent-b fetched agent-a's workspace: %d %s", status, raw)
	}
	must(srv.AddCommit("ada", "notes", "third.txt", "three\n"))
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "pull", "-q", "--ff-only"); err != nil {
		t.Fatalf("agent-a shell pull: %s %v", out, err)
	}
	if users := srv.GitUsers(); users[len(users)-1] != "ada" {
		t.Fatalf("shell pull authenticated as %v", users)
	}
	// agent-b's own Git, asking for ada's private repository, presents bob's
	// grant and is refused by the server.
	if out, err := gitAs("agent-b", "clone", "-q", srv.URL+"/ada/notes.git", filepath.Join(homes["agent-b"], "src", "stolen")); err == nil {
		t.Fatalf("agent-b cloned ada/notes: %s", out)
	}

	// The helper as the wrong UID: another person's home is unreadable, and
	// a readable home of another owner is refused even when the tea file in
	// it is the caller's own.
	request := "protocol=https\nhost=" + strings.TrimPrefix(srv.URL, "https://") + "\npath=ada/notes.git\n\n"
	helper := func(uid int, home string) (string, error) {
		cmd := as(uid, []string{"HOME=" + home}, exe, "gitea", "git-credential", "get")
		cmd.Stdin = strings.NewReader(request)
		out, err := cmd.Output()
		return string(out), err
	}
	if out, err := helper(21001, homes["agent-a"]); err != nil || !strings.Contains(out, "password=tok-ada-0001") {
		t.Fatalf("own helper: %q %v", out, err)
	}
	if out, err := helper(21002, homes["agent-a"]); err == nil || strings.Contains(out, "password") {
		t.Fatalf("agent-b's helper read agent-a's home: %q %v", out, err)
	}
	// Everything below the home is agent-b's and usable by agent-b; only
	// the home's owner differs, and the control with agent-b's own home
	// succeeds.
	exposed := filepath.Join(work, "exposed-home")
	must(os.MkdirAll(filepath.Join(exposed, ".config", "tea"), 0700))
	must(os.WriteFile(filepath.Join(exposed, ".config", "tea", "config.yml"), snapshot("agent-a"), 0600))
	must(exec.Command("chown", "-R", "21002:21002", exposed).Run())
	must(os.Chown(exposed, 21001, 21001))
	must(os.Chmod(exposed, 0755))
	must(os.Chmod(work, 0755))
	if out, err := helper(21002, exposed); err == nil || strings.Contains(out, "password") {
		t.Fatalf("agent-b's helper accepted a home of another owner: %q %v", out, err)
	}
	must(os.Chown(exposed, 21002, 21002))
	if out, err := helper(21002, exposed); err != nil || !strings.Contains(out, "password=") {
		t.Fatalf("control with agent-b's own home: %q %v", out, err)
	}
	// Each read works as agent-a and is denied to agent-b.
	checkout := filepath.Join(homes["agent-a"], "src", "notes")
	for _, read := range [][]string{{"/bin/ls", homes["agent-a"]}, {"/bin/ls", checkout}, {"/bin/cat", teaFile("agent-a")}, {"/bin/cat", filepath.Join(checkout, ".git", "config")}} {
		if out, err := as(21001, nil, read[0], read[1]).CombinedOutput(); err != nil {
			t.Fatalf("agent-a control %v: %s %v", read, out, err)
		}
		if out, err := as(21002, nil, read[0], read[1]).CombinedOutput(); err == nil || !strings.Contains(string(out), "Permission denied") {
			t.Fatalf("agent-b %v: %s %v", read, out, err)
		}
	}

	// Only the gateway's kernel peer is served. agent-a may connect to its
	// own socket file and root may connect to any, yet neither is answered;
	// agent-b cannot even connect.
	for _, uid := range []int{21001, 0} {
		if status, _, raw = callAs(uid, "agent-a", "GET", integrations.ListPath, ""); status == 200 || strings.Contains(raw, "GITEA_PROBE_DIAL=") {
			t.Fatalf("UID %d on agent-a's socket: %d %s", uid, status, raw)
		}
	}
	if status, _, raw = callAs(21002, "agent-a", "GET", integrations.ListPath, ""); status != 0 || !strings.Contains(raw, "GITEA_PROBE_DIAL=") || !strings.Contains(raw, "permission denied") {
		t.Fatalf("agent-b reached agent-a's socket: %d %s", status, raw)
	}

	// Replacing agent-a's PAT changes only agent-a's file.
	srv.SetToken(7, "tok-ada-0003")
	if status, out, raw = call("agent-a", "POST", integrations.GiteaPath, `{"action":"check","connection_id":"`+a+`"}`); status != 200 || out["api"] != "token_rejected" {
		t.Fatalf("check after revocation: %d %s", status, raw)
	}
	if s := repos("agent-a"); s["state"] != "failed" || s["failure"] != "token_rejected" {
		t.Fatalf("agent-a repositories after revocation: %v", s)
	}
	if s := repos("agent-b"); s["state"] != "ok" {
		t.Fatalf("agent-a's revocation reached agent-b: %v", s)
	}
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "fetch", "-q"); err == nil {
		t.Fatalf("revoked PAT still fetched: %s", out)
	}
	if status, out, raw = call("agent-a", "POST", integrations.GiteaPath, `{"action":"replace","connection_id":"`+a+`","token":"tok-ada-0003"}`); status != 200 || out["api"] != "ok" {
		t.Fatalf("replace: %d %s", status, raw)
	}
	if content := snapshot("agent-a"); !bytes.Contains(content, []byte("tok-ada-0003")) || bytes.Contains(content, []byte("tok-ada-0001")) {
		t.Fatal("replace did not rewrite agent-a's token")
	}
	if !bytes.Equal(snapshot("agent-b"), bTea) {
		t.Fatal("agent-a's replace changed agent-b's tea file")
	}
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "fetch", "-q"); err != nil {
		t.Fatalf("fetch with the replaced PAT: %s %v", out, err)
	}

	// Disconnect removes agent-a's login and helper, keeps the clone, and
	// leaves agent-b's connection, helper and clone as they were.
	if status, out, raw = call("agent-a", "DELETE", integrations.GiteaPath, `{"action":"disconnect","connection_id":"`+a+`"}`); status != 200 {
		t.Fatalf("disconnect: %d %s", status, raw)
	}
	if content := snapshot("agent-a"); bytes.Contains(content, []byte("tok-ada")) {
		t.Fatal("disconnect left agent-a's PAT")
	}
	if gitconfig, _ := os.ReadFile(filepath.Join(homes["agent-a"], ".gitconfig")); bytes.Contains(gitconfig, []byte(exe)) {
		t.Fatalf("disconnect left agent-a's helper: %s", gitconfig)
	}
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "rev-list", "--count", "HEAD"); err != nil || strings.TrimSpace(string(out)) != "3" {
		t.Fatalf("disconnect did not keep agent-a's clone: %s %v", out, err)
	}
	if out, err := gitAs("agent-a", "-C", filepath.Join(homes["agent-a"], "src", "notes"), "fetch", "-q"); err == nil {
		t.Fatalf("a disconnected clone still fetched: %s", out)
	}
	if !bytes.Equal(snapshot("agent-b"), bTea) {
		t.Fatal("agent-a's disconnect changed agent-b's tea file")
	}
	if gitconfig, _ := os.ReadFile(filepath.Join(homes["agent-b"], ".gitconfig")); !bytes.Contains(gitconfig, []byte(exe)) {
		t.Fatal("agent-a's disconnect removed agent-b's helper")
	}
	if s := repos("agent-b"); s["state"] != "ok" || s["connection_id"] != b {
		t.Fatalf("agent-b after agent-a's disconnect: %v", s)
	}
	if out, err := gitAs("agent-b", "-C", filepath.Join(homes["agent-b"], "src", "shared"), "fetch", "-q"); err != nil {
		t.Fatalf("agent-b fetch after agent-a's disconnect: %s %v", out, err)
	}
	for _, body := range replies {
		if strings.Contains(body, "tok-") {
			t.Fatalf("token in a reply: %s", body)
		}
	}
}

// serveGiteaUID is a person's daemon run as that person: the real transport
// server and the production Gitea adapter, clone jobs, observation and
// fetch, trusting only the system store.
func serveGiteaUID(t *testing.T) {
	name, subject := os.Getenv("GITEA_UID_NAME"), os.Getenv("GITEA_UID_SUBJECT")
	home := giteaUIDHome(name)
	cfg := transport.Config{GatewayUID: giteaUIDGateway, UID: os.Geteuid(), Username: name, Home: home, Socket: "/run/open-habitat/users/" + name + "/daemon.sock", Provider: "github", Subject: subject}
	server, err := transport.NewServer(cfg, func(context.Context, string, bool) (bool, error) { return false, nil })
	if err != nil {
		t.Fatal("handoff server", err)
	}
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: cfg.Socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Chmod(cfg.Socket, 0660); err != nil {
		t.Fatal(err)
	}
	// tea itself is never run by the daemon; its presence offers the provider.
	env := integrations.Env{Home: home, LoadConfig: func() (integrations.Config, error) {
		return integrations.Config{Tools: map[string]string{"tea": "/usr/bin/true"}}, nil
	}}
	gitea, err := integrations.NewGitea(env, nativegitea.NewClient(), "/usr/bin/git", os.Getenv("GITEA_UID_EXE"))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	clones := NewCloneJobs(ctx, cfg, server.TrustedPeer).WithGitea(gitea)
	// The container has no user quota; admission is the quota tests' concern.
	clones.budget = func(int) bool { return true }
	mux := http.NewServeMux()
	mux.Handle(RepoClonesPath, clones.Handler())
	mux.Handle(RepoCloneEventsPath, clones.Events())
	mux.Handle(RepoObservePath, RepoObserveHandler(cfg, server.TrustedPeer, clones))
	mux.Handle(WorkspaceGitFetchPath, WorkspaceGitFetchHandler(cfg, server.TrustedPeer, Forges{Gitea: gitea}))
	catalog := integrations.New(env, nil, nil, integrations.WithGitea(gitea))
	routes := catalog.Handler(func(r *http.Request) bool { return historyAuthorized(cfg, server.TrustedPeer, r) })
	for _, path := range []string{integrations.ListPath, integrations.GiteaPath, integrations.GiteaReposPath} {
		mux.Handle(path, routes)
	}
	if err = server.ServeMux(ctx, ln, mux); err != nil {
		t.Fatal("serve", err)
	}
}

// TestGiteaUIDProbe makes one request on a daemon socket as the calling UID
// and prints its status and body; a refused connection is a failed run.
func TestGiteaUIDProbe(t *testing.T) {
	if os.Getenv("GITEA_UID_PROBE") != "1" {
		t.Skip("helper")
	}
	conn, err := net.DialTimeout("unix", os.Getenv("GITEA_PROBE_SOCKET"), 2*time.Second)
	if err != nil {
		// Distinguishes a connection never made from one refused after it.
		fmt.Printf("GITEA_PROBE_DIAL=%v\n", err)
		return
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(45 * time.Second))
	var body io.Reader
	if b := os.Getenv("GITEA_PROBE_BODY"); b != "" {
		body = strings.NewReader(b)
	}
	req, err := http.NewRequest(os.Getenv("GITEA_PROBE_METHOD"), "http://unix"+os.Getenv("GITEA_PROBE_PATH"), body)
	if err != nil {
		t.Fatal(err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	forged := os.Getenv("GITEA_PROBE_FORGED")
	req.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:"+forged))
	req.Header.Set("X-Agent-Host-Display-Name", "GitHub user "+forged)
	req.Close = true
	if err = req.Write(conn); err != nil {
		t.Fatal(err)
	}
	res, err := http.ReadResponse(bufio.NewReader(conn), req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	line, _ := json.Marshal(map[string]any{"status": res.StatusCode, "body": string(b)})
	fmt.Printf("GITEA_PROBE=%s\n", line)
}
