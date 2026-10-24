// Package egress holds the dial-time destination rule shared by the daemon's
// outbound requests that carry a person's credentials. It holds no authority
// of its own and is not same-UID egress isolation.
package egress

import "net/netip"

// Metadata endpoints outside the link-local ranges. Link-local already
// covers 169.254.169.254 and fe80::/10.
var metadataAddrs = []netip.Addr{
	netip.MustParseAddr("fd00:ec2::254"),   // AWS IPv6 instance metadata
	netip.MustParseAddr("100.100.100.200"), // Alibaba Cloud metadata
}

// Allowed is the dial-time network boundary Jari approved on 2026-10-24:
// LAN, VPN and public addresses are allowed, loopback only when the person
// named it, and unspecified, multicast, link-local and metadata destinations
// never. Callers apply it to every resolved address, so DNS cannot move a
// name onto a refused class.
func Allowed(ip netip.Addr, loopback bool) bool {
	ip = ip.Unmap()
	if !ip.IsValid() || ip.Zone() != "" {
		return false
	}
	switch {
	case ip.IsUnspecified(), ip.IsMulticast(), ip.IsLinkLocalUnicast(),
		ip.IsLinkLocalMulticast(), ip.IsInterfaceLocalMulticast():
		return false
	case ip.Is4() && (ip.As4()[0] == 0 || ip == netip.AddrFrom4([4]byte{255, 255, 255, 255})):
		return false
	case ip.IsLoopback():
		return loopback
	}
	for _, m := range metadataAddrs {
		if ip == m {
			return false
		}
	}
	return true
}
