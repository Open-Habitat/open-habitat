//go:build linux

package integrations

import (
	"strings"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

// The operator's Microsoft applications form a table by organisation
// (tenant GUID) and level, built from root's file alone each time it is
// asked, so a change there takes effect at the next connect, refresh or
// tool call without a restart:
//
//  1. each single-tenant section (microsoft, microsoft_nosend, …) fills the
//     cell of its own tenant and level;
//  2. each organisation on the allowed list (integrationapps.TenantsKey)
//     then gets, at every level whose cell is still empty, the shared
//     (multi-tenant) application of that level, signing in at that
//     organisation's own authority.
//
// So an organisation with its own single-tenant application keeps it for
// that level, and the shared ones fill the rest. Nothing falls back to
// another organisation. The list is not a security boundary: it governs
// what the catalog's own connect, refresh and tool paths do, never what a
// program running as the person could reach with a shared application's
// refresh token.

// MicrosoftOrganisation is one organisation a connection can be made in.
type MicrosoftOrganisation struct {
	TenantID string `json:"tenant_id"`
	// Label is the allowed list's name for it, "" for an organisation
	// served only by a single-tenant section of its own.
	Label string `json:"label,omitempty"`
	// Own is the operator's own organisation: the shared applications'
	// owning tenant, or with none configured, a single-tenant section's.
	Own bool `json:"own"`
	// Levels are the levels the organisation has an application for.
	Levels []LevelOption `json:"levels"`
}

// microsoftTable is the operator's applications by organisation and level,
// with the organisations in the order people choose from.
type microsoftTable struct {
	cells map[string]map[Level]MicrosoftApp
	orgs  []MicrosoftOrganisation
}

// microsoftSections are the single-tenant and shared sections by level.
func microsoftSections(cfg Config) (single, shared [4]*MicrosoftApp) {
	return [4]*MicrosoftApp{cfg.Microsoft, cfg.MicrosoftNoSend, cfg.MicrosoftDrafts, cfg.MicrosoftRead},
		[4]*MicrosoftApp{cfg.MicrosoftShared, cfg.MicrosoftSharedNoSend, cfg.MicrosoftSharedDrafts, cfg.MicrosoftSharedRead}
}

func usableMicrosoft(section string, app *MicrosoftApp) bool {
	return app != nil && integrationapps.Usable(section, map[string]string{"client_id": app.ClientID, "tenant_id": app.TenantID})
}

// microsoftTable reads the table from the operator's file now.
func (env Env) microsoftTable() microsoftTable {
	t := microsoftTable{cells: map[string]map[Level]MicrosoftApp{}}
	cfg, ok := env.config()
	if !ok {
		return t
	}
	single, shared := microsoftSections(cfg)
	put := func(tenant string, level Level, app MicrosoftApp) {
		if t.cells[tenant] == nil {
			t.cells[tenant] = map[Level]MicrosoftApp{}
		}
		if _, taken := t.cells[tenant][level]; !taken {
			t.cells[tenant][level] = app
		}
	}
	var singleTenants []string
	own := map[string]bool{}
	for i, level := range microsoftLevels {
		section := []string{"microsoft", "microsoft_nosend", "microsoft_drafts", "microsoft_read"}[i]
		if usableMicrosoft(section, single[i]) {
			tenant := strings.ToLower(single[i].TenantID)
			// A single-tenant section keeps its own bytes: its entries
			// already name its tenant as root wrote it.
			put(tenant, level, *single[i])
			singleTenants = append(singleTenants, tenant)
		}
		if usableMicrosoft(integrationapps.MicrosoftShared(section), shared[i]) {
			own[strings.ToLower(shared[i].TenantID)] = true
		}
	}
	sharedAny := len(own) > 0
	if !sharedAny {
		for _, tenant := range singleTenants {
			own[tenant] = true
		}
	}
	for _, org := range cfg.MicrosoftTenants {
		for i, level := range microsoftLevels {
			section := integrationapps.MicrosoftShared([]string{"microsoft", "microsoft_nosend", "microsoft_drafts", "microsoft_read"}[i])
			if usableMicrosoft(section, shared[i]) {
				put(org.ID, level, MicrosoftApp{ClientID: shared[i].ClientID, TenantID: org.ID})
			}
		}
	}
	// Own organisations first, then the allowed list in its order, then the
	// organisations only a single-tenant section serves.
	labels := map[string]string{}
	var order []string
	seen := map[string]bool{}
	add := func(tenant string) {
		if !seen[tenant] && t.cells[tenant] != nil {
			seen[tenant] = true
			order = append(order, tenant)
		}
	}
	for _, org := range cfg.MicrosoftTenants {
		labels[org.ID] = org.Label
	}
	for _, org := range cfg.MicrosoftTenants {
		if own[org.ID] {
			add(org.ID)
		}
	}
	for _, tenant := range singleTenants {
		if own[tenant] {
			add(tenant)
		}
	}
	for _, org := range cfg.MicrosoftTenants {
		add(org.ID)
	}
	for _, tenant := range singleTenants {
		add(tenant)
	}
	for _, tenant := range order {
		org := MicrosoftOrganisation{TenantID: tenant, Label: labels[tenant], Own: own[tenant]}
		for _, l := range microsoftLevels {
			_, has := t.cells[tenant][l]
			org.Levels = append(org.Levels, appLevel(l, has))
		}
		t.orgs = append(t.orgs, org)
	}
	return t
}

// cell is the organisation's application at the level.
func (t microsoftTable) cell(tenant string, level Level) (MicrosoftApp, bool) {
	app, ok := t.cells[strings.ToLower(tenant)][level]
	return app, ok
}

// defaultTenant is the organisation a new connection without a chosen one
// signs in at: the first, in the order people choose from, with an
// application at the level. With one organisation it is that one; with
// single-tenant sections alone it is the tenant of the level's section, as
// before organisations could be chosen.
func (t microsoftTable) defaultTenant(level Level) string {
	for _, org := range t.orgs {
		if _, ok := t.cells[org.TenantID][level]; ok {
			return org.TenantID
		}
	}
	return ""
}

// levels are the provider's levels: available where any organisation has
// the level's application.
func (t microsoftTable) levels() []LevelOption {
	var out []LevelOption
	for _, l := range microsoftLevels {
		out = append(out, appLevel(l, t.defaultTenant(l) != ""))
	}
	return out
}

// label is the organisation's name on the allowed list, "" when unlisted.
func (t microsoftTable) label(tenant string) string {
	for _, org := range t.orgs {
		if org.TenantID == strings.ToLower(tenant) {
			return org.Label
		}
	}
	return ""
}
