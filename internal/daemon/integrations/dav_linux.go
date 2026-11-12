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
	// what is the kind of thing; resource and data are CalDAV's or CardDAV's
	// own names for the collection and its report payload.
	label, what, namespace, resource, mime, data := "calendars (CalDAV)", "Calendars", "urn:ietf:params:xml:ns:caldav", "calendar", "text/calendar", "calendar-data"
	invitations := "\nSaving an event that has attendees can make the server send them invitations,\nwhich is the person's call just as sending mail is."
	if d.provider == CardDAV {
		label, what, namespace, resource, mime, data = "contacts (CardDAV)", "Contacts", "urn:ietf:params:xml:ns:carddav", "addressbook", "text/vcard", "address-data"
		invitations = ""
	}
	return SkillAccount{Label: label, Kinds: d.Services(), Body: fmt.Sprintf(`%[1]s over %[2]s with curl. Nothing is synced or cached locally: every read
is a request to the server. Every command starts

    %[3]s

The config file holds the account's URL and password, which is why the command
names no URL and why the file is not for printing. The URL is the account's
%[5]s home set where the provider announced one, so a PROPFIND with
Depth: 1 lists the collections:

    %[3]s --request PROPFIND --header 'Depth: 1' --header 'Content-Type: application/xml' --data-binary '<d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:displayname/></d:prop></d:propfind>'

If that lists none, ask for DAV:current-user-principal and the
%[5]s-home-set by name, since an allprop response may omit them. To
address a principal, home set, collection or item found in an href, add
`+"`--request-target '/absolute/path/from/href'`"+`: it changes the path of the
request and leaves the server and credentials as configured. From there it is
ordinary %[2]s (namespace %[4]s): REPORT with
%[5]s-query or %[5]s-multiget and %[7]s, GET with --include to see
the ETag, PUT of %[6]s with If-Match: <ETag> (If-None-Match: * for a
new UID), and DELETE with If-Match.

The password goes wherever curl sends the request and shows in whatever curl
prints about it. So requests stay on the configured host: an href or redirect
that points to another host is not followed (the person reconnects the account
instead), and --location, --verbose, --trace, --insecure or another --url have
no place with this config.

A change lands in the person's real data at once. Sending the ETag you read
as If-Match makes a change made elsewhere in the meantime come back as 412
instead of being overwritten; after a 412, read again rather than force.%[8]s`, what, map[Provider]string{CalDAV: "CalDAV", CardDAV: "CardDAV"}[d.provider], cmd, namespace, resource, mime, data, invitations)}
}
