//go:build linux

package daemon

import (
	"net/http"
	"net/url"
)

func observePublishQuery(r *http.Request, in *struct {
	WorkspaceID      string `json:"workspace_id"`
	FullName         string `json:"full_name"`
	Visibility       string `json:"visibility,omitempty"`
	Action           string `json:"action,omitempty"`
	Confirmation     string `json:"confirmation,omitempty"`
	ObservationToken string `json:"observation_token,omitempty"`
}) (string, bool) {
	q, e := url.ParseQuery(r.URL.RawQuery)
	if e != nil || len(q) != 3 || len(q["workspace_id"]) != 1 || len(q["full_name"]) != 1 || len(q["visibility"]) != 1 {
		return "", false
	}
	in.WorkspaceID = q.Get("workspace_id")
	in.FullName = q.Get("full_name")
	in.Visibility = q.Get("visibility")
	expected := RepoPublishPath + "?workspace_id=" + url.QueryEscape(in.WorkspaceID) + "&full_name=" + url.QueryEscape(in.FullName) + "&visibility=" + url.QueryEscape(in.Visibility)
	return expected, r.RequestURI == expected
}
