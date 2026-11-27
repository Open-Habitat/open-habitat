package integrationapps

import (
	"bytes"
	"fmt"
	"strings"
	"testing"
)

const googleID = "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com"

func TestValidIsTheDaemonRuleAndTheProviderFormat(t *testing.T) {
	guid, other := "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903"
	for _, c := range []struct {
		provider      string
		f             map[string]string
		usable, valid bool
	}{
		{"google", map[string]string{"client_id": googleID, "client_secret": "GOCSPX-abc"}, true, true},
		// The daemon accepts any token-shaped id an operator hand-wrote; the
		// broker takes only Google's own client id format.
		{"google", map[string]string{"client_id": "abc", "client_secret": "GOCSPX-abc"}, true, false},
		{"google", map[string]string{"client_id": googleID, "client_secret": "has space"}, false, false},
		{"google", map[string]string{"client_id": googleID, "client_secret": googleID}, true, false},
		{"google", map[string]string{"client_id": googleID, "client_secret": "x", "extra": "y"}, true, false},
		{"google", map[string]string{"client_id": googleID}, false, false},
		{"dropbox", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "h2m5c9xj4ub7ye1"}, true, true},
		{"dropbox", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "a.b"}, false, false},
		{"dropbox", map[string]string{"client_id": "same", "client_secret": "same"}, true, false},
		// The App key and App secret share one Settings page; the key pasted
		// twice is refused whatever its case.
		{"dropbox", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "P3N8VQ1ZT6KA0RW"}, true, false},
		{"dropbox", map[string]string{"client_id": "p3n8vq1zt6ka0rw"}, false, false},
		{"dropbox", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "h2m5c9xj4ub7ye1", "tenant_id": "x"}, true, false},
		{"dropbox", map[string]string{"client_id": strings.Repeat("a", 257), "client_secret": "b"}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": other}, true, true},
		// Single tenant only: no audience keyword, not even by hand.
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": "organizations"}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": "common"}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": "consumers"}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": ""}, false, false},
		{"microsoft", map[string]string{"client_id": guid}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": guid}, true, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": strings.ToUpper(guid)}, true, false},
		{"microsoft", map[string]string{"client_id": "not-a-guid", "tenant_id": other}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": "contoso.onmicrosoft.com"}, false, false},
		{"microsoft", map[string]string{"client_id": guid, "tenant_id": other, "client_secret": "x"}, true, false},
		{"imap", map[string]string{"client_id": "a", "client_secret": "b"}, false, false},
		// A level's application is its provider's kind of registration.
		{"microsoft_read", map[string]string{"client_id": guid, "tenant_id": other}, true, true},
		{"microsoft_nosend", map[string]string{"client_id": guid, "tenant_id": other}, true, true},
		{"microsoft_drafts", map[string]string{"client_id": guid, "tenant_id": "common"}, false, false},
		{"microsoft_read", map[string]string{"client_id": guid, "client_secret": "h2m5c9xj4ub7ye1"}, false, false},
		{"dropbox_app_folder", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "h2m5c9xj4ub7ye1"}, true, true},
		{"dropbox_app_folder", map[string]string{"client_id": guid, "tenant_id": other}, false, false},
		{"dropbox_read", map[string]string{"client_id": "p3n8vq1zt6ka0rw", "client_secret": "h2m5c9xj4ub7ye1"}, false, false},
		{"google_read", map[string]string{"client_id": googleID, "client_secret": "GOCSPX-abc"}, false, false},
	} {
		if Usable(c.provider, c.f) != c.usable || Valid(c.provider, c.f) != c.valid {
			t.Errorf("%s %v: usable %v valid %v, want %v %v", c.provider, c.f, Usable(c.provider, c.f), Valid(c.provider, c.f), c.usable, c.valid)
		}
	}
}

func TestReplaceKeepsEveryOtherByte(t *testing.T) {
	tools := `{"rclone": "/opt/open-habitat/profiles/integrations/bin/rclone",  "curl":"/usr/bin/curl"}`
	file := "{\n  \"tools\": " + tools + ",\n  \"dropbox\" : {\"client_id\":\"k\",\"client_secret\":\"s\"}\n}\n"
	google := Section("google", map[string]string{"client_id": googleID, "client_secret": "GOCSPX-a"})

	added, err := Replace([]byte(file), "google", google)
	if err != nil {
		t.Fatal(err)
	}
	if want := strings.Replace(file, "\"s\"}", "\"s\"},\"google\":"+string(google), 1); string(added) != want {
		t.Fatalf("append changed other bytes:\n%s\nwant\n%s", added, want)
	}
	replaced, err := Replace(added, "dropbox", []byte(`{"client_id":"k2","client_secret":"s2"}`))
	if err != nil || string(replaced) != strings.Replace(string(added), `{"client_id":"k","client_secret":"s"}`, `{"client_id":"k2","client_secret":"s2"}`, 1) {
		t.Fatalf("in-place replace: %v\n%s", err, replaced)
	}
	// Removing the members again restores the original bytes exactly, and
	// the tools member is never touched on the way.
	back, err := Replace(added, "google", nil)
	if err != nil || string(back) != file {
		t.Fatalf("remove last: %v\n%q\nwant\n%q", err, back, file)
	}
	for _, step := range []struct{ key, want string }{
		{"tools", "{\n  \"dropbox\" : {\"client_id\":\"k\",\"client_secret\":\"s\"}\n}\n"},
		{"dropbox", "{\n  \n}\n"},
	} {
		out, err := Replace([]byte(file), step.key, nil)
		if err != nil {
			t.Fatal(err)
		}
		file = string(out)
		if file != step.want {
			t.Fatalf("remove %s: %q, want %q", step.key, file, step.want)
		}
	}
	first, err := Replace([]byte(file), "google", google)
	if err != nil || string(first) != "{\"google\":"+string(google)+"\n  \n}\n" {
		t.Fatalf("insert into empty object: %v %q", err, first)
	}
	if !bytes.Contains(added, []byte(tools)) {
		t.Fatal("tools bytes changed")
	}
}

func TestReplaceRefusesWhatTheDaemonWouldNotReadAsOneObject(t *testing.T) {
	for _, bad := range []string{
		``, `[]`, `{"tools":{}} {}`, `{"google":{},"google":{}}`, `{"tools":`, "\x00",
		`{"x":"` + strings.Repeat("a", MaxFile) + `"}`,
	} {
		if _, err := Replace([]byte(bad), "google", []byte(`{}`)); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
	// A result over the daemon's read limit is refused, not truncated.
	near := `{"x":"` + strings.Repeat("a", MaxFile-20) + `"}`
	if _, err := Replace([]byte(near), "google", Section("google", map[string]string{"client_id": googleID, "client_secret": "s"})); err == nil {
		t.Error("oversized result accepted")
	}
}

func TestReadSectionRoundTripsSection(t *testing.T) {
	f := map[string]string{"client_id": googleID, "client_secret": `GOCSPX-"x`}
	got, ok := ReadSection(Section("google", f))
	if !ok || got["client_id"] != f["client_id"] || got["client_secret"] != f["client_secret"] {
		t.Fatalf("%v %v", got, ok)
	}
	if _, ok := ReadSection([]byte(`{"client_id":1}`)); ok {
		t.Fatal("non-string member accepted")
	}
}

func TestSharedSectionsAreMicrosoftLevels(t *testing.T) {
	guid, other := "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903"
	for _, s := range []string{"microsoft_shared", "microsoft_shared_nosend", "microsoft_shared_drafts", "microsoft_shared_read"} {
		if ProviderOf(s) != "microsoft" || SecretField(s) != "" {
			t.Fatalf("%s is not a public Microsoft client", s)
		}
		if !Valid(s, map[string]string{"client_id": guid, "tenant_id": other}) || Valid(s, map[string]string{"client_id": guid, "tenant_id": "organizations"}) || Valid(s, map[string]string{"client_id": guid, "tenant_id": guid}) {
			t.Fatalf("%s does not take the single-tenant sections' rule", s)
		}
	}
	for single, shared := range map[string]string{"microsoft": "microsoft_shared", "microsoft_read": "microsoft_shared_read", "microsoft_nosend": "microsoft_shared_nosend", "microsoft_drafts": "microsoft_shared_drafts", "google": "", "microsoft_shared": ""} {
		if MicrosoftShared(single) != shared {
			t.Fatalf("MicrosoftShared(%s) = %q", single, MicrosoftShared(single))
		}
	}
}

func TestTenantListIsGUIDsAndLabels(t *testing.T) {
	own, client := "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903"
	list, ok := ReadTenants([]byte(`{"` + strings.ToUpper(own) + `":"Own Ltd","` + client + `":"Client Öy & Co"}`))
	if !ok || len(list) != 2 || list[0] != (Tenant{own, "Own Ltd"}) || list[1].ID != client {
		t.Fatalf("list %v %v", list, ok)
	}
	if again, ok := ReadTenants(TenantsValue(list)); !ok || len(again) != 2 || again[1] != list[1] {
		t.Fatalf("canonical value does not round-trip: %s", TenantsValue(list))
	}
	for _, bad := range []string{
		`{"organizations":"X"}`,
		`{"contoso.onmicrosoft.com":"X"}`,
		`{"` + own + `":""}`,
		`{"` + own + `":" Own"}`,
		`{"` + own + `":"Own\nLtd"}`,
		`{"` + own + `":"Own Ltd"}`,
		`{"` + own + `":"` + strings.Repeat("ä", MaxLabel+1) + `"}`,
		`{"` + own + `":1}`,
		// The same tenant twice in different case is not guessed between.
		`{"` + own + `":"A","` + strings.ToUpper(own) + `":"B"}`,
		`[]`,
	} {
		if _, ok := ReadTenants([]byte(bad)); ok {
			t.Errorf("accepted %s", bad)
		}
	}
	if !ValidLabel(strings.Repeat("ä", MaxLabel)) || ValidTenantID(strings.ToUpper(own)) || !ValidTenantID(own) {
		t.Fatal("label or id bound")
	}
	var full []Tenant
	for i := 0; i < MaxTenants; i++ {
		full = append(full, Tenant{ID: fmt.Sprintf("00000000-0000-4000-8000-%012d", i), Label: "T"})
	}
	if _, ok := ReadTenants(TenantsValue(full)); !ok {
		t.Fatal("a full list is refused")
	}
	if _, ok := SetTenant(full, Tenant{ID: own, Label: "X"}); ok {
		t.Fatal("a 33rd entry was added")
	}
	if _, ok := ReadTenants(TenantsValue(append(full, Tenant{ID: own, Label: "X"}))); ok {
		t.Fatal("a 33rd entry was read")
	}
	// Relabelling keeps the organisation's place; removal takes only it.
	relabelled, ok := SetTenant(list, Tenant{ID: own, Label: "Own Oy"})
	if !ok || relabelled[0] != (Tenant{own, "Own Oy"}) || len(relabelled) != 2 || list[0].Label != "Own Ltd" {
		t.Fatalf("relabel %v", relabelled)
	}
	if rest := RemoveTenant(relabelled, own); len(rest) != 1 || rest[0].ID != client {
		t.Fatalf("remove %v", rest)
	}
}
