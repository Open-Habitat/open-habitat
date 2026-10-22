//go:build linux

package host

import (
	"context"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

// ProbeUpgradeListener is a fixed read-only subprocess entry point so root can
// exercise the production peer checks as the actual gateway/mapped kernel UID.
// It cannot start work, submit credentials, select an arbitrary URL or return
// daemon content. It is not a new daemon/gateway administrative API.
func ProbeUpgradeListener(kind, name string) bool {
	if os.Geteuid() == 0 || !siteIDRE.MatchString(name) {
		return false
	}
	path, route := "", ""
	switch kind {
	case "agent":
		path = "/run/open-habitat/users/" + name + "/agent.sock"
		route = "/agent/v1/environment"
	case "web":
		path = "/run/open-habitat/users/" + name + "/daemon.sock"
		route = "/api/v1/conversations"
	default:
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		var d net.Dialer
		return d.DialContext(ctx, "unix", path)
	}}
	defer transport.CloseIdleConnections()
	req, e := http.NewRequestWithContext(ctx, http.MethodGet, "http://unix"+route, nil)
	if e != nil {
		return false
	}
	client := &http.Client{Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	response, e := client.Do(req)
	if e != nil {
		return false
	}
	defer response.Body.Close()
	io.Copy(io.Discard, io.LimitReader(response.Body, 1024))
	return response.StatusCode == http.StatusOK
}
