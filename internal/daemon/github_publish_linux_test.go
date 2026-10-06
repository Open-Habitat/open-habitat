//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPublishStagesAndDenials(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if e := os.Mkdir(filepath.Join(cfg.Home, "src"), 0700); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(cfg.Home, "src", "local")
	if e := os.Mkdir(path, 0700); e != nil {
		t.Fatal(e)
	}
	if out, e := cloneCommand(context.Background(), "/usr/bin/git", cfg.Home, "", "init", path); e != nil {
		t.Fatalf("init %s %v", out, e)
	}
	entry := Discover(cfg).Entries[0]
	id := entry.WorkspaceID
	if id == "" {
		id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
	}
	var remote bool
	var created bool
	var nonEmpty bool
	var alternatePushURL bool
	var calls []string
	fail := ""
	run := func(ctx context.Context, program, home, fd string, args ...string) ([]byte, error) {
		cmd := strings.Join(args, " ")
		calls = append(calls, cmd)
		if program == "gh" {
			if cmd == "api --method GET /user" {
				return []byte(`{"id":` + cfg.Subject + `,"login":"owner"}`), nil
			}
			if strings.Contains(cmd, "/branches?") {
				if nonEmpty {
					return []byte(`[{"name":"main"}]`), nil
				}
				return []byte(`[]`), nil
			}
			if strings.Contains(cmd, "/repos/") {
				if created {
					return []byte(`{"full_name":"owner/project","private":true}`), nil
				}
				return nil, os.ErrNotExist
			}
			if fail == "create" {
				return nil, os.ErrPermission
			}
			created = true
			return []byte(`{"full_name":"owner/project","private":true}`), nil
		}
		if cmd == "status --porcelain" {
			return []byte(""), nil
		}
		if strings.HasPrefix(cmd, "rev-parse --verify") {
			return nil, os.ErrNotExist
		}
		if strings.Contains(cmd, "remote get-url --push") {
			if alternatePushURL {
				return []byte("https://github.com/owner/other.git\n"), nil
			}
			return []byte("https://github.com/owner/project.git\n"), nil
		}
		if strings.Contains(cmd, "remote get-url") {
			if remote {
				return []byte("https://github.com/owner/project.git\n"), nil
			}
			return nil, os.ErrNotExist
		}
		if cmd == "remote" {
			return []byte(""), nil
		}
		if strings.Contains(cmd, "remote add") {
			if fail == "origin" {
				return nil, os.ErrPermission
			}
			remote = true
			return nil, nil
		}
		if strings.Contains(cmd, "push") {
			if fail == "push" {
				return nil, os.ErrPermission
			}
			return nil, nil
		}
		return nil, os.ErrInvalid
	}
	handler := repoPublishHandler(cfg, func(*http.Request) bool { return true }, cfg.Home, "gh", "git", run)
	send := func(method string, input any) (int, map[string]any) {
		t.Helper()
		var r *http.Request
		if method == "GET" {
			r = httptest.NewRequest("GET", "http://unix"+RepoPublishPath+"?workspace_id="+id+"&full_name=owner%2Fproject&visibility=private", nil)
		} else {
			b, _ := json.Marshal(input)
			r = httptest.NewRequest("POST", "http://unix"+RepoPublishPath, bytes.NewReader(b))
			r.Header.Set("Content-Type", "application/json")
		}
		r.RequestURI = r.URL.RequestURI()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var v map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &v)
		return w.Code, v
	}
	for _, stage := range []string{"create", "origin", "push"} {
		if stage == "push" {
			alternatePushURL = true
			if code, _ := send("GET", nil); code != 409 {
				t.Fatalf("alternate push destination admitted: %d", code)
			}
			alternatePushURL = false
		}
		if stage == "origin" {
			nonEmpty = true
			if code, _ := send("GET", nil); code != 409 {
				t.Fatalf("unrelated existing repository admitted: %d", code)
			}
			nonEmpty = false
		}
		status, v := send("GET", nil)
		if status != 200 || v["stage"] != stage {
			t.Fatalf("observation %s %d %v", stage, status, v)
		}
		token := v["observation_token"].(string)
		body := map[string]any{"workspace_id": id, "full_name": "owner/project", "visibility": "private", "action": stage, "confirmation": "wrong", "observation_token": token}
		before := len(calls)
		if s, _ := send("POST", body); s != 400 || len(calls) != before {
			t.Fatalf("mismatch mutated %d", s)
		}
		body["confirmation"] = "owner/project"
		body["observation_token"] = "invalid_token"
		if s, _ := send("POST", body); s != 409 {
			t.Fatalf("stale: %d", s)
		}
		body["observation_token"] = token
		fail = stage
		if s, _ := send("POST", body); s != 409 {
			t.Fatalf("%s failure should be uncertain: %d", stage, s)
		}
		if s, _ := send("POST", body); s != 409 {
			t.Fatalf("%s failed mutation replay: %d", stage, s)
		}
		fail = ""
		status, v = send("GET", nil)
		if status != 200 || v["stage"] != stage {
			t.Fatalf("%s fresh observation: %d %v", stage, status, v)
		}
		body["observation_token"] = v["observation_token"]
		if s, _ := send("POST", body); s != 200 {
			t.Fatalf("%s: %d", stage, s)
		}
		if s, _ := send("POST", body); s != 409 {
			t.Fatalf("replay %s: %d", stage, s)
		}
	}
	denied := repoPublishHandler(cfg, func(*http.Request) bool { return false }, cfg.Home, "gh", "git", run)
	r := httptest.NewRequest("GET", "http://unix"+RepoPublishPath+"?workspace_id="+id+"&full_name=owner%2Fproject&visibility=private", nil)
	w := httptest.NewRecorder()
	denied.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("cross user: %d", w.Code)
	}
	slow := repoPublishHandler(cfg, func(*http.Request) bool { return true }, cfg.Home, "gh", "git", func(ctx context.Context, program, home, fd string, args ...string) ([]byte, error) {
		if program == "gh" && strings.Join(args, " ") == "api --method GET /user" {
			time.Sleep(120 * time.Millisecond)
		}
		return run(ctx, program, home, fd, args...)
	})
	srv := httptest.NewUnstartedServer(slow)
	srv.Config.WriteTimeout = 50 * time.Millisecond
	srv.Start()
	defer srv.Close()
	request, e := http.NewRequest("GET", srv.URL+RepoPublishPath+"?workspace_id="+id+"&full_name=owner%2Fproject&visibility=private", nil)
	if e != nil {
		t.Fatal(e)
	}
	request.Host = "unix"
	response, e := srv.Client().Do(request)
	if e != nil {
		t.Fatalf("native response lost after short server deadline: %v", e)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatalf("native response after short server deadline: %d", response.StatusCode)
	}
}
