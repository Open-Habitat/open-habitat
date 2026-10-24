package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"slices"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

// Integration app credentials (server-integrations-admin). The root broker
// owns the application sections of the installation's integrations file and
// writes one on the gateway's request, the ADR 0030 pattern. The gateway's
// part is the administrator check and the relay: it parses the request only
// to validate it, forwards the secret once, and keeps, logs and returns
// nothing of it. A change is in effect only when the broker's reply arrives;
// without one the outcome is uncertain and nothing is retried.

// IntegrationApp is one provider's registration as the broker reports it.
// Client and tenant ids are public: they are in every sign-in URL.
type IntegrationApp struct {
	Provider, ClientID, TenantID string
	Usable                       bool
	Source, Actor, At            string
}

// IntegrationApps is the broker's list and root's browser_setup switch.
type IntegrationApps struct {
	BrowserSetup bool
	Apps         []IntegrationApp
}

// IntegrationAppsBroker is the broker's integration surface. Set and Clear
// return ErrIntegrationUncertain when no definite reply arrived.
type IntegrationAppsBroker interface {
	IntegrationList(context.Context) (IntegrationApps, error)
	SetIntegrationApp(ctx context.Context, provider string, fields map[string]string, actor string) (IntegrationApps, error)
	ClearIntegrationApp(ctx context.Context, provider, actor string) (IntegrationApps, error)
}

// Definite broker refusals; nothing was written.
var (
	ErrIntegrationUncertain = errors.New("integration change outcome uncertain")
	ErrBrowserSetupOff      = errors.New("browser setup of integrations is switched off")
	ErrHostBusy             = errors.New("host maintenance in progress")
	ErrIntegrationsFile     = errors.New("integrations file needs root")
	ErrIntegrationRefused   = errors.New("broker refused the integration change")
)

func (a *Auth) integrationBroker() (IntegrationAppsBroker, bool) {
	b, ok := a.broker.(IntegrationAppsBroker)
	return b, ok
}

func validIntegrationProvider(p string) bool { return slices.Contains(integrationapps.Providers, p) }

type integrationAppView struct {
	Provider string `json:"provider"`
	ClientID string `json:"client_id,omitempty"`
	TenantID string `json:"tenant_id,omitempty"`
	Usable   bool   `json:"usable"`
	Source   string `json:"source"`
	Actor    string `json:"actor,omitempty"`
	At       string `json:"at,omitempty"`
}
type integrationAppsView struct {
	SchemaVersion int                  `json:"schema_version"`
	BrowserSetup  bool                 `json:"browser_setup"`
	Apps          []integrationAppView `json:"apps"`
}

func viewOf(apps IntegrationApps) integrationAppsView {
	v := integrationAppsView{SchemaVersion: 1, BrowserSetup: apps.BrowserSetup, Apps: []integrationAppView{}}
	for _, x := range apps.Apps {
		v.Apps = append(v.Apps, integrationAppView{x.Provider, x.ClientID, x.TenantID, x.Usable, x.Source, x.Actor, x.At})
	}
	return v
}

func (a *Auth) integrationList(ctx context.Context) (integrationAppsView, error) {
	broker, ok := a.integrationBroker()
	if !ok {
		return integrationAppsView{}, errBrokerRead
	}
	apps, err := broker.IntegrationList(ctx)
	if err != nil {
		return integrationAppsView{}, errBrokerRead
	}
	return viewOf(apps), nil
}

// changeIntegrationApp sets (fields non-nil) or clears a provider's app
// credentials. caller is the administrator's subject, or empty for root's
// control socket; the role is checked as current, not as of sign-in.
func (a *Auth) changeIntegrationApp(ctx context.Context, caller, provider string, fields map[string]string) (integrationAppsView, error) {
	if !validIntegrationProvider(provider) || fields != nil && !integrationapps.Valid(provider, fields) {
		return integrationAppsView{}, errInvalidIntegration
	}
	broker, ok := a.integrationBroker()
	if !ok {
		return integrationAppsView{}, errBrokerRead
	}
	if caller != "" && !a.isAdministrator(caller) {
		return integrationAppsView{}, errAdminDenied
	}
	var apps IntegrationApps
	var err error
	operation := "set"
	if fields != nil {
		apps, err = broker.SetIntegrationApp(ctx, provider, fields, actorFor(caller))
	} else {
		operation = "clear"
		apps, err = broker.ClearIntegrationApp(ctx, provider, actorFor(caller))
	}
	if errors.Is(err, ErrIntegrationUncertain) {
		a.log.Warn("integration_app", "outcome", "uncertain", "reason", "broker_reply_missing", "operation", operation, "provider", provider, "actor", actorFor(caller))
		return integrationAppsView{}, err
	}
	if err != nil {
		return integrationAppsView{}, err
	}
	a.log.Info("integration_app", "outcome", "accepted", "reason", operation, "provider", provider, "actor", actorFor(caller))
	return viewOf(apps), nil
}

var errInvalidIntegration = errors.New("invalid integration app")

// integrationReason maps a failure to the fixed vocabulary the browser and
// root's control socket share.
func integrationReason(err error) (int, string) {
	switch {
	case errors.Is(err, errInvalidIntegration):
		return 400, "invalid_request"
	case errors.Is(err, errAdminDenied):
		return 403, "admin_required"
	case errors.Is(err, ErrIntegrationUncertain):
		return 503, "outcome_uncertain"
	case errors.Is(err, ErrBrowserSetupOff):
		return 409, "browser_setup_disabled"
	case errors.Is(err, ErrHostBusy):
		return 409, "host_busy"
	case errors.Is(err, ErrIntegrationsFile):
		return 409, "integrations_file_invalid"
	case errors.Is(err, ErrIntegrationRefused):
		return 409, "integration_refused"
	case errors.Is(err, errBrokerRead):
		return 503, "broker_unavailable"
	case errors.Is(err, ErrAdministrationState):
		return 503, "administration_unavailable"
	}
	return 503, "integration_unavailable"
}

const integrationAppsPath = "/api/v1/server/integrations"

// maxIntegrationBody holds the largest valid section: two 256-byte values.
const maxIntegrationBody = 2048

type integrationChange struct {
	Provider string            `json:"provider"`
	Fields   map[string]string `json:"fields"`
}

// decodeIntegrationChange reads one strict change; set has fields, clear none.
func decodeIntegrationChange(r io.Reader, set bool) (integrationChange, bool) {
	var c integrationChange
	dec := json.NewDecoder(io.LimitReader(r, maxIntegrationBody+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&c) != nil || dec.Decode(new(any)) != io.EOF || !validIntegrationProvider(c.Provider) || set != (c.Fields != nil) || set && !integrationapps.Valid(c.Provider, c.Fields) {
		return integrationChange{}, false
	}
	return c, true
}

// integrationAppsHTTP serves the administrator's list and its two writes.
// Every write checks the session, CSRF and the administrator role as current.
func (a *Auth) integrationAppsHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	path := r.URL.Path
	if !a.exact(r, path) || path != integrationAppsPath && path != integrationAppsPath+"/set" && path != integrationAppsPath+"/clear" {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if path == integrationAppsPath {
		if r.Method != http.MethodGet {
			safe(w, 405, "method_not_allowed")
			return
		}
		view, err := a.integrationList(r.Context())
		if err != nil {
			status, code := integrationReason(err)
			safe(w, status, code)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(view)
		return
	}
	if r.Method != http.MethodPost {
		safe(w, 405, "method_not_allowed")
		return
	}
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	set := path == integrationAppsPath+"/set"
	change, ok := decodeIntegrationChange(r.Body, set)
	if r.Header.Get("Content-Type") != "application/json" || !ok {
		safe(w, 400, "invalid_request")
		return
	}
	view, err := a.changeIntegrationApp(r.Context(), s.identity.Subject, change.Provider, change.Fields)
	if err != nil {
		status, code := integrationReason(err)
		safe(w, status, code)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(view)
}

// integrationControl serves root's admin integrations operations over the
// control socket, with the browser's checks except the session.
func (a *Auth) integrationControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation string            `json:"operation"`
		Provider  string            `json:"provider"`
		Fields    map[string]string `json:"fields"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	switch r.Operation {
	case "integration_list":
		if r.Provider != "" || r.Fields != nil {
			break
		}
		view, err := a.integrationList(ctx)
		if err != nil {
			return nil, err
		}
		return json.Marshal(view)
	case "integration_set", "integration_clear":
		if (r.Operation == "integration_set") != (r.Fields != nil) {
			break
		}
		view, err := a.changeIntegrationApp(ctx, "", r.Provider, r.Fields)
		if err != nil {
			return nil, err
		}
		return json.Marshal(view)
	}
	return nil, errors.New("invalid control request")
}

// integrationControlError is the control-socket word for an integration
// failure, or false when the failure is not one of them.
func integrationControlError(err error) (string, bool) {
	status, code := integrationReason(err)
	if code == "integration_unavailable" && status == 503 || code == "broker_unavailable" || code == "administration_unavailable" || code == "admin_required" {
		return "", false
	}
	return code, true
}
