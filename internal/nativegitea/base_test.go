package nativegitea

import (
	"net/netip"
	"testing"
)

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

func TestAllowedDestination(t *testing.T) {
	cases := []struct {
		ip       string
		loopback bool
		allowed  bool
	}{
		{"10.0.0.5", false, true},
		{"192.168.1.10", false, true},
		{"100.64.1.2", false, true}, // VPN/CGNAT range stays allowed
		{"203.0.113.7", false, true},
		{"fd12:3456::1", false, true}, // ULA (VPN/LAN)
		{"2001:db8::1", false, true},
		{"127.0.0.1", false, false},
		{"127.0.0.1", true, true},
		{"::1", false, false},
		{"::1", true, true},
		{"::ffff:127.0.0.1", false, false},
		{"0.0.0.0", true, false},
		{"::", true, false},
		{"0.1.2.3", false, false},
		{"255.255.255.255", false, false},
		{"169.254.169.254", true, false},
		{"::ffff:169.254.169.254", false, false},
		{"fe80::1", true, false},
		{"fd00:ec2::254", false, false},
		{"100.100.100.200", false, false},
		{"224.0.0.1", false, false},
		{"ff02::1", false, false},
		{"ff01::1", false, false},
	}
	for _, c := range cases {
		if got := allowedDestination(netip.MustParseAddr(c.ip), c.loopback); got != c.allowed {
			t.Errorf("%s loopback=%v: %v", c.ip, c.loopback, got)
		}
	}
}
