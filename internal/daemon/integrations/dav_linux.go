//go:build linux

package integrations

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

// curl is the native DAV client: it supports authenticated PROPFIND, REPORT,
// GET, PUT and DELETE without a listener or a second data store. Calendar and
// contact endpoints are separate entries because providers commonly give them
// different URLs (and sometimes different credentials). Each account is one
// directly usable curl config, not host connection metadata.
type dav struct{ provider Provider }

func (d *dav) Provider() Provider { return d.provider }
func (*dav) Login() LoginKind     { return AppPassword }
func (d *dav) Services() []string {
	if d.provider == CalDAV {
		return []string{"calendar"}
	}
	return []string{"contacts"}
}
func (*dav) Tools() []string          { return []string{"curl"} }
func (d *dav) Available(env Env) bool { return MissingTools(d, env) == nil }
func (d *dav) dir() string            { return ".config/curl/open-habitat/" + string(d.provider) }

func (d *dav) Accounts(env Env) ([]string, error) {
	names, dir, err := listHomeDir(env.Home, d.dir())
	if err != nil || dir < 0 {
		return nil, err
	}
	defer unix.Close(dir)
	var out []string
	for _, n := range names {
		if a, ok := strings.CutSuffix(n, ".conf"); ok && ValidAddress(a) {
			var st unix.Stat_t
			if unix.Fstatat(dir, n, &st, unix.AT_SYMLINK_NOFOLLOW) == nil && st.Mode&unix.S_IFMT == unix.S_IFREG {
				out = append(out, a)
			}
		}
	}
	return out, nil
}

func (*dav) ValidAccount(a PasswordAccount) bool {
	// A colon in a Basic username is ambiguous. Mail server fields do not
	// belong in a DAV request.
	if a.Server != "" || a.Port != 0 || a.Security != "" || a.SMTPServer != "" || a.SMTPPort != 0 || a.SMTPSecurity != "" || a.SMTPUsername != "" || a.AppleID != "" || strings.Contains(a.Username, ":") {
		return false
	}
	if !ValidAddress(a.Address) || !printableCredential(a.Username, 254) || !printableCredential(a.Password, 1024) {
		return false
	}
	if len(a.URL) > 2048 || strings.ContainsAny(a.URL, "\r\n\t ") {
		return false
	}
	u, err := url.Parse(a.URL)
	if err != nil {
		return false
	}
	if u.Port() != "" {
		port, err := strconv.Atoi(u.Port())
		if err != nil || port < 1 || port > 65535 {
			return false
		}
	}
	return u.Scheme == "https" && u.Host != "" && u.User == nil && u.RawQuery == "" && !u.ForceQuery && u.Fragment == "" && u.Opaque == "" && hostPattern.MatchString(strings.ToLower(u.Hostname()))
}

func davConfig(a PasswordAccount) []byte {
	return []byte(fmt.Sprintf("url = %s\nuser = %s\nproto = \"=https\"\n", tomlString(a.URL), tomlString(a.Username+":"+a.Password)))
}

func (d *dav) read(env Env, address string) (PasswordAccount, error) {
	a := PasswordAccount{Address: address}
	dir, err := openHomeDir(env.Home, false, splitPath(d.dir())...)
	if err != nil {
		return a, err
	}
	defer unix.Close(dir)
	data, err := readFileAt(dir, address+".conf", 16384)
	if err != nil {
		return a, err
	}
	// Only the native directives we wrote are interpreted. In particular, status
	// never executes a command or reads another file named by a hand-edited config.
	lines := strings.Split(string(data), "\n")
	if len(lines) != 4 || lines[2] != `proto = "=https"` || lines[3] != "" {
		return a, ToolFailed
	}
	rawURL, ok := strings.CutPrefix(lines[0], "url = ")
	if !ok {
		return a, ToolFailed
	}
	a.URL, ok = tomlUnquote(rawURL)
	if !ok {
		return a, ToolFailed
	}
	rawUser, ok := strings.CutPrefix(lines[1], "user = ")
	if !ok {
		return a, ToolFailed
	}
	user, ok := tomlUnquote(rawUser)
	if !ok {
		return a, ToolFailed
	}
	a.Username, a.Password, ok = strings.Cut(user, ":")
	if !ok || !d.ValidAccount(a) {
		return a, ToolFailed
	}
	return a, nil
}

func (d *dav) Connect(ctx context.Context, env Env, a PasswordAccount) error {
	if !d.ValidAccount(a) {
		return ToolFailed
	}
	dir, err := openHomeDir(env.Home, true, splitPath(d.dir())...)
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	var st unix.Stat_t
	if unix.Fstatat(dir, a.Address+".conf", &st, unix.AT_SYMLINK_NOFOLLOW) == nil {
		return AccountExists
	}
	final, err := d.discover(ctx, env, a)
	if err != nil {
		return err
	}
	if a.URL = final; !d.ValidAccount(a) {
		return EndpointRejected
	}
	// Publish only complete native configurations, without replacing an
	// account that appeared during verification. A crash can leave a hidden
	// staging file, never a truncated account in the inventory.
	staged := "." + a.Address + "." + rand.Text() + ".tmp"
	if err := writeNewFileAt(dir, staged, davConfig(a), 0o600); err != nil {
		return err
	}
	defer unix.Unlinkat(dir, staged, 0)
	if err := unix.Linkat(dir, staged, dir, a.Address+".conf", 0); errors.Is(err, unix.EEXIST) {
		return AccountExists
	} else if err != nil {
		return err
	}
	return unix.Fsync(dir)
}

func (d *dav) ChangePassword(ctx context.Context, env Env, address, password string) error {
	a, err := d.read(env, address)
	if errors.Is(err, os.ErrNotExist) {
		return AccountMissing
	}
	if err != nil {
		return err
	}
	a.Password = password
	if !d.ValidAccount(a) {
		return ToolFailed
	}
	if err := d.verify(ctx, env, a); err != nil {
		return err
	}
	dir, err := openHomeDir(env.Home, false, splitPath(d.dir())...)
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	return writeFileAt(dir, address+".conf", davConfig(a), 0o600)
}

func (d *dav) verify(ctx context.Context, env Env, a PasswordAccount) error {
	state, rejected := d.probe(ctx, env, a)
	if rejected {
		return EndpointRejected
	}
	switch state {
	case StateOK:
		return nil
	case StateCredentialsRejected:
		return CredentialsRejected
	case StateUnreachable:
		return ServerUnreachable
	default:
		return ToolFailed
	}
}

// probe also distinguishes an HTTP endpoint that is not a direct DAV URL
// from a missing/broken native tool. Redirects never carry credentials onward.
func (d *dav) probe(ctx context.Context, env Env, a PasswordAccount) (ServiceState, bool) {
	tool, ok := env.Tool("curl")
	if !ok {
		return StateUnknown, false
	}
	pin, err := davPin(ctx, env, a.URL)
	if errors.Is(err, errDAVDestination) {
		return StateUnknown, true
	} else if err != nil {
		return StateUnreachable, false
	}
	// -q must be first: never read a user's default .curlrc. No redirects, URL
	// credentials, verbose output or response bodies; secrets go only to stdin.
	// --globoff keeps a URL with brackets one request.
	out, err := env.run(ctx, Command{Path: tool, Args: []string{"--disable", "--config", "-", "--globoff", "--silent", "--max-time", "10", "--resolve", pin, "--request", "PROPFIND", "--header", "Depth: 0", "--output", "/dev/null", "--write-out", "%{http_code}"}}, bytesReader(davConfig(a)))
	if ctx.Err() != nil || err != nil {
		return StateUnreachable, false
	}
	code, _ := strconv.Atoi(string(out))
	if code >= 300 && code < 400 || code == 404 || code == 405 {
		return StateUnknown, true
	}
	switch string(out) {
	case "207":
		return StateOK, false
	case "401", "403":
		return StateCredentialsRejected, false
	default:
		return StateUnknown, false
	}
}

func (d *dav) Check(ctx context.Context, env Env, address string) []Service {
	state := StateUnknown
	if a, err := d.read(env, address); err == nil {
		state, _ = d.probe(ctx, env, a)
	}
	return []Service{{ID: d.Services()[0], State: state}}
}

func (d *dav) Remove(ctx context.Context, env Env, address string) error {
	dir, err := openHomeDir(env.Home, false, splitPath(d.dir())...)
	if errors.Is(err, os.ErrNotExist) {
		return AccountMissing
	}
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	if err := unix.Unlinkat(dir, address+".conf", 0); errors.Is(err, unix.ENOENT) {
		return AccountMissing
	} else if err != nil {
		return err
	}
	return unix.Fsync(dir)
}

func (d *dav) Skill(env Env, address string) SkillAccount {
	tool, ok := env.Tool("curl")
	if !ok {
		tool = "curl"
	}
	cmd := fmt.Sprintf("%s --disable --config ~/%s/%s.conf --globoff --silent --show-error", tool, d.dir(), address)
	namespace, resource, mime := "urn:ietf:params:xml:ns:caldav", "calendar", "text/calendar"
	if d.provider == CardDAV {
		namespace, resource, mime = "urn:ietf:params:xml:ns:carddav", "addressbook", "text/vcard"
	}
	dataElement := "calendar-data"
	if d.provider == CardDAV {
		dataElement = "address-data"
	}
	return SkillAccount{Label: string(d.provider), Kinds: d.Services(), Body: fmt.Sprintf(`%[1]s uses curl's own private config (URL and credentials). Do not print it.
No local sync or calendar/contact database is maintained.

The configured URL was found when the account was connected: it is the
account's %[5]s home set when the provider announced one, on the host that
serves this account. List its collections with PROPFIND and Depth: 1 (request
DAV:resourcetype and DAV:displayname):

    %[2]s --request PROPFIND --header 'Depth: 1' --header 'Content-Type: application/xml' --data-binary '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>'

If that lists no collections, discover DAV:current-user-principal and the
%[5]s-home-set explicitly (they may be absent from an allprop response):

    %[2]s --request PROPFIND --header 'Depth: 0' --header 'Content-Type: application/xml' --data-binary '<d:propfind xmlns:d="DAV:" xmlns:x="%[4]s"><d:prop><d:current-user-principal/><x:%[5]s-home-set/></d:prop></d:propfind>'

Follow DAV hrefs only on the configured server. To target a discovered principal,
home set, collection or item, add %[3]s; this changes
only the request path, not the server or credentials. An absolute href is usable
only when its host is the configured URL's host; use just its path. A redirect or
an href to another host is not followed: tell the person to reconnect the account.
Never use --location, --verbose, --trace, --insecure or a different --url with this account.
For queries, create a DAV XML REPORT body and call:

    %[2]s --request-target '/collection/' --request REPORT --header 'Depth: 1' --header 'Content-Type: application/xml; charset=utf-8' --data-binary @query.xml

Use %[5]s-query / %[5]s-multiget and %[7]s in that namespace
(calendar-query filters VEVENT by time-range; addressbook-query filters vCards).
GET an item with --include --request-target '/collection/item'. Read its ETag before editing.
Only on the person's request, PUT an iCalendar/vCard file with Content-Type %[6]s
and If-Match: <ETag> (If-None-Match: * for a new UID); never overwrite a 412 conflict.
DELETE requires the person's explicit request for that specific item and If-Match.
Prepare proposed changes first. Do not send calendar invitations without approval.`, d.provider, cmd, "`--request-target '/absolute/path/from/href'`", namespace, resource, mime, dataElement)}
}
