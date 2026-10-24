package nativegitea

import (
	"strings"
	"testing"
)

func fixtureEntries(t *testing.T, extra string) []entry {
	t.Helper()
	data := fixture
	if extra != "" {
		data = strings.Replace(fixture, "preferences:", extra+"preferences:", 1)
	}
	doc, err := parseDocument([]byte(data))
	if err != nil {
		t.Fatal(err)
	}
	return doc.entries
}

func TestMatchCredential(t *testing.T) {
	es := fixtureEntries(t, "    - name: v6\n      url: https://[fd00::5]:3000\n      token: tok-ivan-0007\n      user: ivan\n")
	type c struct {
		name     string
		req      CredentialRequest
		explicit string
		token    string // "" means no credential
		err      error
	}
	r := func(proto, host, path, user string) CredentialRequest {
		return CredentialRequest{Protocol: proto, Host: host, Path: path, Username: user}
	}
	for _, tc := range []c{
		{"first account on shared host", r("https", "git.example.org", "o/r.git", "alice"), "", "tok-alice-0001", nil},
		{"second account on shared host", r("https", "git.example.org", "o/r.git", "bob"), "", "tok-bob-0002", nil},
		{"username case", r("https", "GIT.example.org", "o/r.git", "Bob"), "", "tok-bob-0002", nil},
		{"two accounts need a username", r("https", "git.example.org", "o/r.git", ""), "", "", ErrAmbiguous},
		{"unknown user", r("https", "git.example.org", "o/r.git", "mallory"), "", "", ErrNoMatch},
		{"base path instance", r("https", "git.example.org", "gitea/o/r.git", "carol"), "", "tok-carol-0003", nil},
		{"sole account in base needs no username", r("https", "git.example.org", "gitea/o/r.git", ""), "", "tok-carol-0003", nil},
		{"root account never lent to base-path instance", r("https", "git.example.org", "gitea/o/r.git", "alice"), "", "", ErrNoMatch},
		{"base boundary is a segment", r("https", "git.example.org", "giteax/r.git", "alice"), "", "tok-alice-0001", nil},
		{"base-path account not used at root", r("https", "git.example.org", "o/r.git", "carol"), "", "", ErrNoMatch},
		{"explicit port", r("https", "git.example.org:3000", "o/r.git", "dave"), "", "tok-dave-0004", nil},
		{"port is part of the host", r("https", "git.example.org:3000", "o/r.git", "alice"), "", "", ErrNoMatch},
		{"default port is not 3000", r("https", "git.example.org", "o/r.git", "dave"), "", "", ErrNoMatch},
		{"explicit 443", r("https", "git.example.org:443", "o/r.git", "alice"), "", "tok-alice-0001", nil},
		{"ipv6", r("https", "[fd00::5]:3000", "o/r.git", "ivan"), "", "tok-ivan-0007", nil},
		{"http never", r("http", "git.example.org", "o/r.git", "alice"), "", "", ErrNoMatch},
		{"no path means no base check", r("https", "git.example.org", "", "alice"), "", "", ErrNoMatch},
		{"dot segment", r("https", "git.example.org", "gitea/../o/r.git", "alice"), "", "", ErrNoMatch},
		{"encoded path", r("https", "git.example.org", "o/r%2fx.git", "alice"), "", "", ErrNoMatch},
		{"cross host", r("https", "evil.example.org", "o/r.git", "alice"), "", "", ErrNoMatch},
		{"userinfo in host", r("https", "alice@git.example.org", "o/r.git", "alice"), "", "", ErrNoMatch},
		{"oauth entry unsupported", r("https", "other.example.org", "o/r.git", "erin"), "", "", ErrNoMatch},
		{"ssh entry has no token", r("https", "other.example.org", "o/r.git", "frank"), "", "", ErrNoMatch},
		{"insecure entry never", r("https", "insecure.example.org", "o/r.git", "gina"), "", "", ErrNoMatch},
		{"explicit selects within instance", r("https", "git.example.org", "o/r.git", "alice"), "WORK", "tok-alice-0001", nil},
		{"explicit with absent username", r("https", "git.example.org", "o/r.git", ""), "work", "tok-alice-0001", nil},
		{"explicit cannot cross host", r("https", "evil.example.org", "o/r.git", "alice"), "work", "", ErrNoMatch},
		{"explicit cannot cross port", r("https", "git.example.org:3000", "o/r.git", "alice"), "work", "", ErrNoMatch},
		{"explicit cannot cross base", r("https", "git.example.org", "gitea/o/r.git", "alice"), "work", "", ErrNoMatch},
		{"explicit cannot change user", r("https", "git.example.org", "o/r.git", "bob"), "work", "", ErrNoMatch},
		{"nested path is not a root repository", r("https", "git.example.org", "a/b/c.git", "alice"), "", "", ErrNoMatch},
		{"single segment is not a repository", r("https", "git.example.org", "r.git", "alice"), "", "", ErrNoMatch},
		{"explicit unknown", r("https", "git.example.org", "o/r.git", "alice"), "nope", "", ErrNoMatch},
	} {
		got, err := match(es, tc.req, tc.explicit)
		if err != tc.err || got.Password != tc.token {
			t.Errorf("%s: %q %v, want %q %v", tc.name, got.Password, err, tc.token, tc.err)
		}
	}

	// A duplicated account is ambiguous; tea would pick the first, we pick neither.
	dup := fixtureEntries(t, "    - name: again\n      url: https://git.example.org/\n      token: tok-alice-0099\n      user: ALICE\n")
	if _, err := match(dup, r("https", "git.example.org", "o/r.git", "alice"), ""); err != ErrAmbiguous {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := match(dup, r("https", "git.example.org", "o/r.git", "alice"), "work"); err != ErrAmbiguous {
		t.Fatalf("duplicate with explicit name: %v", err)
	}
	if got, err := match(dup, r("https", "git.example.org", "o/r.git", "bob"), ""); err != nil || got.Password != "tok-bob-0002" {
		t.Fatalf("unrelated account affected: %v", err)
	}
	// An unsupported entry at the same base still claims that base path, so
	// a shorter base's account is not lent to it, and it makes a missing
	// username ambiguous.
	claim := fixtureEntries(t, "    - name: subauth\n      url: https://git.example.org/gitea\n      user: ken\n      auth_method: oauth\n")
	if _, err := match(claim, r("https", "git.example.org", "gitea/o/r.git", ""), ""); err != ErrAmbiguous {
		t.Fatalf("sole-account selection with another entry: %v", err)
	}
}

// After the base-path instance's own login is removed, its repositories
// must not receive the root instance's token.
func TestRemovedSubInstanceNotLentRootToken(t *testing.T) {
	doc, err := parseDocument([]byte("logins:\n    - name: root\n      url: https://git.example.org\n      token: tok-root\n      user: alice\n"))
	if err != nil {
		t.Fatal(err)
	}
	req := CredentialRequest{Protocol: "https", Host: "git.example.org", Path: "gitea/team/repo.git", Username: "alice"}
	if c, err := match(doc.entries, req, ""); err != ErrNoMatch || c.Password != "" {
		t.Fatalf("%q %v", c.Password, err)
	}
}

func TestProjectionDropsInvalidURL(t *testing.T) {
	doc, err := parseDocument([]byte("logins:\n    - name: x\n      url: https://alice:SECRET@git.example.org/?q=1\n      token: tok\n      user: alice\n"))
	if err != nil {
		t.Fatal(err)
	}
	if l := doc.projection()[0]; l.Kind != KindInvalid || l.URL != "" || strings.Contains(l.ConnectionID()+l.URL, "SECRET") {
		t.Fatalf("%+v", l)
	}
}

func TestParseCredentialRequest(t *testing.T) {
	req, err := ParseCredentialRequest(strings.NewReader("capability[]=authtype\nprotocol=https\nhost=git.example.org:3000\npath=o/r.git\nusername=bob\nwwwauth[]=Basic realm=x\n\nignored=after-blank\n"))
	if err != nil || req != (CredentialRequest{Protocol: "https", Host: "git.example.org:3000", Path: "o/r.git", Username: "bob"}) {
		t.Fatalf("%+v %v", req, err)
	}
	for _, in := range []string{
		"protocol=https\nprotocol=http\n",
		"host=a\nhost=b\n",
		"url=https://git.example.org/o/r.git\n",
		"protocol=https\x00\n",
		"novalue\n",
		"path=" + strings.Repeat("a", maxRequestLine) + "\n",
		strings.Repeat("capability[]=x\n", maxRequest/10),
	} {
		if _, err := ParseCredentialRequest(strings.NewReader(in)); err != ErrInvalidRequest {
			t.Errorf("%.40q accepted: %v", in, err)
		}
	}
}
