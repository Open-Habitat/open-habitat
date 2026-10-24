package provision

import (
	"encoding/json"
	"regexp"
	"slices"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

// Integration app registrations (server-integrations-admin). On the gateway's
// request the broker writes one provider's section of root's
// /opt/open-habitat/integrations.json, the file every person's daemon reads.
// A secret enters only in a set request and never leaves in a reply.
const (
	OpIntegrationList  = "integration_list"
	OpIntegrationSet   = "set_integration_app"
	OpIntegrationClear = "clear_integration_app"
)

// Definite integration refusals: nothing was written.
const (
	// BrowserSetupOff is root's integrations.browser_setup switch.
	BrowserSetupOff Failure = "browser_setup_disabled"
	// HostBusy means host apply, prepare or upgrade holds the operation lock.
	HostBusy Failure = "host_busy"
	// IntegrationsFile means the file is absent, not root's, or not one JSON
	// object the change could be spliced into, or the host operation lock
	// directory is not root's private directory; only root can repair it. A
	// section the current rules call unusable is not a broken file: the
	// broker replaces or removes it like any other.
	IntegrationsFile Failure = "integrations_file_invalid"
)

// Sources of a section: site_admin when the broker wrote exactly these bytes
// on a recorded request, operator when root wrote or changed them by hand.
const (
	AppSourceSiteAdmin = "site_admin"
	AppSourceOperator  = "operator"
)

// IntegrationApp is one provider's registration as the list shows it. The
// client and tenant ids are public: they appear in every sign-in URL.
type IntegrationApp struct {
	Provider string `json:"provider"`
	ClientID string `json:"client_id"`
	TenantID string `json:"tenant_id,omitempty"`
	// Usable is the daemon's rule; an unusable section is ignored by every
	// daemon and shown so that root can see why.
	Usable bool   `json:"usable"`
	Source string `json:"source"`
	Actor  string `json:"actor,omitempty"`
	At     string `json:"at,omitempty"`
}

// IntegrationPage answers every integration operation. BrowserSetup is root's
// switch as host apply last published it.
type IntegrationPage struct {
	BrowserSetup bool             `json:"browser_setup"`
	Apps         []IntegrationApp `json:"apps"`
}

var publicID = regexp.MustCompile(`^[A-Za-z0-9._-]{1,256}$`)

func integrationOperation(op string) bool {
	return op == OpIntegrationList || op == OpIntegrationSet || op == OpIntegrationClear
}

func integrationProvider(p string) bool { return slices.Contains(integrationapps.Providers, p) }

func parseIntegrationRequest(raw map[string]json.RawMessage, r Request) (Request, error) {
	present := func(k string) bool { _, ok := raw[k]; return ok }
	for _, k := range []string{"candidate", "default_limit_bytes", "limit_bytes", "login_hint"} {
		if present(k) {
			return Request{}, ErrInvalid
		}
	}
	if r.Version != 1 || r.ID != "0" {
		return Request{}, ErrInvalid
	}
	switch r.Operation {
	case OpIntegrationList:
		if r.Provider != "all" || present("actor") || present("fields") {
			return Request{}, ErrInvalid
		}
	case OpIntegrationSet:
		if !integrationProvider(r.Provider) || !validActor(r.Actor) || !integrationapps.Valid(r.Provider, r.Fields) {
			return Request{}, ErrInvalid
		}
	case OpIntegrationClear:
		if !integrationProvider(r.Provider) || !validActor(r.Actor) || present("fields") {
			return Request{}, ErrInvalid
		}
	}
	return r, nil
}

func parseIntegrationReply(raw map[string]json.RawMessage, r Reply) (Reply, error) {
	if r.Integrations == nil || r.Route != nil || r.Users != nil || r.Quota != nil || r.Quotas != nil || r.Access != nil || r.Generation != 0 || r.Epoch != 0 || r.Next != "" {
		return Reply{}, ErrInvalid
	}
	page, err := object(raw["integrations"], "browser_setup", "apps")
	if err != nil || len(page["browser_setup"]) == 0 || string(page["browser_setup"]) == "null" {
		return Reply{}, ErrInvalid
	}
	apps, err := checkArray(page["apps"], "apps")
	if err != nil || len(apps) > len(integrationapps.Providers) {
		return Reply{}, ErrInvalid
	}
	seen := map[string]bool{}
	for _, app := range apps {
		var x IntegrationApp
		fields, err := object(app, "provider", "client_id", "tenant_id", "usable", "source", "actor", "at")
		if err != nil || json.Unmarshal(app, &x) != nil || !validIntegrationApp(x, fields) || seen[x.Provider] {
			return Reply{}, ErrInvalid
		}
		seen[x.Provider] = true
	}
	return r, nil
}

func validIntegrationApp(x IntegrationApp, fields map[string]json.RawMessage) bool {
	for _, k := range []string{"provider", "client_id", "usable", "source"} {
		if len(fields[k]) == 0 || string(fields[k]) == "null" {
			return false
		}
	}
	// An operator's hand-written id is shown only when it is token-shaped.
	if !integrationProvider(x.Provider) || x.ClientID != "" && !publicID.MatchString(x.ClientID) || x.TenantID != "" && (!publicID.MatchString(x.TenantID) || x.Provider != "microsoft") {
		return false
	}
	switch x.Source {
	case AppSourceSiteAdmin:
		return validActor(x.Actor) && validStamp(x.At)
	case AppSourceOperator:
		return x.Actor == "" && x.At == ""
	}
	return false
}
