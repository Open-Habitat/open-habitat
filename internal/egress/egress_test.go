package egress

import (
	"net/netip"
	"testing"
)

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
		if got := Allowed(netip.MustParseAddr(c.ip), c.loopback); got != c.allowed {
			t.Errorf("%s loopback=%v: %v", c.ip, c.loopback, got)
		}
	}
}
