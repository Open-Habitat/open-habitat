//go:build linux

package integrations

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
)

// Apple (iCloud) is not a tool of its own. One Apple ID and one
// app-specific password reach iCloud Mail with himalaya and iCloud Calendar
// and Contacts with curl, and each connected service is the ordinary imap,
// caldav or carddav account it would be from the generic forms. The page's
// Apple card is composed from those accounts by their stored server, so
// there is no Apple store and a generic connection to iCloud joins the card.
//
// The one thing Apple adds is that the password can be reused: Apple issues
// one app-specific password for the whole account, so a service added later
// may take the password already stored in another of that Apple ID's
// accounts. The daemon reads it from the person's own tool configuration and
// sends it only to Apple's fixed endpoints below; the browser never sees it.
// A source account counts only when its own stored server is Apple's, so a
// password typed for another provider never travels to Apple.

const Apple Provider = "apple"

// appleIDComment records, in the himalaya file the catalog writes, which
// Apple ID an iCloud Mail account was connected with. It is a comment, so
// himalaya ignores it; it is not a second store, only the file's own label.
const appleIDComment = "# Apple ID: "

// AppleHosts are Apple's documented endpoints: iCloud Mail's IMAP (SSL) and
// SMTP (STARTTLS) servers, support.apple.com/102525, and the CalDAV and
// CardDAV front doors from which DAV discovery finds the account's partition
// under the same registrable domain.
type AppleHosts struct {
	IMAP     string
	IMAPPort int
	SMTP     string
	SMTPPort int
	CalDAV   string
	CardDAV  string
}

var appleHosts = AppleHosts{IMAP: "imap.mail.me.com", IMAPPort: 993, SMTP: "smtp.mail.me.com", SMTPPort: 587, CalDAV: "https://caldav.icloud.com/", CardDAV: "https://contacts.icloud.com/"}

// WithAppleHosts points the Apple connection at synthetic servers. Only
// tests use it.
func WithAppleHosts(h AppleHosts) Option { return func(c *Catalog) { c.apple = h } }

// appleServices is the order the services are connected and shown in.
// Contacts and calendar go first: a DAV server's 401 refuses the password
// unambiguously, before mail's username question arises.
var appleServices = []string{"contacts", "calendar", "mail"}

func appleProvider(service string) Provider {
	switch service {
	case "contacts":
		return CardDAV
	case "calendar":
		return CalDAV
	}
	return IMAP
}

// iCloudMail admits the addresses iCloud Mail signs in with. Apple: a
// custom-domain address still signs in with the primary @icloud.com one.
func iCloudMail(address string) bool {
	_, domain, _ := strings.Cut(address, "@")
	return ValidAddress(address) && (domain == "icloud.com" || domain == "me.com" || domain == "mac.com")
}

func (c *Catalog) appleSite(host string) bool {
	host = strings.ToLower(host)
	for _, raw := range []string{c.apple.CalDAV, c.apple.CardDAV} {
		if u, err := url.Parse(raw); err == nil && host != "" && davSite(host) == davSite(strings.ToLower(u.Hostname())) {
			return true
		}
	}
	return false
}

// appleMember says whether an account's stored server is Apple's and, if
// so, which Apple ID it belongs to. A DAV account signs in with the Apple
// ID; a mail account carries the Apple ID it was connected with, or else is
// its own (a generic connection made with the iCloud address).
func (c *Catalog) appleMember(e Entry, address string) (string, bool) {
	switch t := e.(type) {
	case *himalaya:
		a, err := t.read(c.env, address)
		if err != nil || a.Server != c.apple.IMAP {
			return "", false
		}
		if a.AppleID != "" {
			return a.AppleID, true
		}
		return address, true
	case *dav:
		a, err := t.read(c.env, address)
		if err != nil {
			return "", false
		}
		u, err := url.Parse(a.URL)
		if err != nil || !c.appleSite(u.Hostname()) {
			return "", false
		}
		if id := strings.ToLower(a.Username); ValidAddress(id) {
			return id, true
		}
		return address, true
	}
	return "", false
}

// appleView is the Apple tile: available when all three tools are.
func (c *Catalog) appleView() (providerView, bool) {
	view := providerView{ID: Apple, Available: true, Login: AppPassword, Services: []string{"mail", "calendar", "contacts"}}
	for _, p := range []Provider{IMAP, CalDAV, CardDAV} {
		e := c.entry(p)
		if e == nil {
			return view, false
		}
		if !e.Available(c.env) {
			view.Available, view.UnavailableReason = false, "tool_unavailable"
			for _, t := range MissingTools(e, c.env) {
				if !slices.Contains(view.MissingTools, t) {
					view.MissingTools = append(view.MissingTools, t)
				}
			}
		}
	}
	return view, true
}

// appleMembers lists the accounts of one Apple ID in appleServices' order.
func (c *Catalog) appleMembers(appleID string) ([]listed, error) {
	accounts, unread := c.accounts()
	if len(unread) > 0 {
		return nil, errInventory
	}
	var out []listed
	for _, s := range appleServices {
		for _, l := range accounts {
			if l.entry.Provider() == appleProvider(s) {
				if id, ok := c.appleMember(l.entry, l.address); ok && id == appleID {
					out = append(out, l)
				}
			}
		}
	}
	return out, nil
}

// storedApplePassword is the password of one of the Apple ID's accounts.
func (c *Catalog) storedApplePassword(appleID string) (string, error) {
	members, err := c.appleMembers(appleID)
	if err != nil {
		return "", err
	}
	for _, l := range members {
		var a PasswordAccount
		switch t := l.entry.(type) {
		case *himalaya:
			a, err = t.read(c.env, l.address)
		case *dav:
			a, err = t.read(c.env, l.address)
		default:
			continue
		}
		if err == nil && a.Password != "" {
			return a.Password, nil
		}
	}
	return "", AccountMissing
}

type appleFailure struct {
	Service string `json:"service"`
	Failure string `json:"failure"`
}

func appleFailureCode(err error) string {
	var f Failure
	if errors.As(err, &f) && (f == CredentialsRejected || f == ServerUnreachable || f == EndpointRejected || f == AccountExists || f == AccountMissing) {
		return string(f)
	}
	return "native_unavailable"
}

// connectApple connects each service with Apple's endpoints. A password
// Apple refuses on the first service is refused for all and nothing is
// written; after that, each service stands on its own.
func (c *Catalog) connectApple(ctx context.Context, appleID, mail, password string, services []string) ([]listed, []appleFailure, error) {
	var done []listed
	var failed []appleFailure
	for _, s := range appleServices {
		if !slices.Contains(services, s) {
			continue
		}
		e := c.entry(appleProvider(s))
		pe, ok := e.(PasswordEntry)
		if !ok {
			failed = append(failed, appleFailure{s, "native_unavailable"})
			continue
		}
		var err error
		address := appleID
		switch s {
		case "mail":
			address = mail
			name, _, _ := strings.Cut(mail, "@")
			a := PasswordAccount{Address: mail, Server: c.apple.IMAP, Port: c.apple.IMAPPort, Security: "tls", Username: name, Password: password,
				SMTPServer: c.apple.SMTP, SMTPPort: c.apple.SMTPPort, SMTPSecurity: "starttls", SMTPUsername: mail, AppleID: appleID}
			err = pe.Connect(ctx, c.env, a)
			if errors.Is(err, CredentialsRejected) {
				// Apple: if the name part does not sign in, use the full address.
				a.Username, a.SMTPUsername = mail, ""
				err = pe.Connect(ctx, c.env, a)
			}
		default:
			u := c.apple.CardDAV
			if s == "calendar" {
				u = c.apple.CalDAV
			}
			err = pe.Connect(ctx, c.env, PasswordAccount{Address: appleID, URL: u, Username: appleID, Password: password})
		}
		if err == nil {
			done = append(done, listed{e, address})
			continue
		}
		if len(done) == 0 && len(failed) == 0 && errors.Is(err, CredentialsRejected) {
			return nil, nil, err
		}
		failed = append(failed, appleFailure{s, appleFailureCode(err)})
	}
	return done, failed, nil
}

// renewApple gives every account of the Apple ID the new password; each
// entry checks it before replacing the old one.
func (c *Catalog) renewApple(ctx context.Context, appleID, password string) ([]listed, []appleFailure, error) {
	members, err := c.appleMembers(appleID)
	if err != nil {
		return nil, nil, err
	}
	if len(members) == 0 {
		return nil, nil, AccountMissing
	}
	var done []listed
	var failed []appleFailure
	for _, l := range members {
		pe, ok := l.entry.(PasswordEntry)
		if !ok {
			continue
		}
		err := pe.ChangePassword(ctx, c.env, l.address, password)
		if err == nil {
			done = append(done, l)
			continue
		}
		if len(done) == 0 && len(failed) == 0 && errors.Is(err, CredentialsRejected) {
			return nil, nil, err
		}
		failed = append(failed, appleFailure{l.entry.Services()[0], appleFailureCode(err)})
	}
	return done, failed, nil
}

// appleRequest serves the Apple card's writes. Address is the Apple ID.
func (c *Catalog) appleRequest(w http.ResponseWriter, r *http.Request, in accountRequest) {
	plain := in.Server == "" && in.Port == 0 && in.Security == "" && in.Username == "" && in.SMTPServer == "" && in.SMTPPort == 0 && in.SMTPSecurity == "" && in.URL == ""
	services := len(in.Services) > 0 && len(in.Services) <= len(appleServices)
	for i, s := range in.Services {
		services = services && slices.Contains(appleServices, s) && !slices.Contains(in.Services[:i], s)
	}
	// Mail signs in with an iCloud address: the Apple ID's own, or the one
	// the person gives when the Apple ID is another address.
	mail := ""
	if services && slices.Contains(in.Services, "mail") {
		mail = in.MailAddress
		if mail == "" {
			mail = in.Address
		}
		services = iCloudMail(mail)
	} else if in.MailAddress != "" {
		services = false
	}
	view, ok := c.appleView()
	switch {
	case !ok || !plain:
		fail(w, 400, "invalid_request")
		return
	case r.Method == http.MethodPost && (in.Action == "connect" || in.Action == "add") && in.DeleteDirectories == nil && services && (in.Action == "add") == (in.Password == ""):
		if in.Action == "connect" && !printableCredential(in.Password, 1024) {
			fail(w, 400, "invalid_request")
			return
		}
	case r.Method == http.MethodPost && in.Action == "password" && in.DeleteDirectories == nil && in.Services == nil && in.MailAddress == "" && printableCredential(in.Password, 1024):
	case r.Method == http.MethodDelete && in.Action == "remove" && in.DeleteDirectories != nil && in.Services == nil && in.MailAddress == "" && in.Password == "":
		c.removeApple(w, r, in.Address)
		return
	default:
		fail(w, 400, "invalid_request")
		return
	}
	if !view.Available {
		fail(w, 409, "provider_unavailable")
		return
	}
	// A first cloud import can take hours. Never queue a browser write
	// behind it and execute that write after the caller has timed out.
	if !c.write.TryLock() {
		fail(w, 503, "native_unavailable")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(90 * time.Second))
	var done []listed
	var failed []appleFailure
	var err error
	switch in.Action {
	case "connect":
		done, failed, err = c.connectApple(r.Context(), in.Address, mail, in.Password, in.Services)
	case "add":
		password := ""
		if password, err = c.storedApplePassword(in.Address); err == nil {
			done, failed, err = c.connectApple(r.Context(), in.Address, mail, password, in.Services)
		}
	case "password":
		done, failed, err = c.renewApple(r.Context(), in.Address, in.Password)
	}
	if err == nil && len(done) == 0 {
		// Nothing was written: answer as the first refusal.
		err = Failure(failed[0].Failure)
		if failed[0].Failure == "native_unavailable" {
			err = ToolFailed
		}
	}
	if err != nil {
		c.write.Unlock()
		c.refuse(w, Apple, err)
		return
	}
	skill := c.reconcile()
	c.write.Unlock()
	c.log.Info("integration_connect", "provider", string(Apple), "outcome", "connected")
	out := changeView{SchemaVersion: 1, Accounts: []Account{}, Failed: failed, Skill: skill}
	for _, l := range done {
		out.Accounts = append(out.Accounts, c.check(r.Context(), l.entry, l.address))
	}
	reply(w, out)
}

// removeApple removes every account of the Apple ID. The app-specific
// password stays valid at Apple until the person revokes it; the page says so.
func (c *Catalog) removeApple(w http.ResponseWriter, r *http.Request, appleID string) {
	if !c.write.TryLock() {
		fail(w, 503, "native_unavailable")
		return
	}
	defer c.write.Unlock()
	members, err := c.appleMembers(appleID)
	switch {
	case err != nil:
		fail(w, 503, "native_unavailable")
		return
	case len(members) == 0:
		fail(w, 409, string(AccountMissing))
		return
	}
	for _, l := range members {
		if err := l.entry.Remove(r.Context(), c.env, l.address); err != nil && !errors.Is(err, AccountMissing) {
			c.reconcile()
			c.log.Warn("integration_remove", "provider", string(Apple), "outcome", "failed", "reason", "native_failure")
			fail(w, 503, "native_unavailable")
			return
		}
	}
	skill := c.reconcile()
	c.log.Info("integration_remove", "provider", string(Apple), "outcome", "removed")
	reply(w, changeView{SchemaVersion: 1, Removed: &removed{Apple, appleID}, Skill: skill})
}
