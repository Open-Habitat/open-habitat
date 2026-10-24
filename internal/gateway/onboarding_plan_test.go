package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// planProvider answers the sign-in like fakeProvider and the access checks
// from a fixed table; a name not in it never answers before the deadline.
type planProvider struct {
	fakeProvider
	mu     sync.Mutex
	access map[string]string
	tokens []string
	names  []string
}

func (p *planProvider) CheckRepository(ctx context.Context, token, name string) string {
	p.mu.Lock()
	p.tokens = append(p.tokens, token)
	p.names = append(p.names, name)
	got, ok := p.access[name]
	p.mu.Unlock()
	if !ok {
		<-ctx.Done()
		return "readable" // too late: the deadline already decided
	}
	return got
}

type planSink struct {
	fakeSink
	plans  []RepositoryPlan
	seeds  []SiteKeySeed
	answer func(RepositoryPlan) ([]PlanOutcome, error)
	// seed answers a seed; nil answers seeded.
	seed func(SiteKeySeed) (string, error)
}

func (s *planSink) DeliverFirst(ctx context.Context, m Identity, id, token string, first FirstLogin) (FirstLoginReply, error) {
	if first.Plan != nil {
		s.plans = append(s.plans, *first.Plan)
	}
	if first.Seed != nil {
		s.seeds = append(s.seeds, *first.Seed)
	}
	if err := s.Deliver(ctx, m, id, token); err != nil {
		return FirstLoginReply{}, err
	}
	var reply FirstLoginReply
	if first.Plan != nil {
		out, err := s.answer(*first.Plan)
		if err != nil {
			return FirstLoginReply{}, err
		}
		reply.Defaults = out
	}
	if first.Seed != nil {
		reply.AIKey = "seeded"
		if s.seed != nil {
			got, err := s.seed(*first.Seed)
			if err != nil {
				return FirstLoginReply{}, err
			}
			reply.AIKey = got
		}
	}
	return reply, nil
}

func planFixture(t *testing.T, mode string, defaults ...string) (http.Handler, *Auth, *planProvider, *planSink, *bytes.Buffer, string) {
	t.Helper()
	now := time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	p := &planProvider{fakeProvider: fakeProvider{token: "gho_" + strings.Repeat("S", 40), id: "42", login: "alice"}, access: map[string]string{}}
	s := &planSink{answer: func(plan RepositoryPlan) ([]PlanOutcome, error) {
		out := []PlanOutcome{}
		for _, n := range plan.Defaults {
			out = append(out, PlanOutcome{FullName: n, Outcome: "queued"})
		}
		return out, nil
	}}
	broker := newFakeBroker()
	broker.unbound = map[string]bool{"42": true}
	var logs bytes.Buffer
	admin := filepath.Join(t.TempDir(), "administration.json")
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: p, Sink: s, Broker: broker, AdminFile: admin, Now: func() time.Time { return now }, Log: CallbackLogger(&logs)})
	if e != nil {
		t.Fatal(e)
	}
	if e := a.changeDefaultLimitFor("", 1<<30); e != nil {
		t.Fatal(e)
	}
	if _, e := a.updateOnboardingFor("", 0, onboardingDocument{Repositories: onboardingRepositories{Mode: mode, Defaults: append([]string{}, defaults...)}, Integrations: []onboardingIntegration{}, AIAccount: onboardingAIAccount{Offer: "all"}}); e != nil {
		t.Fatal(e)
	}
	return NewWithAuth("", a), a, p, s, &logs, admin
}

func login(t *testing.T, h http.Handler) (*httptest.ResponseRecorder, *http.Cookie) {
	t.Helper()
	state, flow := start(t, h)
	w := callback(h, state, flow)
	for _, c := range w.Result().Cookies() {
		if c.Name == cookieName && c.Value != "" {
			return w, c
		}
	}
	return w, nil
}

// The binding-creating login checks every default with the person's token
// and hands the daemon only the readable ones; a refused or unfinished check
// fails closed on that name. A later login carries no plan, so a default the
// person deleted is not imported again.
func TestFirstLoginPlanCarriesOnlyReadableDefaults(t *testing.T) {
	h, a, p, s, logs, admin := planFixture(t, "auto", "acme/team", "acme/management", "acme/slow")
	p.access = map[string]string{"acme/team": "readable", "acme/management": "no_access"}
	start := time.Now()
	w, cookie := login(t, h)
	if w.Code != 303 || cookie == nil {
		t.Fatal(w.Code, w.Body.String())
	}
	if time.Since(start) > repositoryCheckDeadline+2*time.Second {
		t.Fatal("check deadline not applied")
	}
	if len(s.plans) != 1 || s.plans[0].Mode != "auto" || strings.Join(s.plans[0].Defaults, ",") != "acme/team" || s.calls != 1 {
		t.Fatalf("plan %+v calls %d", s.plans, s.calls)
	}
	for _, tok := range p.tokens {
		if tok != p.token {
			t.Fatal("check used another credential")
		}
	}
	r, ok := a.receiptFor("42")
	want := []receiptDefault{{"acme/team", "queued"}, {"acme/management", "no_access"}, {"acme/slow", "check_failed"}}
	if !ok || r.Mode != "auto" || r.At != "2026-10-24T09:00:00Z" || len(r.Defaults) != 3 || r.Defaults[0] != want[0] || r.Defaults[1] != want[1] || r.Defaults[2] != want[2] {
		t.Fatalf("receipt %+v", r)
	}
	stored, _ := os.ReadFile(admin)
	for _, leak := range [][]byte{stored, logs.Bytes()} {
		if bytes.Contains(leak, []byte(p.token)) {
			t.Fatal("token persisted or logged")
		}
	}
	if bytes.Contains(logs.Bytes(), []byte("acme/")) {
		t.Fatal("default names logged")
	}

	// The person's own read names only their readable default.
	site := request(h, "GET", "/api/v1/onboarding/site", cookie)
	var view struct {
		Repositories struct {
			Mode    string   `json:"mode"`
			Imports []string `json:"imports"`
		} `json:"repositories"`
	}
	if site.Code != 200 || json.Unmarshal(site.Body.Bytes(), &view) != nil || view.Repositories.Mode != "auto" || strings.Join(view.Repositories.Imports, ",") != "acme/team" || strings.Contains(site.Body.String(), "management") || strings.Contains(site.Body.String(), "slow") {
		t.Fatal(site.Body.String())
	}
	if q := a.catalogQuery("42"); q != "default=acme%2Fteam&mode=auto" {
		t.Fatal(q)
	}

	// A configuration change later never changes this person.
	if _, e := a.updateOnboardingFor("", 1, onboardingDocument{Repositories: onboardingRepositories{Mode: "skip", Defaults: []string{"acme/other"}}, Integrations: []onboardingIntegration{}, AIAccount: onboardingAIAccount{Offer: "all"}}); e != nil {
		t.Fatal(e)
	}
	if q := a.catalogQuery("42"); q != "default=acme%2Fteam&mode=auto" {
		t.Fatal("configuration change reached a joined person", q)
	}

	checks := len(p.names)
	if w, _ := login(t, h); w.Code != 303 {
		t.Fatal(w.Code)
	}
	if len(s.plans) != 1 || s.calls != 2 || len(p.names) != checks {
		t.Fatal("later login replayed the plan or checked again", len(s.plans), s.calls, len(p.names))
	}
	if r2, _ := a.receiptFor("42"); r2.At != r.At || r2.Mode != "auto" {
		t.Fatal("later login rewrote the record", r2)
	}
}

// A lost handoff answer fails the login as before, but its record stays:
// every readable default is unknown, never assumed queued, and the next
// login (no longer creating) does not try again.
func TestFirstLoginPlanLostAnswer(t *testing.T) {
	h, a, p, s, _, _ := planFixture(t, "skip", "acme/team")
	p.access = map[string]string{"acme/team": "readable"}
	s.answer = func(RepositoryPlan) ([]PlanOutcome, error) { return nil, errors.New("lost") }
	if w, _ := login(t, h); w.Code == 303 {
		t.Fatal("lost handoff answer issued a session")
	}
	r, ok := a.receiptFor("42")
	if !ok || len(r.Defaults) != 1 || r.Defaults[0].Outcome != "unknown" {
		t.Fatal(r)
	}
	if w, _ := login(t, h); w.Code != 303 || len(s.plans) != 1 {
		t.Fatal("plan replayed after a failed handoff", w.Code, len(s.plans))
	}
	if a.catalogQuery("42") != "" {
		t.Fatal("skip mode has no chooser to mark")
	}
}

// preselected imports nothing by itself: no plan goes to the daemon and the
// readable defaults are only marked in the person's chooser.
func TestFirstLoginPreselectedSendsNoPlan(t *testing.T) {
	h, a, p, s, _, _ := planFixture(t, "preselected", "acme/team", "acme/management")
	p.access = map[string]string{"acme/team": "readable", "acme/management": "no_access"}
	if w, _ := login(t, h); w.Code != 303 {
		t.Fatal(w.Code)
	}
	if len(s.plans) != 0 || s.calls != 1 {
		t.Fatal("preselected sent a plan", s.plans)
	}
	if q, want := a.catalogQuery("42"), (url.Values{"mode": {"preselected"}, "default": {"acme/team"}}).Encode(); q != want {
		t.Fatal(q)
	}
	r, _ := a.receiptFor("42")
	if r.Defaults[0].Outcome != "preselected" || r.Defaults[1].Outcome != "no_access" {
		t.Fatal(r)
	}
}

// A record a write could not have made fails the state closed at startup.
func TestStoredReceiptValidation(t *testing.T) {
	ok := onboardingReceipt{At: "2026-10-24T09:00:00Z", Mode: "auto", Defaults: []receiptDefault{{"acme/team", "queued"}}}
	if !validReceipt("42", ok) {
		t.Fatal("valid receipt refused")
	}
	for _, bad := range []struct {
		subject string
		r       onboardingReceipt
	}{
		{"042", ok},
		{"42", onboardingReceipt{At: "yesterday", Mode: "auto", Defaults: ok.Defaults}},
		{"42", onboardingReceipt{At: ok.At, Mode: "manual", Defaults: ok.Defaults}},
		{"42", onboardingReceipt{At: ok.At, Mode: "auto", Defaults: []receiptDefault{{"acme/team", "cloned"}}}},
		{"42", onboardingReceipt{At: ok.At, Mode: "auto", Defaults: []receiptDefault{{"acme/team", "preselected"}}}},
		{"42", onboardingReceipt{At: ok.At, Mode: "preselected", Defaults: []receiptDefault{{"acme/team", "queued"}}}},
		{"42", onboardingReceipt{At: ok.At, Mode: "auto", Defaults: []receiptDefault{{"acme/team", "queued"}, {"ACME/team", "queued"}}}},
		{"42", onboardingReceipt{At: ok.At, Mode: "auto", Defaults: []receiptDefault{{"acme/..", "queued"}}}},
	} {
		if validReceipt(bad.subject, bad.r) {
			t.Fatalf("accepted %+v", bad)
		}
	}
}
