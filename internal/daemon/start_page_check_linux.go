//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/jsoncheck"
)

const WorkspaceStartPageCheckPath = "/api/v1/workspaces/start_page/check"

// JSON escaping can expand each content byte sixfold.
const maxStartPageCheckRequest = 6*32*1024 + 1024

type startPageProblem struct {
	Code string `json:"code"`
	Path string `json:"path"`
}

// Check only the supplied buffer. Admission is the usual workspace proof;
// neither the saved page nor Pi is read or changed.
func (c *ConversationController) WorkspaceStartPageCheck() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(c.cfg, c.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != WorkspaceStartPageCheckPath || r.RequestURI != WorkspaceStartPageCheckPath || r.ContentLength < 2 || r.ContentLength > maxStartPageCheckRequest || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, maxStartPageCheckRequest+1))
		var in struct {
			SchemaVersion int     `json:"schema_version"`
			WorkspaceID   string  `json:"workspace_id"`
			Content       *string `json:"content"`
		}
		dec := json.NewDecoder(bytes.NewReader(body))
		dec.DisallowUnknownFields()
		if err != nil || int64(len(body)) != r.ContentLength || !utf8.Valid(body) || !jsoncheck.NoDuplicates(body) || dec.Decode(&in) != nil || dec.Decode(new(any)) != io.EOF || in.SchemaVersion != 1 || !idPattern.MatchString(in.WorkspaceID) || in.Content == nil {
			snapshotError(w, 400, "invalid_request")
			return
		}
		ws, _, err := c.workspaceFD(in.WorkspaceID)
		if err != nil {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		ws.Close()
		page, problem := parseStartPageDocument([]byte(*in.Content))
		if problem != nil {
			historyJSON(w, map[string]any{"schema_version": 1, "valid": false, "problems": []*startPageProblem{problem}})
		} else {
			historyJSON(w, map[string]any{"schema_version": 1, "valid": true, "page": page})
		}
	})
}
