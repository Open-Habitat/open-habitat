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
)

// Row states. A runtime entry is admitted or withdrawn; allowed and joined
// say whether an admitted id has a committed binding. removed is only a
// withdraw reply: the never-bound entry was deleted and leaves nothing.
const (
	StateAllowed   = "allowed"
	StateJoined    = "joined"
	StateWithdrawn = "withdrawn"
	StateRemoved   = "removed"
)

// MaxRuntimeAdmission bounds what a compromised gateway can mint.
const MaxRuntimeAdmission = 256

// AccessPageSize keeps a list page inside one broker frame.
const AccessPageSize = 15

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
}

// AccessPage answers access_list, access_read, admit and withdraw. Mode is the
// broker's admission mode; RuntimeAdmission is root's switch.
type AccessPage struct {
	Mode             string      `json:"mode"`
	RuntimeAdmission bool        `json:"runtime_admission"`
	Rows             []AccessRow `json:"rows"`
}

func accessOperation(op string) bool {
	return op == "admit" || op == "withdraw" || op == "access_list" || op == "access_read"
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
	switch r.Operation {
	case "access_list":
		if r.ID != "0" || present("login_hint") || present("actor") || present("candidate") && !numericOffset(r.Candidate) {
			return Request{}, ErrInvalid
		}
	case "access_read":
		if !numericID(r.ID) || present("candidate") || present("login_hint") || present("actor") {
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
	page, err := object(raw["access"], "mode", "runtime_admission", "rows")
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
		fields, err := object(row, "id", "source", "state", "username", "login_hint", "actor", "at")
		if err != nil || json.Unmarshal(row, &x) != nil || !validAccessRow(x, fields) || seen[x.ID] {
			return Reply{}, ErrInvalid
		}
		seen[x.ID] = true
	}
	return r, nil
}
