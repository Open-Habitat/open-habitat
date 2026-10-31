//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func editorFixture(t *testing.T) (*ConversationController, string, string, http.Handler) {
	t.Helper()
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	p := filepath.Join(cfg.Home, "src", "app")
	if e := os.MkdirAll(p, 0700); e != nil {
		t.Fatal(e)
	}
	c := &ConversationController{cfg: cfg, home: cfg.Home, discover: Discover, trusted: func(*http.Request) bool { return true }, sessions: map[string]*conversation{}}
	id := workspaceIDOf(cfg, Discover(cfg).Entries[0])
	return c, id, p, c.EditorFiles()
}
func editorCall(h http.Handler, method, op, id, p string, body []byte) (int, map[string]any) {
	target := EditorFilesPrefix + op
	if method == "GET" {
		target += "?" + url.Values{"workspace_id": {id}, "path": {p}}.Encode()
	}
	r := httptest.NewRequest(method, "http://unix"+target, bytes.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	var out map[string]any
	json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}
func saveInput(id, p, base, content string, bom bool, newline string) []byte {
	b, _ := json.Marshal(editorFileRequest{id, p, base, content, bom, newline})
	return b
}
func TestEditorFilesRoundTripAndConflict(t *testing.T) {
	_, id, p, h := editorFixture(t)
	if e := os.WriteFile(filepath.Join(p, "script.sh"), []byte("\xef\xbb\xbfecho hi\r\n"), 0751); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(filepath.Join(p, "script.sh"), 0751); e != nil {
		t.Fatal(e)
	}
	status, read := editorCall(h, "GET", "file", id, "script.sh", nil)
	if status != 200 || read["content"] != "echo hi\n" || read["bom"] != true || read["newline"] != "crlf" {
		t.Fatalf("read %d %#v", status, read)
	}
	base := read["version"].(string)
	// Saving without editing preserves exact bytes, mode, BOM and CRLF. A second
	// save must accept the post-rename token (rename changes inode ctime).
	var stale string
	for i := 0; i < 2; i++ {
		status, saved := editorCall(h, "PUT", "file", id, "", saveInput(id, "script.sh", base, "echo hi\n", true, "crlf"))
		if status != 200 {
			t.Fatalf("save %d %#v", status, saved)
		}
		next := saved["version"].(string)
		if next == base {
			t.Fatal("replacement did not change token")
		}
		stale, base = base, next
	}
	raw, e := os.ReadFile(filepath.Join(p, "script.sh"))
	if e != nil || string(raw) != "\xef\xbb\xbfecho hi\r\n" {
		t.Fatal("bytes changed", e)
	}
	s, _ := os.Stat(filepath.Join(p, "script.sh"))
	if s.Mode().Perm() != 0751 {
		t.Fatal("mode changed")
	}
	// The token names the observed state, not its history: the second save can
	// reuse the original's freed inode within one timestamp tick, restoring the
	// first read's token for identical bytes. The first save's inode was still
	// live when the second was created, so its token is always stale.
	status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, "script.sh", stale, "stale", false, "none"))
	if status != 409 {
		t.Fatal("stale", status)
	}
	if e := os.WriteFile(filepath.Join(p, "script.sh"), []byte("native"), 0751); e != nil {
		t.Fatal(e)
	}
	status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, "script.sh", base, "stale", false, "none"))
	if status != 409 {
		t.Fatal("native change", status)
	}
}
func TestEditorFilesPathsAndSpecialFiles(t *testing.T) {
	c, id, p, h := editorFixture(t)
	os.WriteFile(filepath.Join(p, "text"), []byte("safe"), 0600)
	outside := t.TempDir()
	os.WriteFile(filepath.Join(outside, "secret"), []byte("secret"), 0600)
	os.Symlink(outside, filepath.Join(p, "link"))
	os.Symlink("text", filepath.Join(p, "inside"))
	unix.Mkfifo(filepath.Join(p, "fifo"), 0600)
	socket, err := net.Listen("unix", filepath.Join(p, "socket"))
	if err != nil {
		t.Fatal(err)
	}
	defer socket.Close()
	for _, name := range []string{"../secret", "/etc/passwd", "a//b", "./text", "a/../text", "a\\b", ".git/config", ".agent-host/workspace.json", "link/secret", "inside", "fifo", "socket", "a\x00b"} {
		status, out := editorCall(h, "GET", "file", id, name, nil)
		if status == 200 {
			t.Fatalf("admitted %q %#v", name, out)
		}
		data, _ := json.Marshal(out)
		if bytes.Contains(data, []byte("secret")) {
			t.Fatal("error leaks content")
		}
	}
	c.trusted = func(*http.Request) bool { return false }
	status, _ := editorCall(h, "GET", "file", id, "text", nil)
	if status != 403 {
		t.Fatal(status)
	}
}
func TestEditorFilesRefuseMetadataEncodingAndCaps(t *testing.T) {
	_, id, p, h := editorFixture(t)
	tests := []struct {
		name string
		data []byte
		mode os.FileMode
		want int
	}{
		{"readonly", []byte("x"), 0400, 200}, {"binary", []byte{0}, 0600, 415}, {"encoding", []byte{0xff}, 0600, 415}, {"mixed", []byte("a\r\nb\n"), 0600, 415}, {"barecr", []byte("a\rb"), 0600, 415}, {"big", bytes.Repeat([]byte("x"), editorTextLimit+1), 0600, 413},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			os.WriteFile(filepath.Join(p, tt.name), tt.data, tt.mode)
			status, _ := editorCall(h, "GET", "file", id, tt.name, nil)
			if status != tt.want {
				t.Fatal(status)
			}
		})
	}
	os.WriteFile(filepath.Join(p, "hard"), []byte("x"), 0600)
	os.Link(filepath.Join(p, "hard"), filepath.Join(p, "alias"))
	status, read := editorCall(h, "GET", "file", id, "hard", nil)
	if status != 200 {
		t.Fatal("hardlink read", status)
	}
	status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, "hard", read["version"].(string), "changed", false, "none"))
	if status != 415 {
		t.Fatal("hardlink save", status)
	}
	os.WriteFile(filepath.Join(p, "attr"), []byte("x"), 0600)
	if e := unix.Setxattr(filepath.Join(p, "attr"), "user.test", []byte("x"), 0); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"attr", "readonly"} {
		status, read = editorCall(h, "GET", "file", id, name, nil)
		if status != 200 {
			t.Fatal("metadata read", name, status)
		}
		status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, name, read["version"].(string), "changed", false, "none"))
		if status != 415 {
			t.Fatal("metadata save", name, status)
		}
		status, info := editorCall(h, "GET", "stat", id, name, nil)
		if status != 200 || info["editable"] != false || info["reason"] != "metadata_unsupported" {
			t.Fatal("metadata stat", name, status, info)
		}
	}
}
func TestEditorFilesStrictWireUnicode(t *testing.T) {
	_, id, p, h := editorFixture(t)
	os.WriteFile(filepath.Join(p, "text"), []byte("safe"), 0600)
	_, read := editorCall(h, "GET", "file", id, "text", nil)
	base := read["version"].(string)
	valid := string(saveInput(id, "text", base, "REPLACE", false, "none"))
	for _, wire := range []string{`\ud800`, `\udc00`, `\ud800\u0061`, string([]byte{0xff}), `\u0000`, `\r`} {
		status, _ := editorCall(h, "PUT", "file", id, "", []byte(strings.Replace(valid, "REPLACE", wire, 1)))
		if status != 400 {
			t.Fatalf("unicode %q: %d", wire, status)
		}
	}
	for _, wire := range []string{`\ud83d\ude00`, `\ufffd`} {
		status, _ := editorCall(h, "PUT", "file", id, "", []byte(strings.Replace(valid, "REPLACE", wire, 1)))
		if status != 200 {
			t.Fatalf("valid unicode %q: %d", wire, status)
		}
		_, read = editorCall(h, "GET", "file", id, "text", nil)
		valid = string(saveInput(id, "text", read["version"].(string), "REPLACE", false, "none"))
	}
	for _, wire := range []string{strings.Replace(valid, `"bom":false`, `"bom":null`, 1), strings.Replace(valid, `"bom":false`, `"bom":false,"bom":true`, 1), valid + ` {}`, strings.Replace(valid, `"bom":false`, `"bom":false,"extra":1`, 1)} {
		status, _ := editorCall(h, "PUT", "file", id, "", []byte(wire))
		if status != 400 {
			t.Fatalf("wire %d", status)
		}
	}
}
func TestEditorFilesConcurrentSavesAndDeletionLease(t *testing.T) {
	c, id, p, h := editorFixture(t)
	os.WriteFile(filepath.Join(p, "text"), []byte("base"), 0600)
	_, read := editorCall(h, "GET", "file", id, "text", nil)
	base := read["version"].(string)
	var wg sync.WaitGroup
	results := make(chan int, 2)
	for _, text := range []string{"first", "second"} {
		wg.Add(1)
		go func(text string) {
			defer wg.Done()
			s, _ := editorCall(h, "PUT", "file", id, "", saveInput(id, "text", base, text, false, "none"))
			results <- s
		}(text)
	}
	wg.Wait()
	a, b := <-results, <-results
	if a+b != 609 {
		t.Fatal("both writes accepted or refused", a, b)
	}
	ws, cwd, e := c.workspaceFD(id)
	if e != nil {
		t.Fatal(e)
	}
	defer ws.Close()
	release, ok := c.editorLease(ws, cwd)
	if !ok {
		t.Fatal("lease refused")
	}
	preview := c.busySessions(context.Background(), cwd)
	if len(preview) != 1 || preview[0].activity != "file_operation" {
		t.Fatal("preview missed live operation")
	}
	s, _ := stat(int(ws.Fd()))
	busy, fence := c.fenceWorkspace(context.Background(), cwd, inodeOf(s))
	if fence != nil || len(busy) != 1 || busy[0].activity != "file_operation" {
		t.Fatal("deletion missed lease")
	}
	// A nested deletion overlaps an operation admitted at its enclosing root.
	child := filepath.Join(cwd, "nested")
	os.Mkdir(child, 0700)
	cf, _ := os.Open(child)
	defer cf.Close()
	cs, _ := stat(int(cf.Fd()))
	busy, fence = c.fenceWorkspace(context.Background(), child, inodeOf(cs))
	if fence != nil || len(busy) == 0 {
		t.Fatal("nested deletion missed enclosing lease")
	}
	release()
	_, fence = c.fenceWorkspace(context.Background(), child, inodeOf(cs))
	if fence == nil {
		t.Fatal("fence refused after release")
	}
	defer fence()
	if _, ok := c.editorLease(ws, cwd); ok {
		t.Fatal("enclosing lease admitted while child fenced")
	}
}
func TestEditorFilesParentSwapAndNamedRoot(t *testing.T) {
	c, id, p, _ := editorFixture(t)
	os.Mkdir(filepath.Join(p, "dir"), 0700)
	os.WriteFile(filepath.Join(p, "dir", "text"), []byte("original"), 0600)
	ws, cwd, e := c.workspaceFD(id)
	if e != nil {
		t.Fatal(e)
	}
	defer ws.Close()
	// A symlink substituted for a held directory cannot redirect a content open.
	os.Rename(filepath.Join(p, "dir"), filepath.Join(p, "old"))
	os.Symlink(t.TempDir(), filepath.Join(p, "dir"))
	if f, e := editorOpen(int(ws.Fd()), "dir/text", uint32(c.cfg.UID), unix.O_RDONLY); e == nil {
		f.Close()
		t.Fatal("followed swapped parent")
	}
	os.Rename(p, p+"-old")
	os.Mkdir(p, 0700)
	if c.editorAdmitted(ws, cwd) {
		t.Fatal("substituted root admitted")
	}
}

func TestEditorFilesCommitFailuresAreUncertainAndNeverPartial(t *testing.T) {
	for _, phase := range []string{"disk_full", "file_sync", "directory_sync"} {
		t.Run(phase, func(t *testing.T) {
			c, id, p, h := editorFixture(t)
			name := filepath.Join(p, "text")
			os.WriteFile(name, []byte("old"), 0600)
			_, read := editorCall(h, "GET", "file", id, "text", nil)
			hooks := &editorFileTestHooks{}
			switch phase {
			case "disk_full":
				hooks.write = func(*os.File, []byte) (int, error) { return 0, unix.ENOSPC }
			case "file_sync":
				hooks.syncFile = func(*os.File) error { return unix.EIO }
			case "directory_sync":
				hooks.syncDir = func(int) error { return unix.EIO }
			}
			c.editorFileTest = hooks
			status, _ := editorCall(h, "PUT", "file", id, "", saveInput(id, "text", read["version"].(string), "complete replacement", false, "none"))
			if status != 503 {
				t.Fatal("acknowledged failed durability", status)
			}
			got, _ := os.ReadFile(name)
			want := "old"
			if phase == "directory_sync" {
				want = "complete replacement"
			}
			if string(got) != want {
				t.Fatalf("%q want %q", got, want)
			}
			entries, _ := os.ReadDir(p)
			for _, entry := range entries {
				if strings.HasPrefix(entry.Name(), ".oh-save-") {
					t.Fatal("own staging leaked")
				}
			}
		})
	}
}
func TestEditorFilesSwapDuringSaveRefusesBeforeRename(t *testing.T) {
	for _, kind := range []string{"target", "parent", "workspace"} {
		t.Run(kind, func(t *testing.T) {
			c, id, p, h := editorFixture(t)
			os.Mkdir(filepath.Join(p, "dir"), 0700)
			name := filepath.Join(p, "dir", "text")
			os.WriteFile(name, []byte("old"), 0600)
			_, read := editorCall(h, "GET", "file", id, "dir/text", nil)
			outside := t.TempDir()
			os.WriteFile(filepath.Join(outside, "text"), []byte("outside"), 0600)
			c.editorFileTest = &editorFileTestHooks{beforeCheck: func() {
				switch kind {
				case "target":
					os.Remove(name)
					os.Symlink(filepath.Join(outside, "text"), name)
				case "parent":
					os.Rename(filepath.Join(p, "dir"), filepath.Join(p, "held"))
					os.Symlink(outside, filepath.Join(p, "dir"))
				case "workspace":
					os.Rename(p, p+"-held")
					os.Mkdir(p, 0700)
				}
			}}
			status, _ := editorCall(h, "PUT", "file", id, "", saveInput(id, "dir/text", read["version"].(string), "replacement", false, "none"))
			if status < 400 || status >= 500 {
				t.Fatalf("swap %s: %d", kind, status)
			}
			got, _ := os.ReadFile(filepath.Join(outside, "text"))
			if string(got) != "outside" {
				t.Fatal("escaped into substitute")
			}
		})
	}
}
func TestEditorFilesBoundedDirectoryAndQueryGrammar(t *testing.T) {
	_, id, p, h := editorFixture(t)
	for i := 0; i < 510; i++ {
		os.WriteFile(filepath.Join(p, fmt.Sprintf("file-%04d", i)), []byte("x"), 0600)
	}
	os.Mkdir(filepath.Join(p, ".git"), 0700)
	os.Symlink("file-0000", filepath.Join(p, "link"))
	status, list := editorCall(h, "GET", "list", id, "", nil)
	if status != 200 || list["truncated"] != true || len(list["entries"].([]any)) != 500 {
		t.Fatal(status, list["truncated"])
	}
	first := list["entries"].([]any)[0].(map[string]any)
	if first["kind"] != "file" {
		t.Fatal("ordinary files marked unsupported", first)
	}
	status, info := editorCall(h, "GET", "stat", id, "file-0000", nil)
	if status != 200 || info["kind"] != "file" || info["editable"] != true {
		t.Fatal("stat", status, info)
	}
	status, info = editorCall(h, "GET", "stat", id, "", nil)
	if status != 200 || info["kind"] != "directory" {
		t.Fatal("root stat", status, info)
	}
	for _, query := range []string{"workspace_id=" + id + "&path=&path=x", "workspace_id=" + id + "&path=&uid=1", "workspace_id=" + id} {
		r := httptest.NewRequest("GET", "http://unix"+EditorFilesPrefix+"list?"+query, nil)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 400 {
			t.Fatal(w.Code)
		}
	}
}

func TestEditorFilesAliasesShareSaveGateAndLeases(t *testing.T) {
	f := newWorktreeFixture(t)
	nested := filepath.Join(f.src("toinen"), "nested")
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "alias", nested)
	obs := Discover(f.cfg)
	var parentID, placeID string
	for _, entry := range obs.Entries {
		if entry.Name == "toinen" {
			parentID = workspaceIDOf(f.cfg, entry)
		}
		if entry.Name == "app" {
			places, ok := readWorktreePlaces(f.cfg.Home, entry, f.id)
			if !ok {
				t.Fatal("place inventory unavailable")
			}
			for _, place := range places {
				if place.Path == nested {
					placeID = place.ID
				}
			}
		}
	}
	if parentID == "" || placeID == "" {
		t.Fatal("missing alias ids", parentID, placeID)
	}
	f.c.discover = Discover
	f.c.trusted = func(*http.Request) bool { return true }
	h := f.c.EditorFiles()
	s, a := editorCall(h, "GET", "file", parentID, "nested/README", nil)
	if s != 200 {
		t.Fatal("enclosing read", s, a)
	}
	s, b := editorCall(h, "GET", "file", placeID, "README", nil)
	if s != 200 {
		t.Fatal("place read", s, b)
	}
	entered := make(chan struct{}, 2)
	release := make(chan struct{})
	f.c.editorFileTest = &editorFileTestHooks{beforeCheck: func() { entered <- struct{}{}; <-release }}
	result := make(chan int, 2)
	go func() {
		s, _ := editorCall(h, "PUT", "file", parentID, "", saveInput(parentID, "nested/README", a["version"].(string), "enclosing", false, "none"))
		result <- s
	}()
	<-entered
	go func() {
		s, _ := editorCall(h, "PUT", "file", placeID, "", saveInput(placeID, "README", b["version"].(string), "place", false, "none"))
		result <- s
	}()
	select {
	case <-entered:
		close(release)
		t.Fatal("alias save entered commit while enclosing save held daemon gate")
	case <-time.After(40 * time.Millisecond):
	}
	close(release)
	if a, b := <-result, <-result; a+b != 609 {
		t.Fatal("alias writes did not conflict", a, b)
	}
	// A lease on the place also blocks deletion of the enclosing workspace.
	ws, cwd, e := f.c.workspaceFD(placeID)
	if e != nil {
		t.Fatal(e)
	}
	defer ws.Close()
	done, ok := f.c.editorLease(ws, cwd)
	if !ok {
		t.Fatal("place lease refused")
	}
	defer done()
	parent, _, e := f.c.workspaceFD(parentID)
	if e != nil {
		t.Fatal(e)
	}
	defer parent.Close()
	st, _ := stat(int(parent.Fd()))
	busy, fence := f.c.fenceWorkspace(context.Background(), f.src("toinen"), inodeOf(st))
	if fence != nil || len(busy) == 0 || busy[0].activity != "file_operation" {
		t.Fatal("enclosing deletion missed place lease")
	}
}

func TestEditorFilesCleanupDoesNotOwnTheOldNameAfterRename(t *testing.T) {
	c, id, p, h := editorFixture(t)
	os.WriteFile(filepath.Join(p, "text"), []byte("old"), 0600)
	_, read := editorCall(h, "GET", "file", id, "text", nil)
	var temporary string
	c.editorFileTest = &editorFileTestHooks{
		beforeCheck: func() {
			entries, e := os.ReadDir(p)
			if e != nil {
				t.Fatal(e)
			}
			for _, entry := range entries {
				if strings.HasPrefix(entry.Name(), ".oh-save-") {
					temporary = entry.Name()
				}
			}
		},
		syncDir: func(fd int) error {
			if temporary == "" {
				t.Fatal("no staged name")
			}
			// A native process reused the now-free name. It is not this request's
			// staging file and must not be deleted by post-commit cleanup.
			if e := os.WriteFile(filepath.Join(p, temporary), []byte("native file"), 0600); e != nil {
				return e
			}
			return unix.Fsync(fd)
		},
	}
	status, _ := editorCall(h, "PUT", "file", id, "", saveInput(id, "text", read["version"].(string), "replacement", false, "none"))
	if status != 200 {
		t.Fatal(status)
	}
	got, e := os.ReadFile(filepath.Join(p, temporary))
	if e != nil || string(got) != "native file" {
		t.Fatal("removed a name no longer owned by the save", e)
	}
}

func TestEditorFilesACLAndSpecialModeAreReadableButNotSaveable(t *testing.T) {
	_, id, p, h := editorFixture(t)
	for _, name := range []string{"acl", "setid"} {
		os.WriteFile(filepath.Join(p, name), []byte("readable"), 0600)
	}
	// Linux POSIX ACL xattr version 2: owner, named user, group, mask, other.
	acl := make([]byte, 4+5*8)
	binary.LittleEndian.PutUint32(acl, 2)
	entries := [][3]uint32{{1, 6, ^uint32(0)}, {2, 4, uint32(os.Geteuid() + 1)}, {4, 0, ^uint32(0)}, {16, 4, ^uint32(0)}, {32, 0, ^uint32(0)}}
	for i, v := range entries {
		off := 4 + i*8
		binary.LittleEndian.PutUint16(acl[off:], uint16(v[0]))
		binary.LittleEndian.PutUint16(acl[off+2:], uint16(v[1]))
		binary.LittleEndian.PutUint32(acl[off+4:], v[2])
	}
	if e := unix.Setxattr(filepath.Join(p, "acl"), "system.posix_acl_access", acl, 0); e != nil {
		t.Fatal("ACL fixture", e)
	}
	if e := os.Chmod(filepath.Join(p, "setid"), 0600|os.ModeSetuid); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"acl", "setid"} {
		status, doc := editorCall(h, "GET", "file", id, name, nil)
		if status != 200 {
			t.Fatal("read", name, status)
		}
		status, _ = editorCall(h, "PUT", "file", id, "", saveInput(id, name, doc["version"].(string), "changed", false, "none"))
		if status != 415 {
			t.Fatal("save", name, status)
		}
	}
}
