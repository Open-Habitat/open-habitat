package nativegitlab

import (
	"os"
	"strings"
	"testing"
)

func blankConfig(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile("testdata/glab-1.124-blank.yml")
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func mustBase(t *testing.T, s string) Base {
	t.Helper()
	b, err := ParseBase(s)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

// glab's first run writes a gitlab.com entry with every per-host key empty;
// it holds no credential, so it is no connection.
func TestBlankGlabConfigHasNoLogins(t *testing.T) {
	doc, err := parseDocument(blankConfig(t))
	if err != nil {
		t.Fatal(err)
	}
	if got := doc.projection(); len(got) != 0 {
		t.Fatalf("%+v", got)
	}
	if len(doc.entries) != 1 || doc.entries[0].Key != "gitlab.com" || doc.entries[0].signedIn {
		t.Fatalf("%+v", doc.entries)
	}
	for _, empty := range []string{"", "\n", "# only a comment\n", "~\n"} {
		if doc, err := parseDocument([]byte(empty)); err != nil || len(doc.projection()) != 0 {
			t.Errorf("%q: %v", empty, err)
		}
	}
}

const hostsFixture = `hosts:
    gitlab.com:
        token: glpat-ada-0001
        user: ada
        api_protocol: https
        api_host: gitlab.com
        git_protocol: https
        use_keyring: "false"
    gitlab.example.org:8443:
        token: glpat-bob-0002
        user: bob
        subfolder: /gitlab/
    oauth.example.org:
        token: oauth-access
        is_oauth2: "true"
        oauth2_refresh_token: r
        user: carol
    keyring.example.org:
        use_keyring: "true"
        user: dave
    insecure.example.org:
        token: glpat-erin
        user: erin
        skip_tls_verify: "true"
    proxy.example.org:
        token: glpat-frank
        user: frank
        proxy: http://proxy:3128
    headers.example.org:
        token: glpat-gina
        user: gina
        custom_headers:
            - name: X
              value: y
    http.example.org:
        token: glpat-hank
        user: hank
        api_protocol: http
    api.example.org:
        token: glpat-ivan
        user: ivan
        api_host: elsewhere.example.org
    ci.example.org:
        job_token: ci-job
    alias.example.org:
        gitlab_token: glpat-judy
        user: judy
    nouser.example.org:
        token: glpat-kim
    GitLab.Upper.org:
        token: glpat-lee
        user: lee
    twice.example.org:
        token: glpat-mo-1
        user: mo
    twice.example.org:443:
        token: glpat-mo-2
        user: mo
    loggedout.example.org:
        user: nell
        git_protocol: ssh
`

func TestClassifyHostEntries(t *testing.T) {
	doc, err := parseDocument([]byte(hostsFixture))
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]struct {
		kind      Kind
		url       string
		ambiguous bool
	}{
		"gitlab.com":              {KindPAT, "https://gitlab.com", false},
		"gitlab.example.org:8443": {KindPAT, "https://gitlab.example.org:8443/gitlab", false},
		"oauth.example.org":       {KindOAuth, "https://oauth.example.org", false},
		"keyring.example.org":     {KindKeyring, "https://keyring.example.org", false},
		"insecure.example.org":    {KindInsecure, "https://insecure.example.org", false},
		"proxy.example.org":       {KindInsecure, "https://proxy.example.org", false},
		"headers.example.org":     {KindInsecure, "https://headers.example.org", false},
		"http.example.org":        {KindInsecure, "https://http.example.org", false},
		"api.example.org":         {KindInvalid, "https://api.example.org", false},
		"ci.example.org":          {KindInvalid, "https://ci.example.org", false},
		"alias.example.org":       {KindInvalid, "https://alias.example.org", false},
		"nouser.example.org":      {KindInvalid, "https://nouser.example.org", false},
		"GitLab.Upper.org":        {KindInvalid, "", false},
		"twice.example.org":       {KindPAT, "https://twice.example.org", true},
		"twice.example.org:443":   {KindInvalid, "", true},
	}
	got := map[string]Login{}
	for _, l := range doc.projection() {
		got[l.Key] = l
	}
	if len(got) != len(want) {
		t.Errorf("listed %d, want %d: %+v", len(got), len(want), got)
	}
	for key, w := range want {
		l, ok := got[key]
		if !ok || l.Kind != w.kind || l.URL != w.url || l.Ambiguous != w.ambiguous {
			t.Errorf("%s: %+v, want %+v", key, l, w)
		}
		if l.Usable() != (w.kind == KindPAT && !w.ambiguous) {
			t.Errorf("%s: usable %v", key, l.Usable())
		}
	}
	if _, listed := got["loggedout.example.org"]; listed {
		t.Error("a logged-out entry is no connection")
	}
	a, b := got["gitlab.com"], got["gitlab.example.org:8443"]
	if a.ConnectionID() == b.ConnectionID() || !strings.HasPrefix(a.ConnectionID(), "gitlab_") || len(a.ConnectionID()) != 31 {
		t.Fatal(a.ConnectionID(), b.ConnectionID())
	}
}

func TestUnreadableDocumentsAreUnavailable(t *testing.T) {
	for _, bad := range []string{
		"hosts: [1]\n",
		"hosts:\n    a: 1\nhosts:\n    b: 2\n",
		"- a\n- b\n",
		"x: &a 1\ny: *a\n",
		"a: 1\n---\nb: 2\n",
		"hosts:\n  [x]: {}\n",
		"\tbad",
	} {
		if _, err := parseDocument([]byte(bad)); err != ErrUnavailable {
			t.Errorf("%q: %v", bad, err)
		}
	}
	// A host entry glab could read another way is shown as invalid and
	// counts as signed in: nothing fills or lends it.
	doc, err := parseDocument([]byte("hosts:\n    a.example.org: 5\n    b.example.org:\n        token: x\n        token: y\n        user: u\n    c.example.org:\n        token: {a: b}\n        user: u\n"))
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range doc.projection() {
		if l.Kind != KindInvalid {
			t.Errorf("%+v", l)
		}
	}
	if len(doc.projection()) != 3 {
		t.Fatalf("%+v", doc.projection())
	}
}

func TestValidFullName(t *testing.T) {
	deep := strings.Repeat("g/", 20) + "p"
	for _, ok := range []string{"a/b", "konepaja/verkkokauppa/infra/terraform", "aino.virtanen/notes", "a_b/c-d.e", deep} {
		if !ValidFullName(ok) {
			t.Errorf("%q refused", ok)
		}
	}
	for _, bad := range []string{"", "a", "a/", "/a/b", "a//b", "a/./b", "a/../b", "a/-/b", "a/b.git", "a/b.atom", "a/b c", "a/b%2f", strings.Repeat("g/", 21) + "p", "a/" + strings.Repeat("x", 256), "a/b~c"} {
		if ValidFullName(bad) {
			t.Errorf("%q accepted", bad)
		}
	}
	if Name("a/b/c") != "c" || Namespace("a/b/c") != "a/b" {
		t.Fatal(Name("a/b/c"), Namespace("a/b/c"))
	}
}

func TestMatchCredential(t *testing.T) {
	doc, err := parseDocument([]byte(hostsFixture))
	if err != nil {
		t.Fatal(err)
	}
	r := func(proto, host, path, user string) CredentialRequest {
		return CredentialRequest{Protocol: proto, Host: host, Path: path, Username: user}
	}
	for _, tc := range []struct {
		name  string
		req   CredentialRequest
		token string
		err   error
	}{
		{"nested project", r("https", "gitlab.com", "konepaja/verkkokauppa/infra/terraform.git", "ada"), "glpat-ada-0001", nil},
		{"no username", r("https", "gitlab.com", "ada/notes.git", ""), "glpat-ada-0001", nil},
		{"username case", r("https", "GITLAB.com:443", "ada/notes", "ADA"), "glpat-ada-0001", nil},
		{"another user", r("https", "gitlab.com", "ada/notes.git", "mallory"), "", ErrNoMatch},
		{"http never", r("http", "gitlab.com", "ada/notes.git", "ada"), "", ErrNoMatch},
		{"no path", r("https", "gitlab.com", "", "ada"), "", ErrNoMatch},
		{"one segment", r("https", "gitlab.com", "notes.git", "ada"), "", ErrNoMatch},
		{"route segment", r("https", "gitlab.com", "ada/-/raw.git", "ada"), "", ErrNoMatch},
		{"below a repository", r("https", "gitlab.com", "ada/notes.git/info/lfs", "ada"), "", ErrNoMatch},
		{"dot segment", r("https", "gitlab.com", "ada/../notes.git", "ada"), "", ErrNoMatch},
		{"too deep", r("https", "gitlab.com", strings.Repeat("g/", 21)+"p.git", "ada"), "", ErrNoMatch},
		{"subfolder base", r("https", "gitlab.example.org:8443", "gitlab/team/app.git", "bob"), "glpat-bob-0002", nil},
		{"outside subfolder", r("https", "gitlab.example.org:8443", "team/app.git", "bob"), "", ErrNoMatch},
		{"port is the server", r("https", "gitlab.example.org", "gitlab/team/app.git", "bob"), "", ErrNoMatch},
		{"oauth never", r("https", "oauth.example.org", "c/r.git", "carol"), "", ErrNoMatch},
		{"keyring never", r("https", "keyring.example.org", "d/r.git", "dave"), "", ErrNoMatch},
		{"insecure never", r("https", "insecure.example.org", "e/r.git", "erin"), "", ErrNoMatch},
		{"api elsewhere never", r("https", "api.example.org", "i/r.git", "ivan"), "", ErrNoMatch},
		{"two keys for one server", r("https", "twice.example.org", "m/r.git", "mo"), "", ErrAmbiguous},
		{"logged out", r("https", "loggedout.example.org", "n/r.git", "nell"), "", ErrNoMatch},
		{"unknown server", r("https", "evil.example.org", "ada/notes.git", "ada"), "", ErrNoMatch},
		{"userinfo in host", r("https", "ada@gitlab.com", "ada/notes.git", "ada"), "", ErrNoMatch},
	} {
		c, err := match(doc.entries, tc.req)
		if err != tc.err || c.Password != tc.token {
			t.Errorf("%s: %+v %v", tc.name, c, err)
		}
		if err == nil && c.Username == "" {
			t.Errorf("%s: no username", tc.name)
		}
	}
}

func TestMatchOriginNestedPaths(t *testing.T) {
	bases := []Base{mustBase(t, "https://gitlab.com"), mustBase(t, "https://gitlab.example.org:8443/gitlab")}
	for in, want := range map[string]string{
		"https://gitlab.com/konepaja/verkkokauppa/infra/terraform.git": "konepaja/verkkokauppa/infra/terraform",
		"https://gitlab.com/ada/notes":                                 "ada/notes",
		"https://GITLAB.com:443/ada/notes.git":                         "ada/notes",
		"https://gitlab.example.org:8443/gitlab/team/app.git":          "team/app",
	} {
		_, name, ok := MatchOrigin(in, bases)
		if !ok || name != want {
			t.Errorf("%s: %v %q", in, ok, name)
		}
	}
	for _, in := range []string{
		"git@gitlab.com:ada/notes.git", "ssh://git@gitlab.com/ada/notes.git", "https://ada@gitlab.com/ada/notes.git",
		"https://gitlab.com/notes.git", "https://gitlab.com/ada/-/notes.git", "https://gitlab.com/ada/%2e%2e/notes.git",
		"https://gitlab.example.org:8443/team/app.git", "https://other.example.org/ada/notes.git", "https://gitlab.com/ada/notes.git?x",
	} {
		if _, name, ok := MatchOrigin(in, bases); ok {
			t.Errorf("%s matched as %q", in, name)
		}
	}
}
