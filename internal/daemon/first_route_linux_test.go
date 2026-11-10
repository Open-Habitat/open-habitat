//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// The mark lives in the person's own home: reading creates nothing, finishing
// is kept across readers, and another home is untouched.
func TestFirstRouteMarkIsThePersonsOwnState(t *testing.T) {
	home, other := t.TempDir(), t.TempDir()
	if done, err := readFirstRoute(home); err != nil || done {
		t.Fatal("fresh home", done, err)
	}
	if _, err := os.Stat(filepath.Join(home, ".local")); !os.IsNotExist(err) {
		t.Fatal("read created state")
	}
	for range 2 {
		if err := finishFirstRoute(home); err != nil {
			t.Fatal(err)
		}
	}
	if done, err := readFirstRoute(home); err != nil || !done {
		t.Fatal("finished route", done, err)
	}
	if done, err := readFirstRoute(other); err != nil || done {
		t.Fatal("other person", done, err)
	}
	st, err := os.Stat(filepath.Join(home, ".local/state/open-habitat/first-route-finished"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatal(st, err)
	}
}

// A link at any level is neither followed nor taken as the mark.
func TestFirstRouteMarkRefusesLinks(t *testing.T) {
	for _, location := range []string{".local", ".local/state/open-habitat", ".local/state/open-habitat/first-route-finished"} {
		t.Run(location, func(t *testing.T) {
			home, outside := t.TempDir(), t.TempDir()
			target := filepath.Join(outside, "target")
			if err := os.WriteFile(target, nil, 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(filepath.Dir(filepath.Join(home, location)), 0700); err != nil {
				t.Fatal(err)
			}
			link := outside
			if strings.HasSuffix(location, "finished") {
				link = target
			}
			if err := os.Symlink(link, filepath.Join(home, location)); err != nil {
				t.Fatal(err)
			}
			if done, err := readFirstRoute(home); err == nil || done {
				t.Fatal("read followed a link", done)
			}
			if err := finishFirstRoute(home); err == nil {
				t.Fatal("finish followed a link")
			}
			if entries, _ := os.ReadDir(outside); len(entries) != 1 {
				t.Fatal("wrote outside the home")
			}
		})
	}
}

func TestFirstRouteHTTPBoundary(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	trusted := true
	handler := FirstRouteHandler(cfg, func(*http.Request) bool { return trusted })
	call := func(method, suffix, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+FirstRoutePath+suffix, strings.NewReader(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	finished := func(w *httptest.ResponseRecorder) bool {
		var v struct {
			Finished *bool  `json:"finished"`
			Identity string `json:"web_identity_id"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || v.Finished == nil || !strings.HasPrefix(v.Identity, "wid_") {
			t.Fatal(w.Code, w.Body.String())
		}
		return *v.Finished
	}
	for _, tc := range []struct{ method, suffix, body string }{
		{"GET", "?uid=123", ""}, {"POST", "", `{"finished":true}`},
		{"PUT", "", `{"finished":false}`}, {"PUT", "", `{}`},
		{"PUT", "", `{"finished":true,"path":"/home/x"}`}, {"PUT", "", `{"finished":true} {}`},
	} {
		if w := call(tc.method, tc.suffix, tc.body); w.Code != 400 {
			t.Fatalf("%+v: %d", tc, w.Code)
		}
	}
	if finished(call("GET", "", "")) {
		t.Fatal("unfinished route read as finished")
	}
	if !finished(call("PUT", "", `{"finished":true}`)) || !finished(call("GET", "", "")) {
		t.Fatal("finish not kept")
	}
	trusted = false
	if w := call("GET", "", ""); w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}
