//go:build linux

package gateway

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base32"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"maps"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// Other people in a person's conversation (ADR 0038 sections 2 and 7), the
// participant's way in. The gateway keeps a participation index: metadata
// only, next to view-links.json. It routes a participant to the owner's guest
// socket without asking every daemon, and lists what is shared with them. It
// holds no message, no role and no permission: a guest request passes only
// when the index and the owner's own membership record both admit it, so a
// drift between the two closes access and never opens it.
//
// Every participant route is /api/v1/shared/<share_id>/<operation> on the app
// origin, with the app's session, cookie and CSRF rules. share_id is an
// opaque random ID; the URL never chooses a Unix user. The gateway checks the
// entry's participant is the session's subject and that neither person is
// denied, dials the owner's guest.sock and rewrites the request to the fixed
// guest path, naming the participant in one header. An unknown, removed or
// foreign share_id gets the same answer as a missing one.

const (
	sharedPath        = "/api/v1/shared"
	sharedPrefix      = "/api/v1/shared/"
	shareStoreName    = "participation.json"
	shareStoreVersion = 1
	// 16 people in 256 conversations per owner (the daemon's own limits),
	// and a site bound well above any real server; about 400 bytes each.
	sharesPerOwner  = 4096
	sharesMax       = 32768
	shareStoreBytes = 16 << 20
	// guestParticipantHeader is how the owner's daemon learns which person
	// speaks on its guest socket. It never carries a Unix name.
	guestParticipantHeader = "Open-Habitat-Participant"
)

var shareIDPattern = regexp.MustCompile(`^s[a-z2-7]{26}$`)

var errShareStore = errors.New("participation index unavailable")

// shareEntry is one person's invitation into one conversation of an owner.
// Owner is the owner's binding as the gateway already routes it; it never
// reaches the participant.
type shareEntry struct {
	ID           string    `json:"share_id"`
	Owner        Identity  `json:"owner"`
	OwnerName    string    `json:"owner_name"`
	Conversation string    `json:"conversation_id"`
	Participant  string    `json:"participant"`
	State        string    `json:"state"`
	Created      time.Time `json:"created"`
}

type shareState struct {
	Version int          `json:"version"`
	Shares  []shareEntry `json:"shares"`
}

func validShare(v shareEntry) bool {
	route, ok := brokerIdentity(v.Owner.Subject, BrokerReply{Route: &BrokerRoute{UID: uint32(v.Owner.UID), Username: v.Owner.Username, Socket: v.Owner.Socket}, Epoch: 1, Generation: 1})
	return shareIDPattern.MatchString(v.ID) && ok && route == v.Owner && v.Owner.Provider == "github" && v.Owner.UID > 0 && canonicalSubject(v.Owner.Subject) &&
		conversationUUID.MatchString(v.Conversation) && v.Conversation == strings.ToLower(v.Conversation) &&
		memberSubject.MatchString(v.Participant) && v.Participant != "github:"+v.Owner.Subject &&
		(v.State == "invited" || v.State == "joined") && memberName(v.OwnerName) == v.OwnerName && v.OwnerName != "" && !v.Created.IsZero()
}

func shareKey(owner, conversation, participant string) string {
	return owner + "\x00" + conversation + "\x00" + participant
}

func decodeShareStore(data []byte) ([]shareEntry, bool) {
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	var state shareState
	if d.Decode(&state) != nil || state.Version != shareStoreVersion || state.Shares == nil || d.Decode(new(any)) != io.EOF || len(state.Shares) > sharesMax {
		return nil, false
	}
	ids, keys, owners := map[string]bool{}, map[string]bool{}, map[string]int{}
	for _, v := range state.Shares {
		key := shareKey(v.Owner.Subject, v.Conversation, v.Participant)
		if !validShare(v) || ids[v.ID] || keys[key] || owners[v.Owner.Subject] >= sharesPerOwner {
			return nil, false
		}
		ids[v.ID], keys[key] = true, true
		owners[v.Owner.Subject]++
	}
	return state.Shares, true
}

func (a *Auth) shareFile() string {
	if a.sessionFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.sessionFile), shareStoreName)
}

// loadShares reads the index once at startup. An absent index is empty; an
// unusable one disables sharing, never the rest of the app, and is never
// reset: repairing it is the operator's, and a reset would lose nothing an
// owner could not re-create, but a silent one would hide the fault.
func (a *Auth) loadShares() {
	a.shares, a.shareFault = map[string]shareEntry{}, ""
	path := a.shareFile()
	if path == "" {
		return
	}
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return
	}
	if err != nil || !privateSessionFile(info) {
		a.shareStoreFailed()
		return
	}
	f, err := os.Open(path)
	if err != nil {
		a.shareStoreFailed()
		return
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, shareStoreBytes+1))
	if err != nil || len(data) > shareStoreBytes {
		a.shareStoreFailed()
		return
	}
	list, ok := decodeShareStore(data)
	if !ok {
		a.shareStoreFailed()
		return
	}
	for _, v := range list {
		a.shares[v.ID] = v
	}
}

// shareStoreFailed disables every share until a restart finds a usable
// index. Call under mu (or before serving).
func (a *Auth) shareStoreFailed() {
	if a.shareFault == "" && a.log != nil {
		a.log.Warn("participation_index_unavailable", "outcome", "rejected", "reason", "invalid_participation_index")
	}
	a.shareFault = "invalid_participation_index"
	for id := range a.shares {
		a.cancelShareRelaysLocked(id)
	}
	a.shares = map[string]shareEntry{}
}

// shareStoreUsable is false once the index failed, or an operator removed or
// loosened it while it held entries. Call under mu.
func (a *Auth) shareStoreUsable() bool {
	if a.shareFault != "" {
		return false
	}
	path := a.shareFile()
	if path == "" || len(a.shares) == 0 {
		return true
	}
	info, err := os.Lstat(path)
	if err != nil || !privateSessionFile(info) {
		a.shareStoreFailed()
		return false
	}
	return true
}

func writeShareFile(path string, list []shareEntry) error {
	if list == nil {
		list = []shareEntry{}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].ID < list[j].ID })
	data, err := json.Marshal(shareState{shareStoreVersion, list})
	if err != nil {
		return err
	}
	if len(data) > shareStoreBytes {
		return errors.New("participation index capacity exceeded")
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".participation-*")
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

// changeShares applies change to a copy, writes the index durably and
// publishes it; a share that left the index has its relays ended. change
// returns false to leave the index as it is. Call under mu.
func (a *Auth) changeShares(change func(map[string]shareEntry) bool) error {
	if !a.shareStoreUsable() {
		return errShareStore
	}
	next := maps.Clone(a.shares)
	if next == nil {
		next = map[string]shareEntry{}
	}
	if !change(next) {
		return nil
	}
	if path := a.shareFile(); path != "" {
		if err := writeShareFile(path, slices.Collect(maps.Values(next))); err != nil {
			return err
		}
		if err := syncDir(filepath.Dir(path)); err != nil {
			a.publishShares(next)
			return err
		}
	}
	a.publishShares(next)
	return nil
}

func (a *Auth) publishShares(next map[string]shareEntry) {
	for id, old := range a.shares {
		if current, ok := next[id]; !ok || current.Participant != old.Participant || current.Owner != old.Owner || current.Conversation != old.Conversation {
			a.cancelShareRelaysLocked(id)
		}
	}
	a.shares = next
}

// removeSharesLocked deletes every share of subject, as owner and as
// participant, for good. Call under mu.
func (a *Auth) removeSharesLocked(subject string) error {
	return a.changeShares(func(next map[string]shareEntry) bool {
		removed := false
		for id, v := range next {
			if v.Owner.Subject == subject || v.Participant == "github:"+subject {
				delete(next, id)
				removed = true
			}
		}
		return removed
	})
}

func (a *Auth) newShareID() (string, error) {
	b := make([]byte, 17)
	random := a.random
	if random == nil {
		random = rand.Reader
	}
	if _, err := io.ReadFull(random, b); err != nil {
		return "", err
	}
	return "s" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:26], nil
}

// reconcileShare makes the index follow the owner's daemon after a member
// change it answered: the participant's entry exists, in the record's state,
// while the record names them, and is deleted once it does not. The daemon's
// record is the authority; the index only routes.
func (a *Auth) reconcileShare(owner session, conversation, participant string, reply []byte) error {
	var record daemonMembers
	if json.Unmarshal(reply, &record) != nil {
		return errShareStore
	}
	state := ""
	for _, m := range record.Members {
		if m.Subject == participant && (m.State == "invited" || m.State == "joined") {
			state = m.State
		}
	}
	conversation = strings.ToLower(conversation)
	name := memberName(owner.profile.Name)
	if name == "" {
		name = "GitHub " + owner.identity.Subject
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if _, ok := a.authenticatedLocked(owner); !ok {
		return errShareStore
	}
	var id string
	if state != "" {
		var err error
		if id, err = a.newShareID(); err != nil {
			return err
		}
	}
	return a.changeShares(func(next map[string]shareEntry) bool {
		key := shareKey(owner.identity.Subject, conversation, participant)
		owned := 0
		for sid, v := range next {
			if v.Owner.Subject == owner.identity.Subject {
				owned++
			}
			if shareKey(v.Owner.Subject, v.Conversation, v.Participant) != key {
				continue
			}
			if state == "" {
				delete(next, sid)
				return true
			}
			if v.State == state && v.Owner == owner.identity && v.OwnerName == name {
				return false
			}
			v.State, v.Owner, v.OwnerName = state, owner.identity, name
			next[sid] = v
			return true
		}
		if state == "" || owned >= sharesPerOwner || len(next) >= sharesMax {
			return false
		}
		next[id] = shareEntry{ID: id, Owner: owner.identity, OwnerName: name, Conversation: conversation, Participant: participant, State: state, Created: a.now().UTC()}
		return true
	})
}

// shareFor is the entry a participant's session may use, or nothing. The
// owner must not be denied and must not be the participant. Call under mu.
func (a *Auth) shareForLocked(s session, id string) (shareEntry, bool) {
	if !shareIDPattern.MatchString(id) || !a.shareStoreUsable() || s.identity.Provider != "github" {
		return shareEntry{}, false
	}
	v, ok := a.shares[id]
	if !ok || v.Participant != "github:"+s.identity.Subject || v.Owner.Subject == s.identity.Subject || a.deniedLocked(v.Owner.Subject) || a.deniedLocked(s.identity.Subject) {
		return shareEntry{}, false
	}
	return v, true
}

// shareRequest ties one guest request to the browser session and to the
// share, under mu: the share is checked under the same lock that removing a
// participant or withdrawing a person takes to cancel its relays, so no
// request starts after its share is gone.
func (a *Auth) shareRequest(r *http.Request, authenticated session, id string) (shareEntry, context.Context, func(), bool) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return shareEntry{}, nil, nil, false
	}
	key := a.cookieKey(c.Value)
	a.mu.Lock()
	defer a.mu.Unlock()
	s, ok := a.sessions[key]
	if !ok || s.csrf != authenticated.csrf || s.identity != authenticated.identity || !a.now().Before(s.idle) || !a.now().Before(s.absolute) || !a.sessionStoreHealthy() {
		return shareEntry{}, nil, nil, false
	}
	entry, ok := a.shareForLocked(s, id)
	if !ok {
		return shareEntry{}, nil, nil, false
	}
	ctx, release := a.registerRelay(r.Context(), key, id, func() bool {
		current, exists := a.sessions[key]
		if !exists || !a.now().Before(current.idle) || !a.now().Before(current.absolute) || !a.sessionStoreHealthy() || a.deniedLocked(current.identity.Subject) {
			return false
		}
		now, ok := a.shareForLocked(current, id)
		return ok && now.Owner == entry.Owner && now.Conversation == entry.Conversation
	})
	return entry, ctx, release, true
}

type sharedOwner struct {
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
}

type sharedItem struct {
	ShareID   string      `json:"share_id"`
	Owner     sharedOwner `json:"owner"`
	State     string      `json:"state"`
	InvitedAt string      `json:"invited_at"`
}

// guestOperations are the participant operations the gateway forwards, by
// method, to the fixed guest path of the same name. The owner's daemon has
// its own default-deny table; this one keeps the gateway from forwarding
// what was never meant to reach a guest socket. The later issues of the
// multiplayer lane add their operations here.
var guestOperations = map[string]string{
	"join": http.MethodPost,
}

// shared serves GET /api/v1/shared (what is shared with the session's
// person) and /api/v1/shared/<share_id>/<operation>.
func (a *Auth) shared(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	if path != r.URL.Path || r.URL.RawQuery != "" {
		safe(w, 400, "invalid_request")
		return
	}
	if path == sharedPath {
		if r.Method != http.MethodGet || !a.exact(r, path) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			safe(w, 400, "invalid_request")
			return
		}
		s, ok := a.authenticated(r)
		if !ok {
			safe(w, 401, "authentication_required")
			return
		}
		a.listShared(w, s)
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	rest := strings.TrimPrefix(path, sharedPrefix)
	id, op, _ := strings.Cut(rest, "/")
	method, known := guestOperations[op]
	if !known || method != r.Method || !shareIDPattern.MatchString(id) || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		safe(w, 404, "resource_not_found")
		return
	}
	entry, ctx, release, ok := a.shareRequest(r, s, id)
	if !ok {
		safe(w, 404, "resource_not_found")
		return
	}
	defer release()
	a.guestExchange(w, ctx, s, entry, op, method)
}

func (a *Auth) listShared(w http.ResponseWriter, s session) {
	a.mu.Lock()
	if !a.shareStoreUsable() {
		a.mu.Unlock()
		safe(w, 503, "shares_unavailable")
		return
	}
	items, owners := []sharedItem{}, []string{}
	for _, v := range a.shares {
		if _, ok := a.shareForLocked(s, v.ID); !ok {
			continue
		}
		items = append(items, sharedItem{ShareID: v.ID, Owner: sharedOwner{DisplayName: v.OwnerName, AvatarURL: githubAvatar(v.Owner.Subject)}, State: v.State, InvitedAt: v.Created.UTC().Format(time.RFC3339)})
		owners = append(owners, v.Owner.Subject)
	}
	a.mu.Unlock()
	// The owner's current name, when they have a live session.
	names := a.profileNames()
	for i := range items {
		if name := memberName(names[owners[i]]); name != "" {
			items[i].Owner.DisplayName = name
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].InvitedAt != items[j].InvitedAt {
			return items[i].InvitedAt > items[j].InvitedAt
		}
		return items[i].ShareID < items[j].ShareID
	})
	writeJSON(w, map[string]any{"schema_version": 1, "shares": items})
}

func githubAvatar(id string) string {
	return normalizeProfile(AccountProfile{AvatarURL: "https://avatars.githubusercontent.com/u/" + id}).AvatarURL
}

// participantHeader states who speaks, from the authenticated session alone:
// the provider subject, and the name and avatar the gateway shows for them.
func participantHeader(s session) string {
	name := memberName(s.profile.Name)
	if name == "" {
		name = "GitHub " + s.identity.Subject
	}
	avatar := normalizeProfile(s.profile).AvatarURL
	if avatar == "" {
		avatar = githubAvatar(s.identity.Subject)
	}
	b, _ := json.Marshal(map[string]string{"subject": "github:" + s.identity.Subject, "display_name": name, "avatar_url": avatar})
	return base64.RawURLEncoding.EncodeToString(b)
}

func guestSocket(owner Identity) Identity {
	owner.Socket = filepath.Join(filepath.Dir(owner.Socket), "guest.sock")
	return owner
}

// guestExchange makes one request the gateway built itself to the owner's
// guest socket. Nothing of the browser's request crosses but the operation.
func (a *Auth) guestExchange(w http.ResponseWriter, parent context.Context, s session, entry shareEntry, op, method string) {
	target := guestSocket(entry.Owner)
	if a.snapshotDial == nil && udssecure.Guest(target.Socket, target.UID) != nil {
		// The owner's daemon is not there (withdrawn, stopping, or never
		// restored): the participant sees the conversation unavailable.
		safe(w, 503, "daemon_unavailable")
		return
	}
	ctx, cancel := context.WithTimeout(parent, 15*time.Second)
	defer cancel()
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	defer transport.CloseIdleConnections()
	req, err := http.NewRequestWithContext(ctx, method, "http://unix/guest/v1/conversations/"+entry.Conversation+"/"+op, http.NoBody)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	req.Header.Set(guestParticipantHeader, participantHeader(s))
	res, err := transport.RoundTrip(req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 64<<10+1))
	if err != nil || len(body) > 64<<10 {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if res.StatusCode != 200 {
		relayDaemonError(w, res.StatusCode, body)
		return
	}
	switch op {
	case "join":
		a.joined(w, entry, body)
	default:
		safe(w, 503, "daemon_unavailable")
	}
}

// joined answers a join the owner's daemon accepted and records the state in
// the index, for the participant's list. The record already holds; an index
// that cannot be written only leaves the list behind.
func (a *Auth) joined(w http.ResponseWriter, entry shareEntry, body []byte) {
	var reply struct {
		Subject string `json:"subject"`
		Role    string `json:"role"`
		State   string `json:"state"`
	}
	if json.Unmarshal(body, &reply) != nil || reply.Subject != entry.Participant || reply.State != "joined" || (reply.Role != "participant" && reply.Role != "full_rights") {
		safe(w, 503, "daemon_unavailable")
		return
	}
	a.mu.Lock()
	err := a.changeShares(func(next map[string]shareEntry) bool {
		v, ok := next[entry.ID]
		if !ok || v.Participant != entry.Participant || v.Owner != entry.Owner || v.State == "joined" {
			return false
		}
		v.State = "joined"
		next[entry.ID] = v
		return true
	})
	a.mu.Unlock()
	if err != nil && a.log != nil {
		a.log.Warn("participation_index", "outcome", "failed", "reason", "join_not_recorded")
	}
	writeJSON(w, map[string]any{"schema_version": 1, "share_id": entry.ID, "role": reply.Role, "state": reply.State})
}
