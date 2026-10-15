//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
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
	original := []byte(fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, cwd))
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
	c := &ConversationController{home: home, cfg: cfg, sessions: map[string]*conversation{}}
	c.discover = func(transport.Config) Discovery {
		return Discovery{State: "present", Entries: []Workspace{{Name: "project", Kind: "directory", WorkspaceID: wsid, dev: uint64(info.Dev), ino: info.Ino}}}
	}
	native := readNativeHeader(path, cfg.UID)
	token := opaque("obs_", id+":"+native.revision)
	request := func(archived bool, observation string) int {
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
		return w.Code
	}
	writer := exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", path)
	writer.Dir = cwd
	if err := writer.Start(); err != nil {
		t.Fatal(err)
	}
	defer func(cmd *exec.Cmd) { _ = cmd.Process.Kill(); _ = cmd.Wait() }(writer)
	deadline := time.Now().Add(2 * time.Second)
	for piWriter(path, cwd, cfg.UID) != "writer_present" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if piWriter(path, cwd, cfg.UID) != "writer_present" {
		t.Fatal("native writer not observed")
	}
	if got := request(true, token); got != 409 {
		t.Fatalf("native writer admitted to archive: %d", got)
	}
	_ = writer.Process.Kill()
	_ = writer.Wait()
	// A concurrent same-UID process can disappear during /proc enumeration.
	// Wait for affirmative absence, never treat an unknown census as absence.
	deadline = time.Now().Add(3 * time.Second)
	observed := ""
	for time.Now().Before(deadline) {
		observed = piWriter(path, cwd, cfg.UID)
		if observed == "not_observed" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if observed != "not_observed" {
		t.Fatalf("writer absence not established after exit: %s", observed)
	}
	if got := request(true, token); got != 200 {
		t.Fatalf("idle terminal history not archived: %d (writer census: %s)", got, piWriter(path, cwd, cfg.UID))
	}
	// Restoring presentation does not mutate native history and must not be
	// blocked by a terminal writer, unlike archiving.
	writer = exec.Command("bash", "-c", "exec -a pi sleep 20 3<\"$1\"", "bash", path)
	writer.Dir = cwd
	if err := writer.Start(); err != nil {
		t.Fatal(err)
	}
	defer func(cmd *exec.Cmd) { _ = cmd.Process.Kill(); _ = cmd.Wait() }(writer)
	deadline = time.Now().Add(2 * time.Second)
	for piWriter(path, cwd, cfg.UID) != "writer_present" && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if piWriter(path, cwd, cfg.UID) != "writer_present" {
		t.Fatal("native writer not observed on restore")
	}
	if got := request(false, token); got != 200 {
		t.Fatalf("active terminal history not restored: %d", got)
	}
	_ = writer.Process.Kill()
	_ = writer.Wait()
	exited := make(chan struct{})
	c.sessions[id] = &conversation{id: id, workspace: wsid, cwd: cwd, rpc: &piRPC{exited: exited}, state: "accepted"}
	if got := request(true, token); got != 409 {
		t.Fatalf("active writer admitted: %d", got)
	}
	c.sessions[id].state = "idle"
	if got := request(true, "obs_stale123"); got != 409 {
		t.Fatalf("stale view admitted: %d", got)
	}
	if got := request(true, token); got != 200 {
		t.Fatalf("archive: %d", got)
	}
	state, err := loadVisibility(home)
	if err != nil || archiveFact(state, nil, "pi:"+id) != "archived" {
		t.Fatalf("archive missing: %v %v", state, err)
	}
	if got := request(true, token); got != 409 {
		t.Fatalf("stale archive view changed state: %d", got)
	}
	message := httptest.NewRequest("POST", "http://unix/send", bytes.NewBufferString(`{"message":"should stay hidden","command_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}`))
	message.Header.Set("Content-Type", "application/json")
	blocked := httptest.NewRecorder()
	c.send(blocked, message, id)
	if blocked.Code != 409 {
		t.Fatalf("archived conversation accepted a new send: %d", blocked.Code)
	}
	delete(c.sessions, id) // daemon restart loses its handle; visibility restoration remains possible.
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
	c.sessions[id] = &conversation{id: id, workspace: wsid, cwd: cwd, rpc: &piRPC{exited: exited}, state: "idle"}
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
	if got := request(true, restoredToken); got != http.StatusServiceUnavailable {
		t.Fatalf("corrupt annotation overwritten: %d", got)
	}
	data, _ = os.ReadFile(stateDir)
	if string(data) != "{broken" {
		t.Fatal("corrupt bytes destroyed")
	}
}
