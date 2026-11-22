//go:build linux

package daemon

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStartPageCheckBuffer(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	c.runtime = nil
	call := func(body, target, method string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, target, strings.NewReader(body))
		r.Host = "unix"
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.WorkspaceStartPageCheck().ServeHTTP(w, r)
		return w
	}
	request := func(workspace, content string) string {
		data, _ := json.Marshal(map[string]any{"schema_version": 1, "workspace_id": workspace, "content": content})
		return string(data)
	}
	for _, content := range []string{fixtureStartPage, fixtureStartPageNoGuide, "---\ntitle: Draft\ngoals: []\n---\nUnsaved body"} {
		w := call(request(h.workspace, content), WorkspaceStartPageCheckPath, "POST")
		var got struct {
			Valid bool       `json:"valid"`
			Page  *startPage `json:"page"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || !got.Valid {
			t.Fatalf("check: %d %s", w.Code, w.Body.String())
		}
		expected, _ := parseStartPageDocument([]byte(content))
		a, _ := json.Marshal(expected)
		b, _ := json.Marshal(got.Page)
		if string(a) != string(b) {
			t.Fatal("buffer and saved-page parser differ")
		}
	}
	for _, tc := range []struct{ content, code, path string }{
		{"---\ntitle: Draft\ngoals:\n  - title: Goal\n    when: Now\n    what: Work\n    steps: [Read]\n---\n", "invalid_goal_fields", "goals[0].prompt"},
		{"---\ntitle: Draft\nextra: rejected\n---\n", "invalid_frontmatter", ""},
		{strings.Repeat("é", 16385), "too_large", ""},
		{"ordinary markdown", "missing_frontmatter", ""},
		{"---\n---\n", "invalid_frontmatter", ""},
	} {
		w := call(request(h.workspace, tc.content), WorkspaceStartPageCheckPath, "POST")
		var got struct {
			Valid    bool               `json:"valid"`
			Problems []startPageProblem `json:"problems"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || got.Valid || len(got.Problems) != 1 || got.Problems[0].Code != tc.code || got.Problems[0].Path != tc.path {
			t.Fatalf("problem: %d %s", w.Code, w.Body.String())
		}
	}
	good := request(h.workspace, fixtureStartPage)
	for _, tc := range []struct {
		body, target, method string
		code                 int
	}{
		{good, WorkspaceStartPageCheckPath + "?x=1", "POST", 400},
		{good, WorkspaceStartPageCheckPath, "GET", 400},
		{strings.TrimSuffix(good, "}") + `,"path":"elsewhere"}`, WorkspaceStartPageCheckPath, "POST", 400},
		{strings.TrimSuffix(good, "}") + `,"schema_version":1}`, WorkspaceStartPageCheckPath, "POST", 400},
		{request("ws_example123", fixtureStartPage), WorkspaceStartPageCheckPath, "POST", 404},
		{request("../../other", fixtureStartPage), WorkspaceStartPageCheckPath, "POST", 400},
		{strings.Repeat(" ", maxStartPageCheckRequest+1), WorkspaceStartPageCheckPath, "POST", 400},
		{good + "{}", WorkspaceStartPageCheckPath, "POST", 400},
	} {
		if w := call(tc.body, tc.target, tc.method); w.Code != tc.code {
			t.Fatalf("route: %d want %d", w.Code, tc.code)
		}
	}
	if len(h.lines("launches.log")) != 0 {
		t.Fatal("check launched Pi")
	}
}
