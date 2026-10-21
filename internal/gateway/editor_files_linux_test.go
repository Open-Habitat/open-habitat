//go:build linux

package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEditorFilesRelayIsSessionBoundAndLimited(t *testing.T) {
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("X-Unix-User") != "" || r.Header.Get("Cookie") != "" {
			t.Error("browser routing authority forwarded")
		}
		b, e := io.ReadAll(r.Body)
		if e != nil {
			t.Error(e)
		}
		w.Header().Set("Content-Type", "application/json")
		if r.Method == "PUT" && len(b) != 100000 {
			t.Error("body was truncated", len(b))
		}
		w.Write([]byte(`{}`))
	}))
	call := func(method, target, body, csrf, origin string) int {
		r := httptest.NewRequest(method, "https://host.test"+target, strings.NewReader(body))
		r.RequestURI = target
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("X-Unix-User", "other")
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-Agent-Host-CSRF", csrf)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code == 200 && w.Header().Get("Cache-Control") != "no-store" {
			t.Error("cacheable file")
		}
		return w.Code
	}
	p := editorFilesPrefix + "file"
	if s := call("PUT", p, strings.Repeat("x", 100000), "token", "https://host.test"); s != 200 {
		t.Fatal(s)
	}
	if s := call("PUT", p, strings.Repeat("x", 100000), "", "https://host.test"); s != 403 {
		t.Fatal(s)
	}
	if s := call("PUT", p, strings.Repeat("x", 100000), "token", "https://other.test"); s != 403 {
		t.Fatal(s)
	}
	for _, target := range []string{p + "?workspace_id=a&path=x&path=y", p + "?workspace_id=a&path=x&uid=2", editorFilesPrefix + "unknown?workspace_id=a&path=x"} {
		if s := call("GET", target, "", "", ""); s != 400 {
			t.Fatal(target, s)
		}
	}
	if s := call("PUT", p, strings.Repeat("x", (8<<20)+1), "token", "https://host.test"); s != 400 {
		t.Fatal(s)
	}
	if s := call("GET", p+"?workspace_id=other&path=x", "", "", ""); s != 200 {
		t.Fatal(s)
	}
	if calls != 2 {
		t.Fatal("rejected request reached daemon", calls)
	}
}
