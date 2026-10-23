//go:build linux

package host

import (
	"net"
	"os"
	"strconv"
	"strings"
)

// Observation only: never reserve a port or relax the kernel's port threshold.
// Unit ownership/override checks separately establish that our policy will run.
func gatewayListenReady(listen string) error {
	addr, e := net.ResolveTCPAddr("tcp", listen)
	if e != nil || addr.Port < 1 {
		return ErrNativeApply
	}
	if addr.Zone != "" {
		if _, e := net.InterfaceByName(addr.Zone); e != nil {
			return e
		}
	}
	addrs, e := net.InterfaceAddrs()
	if e != nil {
		return e
	}
	if !addr.IP.IsUnspecified() && len(addr.IP) != 0 {
		found := false
		for _, a := range addrs {
			ip, _, err := net.ParseCIDR(a.String())
			if err == nil && ip.Equal(addr.IP) {
				found = true
			}
		}
		if !found {
			return ErrNativeApply
		}
	}
	// A customer may raise the kernel threshold above 1024. We never grant
	// capabilities to declared high ports; reject those now rather than failing
	// at activation or quietly relaxing that customer's sysctl.
	if addr.Port >= 1024 {
		b, e := os.ReadFile("/proc/sys/net/ipv4/ip_unprivileged_port_start")
		if e != nil {
			return e
		}
		if !unprivilegedPortAllowed(addr.Port, string(b)) {
			return ErrNativeApply
		}
	}
	if addr.Port < 1024 {
		b, e := os.ReadFile("/proc/1/status")
		if e != nil {
			return e
		}
		if !managerCanBindLowPort(string(b)) {
			return ErrNativeApply
		}
	}
	return nil
}

func managerCanBindLowPort(status string) bool {
	// systemd must be able to place the bit in its child's permitted and
	// inheritable sets before changing UID and raising the ambient set.
	found := 0
	for _, line := range strings.Split(status, "\n") {
		key, value, ok := strings.Cut(line, ":")
		if !ok || (key != "CapBnd" && key != "CapPrm") {
			continue
		}
		n, e := strconv.ParseUint(strings.TrimSpace(value), 16, 64)
		if e != nil || n&(1<<10) == 0 {
			return false
		} // CAP_NET_BIND_SERVICE
		if key == "CapBnd" {
			found |= 1
		} else {
			found |= 2
		}
	}
	return found == 3
}

func unprivilegedPortAllowed(port int, threshold string) bool {
	n, e := strconv.ParseUint(strings.TrimSpace(threshold), 10, 16)
	return e == nil && port >= int(n)
}
