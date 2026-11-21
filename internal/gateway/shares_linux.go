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
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/jsoncheck"
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
// change it answered: the participant's entry takes the record's state while
// the record names them, and is deleted once it does not. Only an invitation
// creates an entry: a withdrawn person's shares are deleted for good while
// the owner's record may still name them, and changing their rights is no
// new invitation. The daemon's record is the authority; the index
// only routes.
func (a *Auth) reconcileShare(owner session, conversation, participant string, invite bool, reply []byte) error {
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
		if state == "" || !invite || owned >= sharesPerOwner || len(next) >= sharesMax {
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
// method, to the fixed guest path of the same name (ADR 0038 section 6). The
// owner's daemon has its own default-deny table; this one keeps the gateway
// from forwarding what was never meant to reach a guest socket. Each
// operation's query and body are read by guestCall, which rebuilds them:
// nothing of the browser's request crosses unchecked.
var guestOperations = map[string]string{
	"join":     http.MethodPost,
	"invite":   http.MethodGet,
	"state":    http.MethodGet,
	"history":  http.MethodGet,
	"blocks":   http.MethodGet,
	"events":   http.MethodGet,
	"send":     http.MethodPost,
	"cancel":   http.MethodPost,
	"abort":    http.MethodPost,
	"presence": http.MethodPost,
}

// guestCall is one participant request as the gateway rebuilt it.
type guestCall struct {
	op, tail, query string
	body            []byte
	lastEventID     string
}

var (
	guestEntryKey  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)
	guestBlockPath = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}/[0-9]{1,3}$`)
	guestNumber    = regexp.MustCompile(`^(0|[1-9][0-9]{0,8})$`)
	guestRevision  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,200}$`)
	guestMessageID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
)

// guestText bounds a participant's message as the owner's daemon does.
const guestTextBytes = 16000

// readGuestCall checks one operation's grammar and rebuilds its query and
// body. A request that does not fit is refused like an unknown operation.
func readGuestCall(r *http.Request, op, tail string) (guestCall, bool) {
	call := guestCall{op: op, tail: tail}
	if (tail != "") != (op == "blocks") || (op == "blocks" && !guestBlockPath.MatchString(tail)) {
		return call, false
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		return call, false
	}
	for _, values := range q {
		if len(values) != 1 {
			return call, false
		}
	}
	rebuilt := url.Values{}
	allow := func(key string, valid func(string) bool) bool {
		if !q.Has(key) {
			return true
		}
		if !valid(q.Get(key)) {
			return false
		}
		rebuilt.Set(key, q.Get(key))
		return true
	}
	known := map[string]bool{}
	switch op {
	case "history":
		for _, k := range []string{"after", "before", "limit", "messages"} {
			known[k] = true
		}
		if !allow("after", guestEntryKey.MatchString) || !allow("before", guestEntryKey.MatchString) || !allow("limit", guestNumber.MatchString) || !allow("messages", guestNumber.MatchString) {
			return call, false
		}
	case "blocks":
		for _, k := range []string{"revision", "offset", "limit_bytes", "part"} {
			known[k] = true
		}
		if !q.Has("revision") || !q.Has("offset") || !q.Has("limit_bytes") || !allow("revision", guestRevision.MatchString) || !allow("offset", guestNumber.MatchString) || !allow("limit_bytes", guestNumber.MatchString) || !allow("part", func(v string) bool { return v == "skill_arguments" }) {
			return call, false
		}
	case "events":
		known["after"] = true
		if !q.Has("after") || !allow("after", conversationStreamCursor.MatchString) {
			return call, false
		}
		last := r.Header.Values("Last-Event-ID")
		if len(last) > 1 || len(last) == 1 && last[0] != "" && !conversationStreamCursor.MatchString(last[0]) {
			return call, false
		}
		if len(last) == 1 {
			call.lastEventID = last[0]
		}
	}
	for k := range q {
		if !known[k] {
			return call, false
		}
	}
	call.query = rebuilt.Encode()
	var body any
	switch op {
	case "send":
		var in struct {
			Text string `json:"text"`
		}
		if !readGuestBody(r, 6*guestTextBytes+64, &in) || in.Text == "" || len(in.Text) > guestTextBytes {
			return call, false
		}
		body = in
	case "cancel":
		var in struct {
			MessageID string `json:"message_id"`
		}
		if !readGuestBody(r, 256, &in) || !guestMessageID.MatchString(in.MessageID) {
			return call, false
		}
		body = in
	case "presence":
		var in struct {
			State string `json:"state"`
		}
		if !readGuestBody(r, 128, &in) || (in.State != "present" && in.State != "typing" && in.State != "left") {
			return call, false
		}
		body = in
	default:
		if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			return call, false
		}
	}
	if body != nil {
		call.body, _ = json.Marshal(body)
	}
	return call, true
}

// readGuestBody decodes a small JSON body strictly: one object, known
// fields only, no duplicates.
func readGuestBody(r *http.Request, limit int64, target any) bool {
	if r.Header.Get("Content-Type") != "application/json" || len(r.TransferEncoding) != 0 || r.ContentLength <= 0 || r.ContentLength > limit {
		return false
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil || int64(len(raw)) > limit || !jsoncheck.NoDuplicates(raw) {
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	return dec.Decode(target) == nil && dec.Decode(new(any)) == io.EOF
}

// shared serves GET /api/v1/shared (what is shared with the session's
// person) and /api/v1/shared/<share_id>/<operation>.
func (a *Auth) shared(w http.ResponseWriter, r *http.Request) {
	path := r.URL.EscapedPath()
	if path != r.URL.Path {
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
	id, after, _ := strings.Cut(rest, "/")
	op, tail, _ := strings.Cut(after, "/")
	method, known := guestOperations[op]
	if !known || method != r.Method || !shareIDPattern.MatchString(id) || r.URL.Fragment != "" {
		safe(w, 404, "resource_not_found")
		return
	}
	call, ok := readGuestCall(r, op, tail)
	if !ok {
		safe(w, 404, "resource_not_found")
		return
	}
	entry, ctx, release, ok := a.shareRequest(r, s, id)
	if !ok {
		safe(w, 404, "resource_not_found")
		return
	}
	defer release()
	if op == "events" {
		a.guestStream(w, ctx, s, entry, call)
		return
	}
	a.guestExchange(w, ctx, s, entry, call, method)
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

// guestRequest builds the request the gateway sends to the owner's guest
// socket: the fixed guest path of this share's conversation, the rebuilt
// query and body, and the participant named from the session alone.
func guestRequest(ctx context.Context, s session, entry shareEntry, call guestCall, method string) (*http.Request, error) {
	target := "http://unix/guest/v1/conversations/" + entry.Conversation + "/" + call.op
	if call.tail != "" {
		target += "/" + call.tail
	}
	if call.query != "" {
		target += "?" + call.query
	}
	var body io.Reader = http.NoBody
	if call.body != nil {
		body = bytes.NewReader(call.body)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, body)
	if err != nil {
		return nil, err
	}
	if call.body != nil {
		req.ContentLength = int64(len(call.body))
		req.Header.Set("Content-Type", "application/json")
	}
	if call.lastEventID != "" {
		req.Header.Set("Last-Event-ID", call.lastEventID)
	}
	req.Header.Set(guestParticipantHeader, participantHeader(s))
	return req, nil
}

func (a *Auth) guestTransport(target Identity, stream bool) *http.Transport {
	return &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			conn, err := a.dialDaemon(ctx, target)
			if err != nil || !stream {
				return conn, err
			}
			return idleReadConn{conn}, nil
		},
	}
}

// guestExchange makes one finite request the gateway built itself to the
// owner's guest socket and relays the bounded reply.
func (a *Auth) guestExchange(w http.ResponseWriter, parent context.Context, s session, entry shareEntry, call guestCall, method string) {
	target := guestSocket(entry.Owner)
	if a.snapshotDial == nil && udssecure.Guest(target.Socket, target.UID) != nil {
		// The owner's daemon is not there (withdrawn, stopping, or never
		// restored): the participant sees the conversation unavailable.
		safe(w, 503, "daemon_unavailable")
		return
	}
	// A history read may wait for a long native file as the owner's does.
	wait, limit := 15*time.Second, int64(64<<10)
	switch call.op {
	case "history", "blocks", "state":
		wait, limit = 70*time.Second, 4<<20
	}
	ctx, cancel := context.WithTimeout(parent, wait)
	defer cancel()
	transport := a.guestTransport(target, false)
	defer transport.CloseIdleConnections()
	req, err := guestRequest(ctx, s, entry, call, method)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, limit+1))
	if err != nil || int64(len(body)) > limit {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if res.StatusCode != 200 {
		relayDaemonError(w, res.StatusCode, body)
		return
	}
	if call.op == "join" {
		a.joined(w, entry, body)
		return
	}
	if res.Header.Get("Content-Type") != "application/json" || !json.Valid(body) {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(200)
	_, _ = w.Write(body)
}

// guestStream relays the participant's filtered event stream from the
// owner's guest socket. The relay is tied to the browser session and to the
// share (shareRequest): removing the participant, withdrawing either person
// or ending the session cancels it, and the owner's daemon ends its side
// itself when the membership ends.
func (a *Auth) guestStream(w http.ResponseWriter, ctx context.Context, s session, entry shareEntry, call guestCall) {
	target := guestSocket(entry.Owner)
	if a.snapshotDial == nil && udssecure.Guest(target.Socket, target.UID) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	transport := a.guestTransport(target, true)
	defer transport.CloseIdleConnections()
	req, err := guestRequest(ctx, s, entry, call, http.MethodGet)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
		relayDaemonError(w, res.StatusCode, body)
		return
	}
	if res.Header.Get("Content-Type") != "text/event-stream" {
		safe(w, 503, "daemon_unavailable")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		safe(w, 503, "daemon_unavailable")
		return
	}
	controller := http.NewResponseController(w)
	// As the owner's stream relay: a deadline bounds each write to a stalled
	// browser and is cleared while the daemon is quiet.
	armed := func() bool {
		err := controller.SetWriteDeadline(time.Now().Add(streamWriteTimeout))
		return err == nil || errors.Is(err, http.ErrNotSupported)
	}
	idle := func() bool {
		err := controller.SetWriteDeadline(time.Time{})
		return err == nil || errors.Is(err, http.ErrNotSupported)
	}
	if !armed() {
		safe(w, 503, "daemon_unavailable")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(200)
	flusher.Flush()
	if !idle() {
		return
	}
	buf := make([]byte, 32<<10)
	for {
		n, readErr := res.Body.Read(buf)
		if ctx.Err() != nil {
			return
		}
		if n > 0 {
			if !armed() {
				return
			}
			if _, err := w.Write(buf[:n]); err != nil {
				return
			}
			flusher.Flush()
			if !idle() {
				return
			}
		}
		if readErr != nil {
			return
		}
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
