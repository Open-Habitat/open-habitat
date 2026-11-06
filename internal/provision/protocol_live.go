package provision

import (
	"encoding/json"

	"github.com/Open-Habitat/open-habitat/internal/livelimits"
)

// Limits on conversations working at once (live-conversation-limit-admin).
// On the gateway's request the broker writes root's live-limits file, which
// every person's daemon reads for its own UID. The gateway names a person by
// provider subject only; the broker resolves the committed binding's UID, so
// no request selects a UID. ID "0" is the installation's limit.
const (
	OpLiveLimitList  = "live_limit_list"
	OpLiveLimitSet   = "live_limit_set"
	OpLiveLimitClear = "live_limit_clear"
)

// LiveLimitPerson is one person's exception.
type LiveLimitPerson struct {
	ID    string `json:"id"`
	Limit int    `json:"limit"`
}

// LiveLimitPage answers every live-limit operation. Default 0 means the
// installation has no limit of its own and each daemon uses
// livelimits.HostDefault. People holds only committed bindings' exceptions.
type LiveLimitPage struct {
	Default int               `json:"default"`
	People  []LiveLimitPerson `json:"people"`
}

func liveOperation(op string) bool {
	return op == OpLiveLimitList || op == OpLiveLimitSet || op == OpLiveLimitClear
}

func parseLiveRequest(raw map[string]json.RawMessage, r Request) (Request, error) {
	present := func(k string) bool { _, ok := raw[k]; return ok }
	for _, k := range []string{"candidate", "default_limit_bytes", "limit_bytes", "login_hint", "actor", "fields", "slug", "teams"} {
		if present(k) {
			return Request{}, ErrInvalid
		}
	}
	if r.Version != 1 || r.Provider != "github" || r.ID != "0" && !numericID(r.ID) {
		return Request{}, ErrInvalid
	}
	switch r.Operation {
	case OpLiveLimitList, OpLiveLimitClear:
		if present("live_limit") || r.Operation == OpLiveLimitList && r.ID != "0" {
			return Request{}, ErrInvalid
		}
	case OpLiveLimitSet:
		if r.LiveLimit == nil || !livelimits.Valid(*r.LiveLimit) {
			return Request{}, ErrInvalid
		}
	}
	return r, nil
}

func parseLiveReply(raw map[string]json.RawMessage, r Reply) (Reply, error) {
	if r.LiveLimits == nil || r.Route != nil || r.Users != nil || r.Quota != nil || r.Quotas != nil || r.Access != nil || r.Integrations != nil || r.Generation != 0 || r.Epoch != 0 || r.Next != "" {
		return Reply{}, ErrInvalid
	}
	page, err := object(raw["live_limits"], "default", "people")
	if err != nil || len(page["default"]) == 0 || r.LiveLimits.Default != 0 && !livelimits.Valid(r.LiveLimits.Default) {
		return Reply{}, ErrInvalid
	}
	people, err := checkArray(page["people"], "people")
	if err != nil || len(people) > livelimits.MaxPeople {
		return Reply{}, ErrInvalid
	}
	seen := map[string]bool{}
	for _, p := range people {
		var x LiveLimitPerson
		if decode(p, &x, "id", "limit") != nil || !numericID(x.ID) || !livelimits.Valid(x.Limit) || seen[x.ID] {
			return Reply{}, ErrInvalid
		}
		seen[x.ID] = true
	}
	return r, nil
}
