//go:build linux

package integrations

import (
	"regexp"
	"sort"
	"strings"
)

// Access is what the provider's grant lets an account's service do. The
// grant is the only boundary that holds against an agent running as the
// person, so it is read from the grant itself and never from a record of
// what was asked for: a person or an organisation may grant less.
type Access string

const (
	// AccessFull is everything the catalog asks of the service.
	AccessFull Access = "full"
	// AccessDrafts is mail that can be read and drafted but not sent.
	AccessDrafts Access = "drafts"
	AccessRead   Access = "read"
	// AccessNone is a service the grant leaves out; nothing reaches it.
	AccessNone Access = "none"
)

// Grant is an account's grant in the provider's own scope names: what was
// granted, and what the catalog asked for that was not.
type Grant struct {
	Granted    []string `json:"granted"`
	NotGranted []string `json:"not_granted"`
}

// accessRule is one level of a service: every scope in all grants it.
type accessRule struct {
	all    []string
	access Access
}

// grantRules map each service of a provider to its levels, broadest first.
type grantRules map[string][]accessRule

func (r grantRules) access(service string, granted map[string]bool) Access {
	rules, ok := r[service]
	if !ok {
		return ""
	}
next:
	for _, rule := range rules {
		for _, s := range rule.all {
			if !granted[s] {
				continue next
			}
		}
		return rule.access
	}
	return AccessNone
}

// grantScope admits a scope name as the provider spelled it; anything else
// in a provider's answer is dropped rather than shown.
var grantScope = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`)

// scopeSet is the granted scopes, normalized by name.
func scopeSet(scopes []string, name func(string) string) map[string]bool {
	out := map[string]bool{}
	for _, s := range scopes {
		if grantScope.MatchString(s) {
			out[name(s)] = true
		}
	}
	return out
}

// grantOf is the shown grant: the granted scopes and the requested ones
// missing from them, each sorted and bounded. Identity scopes the provider
// always adds are not permissions to show.
func grantOf(granted map[string]bool, requested []string, identity map[string]bool) *Grant {
	g := &Grant{Granted: []string{}, NotGranted: []string{}}
	for s := range granted {
		if !identity[s] {
			g.Granted = append(g.Granted, s)
		}
	}
	for _, s := range requested {
		if !identity[s] && !granted[s] {
			g.NotGranted = append(g.NotGranted, s)
		}
	}
	sort.Strings(g.Granted)
	sort.Strings(g.NotGranted)
	if len(g.Granted) > 32 {
		g.Granted = g.Granted[:32]
	}
	return g
}

// applyAccess sets each service's access from the grant and leaves a
// service the grant does not reach out of any probe's result.
func applyAccess(rules grantRules, granted map[string]bool, services []Service) {
	for i := range services {
		a := rules.access(services[i].ID, granted)
		services[i].Access = a
		if a == AccessNone {
			// Its tool was never set up for it, so no state is observed.
			services[i].State, services[i].Failure, services[i].Progress = StateUnknown, "", nil
		}
	}
}

// accessSummary is the skill's sentence about a narrower grant: which
// services the agent must not expect to change or reach. Empty for a full one.
func accessSummary(services []Service, names map[string]string) string {
	var parts []string
	for _, s := range services {
		name := names[s.ID]
		if name == "" {
			name = s.ID
		}
		switch s.Access {
		case AccessNone:
			parts = append(parts, name+": not granted")
		case AccessRead:
			parts = append(parts, name+": read only")
		case AccessDrafts:
			parts = append(parts, name+": read and drafts, sending is not granted")
		}
	}
	if len(parts) == 0 {
		return ""
	}
	return "\n\nThis account's access is narrower than full: " + strings.Join(parts, "; ") + ". The provider enforces it, so a refused request is the answer and not an obstacle to get around; the person can widen the access in Settings → Integrations."
}
