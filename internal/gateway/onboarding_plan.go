package gateway

import (
	"context"
	"maps"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"
)

// Default repositories are imported once (ADR 0030), and the site AI key
// is seeded in the same handoff (site_key.go). In the login in which
// the broker created the binding, the gateway checks each site default with
// the person's transient sign-in token, hands the person's daemon only the
// readable ones with the token, and keeps a per-subject record of what that
// sign-in did with the site's own defaults. The record is the only place the
// person's filtered plan lives afterwards: later repository-list requests and
// the person's onboarding read take it from there, never from the browser or
// the current configuration, so neither a configuration change nor a later
// login changes a person who has joined.

// RepositoryChecker is the provider's read-only access check.
type RepositoryChecker interface {
	CheckRepository(ctx context.Context, token, fullName string) string
}

const repositoryCheckDeadline = 8 * time.Second

// receiptOutcomes: the gateway's own check (no_access, check_failed), the
// daemon's answer (queued, already_present), unknown when that answer is
// missing, and preselected for a readable default the mode only offers.
var receiptOutcomes = []string{"no_access", "check_failed", "queued", "already_present", "unknown", "preselected"}

type receiptDefault struct {
	Repository string `json:"repository"`
	Outcome    string `json:"outcome"`
}
type onboardingReceipt struct {
	At       string           `json:"at"`
	Mode     string           `json:"mode"`
	Defaults []receiptDefault `json:"defaults"`
	// AIKey is what the sign-in did with the site AI key: not_offered,
	// seeded, already_present (the person's own credential stayed), failed,
	// or unknown when the handoff's answer is missing. A failure may still
	// have left a usable key; native Pi status, not this, decides the step.
	AIKey string `json:"ai_key,omitempty"`
}

var receiptAIKeys = []string{"not_offered", "seeded", "already_present", "failed", "unknown"}

func validReceipt(subject string, r onboardingReceipt) bool {
	at, e := time.Parse(time.RFC3339, r.At)
	if !canonicalSubject(subject) || e != nil || at.UTC().Format(time.RFC3339) != r.At || !slices.Contains(onboardingModes, r.Mode) || r.Defaults == nil || len(r.Defaults) > maxOnboardingDefaults || r.AIKey != "" && !slices.Contains(receiptAIKeys, r.AIKey) {
		return false
	}
	seen := map[string]bool{}
	for _, d := range r.Defaults {
		if !validRepositoryName(d.Repository) || seen[strings.ToLower(d.Repository)] || !slices.Contains(receiptOutcomes, d.Outcome) || d.Outcome == "preselected" && r.Mode != "preselected" || (d.Outcome == "queued" || d.Outcome == "already_present" || d.Outcome == "unknown") && r.Mode == "preselected" {
			return false
		}
		seen[strings.ToLower(d.Repository)] = true
	}
	return true
}

// readable is the person's own filtered plan: the defaults that passed the
// gateway's check.
func (r onboardingReceipt) readable() []string {
	out := []string{}
	for _, d := range r.Defaults {
		if d.Outcome != "no_access" && d.Outcome != "check_failed" {
			out = append(out, d.Repository)
		}
	}
	return out
}

// checkDefaults runs one read-only check per default, all at once (at most
// 20) under one short deadline. A check that does not finish fails closed.
func checkDefaults(ctx context.Context, checker RepositoryChecker, token string, defaults []string) []string {
	out := make([]string, len(defaults))
	ctx, cancel := context.WithTimeout(ctx, repositoryCheckDeadline)
	defer cancel()
	var wg sync.WaitGroup
	for i, name := range defaults {
		wg.Add(1)
		go func() {
			defer wg.Done()
			got := checker.CheckRepository(ctx, token, name)
			if ctx.Err() != nil || got != "readable" && got != "no_access" {
				got = "check_failed"
			}
			out[i] = got
		}()
	}
	wg.Wait()
	return out
}

// deliverFirstLogin is the handoff of the binding-creating login. It returns
// the record to keep for the subject; the error is the handoff's.
func (a *Auth) deliverFirstLogin(ctx context.Context, target Identity, id, token string) (onboardingReceipt, bool, error) {
	c, ok := a.onboardingView()
	checker, canCheck := a.provider.(RepositoryChecker)
	seed := a.siteKeySeed()
	if !ok || !canCheck && seed == nil {
		// Without the configuration, or with nothing to hand over, nothing
		// is imported or seeded; the login itself goes on as before.
		return onboardingReceipt{}, false, a.sink.Deliver(ctx, target, id, token)
	}
	receipt := onboardingReceipt{At: a.now().UTC().Format(time.RFC3339), Mode: c.Repositories.Mode, Defaults: []receiptDefault{}, AIKey: "not_offered"}
	checked := make([]string, len(c.Repositories.Defaults))
	if canCheck {
		checked = checkDefaults(ctx, checker, token, c.Repositories.Defaults)
	}
	plan := RepositoryPlan{Mode: c.Repositories.Mode}
	for i, name := range c.Repositories.Defaults {
		outcome := checked[i]
		switch outcome {
		case "readable":
			outcome = "unknown"
			if c.Repositories.Mode == "preselected" {
				outcome = "preselected"
			} else {
				plan.Defaults = append(plan.Defaults, name)
			}
		case "":
			outcome = "check_failed"
		}
		receipt.Defaults = append(receipt.Defaults, receiptDefault{Repository: name, Outcome: outcome})
	}
	var first FirstLogin
	if len(plan.Defaults) > 0 {
		first.Plan = &plan
	}
	if seed != nil {
		first.Seed = seed
		receipt.AIKey = "unknown"
	}
	sink, capable := a.sink.(FirstLoginSink)
	if first.Plan == nil && first.Seed == nil || !capable {
		if seed != nil {
			receipt.AIKey = "failed"
		}
		return receipt, true, a.sink.Deliver(ctx, target, id, token)
	}
	reply, err := sink.DeliverFirst(ctx, target, id, token, first)
	if err != nil {
		// The answer is missing: every daemon-side entry stays unknown.
		return receipt, true, err
	}
	if first.Seed != nil && slices.Contains([]string{"seeded", "already_present", "failed"}, reply.AIKey) {
		receipt.AIKey = reply.AIKey
	}
	if first.Seed != nil {
		a.log.Info("site_ai_key_seed", "outcome", receipt.AIKey)
	}
	if first.Plan == nil || len(reply.Defaults) != len(plan.Defaults) {
		return receipt, true, nil
	}
	for i, o := range reply.Defaults {
		for j := range receipt.Defaults {
			if receipt.Defaults[j].Repository == plan.Defaults[i] && o.FullName == plan.Defaults[i] && (o.Outcome == "queued" || o.Outcome == "already_present") {
				receipt.Defaults[j].Outcome = o.Outcome
			}
		}
	}
	return receipt, true, nil
}

// recordReceipt keeps the binding-creating login's record. A record that
// does not fit leaves the person without marked defaults; it never blocks
// the login.
func (a *Auth) recordReceipt(subject string, r onboardingReceipt) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !validReceipt(subject, r) {
		return ErrAdministrationState
	}
	settings := a.settings
	settings.OnboardingReceipts = maps.Clone(a.settings.OnboardingReceipts)
	if settings.OnboardingReceipts == nil {
		settings.OnboardingReceipts = map[string]onboardingReceipt{}
	}
	settings.OnboardingReceipts[subject] = r
	return a.commitAdministration(settings)
}

// receiptView is the record as administrators' reads show it. It is the
// only cross-user onboarding fact, and nothing person-side carries it.
func receiptView(receipts map[string]onboardingReceipt, subject string) *onboardingReceipt {
	r, ok := receipts[subject]
	if !ok {
		return nil
	}
	r.Defaults = slices.Clone(r.Defaults)
	if r.AIKey == "" {
		r.AIKey = "not_offered"
	}
	return &r
}

func (a *Auth) receiptFor(subject string) (onboardingReceipt, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return onboardingReceipt{}, false
	}
	r, ok := a.settings.OnboardingReceipts[subject]
	return r, ok
}

// catalogQuery is what the gateway adds to its own repository-list request
// for this person: the readable defaults of their first sign-in in
// preselected and auto mode, in the daemon's canonical encoding.
func (a *Auth) catalogQuery(subject string) string {
	r, ok := a.receiptFor(subject)
	if !ok || r.Mode == "skip" {
		return ""
	}
	names := r.readable()
	if len(names) == 0 {
		return ""
	}
	return url.Values{"mode": {r.Mode}, "default": names}.Encode()
}
