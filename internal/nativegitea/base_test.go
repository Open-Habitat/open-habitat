package nativegitea

import "testing"

func TestParseBase(t *testing.T) {
	ok := map[string]string{
		"git.example.org":                   "https://git.example.org",
		"https://git.example.org/":          "https://git.example.org",
		"HTTPS://Git.Example.ORG":           "https://git.example.org",
		"git.example.org:443":               "https://git.example.org",
		"git.example.org:3000/gitea/":       "https://git.example.org:3000/gitea",
		"https://git.example.org/a/b-c.d_e": "https://git.example.org/a/b-c.d_e",
		"10.0.0.5:3000":                     "https://10.0.0.5:3000",
		"https://[fd00::5]:3000/gitea":      "https://[fd00::5]:3000/gitea",
		"[::1]":                             "https://[::1]",
		"localhost:3000":                    "https://localhost:3000",
	}
	for in, want := range ok {
		b, err := ParseBase(in)
		if err != nil || b.String() != want {
			t.Errorf("%q: %v %q, want %q", in, err, b.String(), want)
		}
	}
	for _, in := range []string{
		"", "http://git.example.org", "ssh://git.example.org", "git://x.org", "http:/x.org",
		"https://user@git.example.org", "https://u:p@git.example.org", "git.example.org?x=1", "git.example.org#f",
		"git.example.org/%2e%2e", "git.example.org/a/../b", "git.example.org/./a", "git.example.org//a",
		"git.example.org\\a", " git.example.org", "git.example.org ", "git.exa\tmple.org", "gït.example.org",
		"git.example.org:", "git.example.org:0", "git.example.org:65536", "git.example.org:0443", "git.example.org:x",
		"[fe80::1%eth0]", "[::ffff:1.2.3.4", "[1.2.3.4]", "127.1", "0x7f.0.0.1", "010.0.0.1", "10.1",
		"-git.example.org", "git..example.org", "git.example.org.", "https://", "a:1:2",
	} {
		if b, err := ParseBase(in); err == nil {
			t.Errorf("%q accepted as %q", in, b.String())
		}
	}
}

// A remote reaches a login when the helper would match its host and port,
// whatever case or default port the remote spells.
func TestRemoteAuthority(t *testing.T) {
	for in, want := range map[string]string{
		"https://git.example.org/a/b.git":        "https://git.example.org",
		"HTTPS://GIT.example.org:443/a/b":        "https://git.example.org",
		"https://ada@git.example.org:3000/g/a/b": "https://git.example.org:3000",
		"https://[fd00::5]:3000/a/b.git":         "https://[fd00::5]:3000",
		"https://git.example.org?x":              "https://git.example.org",
	} {
		b, ok := RemoteAuthority(in)
		if !ok || b.String() != want {
			t.Errorf("%q: %v %q, want %q", in, ok, b.String(), want)
		}
	}
	for _, in := range []string{"http://git.example.org/a/b", "ssh://git.example.org/a/b", "git@git.example.org:a/b.git", "file:///srv/a.git", "https://127.1/a/b", "https://git.example.org:0/a", "/srv/a.git"} {
		if b, ok := RemoteAuthority(in); ok {
			t.Errorf("%q accepted as %q", in, b.String())
		}
	}
}
