//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/publicsuffix"

	"github.com/Open-Habitat/open-habitat/internal/egress"
)

// A person knows their provider's DAV address (https://contacts.icloud.com),
// not the partition host that serves their account (p42-contacts.icloud.com).
// iCloud answers the known address with the account's principal, and the
// principal names an absolute home set on the partition host; Nextcloud and
// others announce the DAV root through /.well-known/ (RFC 6764). Connect
// therefore walks that chain once, with the person's credentials, and stores
// the account's final home set as curl's URL. Every later request (status,
// renewal, the agent's own) uses that one stored URL and follows no redirect.
//
// The walk sends the credentials only to the host the person entered and to
// hosts under its registrable domain (public suffix list), over HTTPS, after
// every resolved address passed the same dial-time rule as Gitea's client;
// curl is pinned to the checked addresses so it cannot resolve the name again
// onto a refused one.

const (
	davMaxHops     = 8
	davStatusMark  = "open-habitat-dav-status"
	davResolveTime = 10 * time.Second
)

// errDAVDestination is a host outside the dial-time rule or the entered site.
var errDAVDestination = errors.New("dav destination refused")

// davLoopback reports whether the person named a loopback destination
// themselves. Only then may the daemon send their credentials to loopback.
func davLoopback(host string) bool {
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err == nil && ip.IsLoopback()
}

// davPin resolves the URL's host, refuses it unless every address passes the
// dial-time rule, and returns curl's --resolve value pinning those addresses.
func davPin(ctx context.Context, env Env, raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" {
		return "", errDAVDestination
	}
	host, port := strings.ToLower(u.Hostname()), u.Port()
	if port == "" {
		port = "443"
	}
	ctx, cancel := context.WithTimeout(ctx, davResolveTime)
	defer cancel()
	var addrs []netip.Addr
	if ip, err := netip.ParseAddr(host); err == nil {
		addrs = []netip.Addr{ip}
	} else if env.Resolve != nil {
		addrs, err = env.Resolve(ctx, host)
	} else {
		addrs, err = net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	}
	if err != nil || len(addrs) == 0 {
		return "", ServerUnreachable
	}
	list := make([]string, 0, len(addrs))
	for _, ip := range addrs {
		if !egress.Allowed(ip, davLoopback(host)) {
			return "", errDAVDestination
		}
		ip = ip.Unmap()
		if ip.Is6() {
			list = append(list, "["+ip.String()+"]")
		} else {
			list = append(list, ip.String())
		}
	}
	return host + ":" + port + ":" + strings.Join(list, ","), nil
}

// davSite is the registrable domain a discovery may move within. An IP
// literal, or a name that is itself a public suffix, is its own site.
func davSite(host string) string {
	if _, err := netip.ParseAddr(host); err == nil {
		return host
	}
	site, err := publicsuffix.EffectiveTLDPlusOne(host)
	if err != nil {
		return host
	}
	return site
}

// davCanonical lowercases the host and drops the default port, so the stored
// URL and curl's pinned name agree.
func davCanonical(u *url.URL) string {
	c := *u
	c.Host = strings.ToLower(u.Hostname())
	if p := u.Port(); p != "" && p != "443" {
		c.Host += ":" + p
	}
	return c.String()
}

// davNext resolves a redirect target or DAV href against the current URL and
// accepts it only as an HTTPS URL on the entered site, with nothing a curl
// config may not carry.
func davNext(site, cur, ref string) (string, bool) {
	base, err := url.Parse(cur)
	if err != nil {
		return "", false
	}
	r, err := url.Parse(ref)
	if err != nil {
		return "", false
	}
	n := base.ResolveReference(r)
	host := strings.ToLower(n.Hostname())
	if n.Scheme != "https" || n.User != nil || n.RawQuery != "" || n.ForceQuery || n.Fragment != "" || n.Opaque != "" || !hostPattern.MatchString(host) || davSite(host) != site {
		return "", false
	}
	if p := n.Port(); p != "" {
		if v, err := strconv.Atoi(p); err != nil || v < 1 || v > 65535 {
			return "", false
		}
	}
	out := davCanonical(n)
	if len(out) > 2048 || strings.ContainsAny(out, "\r\n\t ") {
		return "", false
	}
	return out, true
}

// discover walks from the entered URL to the account's DAV home set and
// returns the URL to store. A 207 without principal or home set is a direct
// collection URL and is kept as entered, as before discovery existed.
func (d *dav) discover(ctx context.Context, env Env, a PasswordAccount) (string, error) {
	tool, ok := env.Tool("curl")
	if !ok {
		return "", ToolFailed
	}
	entered, err := url.Parse(a.URL)
	if err != nil {
		return "", ToolFailed
	}
	site := davSite(strings.ToLower(entered.Hostname()))
	cur := davCanonical(entered)
	visited := map[string]bool{}
	wellKnown, atHome := false, false
	for range davMaxHops {
		if visited[cur] {
			return "", EndpointRejected
		}
		visited[cur] = true
		hop := a
		hop.URL = cur
		status, location, body, err := d.propfind(ctx, env, tool, hop)
		if err != nil {
			return "", err
		}
		switch {
		case status >= 300 && status < 400:
			next, ok := davNext(site, cur, location)
			if !ok {
				return "", EndpointRejected
			}
			cur = next
		case status == 401 || status == 403:
			return "", CredentialsRejected
		case status == 207:
			if atHome {
				return cur, nil
			}
			principal, home := davHrefs(body, d.provider)
			if home != "" {
				next, ok := davNext(site, cur, home)
				if !ok {
					return "", EndpointRejected
				}
				if next == cur {
					return cur, nil
				}
				cur, atHome = next, true
				continue
			}
			if principal != "" {
				next, ok := davNext(site, cur, principal)
				if !ok {
					return "", EndpointRejected
				}
				if !visited[next] {
					cur = next
					continue
				}
			}
			return cur, nil
		default:
			// Not a DAV resource: try the provider's announced DAV root once.
			if wellKnown {
				return "", EndpointRejected
			}
			wellKnown = true
			root := *entered
			root.Path, root.RawPath = "/.well-known/"+string(d.provider), ""
			cur = davCanonical(&root)
		}
	}
	return "", EndpointRejected
}

// propfind asks one URL for the principal and home set. Credentials reach
// curl only through stdin; curl follows nothing and reports the raw Location
// for discover to judge. (curl's %{redirect_url} would carry the configured
// credentials as userinfo.)
func (d *dav) propfind(ctx context.Context, env Env, tool string, a PasswordAccount) (int, string, []byte, error) {
	pin, err := davPin(ctx, env, a.URL)
	if errors.Is(err, errDAVDestination) {
		return 0, "", nil, EndpointRejected
	} else if err != nil {
		return 0, "", nil, ServerUnreachable
	}
	ns, resource := davNamespace(d.provider)
	body := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:x="%s"><d:prop><d:current-user-principal/><x:%s-home-set/></d:prop></d:propfind>`, ns, resource)
	out, err := env.run(ctx, Command{Path: tool, Args: []string{"--disable", "--config", "-", "--silent", "--max-time", "10", "--resolve", pin, "--request", "PROPFIND", "--header", "Depth: 0", "--header", "Content-Type: application/xml; charset=utf-8", "--data-binary", body, "--write-out", `\n` + davStatusMark + ` %{http_code} %header{location}`}}, bytesReader(davConfig(a)))
	if errors.Is(err, ToolFailed) {
		return 0, "", nil, ToolFailed
	}
	if ctx.Err() != nil || err != nil {
		return 0, "", nil, ServerUnreachable
	}
	i := bytes.LastIndex(out, []byte("\n"+davStatusMark+" "))
	if i < 0 {
		return 0, "", nil, ToolFailed
	}
	code, location, _ := strings.Cut(strings.TrimSpace(string(out[i+len(davStatusMark)+2:])), " ")
	status, err := strconv.Atoi(code)
	if err != nil {
		return 0, "", nil, ToolFailed
	}
	location = strings.TrimSpace(location)
	return status, location, out[:i], nil
}

func davNamespace(p Provider) (string, string) {
	if p == CardDAV {
		return "urn:ietf:params:xml:ns:carddav", "addressbook"
	}
	return "urn:ietf:params:xml:ns:caldav", "calendar"
}

// davHrefs reads the first current-user-principal and home-set hrefs of a
// multistatus. Malformed XML yields what was read before the error.
func davHrefs(body []byte, p Provider) (principal, home string) {
	ns, resource := davNamespace(p)
	principalName := xml.Name{Space: "DAV:", Local: "current-user-principal"}
	homeName := xml.Name{Space: ns, Local: resource + "-home-set"}
	href := xml.Name{Space: "DAV:", Local: "href"}
	dec := xml.NewDecoder(bytes.NewReader(body))
	var stack []xml.Name
	for {
		tok, err := dec.Token()
		if err != nil {
			return principal, home
		}
		switch t := tok.(type) {
		case xml.StartElement:
			stack = append(stack, t.Name)
		case xml.EndElement:
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
		case xml.CharData:
			if len(stack) < 2 || stack[len(stack)-1] != href {
				continue
			}
			v := strings.TrimSpace(string(t))
			switch stack[len(stack)-2] {
			case principalName:
				if principal == "" {
					principal = v
				}
			case homeName:
				if home == "" {
					home = v
				}
			}
		}
	}
}
