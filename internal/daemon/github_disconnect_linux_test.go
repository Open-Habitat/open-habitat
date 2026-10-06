//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/maintainer/native-agent-host/internal/nativegh"
)

func TestNativeDisconnectPeerAndFreshLogin(t *testing.T) {
	cfg, _ := cloneFixture(t)
	adapter, e := nativegh.New(cfg.Home, cfg.Subject, nil, nil)
	if e != nil {
		t.Fatal(e)
	}
	req := httptest.NewRequest("GET", "http://unix"+RepoDisconnectPath, nil)
	req.RequestURI = RepoDisconnectPath
	req.Header.Set("X-Agent-Host-Recent-Login", "1")
	w := httptest.NewRecorder()
	RepoDisconnectHandler(cfg, func(*http.Request) bool { return false }, adapter).ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatalf("foreign peer: %d", w.Code)
	}
	req.Header.Del("X-Agent-Host-Recent-Login")
	w = httptest.NewRecorder()
	RepoDisconnectHandler(cfg, func(*http.Request) bool { return true }, adapter).ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatalf("no fresh OAuth attestation: %d", w.Code)
	}
}
