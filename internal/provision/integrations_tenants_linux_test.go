//go:build linux

package provision

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
)

const (
	testOwnTenant    = "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3"
	testClientTenant = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903"
)

func tenantSet(w Writer, id, label, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationTenantSet, Provider: integrationapps.TenantsKey, ID: "0", Actor: actor, Fields: map[string]string{"tenant_id": id, "label": label}})
}
func tenantRemove(w Writer, id, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationTenantRemove, Provider: integrationapps.TenantsKey, ID: "0", Actor: actor, Fields: map[string]string{"tenant_id": id}})
}

// The allowed list changes one organisation at a time under both locks:
// add appends, a relabel keeps the place, remove takes only that entry and
// the member goes with the last one; every other byte of the file stays and
// each entry records who set its label.
func TestIntegrationTenantListAddRelabelRemove(t *testing.T) {
	w := integrationWriter(t)
	r := tenantSet(w, testOwnTenant, "Own Ltd", "42")
	if r.Failure != "" || len(r.Integrations.Tenants) != 1 || r.Integrations.Tenants[0] != (IntegrationTenant{testOwnTenant, "Own Ltd", AppSourceSiteAdmin, "42", "2026-10-24T12:00:00Z"}) {
		t.Fatalf("add: %+v", r)
	}
	if got, want := fileText(t, w.IntegrationsFile), strings.Replace(operatorFile, "\"dropbox-secret\"}", "\"dropbox-secret\"},\"microsoft_tenants\":{\""+testOwnTenant+"\":\"Own Ltd\"}", 1); got != want {
		t.Fatalf("file:\n%s\nwant\n%s", got, want)
	}
	if r = tenantSet(w, testClientTenant, "Client One", "root"); r.Failure != "" || len(r.Integrations.Tenants) != 2 || r.Integrations.Tenants[1].TenantID != testClientTenant {
		t.Fatalf("second: %+v", r)
	}
	if r = tenantSet(w, testOwnTenant, "Own Oy", "43"); r.Failure != "" || r.Integrations.Tenants[0] != (IntegrationTenant{testOwnTenant, "Own Oy", AppSourceSiteAdmin, "43", "2026-10-24T12:00:00Z"}) || r.Integrations.Tenants[1].Actor != "root" {
		t.Fatalf("relabel: %+v", r.Integrations.Tenants)
	}
	// Root relabelling by hand is root's, not the administrator's.
	writeOperatorFile(t, w, strings.Replace(fileText(t, w.IntegrationsFile), "Client One", "Client 1", 1))
	if l := integrationList(w); l.Integrations.Tenants[1].Source != AppSourceOperator || l.Integrations.Tenants[1].Actor != "" || l.Integrations.Tenants[0].Source != AppSourceSiteAdmin {
		t.Fatalf("hand edit: %+v", l.Integrations.Tenants)
	}
	if r = tenantRemove(w, testOwnTenant, "42"); r.Failure != "" || len(r.Integrations.Tenants) != 1 || r.Integrations.Tenants[0].Label != "Client 1" {
		t.Fatalf("remove: %+v", r)
	}
	// Removing an absent organisation changes nothing and is no error.
	before := fileText(t, w.IntegrationsFile)
	if r = tenantRemove(w, testOwnTenant, "42"); r.Failure != "" || fileText(t, w.IntegrationsFile) != before {
		t.Fatalf("remove absent: %+v", r)
	}
	if r = tenantRemove(w, testClientTenant, "42"); r.Failure != "" || len(r.Integrations.Tenants) != 0 || fileText(t, w.IntegrationsFile) != operatorFile {
		t.Fatalf("last removal left:\n%s", fileText(t, w.IntegrationsFile))
	}
	s, err := w.inspectIntegrations(context.Background())
	if err != nil || len(s.Tenants) != 0 || s.Tenants == nil {
		t.Fatalf("host plan: %+v %v", s, err)
	}
}

// A full list refuses a 33rd organisation with nothing written, and a full
// page with every section and the longest labels still fits one reply.
func TestIntegrationTenantListBound(t *testing.T) {
	w := integrationWriter(t)
	long := strings.Repeat("Ä", integrationapps.MaxLabel)
	for i := 0; i < integrationapps.MaxTenants; i++ {
		if r := tenantSet(w, fmt.Sprintf("00000000-0000-4000-8000-%012d", i), long, "12345678901234567890"); r.Failure != "" {
			t.Fatalf("entry %d: %+v", i, r)
		}
	}
	for _, p := range integrationapps.Providers {
		f := map[string]string{"client_id": strings.Repeat("a", 1), "client_secret": "b"}
		switch integrationapps.ProviderOf(p) {
		case "microsoft":
			f = map[string]string{"client_id": testClientTenant, "tenant_id": testOwnTenant}
		case "google":
			f = map[string]string{"client_id": testGoogleID, "client_secret": "s"}
		}
		if r := w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationSet, Provider: p, ID: "0", Actor: "12345678901234567890", Fields: f}); r.Failure != "" {
			t.Fatalf("%s: %+v", p, r)
		}
	}
	before := fileText(t, w.IntegrationsFile)
	if r := tenantSet(w, testOwnTenant, "Own", "42"); r.Failure != TenantsFull || fileText(t, w.IntegrationsFile) != before {
		t.Fatalf("33rd: %+v", r)
	}
	r := integrationList(w)
	b, err := EncodeReply(r)
	if err != nil || len(b) > MaxReply || len(r.Integrations.Tenants) != integrationapps.MaxTenants || len(r.Integrations.Apps) != len(integrationapps.Providers) {
		t.Fatalf("full page %d bytes: %v", len(b), err)
	}
}

// A list root wrote that the daemons would refuse whole is shown as such and
// is root's to repair: the broker does not rewrite it from a guess.
func TestIntegrationTenantListRootMustRepairAnInvalidList(t *testing.T) {
	w := integrationWriter(t)
	broken := `{"tools":{},"microsoft_tenants":{"organizations":"Everyone"}}`
	writeOperatorFile(t, w, broken)
	if r := integrationList(w); r.Failure != "" || !r.Integrations.TenantsInvalid || len(r.Integrations.Tenants) != 0 {
		t.Fatalf("list: %+v", r.Integrations)
	}
	if r := tenantSet(w, testOwnTenant, "Own", "42"); r.Failure != IntegrationsFile || fileText(t, w.IntegrationsFile) != broken {
		t.Fatalf("set over an invalid list: %+v", r)
	}
	if err := publishIntegrationSetup(context.Background(), w.Dir, w.owner, false); err != nil {
		t.Fatal(err)
	}
	if r := tenantSet(w, testOwnTenant, "Own", "42"); r.Failure != BrowserSetupOff {
		t.Fatalf("switch off: %+v", r)
	}
}

func TestIntegrationTenantRequestValidation(t *testing.T) {
	valid := Request{Version: 1, Operation: OpIntegrationTenantSet, Provider: integrationapps.TenantsKey, ID: "0", Actor: "42", Fields: map[string]string{"tenant_id": testOwnTenant, "label": "Own Ltd"}}
	if _, err := EncodeRequest(valid); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*Request){
		"audience keyword": func(r *Request) { r.Fields["tenant_id"] = "organizations" },
		"domain":           func(r *Request) { r.Fields["tenant_id"] = "contoso.onmicrosoft.com" },
		"uppercase guid":   func(r *Request) { r.Fields["tenant_id"] = strings.ToUpper(testOwnTenant) },
		"empty label":      func(r *Request) { r.Fields["label"] = "" },
		"control label":    func(r *Request) { r.Fields["label"] = "Own\u0007" },
		"long label":       func(r *Request) { r.Fields["label"] = strings.Repeat("x", integrationapps.MaxLabel+1) },
		"extra field":      func(r *Request) { r.Fields["client_id"] = testClientTenant },
		"section provider": func(r *Request) { r.Provider = "microsoft_shared" },
		"no actor":         func(r *Request) { r.Actor = "" },
		"label on remove":  func(r *Request) { r.Operation = OpIntegrationTenantRemove },
		"list as a section": func(r *Request) {
			r.Operation, r.Fields = OpIntegrationSet, map[string]string{"client_id": testClientTenant, "tenant_id": testOwnTenant}
		},
		"clear of the list": func(r *Request) { r.Operation, r.Fields = OpIntegrationClear, nil },
		"remove without id": func(r *Request) { r.Operation, r.Fields = OpIntegrationTenantRemove, map[string]string{} },
	} {
		r := valid
		r.Fields = map[string]string{"tenant_id": testOwnTenant, "label": "Own Ltd"}
		mutate(&r)
		if _, err := EncodeRequest(r); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
}
