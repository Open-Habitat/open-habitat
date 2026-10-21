//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

func TestArchiveKeepsNativeHistoryAndRejectsUnknownWriters(t *testing.T) {
	const id = "12345678-1234-4123-8123-123456789abc"
	const wsid = "ws_12345678"
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "project")
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	root := filepath.Join(home, ".pi", "agent", "sessions")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "history.jsonl")
	original := []byte(fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd) + `{"type":"message","id":"message1","message":{"role":"user","content":"saved"}}` + "\n" + `{"type":"message","id":"message2","message":{"role":"assistant","content":"cut`)
	// The writer census must still reject a real writer for this cut-off file.
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	fd, err := unix.Open(cwd, unix.O_PATH|unix.O_DIRECTORY, 0)
	if err != nil {
		t.Fatal(err)
	}
	info, err := stat(fd)
	unix.Close(fd)
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	c := &ConversationController{writerProc: t.TempDir(), home: home, cfg: cfg, sessions: map[string]*conversation{}}
	c.discover = func(transport.Config) Discovery {
		return Discovery{State: "present", Entries: []Workspace{{Name: "project", Kind: "directory", WorkspaceID: wsid, dev: uint64(info.Dev), ino: info.Ino}}}
	}
	native := readNativeHeader(path, cfg.UID)
	token := opaque("obs_", id+":"+native.revision)
	requestDetail := func(archived bool, observation string) (int, string) {
		t.Helper()
		body, _ := json.Marshal(map[string]any{"workspace_id": wsid, "archived": archived, "previous_archive": func() string {
			if archived {
				return "active"
			}
			return "archived"
		}(), "observation_token": observation})
		req := httptest.NewRequest("POST", "http://unix/archive", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.archive(w, req, id)
		var response struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		_ = json.Unmarshal(w.Body.Bytes(), &response)
		return w.Code, response.Error.Code
	}
	request := func(archived bool, observation string) int {
		status, _ := requestDetail(archived, observation)
		return status
	}
	archiveWhenAbsent := func(label string) {
		t.Helper()
		header := readNativeHeader(path, cfg.UID)
		if header.state != "readable" {
			t.Fatalf("%s: native history not readable: %s", label, header.state)
		}
		fresh := opaque("obs_", id+":"+header.revision)
		if status, code := requestDetail(true, fresh); status != http.StatusOK {
			t.Fatalf("%s: archive rejected: %d (%s)", label, status, code)
		}
		token = fresh
	}
	writer := exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", path)
	writer.Dir = cwd
	if err := writer.Start(); err != nil {
		t.Fatal(err)
	}
	exposeTestProcess(t, c.writerProc, writer.Process.Pid)
	defer func(cmd *exec.Cmd) { _ = cmd.Process.Kill(); _ = cmd.Wait() }(writer)
	deadline := time.Now().Add(2 * time.Second)
	for c.piWriter(path, cwd) != "writer_present" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if c.piWriter(path, cwd) != "writer_present" {
		t.Fatal("native writer not observed")
	}
	if status, code := requestDetail(true, token); status != 409 || code != "writer_conflict" {
		t.Fatalf("native writer archive rejection: %d (%s)", status, code)
	}
	_ = writer.Process.Kill()
	_ = writer.Wait()
	// An opaque same-UID process must block archive, not be treated as absent.
	opaqueProcess := filepath.Join(c.writerProc, "99999999")
	if err := os.Mkdir(opaqueProcess, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(opaqueProcess, "cmdline"), []byte("pi\x00"), 0000); err != nil {
		t.Fatal(err)
	}
	if status, code := requestDetail(true, token); status != 409 || code != "control_uncertain" {
		t.Fatalf("unknown writer archive rejection: %d (%s)", status, code)
	}
	if err := os.RemoveAll(opaqueProcess); err != nil {
		t.Fatal(err)
	}
	archiveWhenAbsent("first writer exit")
	// Restoring presentation does not mutate native history and must not be
	// blocked by a terminal writer, unlike archiving.
	writer = exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", path)
	writer.Dir = cwd
	if err := writer.Start(); err != nil {
		t.Fatal(err)
	}
	exposeTestProcess(t, c.writerProc, writer.Process.Pid)
	defer func(cmd *exec.Cmd) { _ = cmd.Process.Kill(); _ = cmd.Wait() }(writer)
	deadline = time.Now().Add(2 * time.Second)
	for c.piWriter(path, cwd) != "writer_present" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if c.piWriter(path, cwd) != "writer_present" {
		t.Fatal("native writer not observed on restore")
	}
	if got := request(false, token); got != 200 {
		t.Fatalf("active terminal history not restored: %d", got)
	}
	_ = writer.Process.Kill()
	_ = writer.Wait()
	exited := make(chan struct{})
	c.mu.Lock()
	c.sessions[id] = &conversation{id: id, workspace: wsid, cwd: cwd, rpc: &piRPC{exited: exited}, state: "accepted"}
	c.mu.Unlock()
	// The live-child fence is independent of the native writer census.
	fresh := opaque("obs_", id+":"+readNativeHeader(path, cfg.UID).revision)
	if status, code := requestDetail(true, fresh); status != 409 || code != "writer_conflict" {
		t.Fatalf("active writer archive rejection: %d (%s)", status, code)
	}
	c.mu.Lock()
	c.sessions[id].state = "idle"
	c.mu.Unlock()
	if status, code := requestDetail(true, "obs_stale123"); status != 409 || code != "control_uncertain" {
		t.Fatalf("stale view archive rejection: %d (%s)", status, code)
	}
	archiveWhenAbsent("idle child")
	state, err := loadVisibility(home)
	if err != nil || archiveFact(state, nil, "pi:"+id) != "archived" {
		t.Fatalf("archive missing: %v %v", state, err)
	}
	if status, code := requestDetail(true, token); status != 409 || code != "control_uncertain" {
		t.Fatalf("stale archive view rejection: %d (%s)", status, code)
	}
	message := httptest.NewRequest("POST", "http://unix/send", bytes.NewBufferString(`{"message":"should stay hidden","command_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}`))
	message.Header.Set("Content-Type", "application/json")
	blocked := httptest.NewRecorder()
	c.send(blocked, message, id)
	if blocked.Code != 409 {
		t.Fatalf("archived conversation accepted a new send: %d", blocked.Code)
	}
	c.mu.Lock()
	delete(c.sessions, id)
	c.mu.Unlock() // daemon restart loses its handle; visibility restoration remains possible.
	if got := request(false, token); got != 200 {
		t.Fatalf("restore: %d", got)
	}
	state, err = loadVisibility(home)
	if err != nil || archiveFact(state, nil, "pi:"+id) != "active" {
		t.Fatalf("restore missing: %v %v", state, err)
	}
	data, err := os.ReadFile(path)
	if err != nil || !bytes.Equal(data, original) {
		t.Fatal("native history changed")
	}
	// A sound header does not make later corrupt native history archivable.
	if err := os.WriteFile(path, append(bytes.Clone(original), []byte("{broken\n")...), 0600); err != nil {
		t.Fatal(err)
	}
	corruptToken := opaque("obs_", id+":"+readNativeHeader(path, cfg.UID).revision)
	c.mu.Lock()
	c.sessions[id] = &conversation{id: id, workspace: wsid, cwd: cwd, rpc: &piRPC{exited: exited}, state: "idle"}
	c.mu.Unlock()
	if got := request(true, corruptToken); got != http.StatusConflict {
		t.Fatalf("corrupt history archived: %d", got)
	}
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	// Corrupt annotation bytes are not overwritten by a new archive action.
	stateDir := filepath.Join(home, ".local", "state", "open-habitat", "user-state.json")
	if err := os.WriteFile(stateDir, []byte("{broken"), 0600); err != nil {
		t.Fatal(err)
	}
	restoredToken := opaque("obs_", id+":"+readNativeHeader(path, cfg.UID).revision)
	got, code := requestDetail(true, restoredToken)
	if got != http.StatusServiceUnavailable {
		t.Fatalf("corrupt annotation overwritten: %d %s", got, code)
	}
	data, _ = os.ReadFile(stateDir)
	if string(data) != "{broken" {
		t.Fatal("corrupt bytes destroyed")
	}
}
