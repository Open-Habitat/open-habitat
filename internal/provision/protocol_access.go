package provision

import (
	"encoding/json"
	"time"
)

// Admission has two sources (ADR 0030). The operator source is root's
// site.json, published by host apply; the site_admin source is runtime
// entries that only admit and withdraw on the gateway socket write. The
// effective admission is their union. These operations never create an
// account: that stays with ensure at the person's own login.
const (
	SourceOperator  = "operator"
	SourceSiteAdmin = "site_admin"
	// SourceTeam is a row only a team membership names: the gateway observed
	// the person as an active member of a listed team at a sign-in.
	SourceTeam = "team"
)

// Row states. A runtime entry is admitted or withdrawn; allowed and joined
// say whether an admitted id has a committed binding. removed is only a
// withdraw reply: the never-bound entry was deleted and leaves nothing.
const (
	StateAllowed   = "allowed"
	StateJoined    = "joined"
	StateWithdrawn = "withdrawn"
	StateRemoved   = "removed"
	// A team row the broker no longer admits: the latest sign-in found the
	// person in no listed team (left), or GitHub did not answer for a team
	// the person was in (unconfirmed).
	StateLeft        = "left"
	StateUnconfirmed = "unconfirmed"
)

// MaxRuntimeAdmission bounds what a compromised gateway can mint.
const MaxRuntimeAdmission = 256

// MaxTeams bounds the team source and MaxTeamMembers the member records a
// compromised gateway could mint through sign-in observations.
const (
	MaxTeams       = 8
	MaxTeamMembers = 256
)

// AccessPageSize keeps a list page inside one broker frame, with every row
// carrying the most team ids it can.
const AccessPageSize = 8

// AccessRow is one admitted or withdrawn id. LoginHint, Actor and At are
// provenance the gateway supplied and the broker stamped; actor is the
// gateway's word about who asked, not proof.
type AccessRow struct {
	ID        string `json:"id"`
	Source    string `json:"source"`
	State     string `json:"state"`
	Username  string `json:"username,omitempty"`
	LoginHint string `json:"login_hint,omitempty"`
	Actor     string `json:"actor,omitempty"`
	At        string `json:"at,omitempty"`
	// TeamState and Teams are the person's member record when one exists:
	// member, left or unconfirmed, and the pinned team ids last confirmed.
	TeamState string   `json:"team_state,omitempty"`
	Teams     []string `json:"teams,omitempty"`
}

// TeamRow is one listed team. OrgID and Org come from GitHub's public
// organisation API at addition; TeamID once a member check pinned it.
type TeamRow struct {
	OrgID         string `json:"org_id"`
	Org           string `json:"org"`
	Slug          string `json:"slug"`
	TeamID        string `json:"team_id,omitempty"`
	Actor         string `json:"actor"`
	At            string `json:"at"`
	UnavailableAt string `json:"unavailable_at,omitempty"`
}

// TeamObservation is the gateway's answer, at one sign-in, for one listed
// team: active, none (not an active member) or unknown (GitHub did not
// answer). TeamID is the team the slug resolved to inside OrgID.
type TeamObservation struct {
	OrgID  string `json:"org_id"`
	Slug   string `json:"slug"`
	TeamID string `json:"team_id,omitempty"`
	State  string `json:"state"`
}

// AccessPage answers access_list, access_read, admit and withdraw. Mode is the
// broker's admission mode; RuntimeAdmission is root's switch.
type AccessPage struct {
	Mode             string      `json:"mode"`
	RuntimeAdmission bool        `json:"runtime_admission"`
	Rows             []AccessRow `json:"rows"`
	// Teams is the team source; only team_list, team_add and team_remove
	// carry it.
	Teams []TeamRow `json:"teams,omitempty"`
}

// Team source operations. team_sign_in records what one sign-in observed;
// forget drops a member record that no longer admits.
const (
	OpTeamList   = "team_list"
	OpTeamAdd    = "team_add"
	OpTeamRemove = "team_remove"
	OpTeamSignIn = "team_sign_in"
	OpForget     = "forget"
)

func accessOperation(op string) bool {
	switch op {
	case "admit", "withdraw", "access_list", "access_read", OpTeamList, OpTeamAdd, OpTeamRemove, OpTeamSignIn, OpForget:
		return true
	}
	return false
}

// teamSlug is GitHub's team slug: lowercase letters, digits, hyphens and
// underscores, bounded for the admission file.
func teamSlug(s string) bool {
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

func validTeamRow(t TeamRow) bool {
	return numericID(t.OrgID) && githubLogin(t.Org) && teamSlug(t.Slug) && (t.TeamID == "" || numericID(t.TeamID)) && validActor(t.Actor) && validStamp(t.At) && (t.UnavailableAt == "" || validStamp(t.UnavailableAt))
}

// validActor is a canonical GitHub id from a browser administrator's session
// or the literal root for the root-local control socket.
func validActor(s string) bool { return s == "root" || numericID(s) }

func validStamp(s string) bool {
	t, err := time.Parse(time.RFC3339, s)
	return err == nil && t.UTC().Format(time.RFC3339) == s
}

func parseAccessRequest(raw map[string]json.RawMessage, r Request) (Request, error) {
	present := func(k string) bool { _, ok := raw[k]; return ok }
	if r.Version != 1 || r.Provider != "github" || present("default_limit_bytes") || present("limit_bytes") {
		return Request{}, ErrInvalid
	}
	if present("slug") != (r.Operation == OpTeamAdd || r.Operation == OpTeamRemove) || present("teams") != (r.Operation == OpTeamSignIn) {
		return Request{}, ErrInvalid
	}
	switch r.Operation {
	case "access_list":
		if r.ID != "0" || present("login_hint") || present("actor") || present("candidate") && !numericOffset(r.Candidate) {
			return Request{}, ErrInvalid
		}
	case "access_read":
		if !numericID(r.ID) || present("candidate") || present("login_hint") || present("actor") {
			return Request{}, ErrInvalid
		}
	case OpTeamList:
		if r.ID != "0" || present("candidate") || present("login_hint") || present("actor") {
			return Request{}, ErrInvalid
		}
	case OpTeamAdd:
		// id is the organisation's id, login_hint its login.
		if !numericID(r.ID) || present("candidate") || !githubLogin(r.LoginHint) || !teamSlug(r.Slug) || !validActor(r.Actor) {
			return Request{}, ErrInvalid
		}
	case OpTeamRemove:
		if !numericID(r.ID) || present("candidate") || present("login_hint") || !teamSlug(r.Slug) || !validActor(r.Actor) {
			return Request{}, ErrInvalid
		}
	case OpTeamSignIn:
		// No actor: the person's own sign-in is the occasion, not an
		// administrator.
		if !numericID(r.ID) || present("candidate") || present("actor") || !githubLogin(r.LoginHint) || r.Teams == nil || len(r.Teams) > MaxTeams {
			return Request{}, ErrInvalid
		}
		entries, err := checkArray(raw["teams"], "teams")
		if err != nil || len(entries) != len(r.Teams) {
			return Request{}, ErrInvalid
		}
		for _, entry := range entries {
			if _, err := object(entry, "org_id", "slug", "team_id", "state"); err != nil {
				return Request{}, ErrInvalid
			}
		}
		seen := map[string]bool{}
		for _, o := range r.Teams {
			key := o.OrgID + "/" + o.Slug
			if !numericID(o.OrgID) || !teamSlug(o.Slug) || o.TeamID != "" && !numericID(o.TeamID) || o.State != "active" && o.State != "none" && o.State != "unknown" || o.State == "active" && o.TeamID == "" || seen[key] {
				return Request{}, ErrInvalid
			}
			seen[key] = true
		}
	case OpForget:
		if !numericID(r.ID) || present("candidate") || present("login_hint") || !validActor(r.Actor) {
			return Request{}, ErrInvalid
		}
	case "admit":
		if !numericID(r.ID) || present("candidate") || !githubLogin(r.LoginHint) || !validActor(r.Actor) {
			return Request{}, ErrInvalid
		}
	case "withdraw":
		if !numericID(r.ID) || present("candidate") || present("login_hint") || !validActor(r.Actor) {
			return Request{}, ErrInvalid
		}
	}
	return r, nil
}

func validAccessRow(x AccessRow, fields map[string]json.RawMessage) bool {
	for _, k := range []string{"id", "source", "state"} {
		if len(fields[k]) == 0 || string(fields[k]) == "null" {
			return false
		}
	}
	if !numericID(x.ID) || x.Username != "" && !username(x.Username) {
		return false
	}
	_, hasTeams := fields["teams"]
	if x.TeamState == "" && hasTeams || x.TeamState != "" && x.TeamState != "member" && x.TeamState != "left" && x.TeamState != "unconfirmed" || len(x.Teams) > MaxTeams || x.TeamState == "member" && len(x.Teams) == 0 {
		return false
	}
	for _, t := range x.Teams {
		if !numericID(t) {
			return false
		}
	}
	if x.Source == SourceTeam {
		if x.State == StateRemoved {
			return x.Username == "" && x.LoginHint == "" && x.Actor == "" && x.At == "" && x.TeamState == ""
		}
		admitted := x.State == StateAllowed || x.State == StateJoined
		if !admitted && x.State != StateLeft && x.State != StateUnconfirmed || admitted && x.Username != "" != (x.State == StateJoined) {
			return false
		}
		return (x.TeamState == "member") == admitted && x.TeamState != "" && githubLogin(x.LoginHint) && x.Actor == "" && validStamp(x.At)
	}
	bound := x.State == StateJoined || x.State == StateWithdrawn
	if bound != (x.Username != "") {
		return false
	}
	provenance := x.LoginHint != "" || x.Actor != "" || x.At != ""
	switch x.Source {
	case SourceOperator:
		return (x.State == StateAllowed || x.State == StateJoined) && !provenance
	case SourceSiteAdmin:
		if x.State != StateAllowed && x.State != StateJoined && x.State != StateWithdrawn && x.State != StateRemoved {
			return false
		}
		if x.State == StateRemoved && !provenance {
			return true
		}
		return githubLogin(x.LoginHint) && validActor(x.Actor) && validStamp(x.At)
	}
	return false
}

func parseAccessReply(raw map[string]json.RawMessage, r Reply) (Reply, error) {
	if r.Access == nil || r.Route != nil || r.Users != nil || r.Quota != nil || r.Quotas != nil || r.Generation == 0 || r.Epoch == 0 || r.Next != "" && !numericOffset(r.Next) {
		return Reply{}, ErrInvalid
	}
	page, err := object(raw["access"], "mode", "runtime_admission", "rows", "teams")
	if err != nil || r.Access.Mode != "allowlist" && r.Access.Mode != "any" || len(page["runtime_admission"]) == 0 || string(page["runtime_admission"]) == "null" {
		return Reply{}, ErrInvalid
	}
	rows, err := checkArray(page["rows"], "rows")
	if err != nil || len(rows) > AccessPageSize {
		return Reply{}, ErrInvalid
	}
	seen := map[string]bool{}
	for _, row := range rows {
		var x AccessRow
		fields, err := object(row, "id", "source", "state", "username", "login_hint", "actor", "at", "team_state", "teams")
		if err != nil || json.Unmarshal(row, &x) != nil || !validAccessRow(x, fields) || seen[x.ID] {
			return Reply{}, ErrInvalid
		}
		seen[x.ID] = true
	}
	if len(page["teams"]) != 0 {
		teams, err := checkArray(page["teams"], "teams")
		if err != nil || len(teams) > MaxTeams {
			return Reply{}, ErrInvalid
		}
		keys := map[string]bool{}
		for _, raw := range teams {
			var t TeamRow
			if decode(raw, &t, "org_id", "org", "slug", "team_id", "actor", "at", "unavailable_at") != nil || !validTeamRow(t) || keys[t.OrgID+"/"+t.Slug] {
				return Reply{}, ErrInvalid
			}
			keys[t.OrgID+"/"+t.Slug] = true
		}
	}
	return r, nil
}
