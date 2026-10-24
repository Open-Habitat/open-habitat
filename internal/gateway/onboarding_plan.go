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

// Default repositories are imported once (ADR 0030). In the login in which
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
}

func validReceipt(subject string, r onboardingReceipt) bool {
	at, e := time.Parse(time.RFC3339, r.At)
	if !canonicalSubject(subject) || e != nil || at.UTC().Format(time.RFC3339) != r.At || !slices.Contains(onboardingModes, r.Mode) || r.Defaults == nil || len(r.Defaults) > maxOnboardingDefaults {
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

// deliverWithPlan is the handoff of the binding-creating login. It returns
// the record to keep for the subject; the error is the handoff's.
func (a *Auth) deliverWithPlan(ctx context.Context, target Identity, id, token string) (onboardingReceipt, bool, error) {
	c, ok := a.onboardingView()
	checker, canCheck := a.provider.(RepositoryChecker)
	if !ok || !canCheck {
		// Without the configuration or a check nothing is imported; the
		// login itself goes on as before.
		return onboardingReceipt{}, false, a.sink.Deliver(ctx, target, id, token)
	}
	receipt := onboardingReceipt{At: a.now().UTC().Format(time.RFC3339), Mode: c.Repositories.Mode, Defaults: []receiptDefault{}}
	checked := checkDefaults(ctx, checker, token, c.Repositories.Defaults)
	plan := RepositoryPlan{Mode: c.Repositories.Mode}
	for i, name := range c.Repositories.Defaults {
		outcome := checked[i]
		if outcome == "readable" {
			outcome = "unknown"
			if c.Repositories.Mode == "preselected" {
				outcome = "preselected"
			} else {
				plan.Defaults = append(plan.Defaults, name)
			}
		}
		receipt.Defaults = append(receipt.Defaults, receiptDefault{Repository: name, Outcome: outcome})
	}
	sink, planned := a.sink.(PlanSink)
	if len(plan.Defaults) == 0 || !planned {
		return receipt, true, a.sink.Deliver(ctx, target, id, token)
	}
	outcomes, err := sink.DeliverPlan(ctx, target, id, token, plan)
	if err != nil || len(outcomes) != len(plan.Defaults) {
		// The answer is missing: every daemon-side entry stays unknown.
		return receipt, true, err
	}
	for i, o := range outcomes {
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
