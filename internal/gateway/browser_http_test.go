//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Every previously HTTP/1.1-only browser route must reach authentication over
// HTTP/2, while retaining its request-shape refusal and legacy protocol refusal.
func TestBrowserRoutesHTTP2(t *testing.T) {
	_, a, _, _, _ := fixture(t)
	for _, tc := range []struct {
		method, path, body string
		handler            http.HandlerFunc
	}{
		{"GET", githubReposPath, "", a.githubRepos},
		{"GET", githubObservePath + "?full_name=org%2Frepo", "", a.githubObserve},
		{"GET", githubClonesPath, "", a.githubClones},
		{"POST", "/api/v1/workspaces", "{}", a.workspaces},
		{"GET", "/api/v1/workspaces/github/publish?workspace_id=x&full_name=org%2Frepo&visibility=private", "", a.githubPublish},
		{"GET", accountPreferencesPath, "", a.personalSetting(accountPreferencesPath)},
		{"GET", firstRoutePath, "", a.personalSetting(firstRoutePath)},
		{"POST", accountKeysPath, `{"kind":"ssh"}`, a.accountKeys},
		{"POST", storageBreakdownPath, `{"measure":true}`, a.storageBreakdown},
		{"POST", ownMachinesPath, `{"action":"connect"}`, a.ownMachines},
		{"GET", editorFilesPrefix + "list?workspace_id=x&path=", "", a.editorFiles},
		{"GET", terminalsPath + "?workspace_id=" + "ws_" + strings.Repeat("a", 24), "", a.terminalList},
		{"POST", terminalClosePath, "{}", a.terminalClose},
		{"GET", "/api/v1/workspaces/git?workspace_id=" + "ws_" + strings.Repeat("a", 24), "", a.workspaceGit},
		{"POST", "/api/v1/workspaces/git/fetch", "{}", a.workspaceGitFetch},
		{"GET", workspaceCommandsPath + "?workspace_id=" + "ws_" + strings.Repeat("a", 24), "", a.workspaceComposerRead},
	} {
		t.Run(tc.path, func(t *testing.T) {
			for _, protocol := range []struct{ major, minor, want int }{{1, 1, 401}, {2, 0, 401}, {1, 0, 400}, {3, 0, 400}} {
				r := httptest.NewRequest(tc.method, "https://host.test"+tc.path, strings.NewReader(tc.body))
				r.RequestURI = r.URL.RequestURI()
				r.ProtoMajor, r.ProtoMinor = protocol.major, protocol.minor
				if tc.body != "" {
					r.Header.Set("Content-Type", "application/json")
				}
				w := httptest.NewRecorder()
				tc.handler(w, r)
				if w.Code != protocol.want {
					t.Fatalf("protocol %d.%d status=%d want=%d body=%s", protocol.major, protocol.minor, w.Code, protocol.want, w.Body.String())
				}
				if protocol.major == 2 {
					r.TransferEncoding = []string{"chunked"}
					w = httptest.NewRecorder()
					tc.handler(w, r)
					if w.Code != 400 {
						t.Fatalf("transfer encoding accepted: %d", w.Code)
					}
				}
			}
		})
	}
}
