package gateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// GitHubOrg is an organisation as GitHub's public API names it.
type GitHubOrg struct {
	ID, Login string
}

// LookupOrg resolves an organisation login through the public organisations
// API, authenticated as the OAuth app only for its rate limit.
func (g GitHubProvider) LookupOrg(ctx context.Context, org string) (GitHubOrg, error) {
	if !githubLoginName(org) {
		return GitHubOrg{}, ErrGitHubOrgNotFound
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, "GET", githubAPI+"/orgs/"+org, nil)
	if err != nil {
		return GitHubOrg{}, ErrGitHubLookup
	}
	req.SetBasicAuth(g.ClientID, g.ClientSecret)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := g.client().Do(req)
	if err != nil {
		return GitHubOrg{}, ErrGitHubLookup
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return GitHubOrg{}, ErrGitHubOrgNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return GitHubOrg{}, ErrGitHubLookup
	}
	var body struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
		Type  string      `json:"type"`
	}
	d := json.NewDecoder(io.LimitReader(resp.Body, 65536))
	d.UseNumber()
	if d.Decode(&body) != nil || !canonicalSubject(body.ID.String()) || !strings.EqualFold(body.Login, org) || !githubLoginName(body.Login) {
		return GitHubOrg{}, ErrGitHubLookup
	}
	if body.Type != "" && body.Type != "Organization" {
		return GitHubOrg{}, ErrGitHubOrgNotFound
	}
	return GitHubOrg{ID: body.ID.String(), Login: body.Login}, nil
}

// CheckTeam answers, with the signed-in person's transient token, whether
// login is an active member of one listed team: active, none or unknown. It
// is the only use of that token for admission; nothing is stored, logged or
// returned beyond the answer and the team id the slug resolved to.
//
// Only a definite answer is none: GitHub's 404 for the team membership when
// the person's own organisation membership confirms the organisation is the
// one listed (or that the person is not in it). Anything GitHub refuses or
// fails to answer, including an organisation's OAuth app restriction (403),
// is unknown, which never records leaving.
func (g GitHubProvider) CheckTeam(ctx context.Context, token, login string, t TeamSource) TeamObservation {
	o := TeamObservation{OrgID: t.OrgID, Slug: t.Slug, TeamID: t.TeamID, State: "unknown"}
	if token == "" || !githubLoginName(login) || !canonicalSubject(t.OrgID) || !githubLoginName(t.Org) || !teamSlugName(t.Slug) || t.TeamID != "" && !canonicalSubject(t.TeamID) {
		return o
	}
	get := func(path string, into any) int {
		req, err := http.NewRequestWithContext(ctx, "GET", githubAPI+path, nil)
		if err != nil {
			return 0
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Accept", "application/vnd.github+json")
		resp, err := g.client().Do(req)
		if err != nil {
			return 0
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			d := json.NewDecoder(io.LimitReader(resp.Body, 1<<20))
			d.UseNumber()
			if d.Decode(into) != nil {
				return 0
			}
		}
		return resp.StatusCode
	}
	// orgAnswer settles a team 404: none when the person's own membership
	// shows the listed organisation (or no membership at all), else unknown.
	orgAnswer := func() string {
		var m struct {
			State        string `json:"state"`
			Organization struct {
				ID json.Number `json:"id"`
			} `json:"organization"`
		}
		switch get("/user/memberships/orgs/"+url.PathEscape(t.Org), &m) {
		case http.StatusOK:
			if m.Organization.ID.String() == t.OrgID && (m.State == "active" || m.State == "pending") {
				return "none"
			}
		case http.StatusNotFound:
			return "none"
		}
		return "unknown"
	}
	if o.TeamID == "" {
		var team struct {
			ID           json.Number `json:"id"`
			Organization struct {
				ID json.Number `json:"id"`
			} `json:"organization"`
		}
		switch get("/orgs/"+url.PathEscape(t.Org)+"/teams/"+url.PathEscape(t.Slug), &team) {
		case http.StatusOK:
			if team.Organization.ID.String() != t.OrgID || !canonicalSubject(team.ID.String()) {
				return o
			}
			o.TeamID = team.ID.String()
		case http.StatusNotFound:
			// The person cannot see the team: settle by organisation.
			o.State = orgAnswer()
			return o
		default:
			return o
		}
	}
	var m struct {
		State string `json:"state"`
	}
	switch get("/organizations/"+t.OrgID+"/team/"+o.TeamID+"/memberships/"+url.PathEscape(login), &m) {
	case http.StatusOK:
		switch m.State {
		case "active":
			o.State = "active"
		case "pending":
			// An invitation not yet accepted is not membership.
			o.State = "none"
		}
	case http.StatusNotFound:
		o.State = orgAnswer()
	}
	return o
}
