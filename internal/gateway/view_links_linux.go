//go:build linux

package gateway

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

// Shared view links (ADR 0033) are the one place where the gateway reads a
// person's daemon for a request with no authenticated person: anyone holding
// a link's URL reads that one frozen export, through the owner's daemon and
// its fixed export-read route, while the link is valid. The link host is a
// host of the view namespace derived from the link ID, and the token is the
// first path segment of every request, so no cookie is set or read. Only the
// person's app session creates, changes and revokes a link; the agent
// listener has no route here and never learns a link's URL. The store is
// gateway-private state beside the session store; it keeps the token so the
// person can copy a link again.

const (
	viewLinksPath        = "/api/v1/view-links"
	viewLinkChangePath   = "/api/v1/view-links/change"
	viewLinkRevokePath   = "/api/v1/view-links/revoke"
	adminViewLinksPath   = "/api/v1/server/view-links"
	adminViewLinksRevoke = "/api/v1/server/view-links/revoke"
	viewLinkStoreName    = "view-links.json"
	viewLinkStoreVersion = 1
	// 4096 links whose titles JSON-escape at six bytes a character stay
	// below 7 MiB; the writer refuses what the reader would not read.
	viewLinkStoreBytes = 16 << 20
	viewLinkMaxDays    = 365
	viewLinksPerPerson = 50
	viewLinksMax       = 4096
	// Public reads cannot starve the owners' own traffic or exhaust a daemon:
	// concurrent relays and a day's bytes are bounded per link and per site.
	// The counters live in memory; a restart resets them.
	viewLinkRelaysPerLink = 8
	viewLinkRelaysSite    = 48
	viewLinkDailyPerLink  = int64(2) << 30
	viewLinkDailySite     = int64(20) << 30
)

var viewLinkIDPattern = regexp.MustCompile(`^l[a-z2-7]{26}$`)

type viewLink struct {
	ID      string    `json:"id"`
	Token   string    `json:"token"`
	Owner   Identity  `json:"owner"`
	ViewID  string    `json:"view_id"`
	Title   string    `json:"title"`
	Created time.Time `json:"created"`
	Expires time.Time `json:"expires"`
}

// viewLinkTraffic is the in-memory relay accounting of public link reads.
type viewLinkTraffic struct {
	day      string
	bytes    map[string]int64
	site     int64
	relays   map[string]int
	relaying int
}

func validViewLinkToken(token string) bool {
	return len(token) == 43 && !strings.ContainsAny(token, "=+/") && strings.Trim(token, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_") == ""
}

func validViewTitle(title string) bool {
	if title == "" || len(title) > 200 || !utf8.ValidString(title) {
		return false
	}
	for _, c := range title {
		if c < 32 || c == 127 {
			return false
		}
	}
	return true
}

func validViewLink(l viewLink) bool {
	if !viewLinkIDPattern.MatchString(l.ID) || !validViewLinkToken(l.Token) || !viewIDPattern.MatchString(l.ViewID) || !validViewTitle(l.Title) || l.Created.IsZero() || !l.Expires.After(l.Created) {
		return false
	}
	route, ok := brokerIdentity(l.Owner.Subject, BrokerReply{Route: &BrokerRoute{UID: uint32(l.Owner.UID), Username: l.Owner.Username, Socket: l.Owner.Socket}, Epoch: 1, Generation: 1})
	return ok && l.Owner.Provider == "github" && l.Owner.UID > 0 && route == l.Owner && canonicalSubject(l.Owner.Subject)
}

func (a *Auth) viewLinksEnabled() bool {
	return a.cfg.ViewOrigin != "" && a.cfg.ViewLinkMaxDays > 0
}

func (a *Auth) viewLinkFile() string {
	if a.sessionFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.sessionFile), viewLinkStoreName)
}

// viewLinkHost is the link's own host in the view namespace. The label is a
// hash of the link ID, never of the token: hostnames leak through DNS and SNI.
func (a *Auth) viewLinkHost(id string) string {
	h := sha256.Sum256([]byte("view-link\x00" + id))
	label := strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(h[:]))
	return strings.Replace(a.viewTemplate(), "*", label, 1)
}

func (a *Auth) viewLinkURL(l viewLink) string {
	return "https://" + a.viewLinkHost(l.ID) + "/" + l.Token + "/"
}

// publishViewLinks replaces the in-memory store and its host index. Call
// under mu.
func (a *Auth) publishViewLinks(next map[string]viewLink) {
	a.viewLinks = next
	a.viewLinkHosts = make(map[string]string, len(next))
	if a.cfg.ViewOrigin == "" {
		return
	}
	for id := range next {
		a.viewLinkHosts[a.viewLinkHost(id)] = id
	}
}

// loadViewLinks reads the store once at startup. An unusable store is
// discarded: losing it revokes every link, which is the safe direction.
func (a *Auth) loadViewLinks() {
	a.publishViewLinks(map[string]viewLink{})
	path := a.viewLinkFile()
	if path == "" {
		return
	}
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return
	}
	discard := func() {
		a.log.Warn("view_link_store_discarded", "outcome", "rejected", "reason", "invalid_view_link_store")
	}
	if err != nil || !privateSessionFile(info) {
		discard()
		return
	}
	f, err := os.Open(path)
	if err != nil {
		discard()
		return
	}
	defer f.Close()
	d := json.NewDecoder(io.LimitReader(f, viewLinkStoreBytes))
	d.DisallowUnknownFields()
	var state struct {
		Version int        `json:"version"`
		Links   []viewLink `json:"links"`
	}
	if d.Decode(&state) != nil || state.Version != viewLinkStoreVersion || state.Links == nil || d.Decode(new(any)) != io.EOF || len(state.Links) > viewLinksMax {
		discard()
		return
	}
	now := a.now()
	next := make(map[string]viewLink, len(state.Links))
	for _, l := range state.Links {
		if !validViewLink(l) || next[l.ID].ID != "" {
			discard()
			return
		}
		if now.Before(l.Expires) {
			next[l.ID] = l
		}
	}
	a.publishViewLinks(next)
}

// viewLinkStoreHealthy is false once an operator removed or loosened the
// store: every link then stops, as a removed session store ends sessions.
func (a *Auth) viewLinkStoreHealthy() bool {
	path := a.viewLinkFile()
	if path == "" || len(a.viewLinks) == 0 {
		return true
	}
	info, err := os.Lstat(path)
	return err == nil && privateSessionFile(info)
}

// changeViewLinks applies change to a copy, drops expired links, writes the
// store durably and publishes it. Call under mu.
func (a *Auth) changeViewLinks(change func(map[string]viewLink)) error {
	if !a.viewLinkStoreHealthy() {
		a.publishViewLinks(map[string]viewLink{})
	}
	now := a.now()
	next := make(map[string]viewLink, len(a.viewLinks))
	for id, l := range a.viewLinks {
		if now.Before(l.Expires) {
			next[id] = l
		}
	}
	change(next)
	if path := a.viewLinkFile(); path != "" {
		list := make([]viewLink, 0, len(next))
		for _, l := range next {
			list = append(list, l)
		}
		sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
		data, err := json.Marshal(struct {
			Version int        `json:"version"`
			Links   []viewLink `json:"links"`
		}{viewLinkStoreVersion, list})
		if err != nil {
			return err
		}
		if len(data) > viewLinkStoreBytes {
			return errors.New("view link store capacity exceeded")
		}
		f, err := os.CreateTemp(filepath.Dir(path), ".view-links-*")
		if err != nil {
			return err
		}
		defer os.Remove(f.Name())
		if err = f.Chmod(0600); err == nil {
			_, err = f.Write(data)
		}
		if err == nil {
			err = f.Sync()
		}
		if closeErr := f.Close(); err == nil {
			err = closeErr
		}
		if err != nil {
			return err
		}
		if err = os.Rename(f.Name(), path); err != nil {
			return err
		}
		a.publishViewLinks(next)
		dir, err := os.Open(filepath.Dir(path))
		if err != nil {
			return err
		}
		err = dir.Sync()
		_ = dir.Close()
		return err
	}
	a.publishViewLinks(next)
	return nil
}

// removeViewLinksLocked removes every link of subject. Call under mu.
func (a *Auth) removeViewLinksLocked(subject string) (int, error) {
	removed := 0
	for _, l := range a.viewLinks {
		if l.Owner.Subject == subject {
			removed++
		}
	}
	if removed == 0 {
		return 0, nil
	}
	err := a.changeViewLinks(func(next map[string]viewLink) {
		for id, l := range next {
			if l.Owner.Subject == subject {
				delete(next, id)
			}
		}
	})
	return removed, err
}

func (a *Auth) newViewLinkID() (string, error) {
	b := make([]byte, 17)
	if _, err := io.ReadFull(a.random, b); err != nil {
		return "", err
	}
	return "l" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:26], nil
}

// readViewSummary asks the owner's daemon for one export's summary. It
// answers the view's title, or 404 when the view is gone and 503 otherwise.
func (a *Auth) readViewSummary(ctx context.Context, target Identity, viewID string) (string, int) {
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		return "", 503
	}
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	defer transport.CloseIdleConnections()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out := &url.URL{Scheme: "http", Host: "unix", Path: "/view-export/" + viewID + "/"}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, out.String(), http.NoBody)
	if err != nil {
		return "", 503
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		return "", 503
	}
	defer res.Body.Close()
	if res.StatusCode == 404 {
		return "", 404
	}
	var body struct {
		View struct {
			Title string `json:"title"`
		} `json:"view"`
	}
	if res.StatusCode != 200 || json.NewDecoder(io.LimitReader(res.Body, 64<<10)).Decode(&body) != nil || !validViewTitle(body.View.Title) {
		return "", 503
	}
	return body.View.Title, 200
}

type viewLinkReply struct {
	LinkID    string `json:"link_id"`
	ViewID    string `json:"view_id"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	CreatedAt string `json:"created_at"`
	ExpiresAt string `json:"expires_at"`
}

func (a *Auth) viewLinkReply(l viewLink) viewLinkReply {
	return viewLinkReply{l.ID, l.ViewID, l.Title, a.viewLinkURL(l), l.Created.UTC().Format(time.RFC3339), l.Expires.UTC().Format(time.RFC3339)}
}

func sameOwner(l viewLink, id Identity) bool {
	return l.Owner.Provider == id.Provider && l.Owner.Subject == id.Subject
}

// viewLinksHTTP is the person's own link list and its writes on the app
// origin. Where links are off, the list is an empty 204 and writes are 404.
func (a *Auth) viewLinksHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	path := r.URL.Path
	if !a.exact(r, path) || path != viewLinksPath && path != viewLinkChangePath && path != viewLinkRevokePath {
		safe(w, 400, "invalid_request")
		return
	}
	if path == viewLinksPath && r.Method == http.MethodGet {
		if r.ContentLength > 0 {
			safe(w, 400, "invalid_request")
			return
		}
		s, ok := a.authenticated(r)
		if !ok {
			safe(w, 401, "authentication_required")
			return
		}
		if !a.viewLinksEnabled() {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		a.mu.Lock()
		if !a.viewLinkStoreHealthy() {
			a.publishViewLinks(map[string]viewLink{})
		}
		now := a.now()
		links := []viewLinkReply{}
		var mine []viewLink
		for _, l := range a.viewLinks {
			if sameOwner(l, s.identity) && now.Before(l.Expires) {
				mine = append(mine, l)
			}
		}
		a.mu.Unlock()
		sort.Slice(mine, func(i, j int) bool { return mine[i].Created.After(mine[j].Created) })
		for _, l := range mine {
			links = append(links, a.viewLinkReply(l))
		}
		writeJSON(w, map[string]any{"schema_version": 1, "max_days": a.cfg.ViewLinkMaxDays, "links": links})
		return
	}
	if r.Method != http.MethodPost {
		safe(w, 405, "method_not_allowed")
		return
	}
	s, _, ok := a.currentSession(w, r, true)
	if !ok {
		return
	}
	if !a.viewLinksEnabled() {
		safe(w, 404, "view_links_unavailable")
		return
	}
	switch path {
	case viewLinksPath:
		var body struct {
			ViewID string `json:"view_id"`
			Days   int    `json:"days"`
		}
		if !jsonBody(w, r, &body) || !viewIDPattern.MatchString(body.ViewID) || body.Days < 1 || body.Days > a.cfg.ViewLinkMaxDays {
			safe(w, 400, "invalid_request")
			return
		}
		a.createViewLink(w, r, s, body.ViewID, body.Days)
	case viewLinkChangePath:
		var body struct {
			LinkID     string `json:"link_id"`
			Days       *int   `json:"days"`
			ViewID     string `json:"view_id"`
			NewAddress bool   `json:"new_address"`
		}
		if !jsonBody(w, r, &body) || !viewLinkIDPattern.MatchString(body.LinkID) ||
			boolInt(body.Days != nil)+boolInt(body.ViewID != "")+boolInt(body.NewAddress) != 1 ||
			body.Days != nil && (*body.Days < 1 || *body.Days > a.cfg.ViewLinkMaxDays) ||
			body.ViewID != "" && !viewIDPattern.MatchString(body.ViewID) {
			safe(w, 400, "invalid_request")
			return
		}
		a.changeViewLink(w, r, s, body.LinkID, body.Days, body.ViewID, body.NewAddress)
	case viewLinkRevokePath:
		var body struct {
			LinkID string `json:"link_id"`
		}
		if !jsonBody(w, r, &body) || !viewLinkIDPattern.MatchString(body.LinkID) {
			safe(w, 400, "invalid_request")
			return
		}
		a.revokeViewLink(w, body.LinkID, func(l viewLink) bool { return sameOwner(l, s.identity) }, "owner")
	}
}

func (a *Auth) createViewLink(w http.ResponseWriter, r *http.Request, s session, viewID string, days int) {
	a.mu.Lock()
	mine, total := 0, 0
	for _, l := range a.viewLinks {
		if a.now().Before(l.Expires) {
			total++
			if sameOwner(l, s.identity) {
				mine++
			}
		}
	}
	a.mu.Unlock()
	if mine >= viewLinksPerPerson || total >= viewLinksMax {
		safe(w, 429, "view_links_limited")
		return
	}
	title, status := a.readViewSummary(r.Context(), s.identity, viewID)
	if status == 404 {
		safe(w, 404, "view_not_found")
		return
	}
	if status != 200 {
		safe(w, 503, "view_unavailable")
		return
	}
	id, err := a.newViewLinkID()
	token, tokenErr := a.secret()
	if err != nil || tokenErr != nil {
		safe(w, 503, "view_links_unavailable")
		return
	}
	now := a.now()
	l := viewLink{ID: id, Token: token, Owner: s.identity, ViewID: viewID, Title: title, Created: now, Expires: now.Add(time.Duration(days) * 24 * time.Hour)}
	a.mu.Lock()
	// The person may have been revoked while the daemon answered.
	if _, ok := a.authenticatedLocked(s); !ok {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	limited := false
	err = a.changeViewLinks(func(next map[string]viewLink) {
		mine := 0
		for _, o := range next {
			if sameOwner(o, s.identity) {
				mine++
			}
		}
		if mine >= viewLinksPerPerson || len(next) >= viewLinksMax {
			limited = true
			return
		}
		next[id] = l
	})
	a.mu.Unlock()
	if limited {
		safe(w, 429, "view_links_limited")
		return
	}
	if err != nil {
		safe(w, 503, "view_links_unavailable")
		return
	}
	a.log.Info("view_link", "outcome", "accepted", "reason", "created", "link", id, "user", s.identity.Username)
	writeJSON(w, map[string]any{"schema_version": 1, "link": a.viewLinkReply(l)})
}

// authenticatedLocked reports whether s is still a live, unexpired session
// of its subject after a daemon call: revocation removes every session under
// mu, and an operator's removed store ends them all. Call under mu.
func (a *Auth) authenticatedLocked(s session) (session, bool) {
	if a.deniedLocked(s.identity.Subject) || a.sessionFile != "" && !a.sessionStoreHealthy() {
		return session{}, false
	}
	now := a.now()
	for _, o := range a.sessions {
		if o.id == s.id && o.identity == s.identity && now.Before(o.idle) && now.Before(o.absolute) {
			return o, true
		}
	}
	return session{}, false
}

func (a *Auth) changeViewLink(w http.ResponseWriter, r *http.Request, s session, id string, days *int, viewID string, newAddress bool) {
	a.mu.Lock()
	l, ok := a.viewLinks[id]
	a.mu.Unlock()
	if !ok || !sameOwner(l, s.identity) || !a.now().Before(l.Expires) {
		safe(w, 404, "view_link_not_found")
		return
	}
	title := ""
	if viewID != "" {
		var status int
		title, status = a.readViewSummary(r.Context(), s.identity, viewID)
		if status == 404 {
			safe(w, 404, "view_not_found")
			return
		}
		if status != 200 {
			safe(w, 503, "view_unavailable")
			return
		}
	}
	token := ""
	if newAddress {
		var err error
		if token, err = a.secret(); err != nil {
			safe(w, 503, "view_links_unavailable")
			return
		}
	}
	var changed viewLink
	found := false
	a.mu.Lock()
	if _, live := a.authenticatedLocked(s); !live {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	err := a.changeViewLinks(func(next map[string]viewLink) {
		l, ok := next[id]
		if !ok || !sameOwner(l, s.identity) {
			return
		}
		switch {
		case days != nil:
			l.Expires = a.now().Add(time.Duration(*days) * 24 * time.Hour)
		case viewID != "":
			l.ViewID, l.Title = viewID, title
		default:
			l.Token = token
		}
		next[id], changed, found = l, l, true
	})
	a.mu.Unlock()
	if err != nil {
		safe(w, 503, "view_links_unavailable")
		return
	}
	if !found {
		safe(w, 404, "view_link_not_found")
		return
	}
	reason := "extended"
	if viewID != "" {
		reason = "repointed"
	} else if newAddress {
		reason = "readdressed"
	}
	a.log.Info("view_link", "outcome", "accepted", "reason", reason, "link", id, "user", s.identity.Username)
	writeJSON(w, map[string]any{"schema_version": 1, "link": a.viewLinkReply(changed)})
}

func (a *Auth) revokeViewLink(w http.ResponseWriter, id string, allowed func(viewLink) bool, actor string) {
	found := false
	a.mu.Lock()
	err := a.changeViewLinks(func(next map[string]viewLink) {
		if l, ok := next[id]; ok && allowed(l) {
			delete(next, id)
			found = true
		}
	})
	a.mu.Unlock()
	if err != nil {
		safe(w, 503, "view_links_unavailable")
		return
	}
	if !found {
		safe(w, 404, "view_link_not_found")
		return
	}
	a.log.Info("view_link", "outcome", "accepted", "reason", "revoked", "link", id, "actor", actor)
	w.WriteHeader(http.StatusNoContent)
}

// adminViewLinksHTTP is the administrator's abuse response: link metadata,
// never a URL or token, and revocation of any link.
func (a *Auth) adminViewLinksHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, r.URL.Path) || r.URL.Path != adminViewLinksPath && r.URL.Path != adminViewLinksRevoke {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if !a.administrationAvailable() {
		safe(w, 503, "administration_unavailable")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if r.URL.Path == adminViewLinksPath {
		if r.Method != http.MethodGet || r.ContentLength > 0 {
			safe(w, 405, "method_not_allowed")
			return
		}
		type row struct {
			LinkID    string `json:"link_id"`
			OwnerID   string `json:"owner_id"`
			Username  string `json:"username"`
			Title     string `json:"title"`
			CreatedAt string `json:"created_at"`
			ExpiresAt string `json:"expires_at"`
		}
		a.mu.Lock()
		if !a.viewLinkStoreHealthy() {
			a.publishViewLinks(map[string]viewLink{})
		}
		now := a.now()
		var list []viewLink
		for _, l := range a.viewLinks {
			if now.Before(l.Expires) {
				list = append(list, l)
			}
		}
		a.mu.Unlock()
		sort.Slice(list, func(i, j int) bool { return list[i].Created.After(list[j].Created) })
		rows := []row{}
		for _, l := range list {
			rows = append(rows, row{l.ID, l.Owner.Subject, l.Owner.Username, l.Title, l.Created.UTC().Format(time.RFC3339), l.Expires.UTC().Format(time.RFC3339)})
		}
		writeJSON(w, map[string]any{"schema_version": 1, "enabled": a.viewLinksEnabled(), "links": rows})
		return
	}
	if r.Method != http.MethodPost {
		safe(w, 405, "method_not_allowed")
		return
	}
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	var body struct {
		LinkID string `json:"link_id"`
	}
	if !jsonBody(w, r, &body) || !viewLinkIDPattern.MatchString(body.LinkID) {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	a.revokeViewLink(w, body.LinkID, func(viewLink) bool { return true }, "administrator")
}

// viewLinkServe is the whole of a link host: robots.txt, and the linked
// export's files under the link's token. Unknown, expired, revoked and
// disabled links answer alike.
func (a *Auth) viewLinkServe(w http.ResponseWriter, r *http.Request, id string) {
	w.Header().Set("X-Robots-Tag", "noindex, nofollow, noarchive")
	if r.URL.Path == "/robots.txt" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = io.WriteString(w, "User-agent: *\nDisallow: /\n")
		return
	}
	token, _, slash := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
	gone := func() { viewFailure(w, r, 404, viewLinkInvalid) }
	if !validViewLinkToken(token) {
		gone()
		return
	}
	a.mu.Lock()
	if !a.viewLinkStoreHealthy() {
		a.publishViewLinks(map[string]viewLink{})
	}
	l, ok := a.viewLinks[id]
	valid := ok && a.viewLinksEnabled() && subtle.ConstantTimeCompare([]byte(token), []byte(l.Token)) == 1 && a.now().Before(l.Expires) && !a.deniedLocked(l.Owner.Subject)
	a.mu.Unlock()
	if !valid {
		gone()
		return
	}
	if !slash {
		w.Header().Set("Location", "/"+token+"/")
		w.WriteHeader(http.StatusFound)
		return
	}
	release, ok := a.acquireViewLinkRelay(id)
	if !ok {
		viewFailure(w, r, 429, viewLinkBusy)
		return
	}
	defer release()
	a.viewRelay(w, r, l.Owner, l.ViewID, "/"+token, func(n int64) bool { return a.chargeViewLink(id, n) }, "link", id)
}

func (a *Auth) acquireViewLinkRelay(id string) (func(), bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	t := &a.viewLinkTraffic
	if t.relays == nil {
		t.relays = map[string]int{}
	}
	if t.relaying >= viewLinkRelaysSite || t.relays[id] >= viewLinkRelaysPerLink {
		return nil, false
	}
	t.relaying++
	t.relays[id]++
	return func() {
		a.mu.Lock()
		defer a.mu.Unlock()
		t.relaying--
		if t.relays[id]--; t.relays[id] <= 0 {
			delete(t.relays, id)
		}
	}, true
}

// chargeViewLink takes n bytes from today's budgets, or refuses.
func (a *Auth) chargeViewLink(id string, n int64) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	t := &a.viewLinkTraffic
	if day := a.now().UTC().Format(time.DateOnly); t.day != day || t.bytes == nil {
		t.day, t.bytes, t.site = day, map[string]int64{}, 0
	}
	if t.site+n > viewLinkDailySite || t.bytes[id]+n > viewLinkDailyPerLink {
		return false
	}
	t.site += n
	t.bytes[id] += n
	return true
}
