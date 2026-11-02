package gateway

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"
)

// Team admission. An administrator lists a GitHub team; at each sign-in the
// gateway asks GitHub, with the person's own transient token, whether they
// are an active member of each listed team, and tells the broker what it
// observed before ensure. The broker owns the team source and the member
// records and decides admission from them, as it does for every other
// source; the gateway stores no credential and decides nothing itself.
// Leaving takes effect at the next sign-in: an open session is not ended,
// and Poista pääsy stays the immediate route.

// TeamSource is one listed team as the broker keeps it.
type TeamSource struct {
	OrgID, Org, Slug, TeamID, Actor, At, UnavailableAt string
}

// TeamObservation is one sign-in's answer for one listed team: active, none
// or unknown, and the team id the slug resolved to.
type TeamObservation struct {
	OrgID, Slug, TeamID, State string
}

// TeamBroker is the broker's team source. TeamSignIn returns
// ErrAccessUncertain when no definite reply arrived.
type TeamBroker interface {
	Teams(context.Context) ([]TeamSource, error)
	AddTeam(ctx context.Context, orgID, org, slug, actor string) ([]TeamSource, error)
	RemoveTeam(ctx context.Context, orgID, slug, actor string) ([]TeamSource, error)
	TeamSignIn(ctx context.Context, id, login string, observed []TeamObservation) error
	Forget(ctx context.Context, id, actor string) (AccessRow, error)
}

// TeamChecker asks GitHub about one person's membership with their token.
type TeamChecker interface {
	CheckTeam(ctx context.Context, token, login string, t TeamSource) TeamObservation
}

// OrgDirectory resolves an organisation login to its numeric id.
type OrgDirectory interface {
	LookupOrg(context.Context, string) (GitHubOrg, error)
}

var (
	ErrGitHubOrgNotFound = errors.New("github organisation not found")
	errInvalidTeam       = errors.New("invalid team")
)

func (a *Auth) teamBroker() (TeamBroker, bool) {
	b, ok := a.broker.(TeamBroker)
	return b, ok
}

// teamSlugName is GitHub's team slug grammar as the broker accepts it.
func teamSlugName(s string) bool {
	if len(s) < 1 || len(s) > 64 || s[0] == '-' || s[len(s)-1] == '-' {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// parseTeam reads organisation/team, as typed or pasted from the team's
// GitHub address. GitHub slugs are lowercase; a team's display name with
// spaces is not its slug and is refused rather than guessed.
func parseTeam(raw string) (org, slug string, ok bool) {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "@")
	if u, err := url.Parse(s); err == nil && (u.Scheme == "https" || u.Scheme == "http") && strings.EqualFold(u.Host, "github.com") {
		parts := strings.Split(strings.Trim(u.Path, "/"), "/")
		if len(parts) != 4 || parts[0] != "orgs" || parts[2] != "teams" {
			return "", "", false
		}
		s = parts[1] + "/" + parts[3]
	}
	org, slug, found := strings.Cut(s, "/")
	slug = strings.ToLower(slug)
	if !found || !githubLoginName(org) || !teamSlugName(slug) {
		return "", "", false
	}
	return org, slug, true
}

// signInTeams asks GitHub about every listed team and tells the broker
// before ensure. unavailable reports that GitHub did not answer for some
// team. ok is false when the broker's answer is missing: a member record
// from an earlier sign-in could then admit without this sign-in's answer,
// so the sign-in must stop. A definite refusal (the switch is off, the
// records are full) recorded nothing and leaves admission to ensure.
func (a *Auth) signInTeams(ctx context.Context, attempt, id, login, token string) (unavailable, ok bool) {
	broker, isTeam := a.teamBroker()
	checker, canCheck := a.provider.(TeamChecker)
	if !isTeam {
		return false, true
	}
	teams, err := broker.Teams(ctx)
	if err != nil {
		a.authEvent(attempt, "rejected", "team_source_unavailable")
		return false, false
	}
	if len(teams) == 0 {
		return false, true
	}
	// One deadline for every team, so a slow GitHub delays a sign-in by
	// seconds however many teams are listed.
	checkCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	observed := make([]TeamObservation, 0, len(teams))
	for _, t := range teams {
		o := TeamObservation{OrgID: t.OrgID, Slug: t.Slug, TeamID: t.TeamID, State: "unknown"}
		if canCheck {
			o = checker.CheckTeam(checkCtx, token, login, t)
		}
		unavailable = unavailable || o.State == "unknown"
		observed = append(observed, o)
	}
	cancel()
	if unavailable {
		a.authEvent(attempt, "degraded", "team_membership_unavailable")
	}
	err = broker.TeamSignIn(ctx, id, login, observed)
	switch {
	case err == nil:
	case errors.Is(err, ErrAccessUncertain), errors.Is(err, errBrokerRead):
		a.authEvent(attempt, "rejected", "team_record_uncertain")
		return unavailable, false
	default:
		a.authEvent(attempt, "degraded", "team_record_refused")
	}
	return unavailable, true
}

// teamView is one listed team on the access page.
type teamView struct {
	OrgID         string `json:"org_id"`
	Org           string `json:"org"`
	Slug          string `json:"slug"`
	Pinned        bool   `json:"pinned"`
	Actor         string `json:"actor"`
	At            string `json:"at"`
	UnavailableAt string `json:"unavailable_at,omitempty"`
}

func teamViews(teams []TeamSource) []teamView {
	out := make([]teamView, 0, len(teams))
	for _, t := range teams {
		out = append(out, teamView{t.OrgID, t.Org, t.Slug, t.TeamID != "", t.Actor, t.At, t.UnavailableAt})
	}
	return out
}

// teamNames maps a pinned team id to organisation/slug for the page.
func teamNames(teams []TeamSource, ids []string) []string {
	if len(ids) == 0 {
		return nil
	}
	out := []string{}
	for _, id := range ids {
		for _, t := range teams {
			if t.TeamID == id {
				out = append(out, t.Org+"/"+t.Slug)
			}
		}
	}
	return out
}

// addTeam lists organisation/team as an admission source. The organisation
// id comes from GitHub's public API; the team's own id is pinned by the
// first member check, since only a member's token can read it.
func (a *Auth) addTeam(ctx context.Context, caller, raw string) ([]TeamSource, error) {
	org, slug, ok := parseTeam(raw)
	if !ok {
		return nil, errInvalidTeam
	}
	broker, isTeam := a.teamBroker()
	if !isTeam {
		return nil, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return nil, errAdminDenied
	}
	directory, ok := a.provider.(OrgDirectory)
	if !ok {
		return nil, ErrGitHubLookup
	}
	found, err := directory.LookupOrg(ctx, org)
	if err != nil {
		return nil, err
	}
	teams, err := broker.AddTeam(ctx, found.ID, found.Login, slug, actorFor(caller))
	if err != nil {
		return nil, err
	}
	a.log.Info("access_team", "outcome", "accepted", "reason", "added")
	return teams, nil
}

// removeTeam ends what a team gives at each member's next sign-in, without
// calling anyone a leaver. Open sessions are left as leaving leaves them.
func (a *Auth) removeTeam(ctx context.Context, caller, orgID, slug string) ([]TeamSource, error) {
	if !canonicalSubject(orgID) || !teamSlugName(slug) {
		return nil, errInvalidTeam
	}
	broker, isTeam := a.teamBroker()
	if !isTeam {
		return nil, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return nil, errAdminDenied
	}
	teams, err := broker.RemoveTeam(ctx, orgID, slug, actorFor(caller))
	if err != nil {
		return nil, err
	}
	a.log.Info("access_team", "outcome", "accepted", "reason", "removed")
	return teams, nil
}

// forgetMember dismisses a leaver's notice: the member record that no
// longer admits goes. Rejoining the team admits again at a sign-in.
func (a *Auth) forgetMember(ctx context.Context, caller, subject string) (AccessRow, error) {
	if !canonicalSubject(subject) {
		return AccessRow{}, errors.New("invalid subject")
	}
	broker, isTeam := a.teamBroker()
	if !isTeam {
		return AccessRow{}, errBrokerRead
	}
	a.accessMu.Lock()
	defer a.accessMu.Unlock()
	if caller != "" && !a.isAdministrator(caller) {
		return AccessRow{}, errAdminDenied
	}
	return broker.Forget(ctx, subject, actorFor(caller))
}
