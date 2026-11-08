//go:build linux

package gateway

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/json"
	"errors"
	"io"
	"maps"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/udssecure"
)

// View addresses (ADR 0035, extending ADR 0033's shared links) are one
// gateway-private reservation per owner and frozen view or file offer (the
// same frozen-copy promise, public-file-offers): a stable entry
// secret for the app origin and a content secret for the reservation's own
// host in the view namespace. A reservation starts private and stays until
// its owner, an administrator or the person's revocation deletes it;
// publication, expiry and making private change only its public-until state,
// never a secret, so publishing again revives earlier copies. A public
// address is the one place where the gateway reads a person's daemon for a
// request with no authenticated person: anyone holding the content URL reads
// that one frozen export through the owner's daemon and its fixed export-read
// route, or that one offer through its fixed offer routes, while the
// publication is valid. No cookie is set or read on the
// content host. Only the person's app session reserves, publishes, changes
// and deletes; the agent listener has no route here and never learns an
// address.

const (
	viewAddressesPath       = "/api/v1/view-addresses"
	viewAddressPublishPath  = "/api/v1/view-addresses/publish"
	viewAddressDurationPath = "/api/v1/view-addresses/duration"
	viewAddressPrivatePath  = "/api/v1/view-addresses/private"
	viewAddressDeletePath   = "/api/v1/view-addresses/delete"
	viewAddressOpenPath     = "/api/v1/view-addresses/open"
	adminPublicationsPath   = "/api/v1/server/view-publications"
	adminPublicationsDelete = "/api/v1/server/view-publications/delete"
	viewEntryPrefix         = "/n/"
	viewLinkStoreName       = "view-links.json"
	// Version 1 held ADR 0033's movable links. It is never read as
	// addresses: only the upgrade resets it (ResetLegacyViewLinks).
	viewLinkStoreVersion = 2
	// 8192 reservations whose titles JSON-escape at six bytes a character
	// stay below 14 MiB; the writer refuses what the reader would not read.
	viewLinkStoreBytes = 32 << 20
	viewLinkMaxDays    = 365
	// Reservations and active publications are bounded separately: a
	// private address is a promise too, so the cap refuses a new
	// reservation and never evicts an old one.
	viewAddressesPerPerson    = 1000
	viewAddressesMax          = 8192
	viewPublicationsPerPerson = 50
	viewPublicationsMax       = 4096
	// Public reads cannot starve the owners' own traffic or exhaust a daemon:
	// concurrent relays and a day's bytes are bounded per address and per
	// site. The counters live in memory; a restart resets them.
	viewLinkRelaysPerLink = 8
	viewLinkRelaysSite    = 48
	viewLinkDailyPerLink  = int64(2) << 30
	viewLinkDailySite     = int64(20) << 30
)

var viewAddressIDPattern = regexp.MustCompile(`^a[a-z2-7]{26}$`)

// errViewAddressStore is a store that cannot be used: an unconverted legacy
// format, an unreadable file, or one an operator removed or loosened.
var errViewAddressStore = errors.New("view address store unavailable")

type viewAddress struct {
	ID    string   `json:"id"`
	Entry string   `json:"entry"`
	Token string   `json:"token"`
	Owner Identity `json:"owner"`
	// Exactly one of ViewID and OfferID names the frozen copy the address
	// reads, for good.
	ViewID  string    `json:"view_id,omitempty"`
	OfferID string    `json:"offer_id,omitempty"`
	Title   string    `json:"title"`
	Created time.Time `json:"created"`
	// PublicUntil is zero while private. Past, the publication has expired:
	// the address stays and anonymous reads end.
	PublicUntil time.Time `json:"public_until,omitzero"`
}

// item is the frozen view or offer the address reads.
func (v viewAddress) item() string {
	return v.ViewID + v.OfferID
}

func (v viewAddress) public(now time.Time) bool {
	return !v.PublicUntil.IsZero() && now.Before(v.PublicUntil)
}

// viewLinkTraffic is the in-memory relay accounting of public reads.
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

func validViewAddress(v viewAddress) bool {
	if !viewAddressIDPattern.MatchString(v.ID) || !validViewLinkToken(v.Entry) || !validViewLinkToken(v.Token) || v.Entry == v.Token || !validAddressItem(v.ViewID, v.OfferID) || !validViewTitle(v.Title) || v.Created.IsZero() || !v.PublicUntil.IsZero() && !v.PublicUntil.After(v.Created) {
		return false
	}
	route, ok := brokerIdentity(v.Owner.Subject, BrokerReply{Route: &BrokerRoute{UID: uint32(v.Owner.UID), Username: v.Owner.Username, Socket: v.Owner.Socket}, Epoch: 1, Generation: 1})
	return ok && v.Owner.Provider == "github" && v.Owner.UID > 0 && route == v.Owner && canonicalSubject(v.Owner.Subject)
}

// validAddressItem: an address reads exactly one view or one file offer.
func validAddressItem(viewID, offerID string) bool {
	return viewIDPattern.MatchString(viewID) && offerID == "" || viewID == "" && fileOfferIDPattern.MatchString(offerID)
}

// viewAddressesEnabled: reservations need the view namespace for their
// content host; private opens work whether or not the site shares.
func (a *Auth) viewAddressesEnabled() bool {
	return a.cfg.ViewOrigin != ""
}

// viewSharingEnabled is the operator's switch for public access. Off, it
// pauses every publication without changing it.
func (a *Auth) viewSharingEnabled() bool {
	return a.cfg.ViewOrigin != "" && a.cfg.ViewLinkMaxDays > 0
}

func (a *Auth) viewLinkFile() string {
	if a.sessionFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.sessionFile), viewLinkStoreName)
}

// viewLinkHost is the address's own content host in the view namespace. The
// label is a hash of the reservation ID, never of a secret: hostnames leak
// through DNS and SNI.
func (a *Auth) viewLinkHost(id string) string {
	h := sha256.Sum256([]byte("view-link\x00" + id))
	label := strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(h[:]))
	return strings.Replace(a.viewTemplate(), "*", label, 1)
}

func (a *Auth) viewContentURL(v viewAddress) string {
	return "https://" + a.viewLinkHost(v.ID) + "/" + v.Token + "/"
}

// viewEntryURL is the stable address opened and copied for the view.
func (a *Auth) viewEntryURL(v viewAddress) string {
	return a.cfg.Origin + viewEntryPrefix + v.Entry
}

// viewEntryKey indexes an entry secret by its hash, so no lookup compares
// the secret itself byte by byte.
func viewEntryKey(entry string) string {
	h := sha256.Sum256([]byte("view-entry\x00" + entry))
	return string(h[:])
}

// publishViewAddresses replaces the in-memory store and its host and entry
// indexes. Call under mu.
func (a *Auth) publishViewAddresses(next map[string]viewAddress) {
	a.viewAddresses = next
	a.viewLinkHosts = make(map[string]string, len(next))
	a.viewEntries = make(map[string]string, len(next))
	for id, v := range next {
		a.viewEntries[viewEntryKey(v.Entry)] = id
	}
	if a.cfg.ViewOrigin == "" {
		return
	}
	for id := range next {
		a.viewLinkHosts[a.viewLinkHost(id)] = id
	}
}

// viewEntryLocked finds the reservation an entry secret names. Call under mu.
func (a *Auth) viewEntryLocked(entry string) (viewAddress, bool) {
	v, ok := a.viewAddresses[a.viewEntries[viewEntryKey(entry)]]
	if !ok || subtle.ConstantTimeCompare([]byte(entry), []byte(v.Entry)) != 1 {
		return viewAddress{}, false
	}
	return v, true
}

// servableLocked is whether anyone may read v's content now: the store is
// usable, the site shares, the publication is current and its owner is not
// denied. Entry and content requests both ask it, every time. Call under mu.
func (a *Auth) servableLocked(v viewAddress) bool {
	return a.viewAddressStoreUsable() && a.viewSharingEnabled() && v.public(a.now()) && !a.deniedLocked(v.Owner.Subject)
}

// publicViewAccess serves only the anonymous reads exempt from oauth.access.
// Dispatch directly, never to the app mux or owner view handler: publication
// can end between checks, and that must not become private-session access.
func (a *Auth) publicViewAccess(w http.ResponseWriter, r *http.Request) bool {
	if r.TLS == nil || (r.Method != http.MethodGet && r.Method != http.MethodHead) || r.Header.Get("Upgrade") != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		return false
	}
	if r.Host == strings.TrimPrefix(a.cfg.Origin, "https://") {
		return strings.HasPrefix(r.URL.Path, viewEntryPrefix) && a.viewEntry(w, r)
	}
	if !a.isViewHost(r.Host) {
		return false
	}
	token, _, _ := strings.Cut(strings.TrimPrefix(r.URL.Path, "/"), "/")
	if !validViewLinkToken(token) {
		return false
	}
	a.mu.Lock()
	id, linked := a.viewLinkHosts[r.Host]
	v, ok := a.viewAddresses[id]
	public := linked && ok && subtle.ConstantTimeCompare([]byte(token), []byte(v.Token)) == 1 && a.servableLocked(v)
	a.mu.Unlock()
	if !public {
		return false
	}
	a.viewLinkServe(w, r, id)
	return true
}

// viewEntry is the app origin's stable address of a view, /n/<entry>. A
// public one redirects to its content host, the owner's own open included,
// so every public read goes through the content host's checks and budgets.
// Anything else (private, expired, paused, deleted, unknown or malformed)
// reports false and the caller serves the app's own page, the same bytes
// for everyone: that page asks the gateway, as the signed-in person, whether
// the address is theirs, and frames the view only for its owner. Never
// export HTML on the app origin, and never a title or owner before sign-in.
// The secret is in the path, which request diagnostics record only as
// "ui"; these responses are neither cached nor indexed and send no referrer
// onward, so the address does not leak to the assets, the API calls, the
// view frame or a sign-in provider.
func (a *Auth) viewEntry(w http.ResponseWriter, r *http.Request) bool {
	h := w.Header()
	h.Set("Cache-Control", "no-store")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("X-Robots-Tag", "noindex, nofollow, noarchive")
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		safe(w, 405, "method_not_allowed")
		return true
	}
	// A query is ignored, never forwarded: messaging apps decorate shared
	// links with tracking parameters, and the address is the path alone.
	entry := strings.TrimPrefix(r.URL.Path, viewEntryPrefix)
	if r.TLS == nil || r.Host != strings.TrimPrefix(a.cfg.Origin, "https://") || !validViewLinkToken(entry) {
		return false
	}
	a.mu.Lock()
	v, ok := a.viewEntryLocked(entry)
	public := ok && a.servableLocked(v)
	a.mu.Unlock()
	if !public {
		return false
	}
	h.Set("Location", a.viewContentURL(v))
	w.WriteHeader(http.StatusFound)
	return true
}

// viewAddressStoreFailed disables every address read and write until a
// restart finds a usable store. The file is never replaced, so nothing an
// operator could still repair is lost. Call under mu.
func (a *Auth) viewAddressStoreFailed(reason string) {
	if a.viewAddressFault == "" {
		a.log.Warn("view_address_store_unavailable", "outcome", "rejected", "reason", reason)
	}
	a.viewAddressFault = reason
	a.publishViewAddresses(map[string]viewAddress{})
}

type viewAddressState struct {
	Version   int           `json:"version"`
	Addresses []viewAddress `json:"addresses"`
}

// decodeViewAddressStore reads the store's bytes, or names why it is not one.
func decodeViewAddressStore(data []byte) ([]viewAddress, string) {
	var head struct {
		Version int `json:"version"`
	}
	if json.Unmarshal(data, &head) == nil && head.Version == 1 {
		return nil, "legacy_view_link_store"
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var state viewAddressState
	if d.Decode(&state) != nil || state.Version != viewLinkStoreVersion || state.Addresses == nil || d.Decode(new(any)) != io.EOF || len(state.Addresses) > viewAddressesMax {
		return nil, "invalid_view_address_store"
	}
	ids, entries, tokens, views := map[string]bool{}, map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, v := range state.Addresses {
		key := v.Owner.Provider + "\x00" + v.Owner.Subject + "\x00" + v.item()
		if !validViewAddress(v) || ids[v.ID] || entries[v.Entry] || tokens[v.Token] || views[key] {
			return nil, "invalid_view_address_store"
		}
		ids[v.ID], entries[v.Entry], tokens[v.Token], views[key] = true, true, true, true
	}
	return state.Addresses, ""
}

func readViewAddressFile(path string) ([]byte, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return nil, err
	}
	if !privateSessionFile(info) {
		return nil, errViewAddressStore
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, viewLinkStoreBytes+1))
	if err == nil && len(data) > viewLinkStoreBytes {
		err = errViewAddressStore
	}
	return data, err
}

// loadViewLinks reads the store once at startup. An absent store is empty;
// an unusable or unconverted one disables addresses, never the rest of the
// app, and is never silently reset.
func (a *Auth) loadViewLinks() {
	a.viewAddressFault = ""
	a.publishViewAddresses(map[string]viewAddress{})
	path := a.viewLinkFile()
	if path == "" {
		return
	}
	data, err := readViewAddressFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return
	}
	if err != nil {
		a.viewAddressStoreFailed("invalid_view_address_store")
		return
	}
	list, reason := decodeViewAddressStore(data)
	if reason != "" {
		a.viewAddressStoreFailed(reason)
		return
	}
	next := make(map[string]viewAddress, len(list))
	for _, v := range list {
		next[v.ID] = v
	}
	a.publishViewAddresses(next)
}

// viewAddressStoreUsable is false once the store failed, or an operator
// removed or loosened it while it held reservations. Call under mu.
func (a *Auth) viewAddressStoreUsable() bool {
	if a.viewAddressFault != "" {
		return false
	}
	path := a.viewLinkFile()
	if path == "" || len(a.viewAddresses) == 0 {
		return true
	}
	info, err := os.Lstat(path)
	if err != nil || !privateSessionFile(info) {
		a.viewAddressStoreFailed("invalid_view_address_store")
		return false
	}
	return true
}

func writeViewAddressFile(path string, list []viewAddress) error {
	// An empty store is an empty list: the reader refuses a null one.
	if list == nil {
		list = []viewAddress{}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
	data, err := json.Marshal(viewAddressState{viewLinkStoreVersion, list})
	if err != nil {
		return err
	}
	if len(data) > viewLinkStoreBytes {
		return errors.New("view address store capacity exceeded")
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
	return os.Rename(f.Name(), path)
}

// changeViewAddresses applies change to a copy, writes the store durably
// and publishes it. change returns false to leave the store as it is. Call
// under mu.
func (a *Auth) changeViewAddresses(change func(map[string]viewAddress) bool) error {
	if !a.viewAddressStoreUsable() {
		return errViewAddressStore
	}
	next := maps.Clone(a.viewAddresses)
	if !change(next) {
		return nil
	}
	if path := a.viewLinkFile(); path != "" {
		if err := writeViewAddressFile(path, slices.Collect(maps.Values(next))); err != nil {
			return err
		}
		a.publishViewAddresses(next)
		return syncDir(filepath.Dir(path))
	}
	a.publishViewAddresses(next)
	return nil
}

// StateDir is the installed gateway's private state directory.
const StateDir = "/var/lib/open-habitat-gateway"

// ResetLegacyViewLinks is the upgrade's one-time transition from ADR 0033's
// movable links, run as the gateway's account while the gateway is stopped:
// a version-1 store becomes the new empty format, so every old shared link
// stops working. A current store and an absent one stay as they are; an
// unusable one is left for the operator, since recovering it as empty would
// silently delete addresses. Ordinary startup never resets anything.
func ResetLegacyViewLinks(dir string) (string, error) {
	path := filepath.Join(dir, viewLinkStoreName)
	data, err := readViewAddressFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "absent", nil
	}
	if err != nil {
		return "unusable_left_unchanged", nil
	}
	switch _, reason := decodeViewAddressStore(data); reason {
	case "":
		return "current", nil
	case "legacy_view_link_store":
	default:
		return "unusable_left_unchanged", nil
	}
	if err := writeViewAddressFile(path, []viewAddress{}); err != nil {
		return "", err
	}
	if err := syncDir(dir); err != nil {
		return "", err
	}
	return "reset", nil
}

// removeViewLinksLocked permanently deletes every address of subject: a
// revoked or withdrawn person's old recipients stay locked out even if the
// person is admitted again. An unusable store cannot be changed, so the
// deletion fails rather than leave addresses an operator's repair would
// revive. Call under mu.
func (a *Auth) removeViewLinksLocked(subject string) (int, error) {
	removed := 0
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		for id, v := range next {
			if v.Owner.Subject == subject {
				delete(next, id)
				removed++
			}
		}
		return removed > 0
	})
	return removed, err
}

func (a *Auth) newViewAddressID() (string, error) {
	b := make([]byte, 17)
	if _, err := io.ReadFull(a.random, b); err != nil {
		return "", err
	}
	return "a" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:26], nil
}

// readViewSummary asks the owner's daemon for one export's or offer's
// summary. It answers the title, or 404 when the item is gone and 503
// otherwise.
func (a *Auth) readViewSummary(ctx context.Context, target Identity, item string) (string, int) {
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
	out := &url.URL{Scheme: "http", Host: "unix", Path: "/view-export/" + item + "/"}
	if fileOfferIDPattern.MatchString(item) {
		out.Path = fileOffersPath + "/" + item
	}
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
		Offer struct {
			Title string `json:"title"`
		} `json:"offer"`
	}
	// An offer's facts carry its file list, up to the manifest's bound.
	if res.StatusCode != 200 || json.NewDecoder(io.LimitReader(res.Body, offerFactsBytes)).Decode(&body) != nil {
		return "", 503
	}
	title := body.View.Title
	if fileOfferIDPattern.MatchString(item) {
		title = body.Offer.Title
	}
	if !validViewTitle(title) {
		return "", 503
	}
	return title, 200
}

type viewAddressReply struct {
	AddressID   string `json:"address_id"`
	ViewID      string `json:"view_id,omitempty"`
	OfferID     string `json:"offer_id,omitempty"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	ContentURL  string `json:"content_url"`
	State       string `json:"state"`
	CreatedAt   string `json:"created_at"`
	PublicUntil string `json:"public_until,omitempty"`
}

func (a *Auth) viewAddressReply(v viewAddress) viewAddressReply {
	reply := viewAddressReply{AddressID: v.ID, ViewID: v.ViewID, OfferID: v.OfferID, Title: v.Title, URL: a.viewEntryURL(v), ContentURL: a.viewContentURL(v), State: "private", CreatedAt: v.Created.UTC().Format(time.RFC3339)}
	if !v.PublicUntil.IsZero() {
		reply.State, reply.PublicUntil = "expired", v.PublicUntil.UTC().Format(time.RFC3339)
		if v.public(a.now()) {
			reply.State = "public"
		}
	}
	return reply
}

func sameOwner(v viewAddress, id Identity) bool {
	return v.Owner.Provider == id.Provider && v.Owner.Subject == id.Subject
}

func (a *Auth) viewMaxDays() int {
	if !a.viewSharingEnabled() {
		return 0
	}
	return a.cfg.ViewLinkMaxDays
}

// viewLinksHTTP is the person's own addresses and their writes on the app
// origin. Without the view namespace the list is an empty 204 and writes are
// 404; with sharing off, reserving, making private and deleting still work.
func (a *Auth) viewLinksHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	path := r.URL.Path
	if !a.exact(r, path) || path != viewAddressesPath && path != viewAddressPublishPath && path != viewAddressDurationPath && path != viewAddressPrivatePath && path != viewAddressDeletePath && path != viewAddressOpenPath {
		safe(w, 400, "invalid_request")
		return
	}
	if path == viewAddressesPath && r.Method == http.MethodGet {
		if r.ContentLength > 0 {
			safe(w, 400, "invalid_request")
			return
		}
		s, ok := a.authenticated(r)
		if !ok {
			safe(w, 401, "authentication_required")
			return
		}
		if !a.viewAddressesEnabled() {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		a.mu.Lock()
		usable := a.viewAddressStoreUsable()
		var mine []viewAddress
		for _, v := range a.viewAddresses {
			if sameOwner(v, s.identity) {
				mine = append(mine, v)
			}
		}
		a.mu.Unlock()
		if !usable {
			safe(w, 503, "view_addresses_unavailable")
			return
		}
		sort.Slice(mine, func(i, j int) bool {
			if !mine[i].Created.Equal(mine[j].Created) {
				return mine[i].Created.After(mine[j].Created)
			}
			return mine[i].ID < mine[j].ID
		})
		list := []viewAddressReply{}
		for _, v := range mine {
			list = append(list, a.viewAddressReply(v))
		}
		writeJSON(w, map[string]any{"schema_version": 1, "max_days": a.viewMaxDays(), "addresses": list})
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
	if !a.viewAddressesEnabled() {
		safe(w, 404, "view_addresses_unavailable")
		return
	}
	if path == viewAddressesPath {
		var body struct {
			ViewID  string `json:"view_id"`
			OfferID string `json:"offer_id"`
		}
		if !jsonBody(w, r, &body) || !validAddressItem(body.ViewID, body.OfferID) {
			safe(w, 400, "invalid_request")
			return
		}
		a.ensureViewAddress(w, r, s, body.ViewID, body.OfferID)
		return
	}
	if path == viewAddressOpenPath {
		var body struct {
			Entry string `json:"entry"`
		}
		if !jsonBody(w, r, &body) || !validViewLinkToken(body.Entry) {
			safe(w, 400, "invalid_request")
			return
		}
		a.openViewEntry(w, s, body.Entry)
		return
	}
	var body struct {
		AddressID string `json:"address_id"`
		Days      *int   `json:"days"`
	}
	withDays := path == viewAddressPublishPath || path == viewAddressDurationPath
	if !jsonBody(w, r, &body) || !viewAddressIDPattern.MatchString(body.AddressID) || withDays != (body.Days != nil) || withDays && (*body.Days < 1 || *body.Days > viewLinkMaxDays) {
		safe(w, 400, "invalid_request")
		return
	}
	if withDays && !a.viewSharingEnabled() {
		safe(w, 409, "view_sharing_off")
		return
	}
	if withDays && *body.Days > a.cfg.ViewLinkMaxDays {
		safe(w, 400, "invalid_request")
		return
	}
	switch path {
	case viewAddressPublishPath:
		a.publishViewAddress(w, r, s, body.AddressID, *body.Days)
	case viewAddressDurationPath:
		a.changeViewAddress(w, s, body.AddressID, "duration", func(v *viewAddress, now time.Time) string {
			if !v.public(now) {
				return "view_address_not_public"
			}
			v.PublicUntil = now.Add(time.Duration(*body.Days) * 24 * time.Hour)
			return ""
		})
	case viewAddressPrivatePath:
		a.changeViewAddress(w, s, body.AddressID, "private", func(v *viewAddress, _ time.Time) string {
			v.PublicUntil = time.Time{}
			return ""
		})
	case viewAddressDeletePath:
		a.deleteViewAddress(w, &s, body.AddressID, func(v viewAddress) bool { return sameOwner(v, s.identity) }, "owner")
	}
}

// openViewEntry answers the signed-in owner which of their addresses an
// entry secret names, so their page can frame the view privately. The
// secret travels in the body, never a URL. Another person's address and one
// that does not exist answer alike: a wrong owner learns no title, owner or
// state. The answer opens nothing by itself; the frame still needs the
// session's own view hand-off.
func (a *Auth) openViewEntry(w http.ResponseWriter, s session, entry string) {
	a.mu.Lock()
	usable := a.viewAddressStoreUsable()
	v, ok := a.viewEntryLocked(entry)
	a.mu.Unlock()
	if !usable {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if !ok || !sameOwner(v, s.identity) {
		safe(w, 404, "view_address_not_found")
		return
	}
	writeJSON(w, map[string]any{"schema_version": 1, "address": a.viewAddressReply(v)})
}

func (a *Auth) ownedAddressLocked(s session, item string) (viewAddress, bool) {
	for _, v := range a.viewAddresses {
		if sameOwner(v, s.identity) && v.item() == item {
			return v, true
		}
	}
	return viewAddress{}, false
}

// ensureViewAddress answers the view's or offer's one reservation, creating
// it private on first need. Concurrent first needs agree on one address.
func (a *Auth) ensureViewAddress(w http.ResponseWriter, r *http.Request, s session, viewID, offerID string) {
	item := viewID + offerID
	a.mu.Lock()
	usable := a.viewAddressStoreUsable()
	existing, found := a.ownedAddressLocked(s, item)
	a.mu.Unlock()
	if !usable {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if found {
		writeJSON(w, map[string]any{"schema_version": 1, "address": a.viewAddressReply(existing)})
		return
	}
	title, status := a.readViewSummary(r.Context(), s.identity, item)
	if status == 404 {
		safe(w, 404, "view_not_found")
		return
	}
	if status != 200 {
		safe(w, 503, "view_unavailable")
		return
	}
	id, err := a.newViewAddressID()
	entry, entryErr := a.secret()
	token, tokenErr := a.secret()
	if err != nil || entryErr != nil || tokenErr != nil {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	v := viewAddress{ID: id, Entry: entry, Token: token, Owner: s.identity, ViewID: viewID, OfferID: offerID, Title: title, Created: a.now()}
	a.mu.Lock()
	// The person may have been revoked while the daemon answered.
	if _, ok := a.authenticatedLocked(s); !ok {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	limited := false
	err = a.changeViewAddresses(func(next map[string]viewAddress) bool {
		mine := 0
		for _, o := range next {
			if sameOwner(o, s.identity) {
				if o.item() == item {
					v = o
					return false
				}
				mine++
			}
		}
		if mine >= viewAddressesPerPerson || len(next) >= viewAddressesMax {
			limited = true
			return false
		}
		next[id] = v
		return true
	})
	a.mu.Unlock()
	if errors.Is(err, errViewAddressStore) {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if err != nil {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if limited {
		safe(w, 429, "view_addresses_limited")
		return
	}
	if v.ID == id {
		a.log.Info("view_address", "outcome", "accepted", "reason", "reserved", "address", id, "user", s.identity.Username)
	}
	writeJSON(w, map[string]any{"schema_version": 1, "address": a.viewAddressReply(v)})
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

// publishViewAddress makes the address public for days from now, whether it
// was private, expired or public. Its secrets stay: earlier copies revive.
func (a *Auth) publishViewAddress(w http.ResponseWriter, r *http.Request, s session, id string, days int) {
	a.mu.Lock()
	usable := a.viewAddressStoreUsable()
	v, ok := a.viewAddresses[id]
	a.mu.Unlock()
	if !usable {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if !ok || !sameOwner(v, s.identity) {
		safe(w, 404, "view_address_not_found")
		return
	}
	// A missing export is never published, nor replaced by another.
	if _, status := a.readViewSummary(r.Context(), s.identity, v.item()); status == 404 {
		safe(w, 404, "view_not_found")
		return
	} else if status != 200 {
		safe(w, 503, "view_unavailable")
		return
	}
	a.mu.Lock()
	if _, live := a.authenticatedLocked(s); !live {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	var changed viewAddress
	refusal := ""
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		v, ok := next[id]
		if !ok || !sameOwner(v, s.identity) {
			refusal = "view_address_not_found"
			return false
		}
		now := a.now()
		mine, total := 0, 0
		for _, o := range next {
			if o.ID != id && o.public(now) {
				total++
				if sameOwner(o, s.identity) {
					mine++
				}
			}
		}
		if mine >= viewPublicationsPerPerson || total >= viewPublicationsMax {
			refusal = "view_publications_limited"
			return false
		}
		v.PublicUntil = now.Add(time.Duration(days) * 24 * time.Hour)
		next[id], changed = v, v
		return true
	})
	a.mu.Unlock()
	switch {
	case err != nil:
		safe(w, 503, "view_addresses_unavailable")
	case refusal == "view_address_not_found":
		safe(w, 404, refusal)
	case refusal != "":
		safe(w, 429, refusal)
	default:
		a.log.Info("view_address", "outcome", "accepted", "reason", "published", "address", id, "user", s.identity.Username)
		writeJSON(w, map[string]any{"schema_version": 1, "address": a.viewAddressReply(changed)})
	}
}

// changeViewAddress applies one owner change that needs no daemon: a new
// duration for a current publication, or making the address private.
func (a *Auth) changeViewAddress(w http.ResponseWriter, s session, id, reason string, change func(*viewAddress, time.Time) string) {
	var changed viewAddress
	refusal := "view_address_not_found"
	a.mu.Lock()
	// The session may have ended while the body was read.
	if _, live := a.authenticatedLocked(s); !live {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		v, ok := next[id]
		if !ok || !sameOwner(v, s.identity) {
			return false
		}
		if refusal = change(&v, a.now()); refusal != "" {
			return false
		}
		next[id], changed = v, v
		return true
	})
	a.mu.Unlock()
	switch {
	case err != nil:
		safe(w, 503, "view_addresses_unavailable")
	case refusal == "view_address_not_found":
		safe(w, 404, refusal)
	case refusal != "":
		safe(w, 409, refusal)
	default:
		a.log.Info("view_address", "outcome", "accepted", "reason", reason, "address", id, "user", s.identity.Username)
		writeJSON(w, map[string]any{"schema_version": 1, "address": a.viewAddressReply(changed)})
	}
}

// deleteViewAddress ends both the entry and the content address for good.
// A later reservation of the same view gets fresh secrets and starts private.
func (a *Auth) deleteViewAddress(w http.ResponseWriter, owner *session, id string, allowed func(viewAddress) bool, actor string) {
	found := false
	a.mu.Lock()
	if owner != nil {
		if _, live := a.authenticatedLocked(*owner); !live {
			a.mu.Unlock()
			safe(w, 401, "authentication_required")
			return
		}
	}
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		if v, ok := next[id]; ok && allowed(v) {
			delete(next, id)
			found = true
		}
		return found
	})
	a.mu.Unlock()
	if err != nil {
		safe(w, 503, "view_addresses_unavailable")
		return
	}
	if !found {
		safe(w, 404, "view_address_not_found")
		return
	}
	a.log.Info("view_address", "outcome", "accepted", "reason", "deleted", "address", id, "actor", actor)
	w.WriteHeader(http.StatusNoContent)
}

// adminViewLinksHTTP is the administrator's abuse response: current
// publications' metadata, never an address, secret or private reservation,
// and permanent deletion of any address.
func (a *Auth) adminViewLinksHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, r.URL.Path) || r.URL.Path != adminPublicationsPath && r.URL.Path != adminPublicationsDelete {
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
	if r.URL.Path == adminPublicationsPath {
		if r.Method != http.MethodGet || r.ContentLength > 0 {
			safe(w, 405, "method_not_allowed")
			return
		}
		type row struct {
			AddressID   string `json:"address_id"`
			OwnerID     string `json:"owner_id"`
			Username    string `json:"username"`
			Title       string `json:"title"`
			CreatedAt   string `json:"created_at"`
			PublicUntil string `json:"public_until"`
		}
		a.mu.Lock()
		usable := a.viewAddressStoreUsable()
		now := a.now()
		var list []viewAddress
		for _, v := range a.viewAddresses {
			if v.public(now) {
				list = append(list, v)
			}
		}
		a.mu.Unlock()
		if !usable {
			safe(w, 503, "view_addresses_unavailable")
			return
		}
		sort.Slice(list, func(i, j int) bool { return list[i].Created.After(list[j].Created) })
		rows := []row{}
		for _, v := range list {
			rows = append(rows, row{v.ID, v.Owner.Subject, v.Owner.Username, v.Title, v.Created.UTC().Format(time.RFC3339), v.PublicUntil.UTC().Format(time.RFC3339)})
		}
		writeJSON(w, map[string]any{"schema_version": 1, "enabled": a.viewSharingEnabled(), "publications": rows})
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
		AddressID string `json:"address_id"`
	}
	if !jsonBody(w, r, &body) || !viewAddressIDPattern.MatchString(body.AddressID) {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	a.deleteViewAddress(w, nil, body.AddressID, func(viewAddress) bool { return true }, "administrator")
}

// viewLinkServe is the whole of a content host: robots.txt, and the
// export's files under the content secret while it is public. Publication,
// expiry, the site's switch and the owner's denial are checked on every
// request, so a cached redirect or a bookmarked content URL bypasses
// nothing. Unknown, private, expired, deleted and disabled addresses answer
// alike.
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
	l, ok := a.viewAddresses[id]
	valid := ok && subtle.ConstantTimeCompare([]byte(token), []byte(l.Token)) == 1 && a.servableLocked(l)
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
	if l.OfferID != "" {
		a.offerLinkServe(w, r, l, "/"+token)
		return
	}
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
	if n < 0 {
		return false
	}
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
