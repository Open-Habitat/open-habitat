//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"golang.org/x/sys/unix"
)

// Lock order: c.mu may be held while memberMu is taken (an archive ends
// memberships inside its commit), so nothing takes c.mu under memberMu.

// Other people in a person's conversation (ADR 0038, section 7). The owner's
// daemon keeps one membership record, a 0600 file in the owner's state
// directory. It is the only authority a guest request is checked against: the
// gateway says which person is speaking, never what that person may do. It is
// a file and not native history because access must not depend on the
// checked-out branch and must be writable while Pi is not running.

// MultiplayerFeature is the experimental switch behind which every
// membership route stays until the browser work lands.
const MultiplayerFeature = "multiplayer"

const (
	membershipFile = "conversation-members.json"
	// A conversation is a conversation, not a room: a handful of people.
	maxMembersPerConversation = 16
	maxSharedConversations    = 256
	// Lines wait in the record only while Pi is not running; a long backlog
	// means Pi has not run for a long time, and the oldest lines go first.
	maxPendingLines = 64
)

const (
	roleParticipant = "participant"
	roleFullRights  = "full_rights"
	stateInvited    = "invited"
	stateJoined     = "joined"
)

// A participant is named by the provider subject the gateway authenticated,
// never by a Unix name, UID or home path.
var memberSubjectPattern = regexp.MustCompile(`^github:[0-9]{1,20}$`)

type membershipRecord struct {
	SchemaVersion int `json:"schema_version"`
	// Generation increases with every change. A member's generation is the
	// record's generation at their latest change, so a grant handed to the
	// companion can be told apart from a later one.
	Generation    uint64                         `json:"generation"`
	Conversations map[string]*membershipSettings `json:"conversations"`
}

type membershipSettings struct {
	// Cwd is the conversation's native working directory when the first
	// invitation was made. A conversation whose history moves or whose
	// workspace is deleted admits nobody.
	Cwd     string         `json:"cwd"`
	Members []memberRecord `json:"members"`
	// Lines are Habitat lines not yet written into the conversation because
	// Pi was not running or was in a turn; the next idle Pi writes them.
	Lines []memberLine `json:"lines,omitempty"`
}

type memberRecord struct {
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
	Role        string `json:"role"`
	State       string `json:"state"`
	Generation  uint64 `json:"generation"`
	InvitedAt   string `json:"invited_at"`
	JoinedAt    string `json:"joined_at,omitempty"`
	UpdatedAt   string `json:"updated_at"`
}

// memberLine is one change told in the conversation as an
// oh-conversation-line (process-extension.mjs memberLineMessage).
type memberLine struct {
	ID          string `json:"line_id"`
	Event       string `json:"event"` // joined, full_rights_given, full_rights_taken, removed
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
	At          string `json:"at"`
}

// guestParticipant is who the gateway says is speaking on the guest socket.
// It is identity only; the record decides what it may do.
type guestParticipant struct {
	Subject     string
	DisplayName string
	AvatarURL   string
}

var errMembershipUnreadable = errors.New("membership record unreadable")

func emptyMembership() membershipRecord {
	return membershipRecord{SchemaVersion: 1, Conversations: map[string]*membershipSettings{}}
}

// validMemberName accepts the display name the gateway shows for a person:
// one line of printable text. It is never a role or an instruction.
func validMemberName(s string) bool {
	if !utf8.ValidString(s) || strings.TrimSpace(s) != s || s == "" || utf8.RuneCountInString(s) > 100 {
		return false
	}
	for _, r := range s {
		if unicode.IsControl(r) || r == ' ' || r == ' ' || unicode.Is(unicode.Cf, r) {
			return false
		}
	}
	return true
}

// loadMembership reads the record. A missing file is an empty record; any
// other problem is refusal, never a silent reset, so a damaged record admits
// nobody rather than everybody. Call under memberMu.
func loadMembership(home string) (membershipRecord, error) {
	record := emptyMembership()
	d, err := stateDir(home, false)
	if errors.Is(err, unix.ENOENT) {
		return record, nil
	}
	if err != nil {
		return record, errMembershipUnreadable
	}
	defer unix.Close(d)
	b, st, status := readSmallStat(unix.Openat2, d, membershipFile, 1<<20)
	if status == "missing" {
		return record, nil
	}
	if status != "valid" || st.Uid != uint32(os.Geteuid()) || st.Mode&0077 != 0 {
		return record, errMembershipUnreadable
	}
	// Decode into a zero record: an existing file must state its version
	// and map, so `{}` or `null` is damage, not an empty record.
	var decoded membershipRecord
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var extra any
	if dec.Decode(&decoded) != nil || dec.Decode(&extra) != io.EOF || !decoded.valid() {
		return record, errMembershipUnreadable
	}
	return decoded, nil
}

func (m membershipRecord) valid() bool {
	if m.SchemaVersion != 1 || m.Conversations == nil || len(m.Conversations) > maxSharedConversations {
		return false
	}
	for key, conv := range m.Conversations {
		if conv == nil || !strings.HasPrefix(key, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(key, "pi:")) || !strings.HasPrefix(conv.Cwd, "/") || len(conv.Members) > maxMembersPerConversation || len(conv.Lines) > maxPendingLines || conv.Members == nil {
			return false
		}
		seen := map[string]bool{}
		for _, x := range conv.Members {
			if seen[x.Subject] || !memberSubjectPattern.MatchString(x.Subject) || !validMemberName(x.DisplayName) || (x.Role != roleParticipant && x.Role != roleFullRights) || (x.State != stateInvited && x.State != stateJoined) || x.Generation == 0 || x.Generation > m.Generation || !validStamp(x.InvitedAt) || !validStamp(x.UpdatedAt) || (x.State == stateJoined) != (x.JoinedAt != "") || (x.JoinedAt != "" && !validStamp(x.JoinedAt)) || (x.State == stateInvited && x.Role != roleParticipant) {
				return false
			}
			seen[x.Subject] = true
		}
		for _, l := range conv.Lines {
			if !sessionIDPattern.MatchString(l.ID) || !memberLineEvent(l.Event) || !memberSubjectPattern.MatchString(l.Subject) || !validMemberName(l.DisplayName) || !validStamp(l.At) {
				return false
			}
		}
	}
	return true
}

func memberLineEvent(e string) bool {
	switch e {
	case "joined", "full_rights_given", "full_rights_taken", "removed":
		return true
	}
	return false
}

func saveMembership(home string, m membershipRecord) error {
	for key, conv := range m.Conversations {
		if len(conv.Members) == 0 && len(conv.Lines) == 0 {
			delete(m.Conversations, key)
		}
	}
	if !m.valid() {
		return errors.New("invalid membership record")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return writeMembership(home, membershipFile, b)
}

// writeMembership is the record's writer; a unit test fails it alone.
var writeMembership = writeStateFile

func (s *membershipSettings) member(subject string) int {
	for i := range s.Members {
		if s.Members[i].Subject == subject {
			return i
		}
	}
	return -1
}

func (s *membershipSettings) addLine(event string, x memberRecord, at string) {
	id, ok := uuid()
	if !ok {
		return // a line is information; the change itself still holds
	}
	s.Lines = append(s.Lines, memberLine{ID: id, Event: event, Subject: x.Subject, DisplayName: x.DisplayName, At: at})
	if len(s.Lines) > maxPendingLines {
		s.Lines = append([]memberLine(nil), s.Lines[len(s.Lines)-maxPendingLines:]...)
	}
}

func multiplayerEnabled(home string) bool {
	p, err := readPreferences(home)
	return err == nil && p.Experimental[MultiplayerFeature]
}

func (c *ConversationController) ownerSubject() string {
	return c.cfg.Provider + ":" + c.cfg.Subject
}

// shareableConversation observes the conversation's native history and its
// archive annotation. Only a readable, unarchived history whose working
// directory still exists can be shared.
func (c *ConversationController) shareableConversation(id string) (cwd string, archived bool, err error) {
	source, err := c.noticeSource(id)
	if err != nil {
		return "", false, err
	}
	if source == nil {
		return "", false, errConversationMissing
	}
	if info, statErr := os.Stat(source.cwd); statErr != nil || !info.IsDir() {
		return "", false, errConversationMissing
	}
	state, err := loadVisibility(c.home)
	if err != nil {
		return "", false, err
	}
	fact := archiveFact(state, nil, "pi:"+id)
	if fact == "unknown" {
		return "", false, errMembershipUnreadable
	}
	return source.cwd, fact == "archived", nil
}

var errConversationMissing = errors.New("conversation missing")

type memberControl struct {
	Action      string `json:"action"`
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name,omitempty"`
}

func memberView(x memberRecord) map[string]any {
	return map[string]any{"subject": x.Subject, "display_name": x.DisplayName, "role": x.Role, "state": x.State, "generation": x.Generation, "invited_at": x.InvitedAt, "updated_at": x.UpdatedAt}
}

func membersReply(id string, generation uint64, conv *membershipSettings) map[string]any {
	members := []map[string]any{}
	if conv != nil {
		for _, x := range conv.Members {
			members = append(members, memberView(x))
		}
	}
	return map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "generation": generation, "members": members}
}

// members serves GET and POST /api/v1/conversations/<id>/members on the
// owner's daemon.sock. The gateway reaches POST only through its own route,
// which checks that an invitee is an admitted, bound person and supplies the
// display name; the daemon still decides alone what the record says.
func (c *ConversationController) members(w http.ResponseWriter, r *http.Request, id string) {
	if !multiplayerEnabled(c.cfg.Home) {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if r.Method == http.MethodGet {
		if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		c.memberMu.Lock()
		defer c.memberMu.Unlock()
		if _, _, err := c.shareableConversation(id); err != nil {
			memberSourceError(w, err)
			return
		}
		record, err := loadMembership(c.home)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		historyJSON(w, membersReply(id, record.Generation, record.Conversations["pi:"+id]))
		return
	}
	var in memberControl
	if decodeControl(r, &in, 1024) != nil || !memberSubjectPattern.MatchString(in.Subject) || (in.Action == "invite") != (in.DisplayName != "") || (in.DisplayName != "" && !validMemberName(in.DisplayName)) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	switch in.Action {
	case "invite", "full_rights", "take_back", "remove":
	default:
		snapshotError(w, 400, "invalid_request")
		return
	}
	if in.Subject == c.ownerSubject() {
		snapshotError(w, 409, "member_is_owner")
		return
	}
	reply, tell, status, code := c.changeMember(id, in)
	if status != 0 {
		snapshotError(w, status, code)
		return
	}
	if tell != nil {
		// The running grant is revoked before the owner hears that it was:
		// a run that participant started loses its tools from the next call
		// (the companion's turn mode, ADR 0038 section 4).
		reply["revocation"] = c.tellGrant(r.Context(), id, *tell)
	}
	c.deliverMemberLinesFor(id)
	historyJSON(w, reply)
}

func memberSourceError(w http.ResponseWriter, err error) {
	if errors.Is(err, errConversationMissing) {
		snapshotError(w, 404, "conversation_not_found")
		return
	}
	snapshotError(w, 503, "native_source_unavailable")
}

// grantChange is what the companion is told about one person's grant.
type grantChange struct {
	Subject    string
	Role       string // participant, full_rights; empty when removed
	Generation uint64
	Removed    bool
}

func (c *ConversationController) changeMember(id string, in memberControl) (map[string]any, *grantChange, int, string) {
	c.memberMu.Lock()
	defer c.memberMu.Unlock()
	cwd, archived, err := c.shareableConversation(id)
	removal := in.Action == "take_back" || in.Action == "remove"
	// Taking rights away is always possible while the record is readable;
	// giving them needs a live, unarchived conversation.
	if err != nil && !(removal && errors.Is(err, errConversationMissing)) {
		if errors.Is(err, errConversationMissing) {
			return nil, nil, 404, "conversation_not_found"
		}
		return nil, nil, 503, "native_source_unavailable"
	}
	if archived && !removal {
		return nil, nil, 409, "conversation_archived"
	}
	record, err := loadMembership(c.home)
	if err != nil {
		return nil, nil, 503, "native_source_unavailable"
	}
	key := "pi:" + id
	conv := record.Conversations[key]
	if conv != nil && cwd != "" && conv.Cwd != cwd && !removal {
		// The history moved since the first invitation; its sharing does
		// not move with it.
		return nil, nil, 409, "conversation_moved"
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)
	at := -1
	if conv != nil {
		at = conv.member(in.Subject)
	}
	if in.Action != "invite" && at < 0 {
		return nil, nil, 404, "member_not_found"
	}
	var tell *grantChange
	changed := false
	switch in.Action {
	case "invite":
		if conv == nil {
			if len(record.Conversations) >= maxSharedConversations {
				return nil, nil, 409, "membership_full"
			}
			conv = &membershipSettings{Cwd: cwd, Members: []memberRecord{}}
			record.Conversations[key] = conv
		}
		if at >= 0 {
			// Inviting again refreshes the name the gateway shows; it
			// changes no grant.
			if conv.Members[at].DisplayName != in.DisplayName {
				conv.Members[at].DisplayName = in.DisplayName
				conv.Members[at].UpdatedAt = now
				changed = true
			}
			break
		}
		if len(conv.Members) >= maxMembersPerConversation {
			return nil, nil, 409, "membership_full"
		}
		record.Generation++
		conv.Members = append(conv.Members, memberRecord{Subject: in.Subject, DisplayName: in.DisplayName, Role: roleParticipant, State: stateInvited, Generation: record.Generation, InvitedAt: now, UpdatedAt: now})
		changed = true
	case "full_rights":
		x := &conv.Members[at]
		if x.State != stateJoined {
			// Rights belong to someone who is in the conversation.
			return nil, nil, 409, "member_not_joined"
		}
		if x.Role == roleFullRights {
			break
		}
		record.Generation++
		x.Role, x.Generation, x.UpdatedAt = roleFullRights, record.Generation, now
		conv.addLine("full_rights_given", *x, now)
		changed = true
	case "take_back":
		x := &conv.Members[at]
		if x.Role != roleFullRights {
			break
		}
		record.Generation++
		x.Role, x.Generation, x.UpdatedAt = roleParticipant, record.Generation, now
		conv.addLine("full_rights_taken", *x, now)
		tell = &grantChange{Subject: x.Subject, Role: roleParticipant, Generation: record.Generation}
		changed = true
	case "remove":
		x := conv.Members[at]
		record.Generation++
		conv.Members = append(conv.Members[:at], conv.Members[at+1:]...)
		if x.State == stateJoined {
			conv.addLine("removed", x, now)
		}
		tell = &grantChange{Subject: x.Subject, Generation: record.Generation, Removed: true}
		changed = true
	}
	if changed {
		if err := saveMembership(c.home, record); err != nil {
			return nil, nil, 503, "native_source_unavailable"
		}
	}
	if in.Action == "remove" {
		// The record refuses the next guest request; streams already open
		// end here, under the same lock that admits new ones.
		c.endGuestStreamsLocked(key, in.Subject)
	}
	return membersReply(id, record.Generation, record.Conversations[key]), tell, 0, ""
}

// joinMember marks an invitation joined. It is the one operation an invited
// person may perform; every refusal looks the same as an unknown
// conversation, so a guest learns nothing about what else exists.
func (c *ConversationController) joinMember(id string, p guestParticipant) (map[string]any, bool) {
	if !multiplayerEnabled(c.cfg.Home) || !memberSubjectPattern.MatchString(p.Subject) || !validMemberName(p.DisplayName) || p.Subject == c.ownerSubject() {
		return nil, false
	}
	reply, joined, ok := c.joinMemberLocked(id, p)
	if joined {
		c.deliverMemberLinesFor(id)
	}
	return reply, ok
}

func (c *ConversationController) joinMemberLocked(id string, p guestParticipant) (map[string]any, bool, bool) {
	c.memberMu.Lock()
	defer c.memberMu.Unlock()
	cwd, archived, err := c.shareableConversation(id)
	if err != nil || archived {
		return nil, false, false
	}
	record, err := loadMembership(c.home)
	if err != nil {
		return nil, false, false
	}
	conv := record.Conversations["pi:"+id]
	if conv == nil || conv.Cwd != cwd {
		return nil, false, false
	}
	at := conv.member(p.Subject)
	if at < 0 {
		return nil, false, false
	}
	x := &conv.Members[at]
	joined := false
	if x.State == stateInvited {
		now := time.Now().UTC().Format(time.RFC3339Nano)
		record.Generation++
		x.State, x.Generation, x.JoinedAt, x.UpdatedAt, x.DisplayName = stateJoined, record.Generation, now, now, p.DisplayName
		conv.addLine("joined", *x, now)
		if saveMembership(c.home, record) != nil {
			return nil, false, false
		}
		joined = true
	}
	return map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "subject": x.Subject, "role": x.Role, "state": x.State, "generation": x.Generation}, joined, true
}

// authorizeGuest is the check every guest request makes against the record:
// the person must be a member of this conversation, joined unless the
// request is the join itself, and the conversation readable, in place and
// not archived. The caller holds memberMu.
func (c *ConversationController) authorizeGuestLocked(id string, p guestParticipant, invitedToo bool) (memberRecord, bool) {
	if !multiplayerEnabled(c.cfg.Home) || !memberSubjectPattern.MatchString(p.Subject) || p.Subject == c.ownerSubject() {
		return memberRecord{}, false
	}
	cwd, archived, err := c.shareableConversation(id)
	if err != nil || archived {
		return memberRecord{}, false
	}
	record, err := loadMembership(c.home)
	if err != nil {
		return memberRecord{}, false
	}
	conv := record.Conversations["pi:"+id]
	if conv == nil || conv.Cwd != cwd {
		return memberRecord{}, false
	}
	at := conv.member(p.Subject)
	if at < 0 || (conv.Members[at].State != stateJoined && !invitedToo) {
		return memberRecord{}, false
	}
	return conv.Members[at], true
}

func (c *ConversationController) authorizeGuest(id string, p guestParticipant, invitedToo bool) (memberRecord, bool) {
	c.memberMu.Lock()
	defer c.memberMu.Unlock()
	return c.authorizeGuestLocked(id, p, invitedToo)
}

type guestStream struct{ cancel context.CancelFunc }

// admitGuestStream registers a participant's live stream under the lock that
// removal and archiving take, so a stream is either refused or ended by the
// change: none slips in between the record write and the cancellation.
func (c *ConversationController) admitGuestStream(parent context.Context, id string, p guestParticipant) (context.Context, func(), bool) {
	c.memberMu.Lock()
	defer c.memberMu.Unlock()
	if _, ok := c.authorizeGuestLocked(id, p, false); !ok {
		return nil, nil, false
	}
	ctx, cancel := context.WithCancel(parent)
	key := "pi:" + id + "\x00" + p.Subject
	if c.memberStreams == nil {
		c.memberStreams = map[string]map[*guestStream]struct{}{}
	}
	stream := &guestStream{cancel: cancel}
	if c.memberStreams[key] == nil {
		c.memberStreams[key] = map[*guestStream]struct{}{}
	}
	c.memberStreams[key][stream] = struct{}{}
	release := func() {
		cancel()
		c.memberMu.Lock()
		defer c.memberMu.Unlock()
		delete(c.memberStreams[key], stream)
		if len(c.memberStreams[key]) == 0 {
			delete(c.memberStreams, key)
		}
	}
	return ctx, release, true
}

// endGuestStreamsLocked ends a person's streams of one conversation, or
// every person's when subject is empty. Caller holds memberMu.
func (c *ConversationController) endGuestStreamsLocked(conversation, subject string) {
	for key, streams := range c.memberStreams {
		conv, who, _ := strings.Cut(key, "\x00")
		if conv != conversation || (subject != "" && who != subject) {
			continue
		}
		for s := range streams {
			s.cancel()
		}
		delete(c.memberStreams, key)
	}
}

// endMemberships ends every membership of a conversation that is archived
// or whose workspace is deleted. Its pending lines go with it: nobody is
// left to read them. A record that cannot be read admits nobody, so there is
// nothing to end; since the affected streams cannot then be told apart,
// every guest stream ends. A record that was read but cannot be written is
// an error: the caller must not let the change it ends memberships for
// commit without it, or a restore would bring them back.
func (c *ConversationController) endMemberships(match func(key string, conv *membershipSettings) bool) error {
	c.memberMu.Lock()
	defer c.memberMu.Unlock()
	record, err := loadMembership(c.home)
	if err != nil {
		for key, streams := range c.memberStreams {
			for s := range streams {
				s.cancel()
			}
			delete(c.memberStreams, key)
		}
		return nil
	}
	ended := []string{}
	for key, conv := range record.Conversations {
		if match(key, conv) {
			ended = append(ended, key)
			delete(record.Conversations, key)
		}
	}
	for _, key := range ended {
		c.endGuestStreamsLocked(key, "")
	}
	if len(ended) > 0 {
		return saveMembership(c.home, record)
	}
	return nil
}

func (c *ConversationController) endConversationMemberships(key string) error {
	err := c.endMemberships(func(k string, _ *membershipSettings) bool { return k == key })
	// Streams of a conversation the record no longer names end too.
	c.memberMu.Lock()
	c.endGuestStreamsLocked(key, "")
	c.memberMu.Unlock()
	return err
}

// tellGrant tells a running Pi's companion that a person's grant changed.
// It reports delivered, not_running (nothing to revoke: the next Pi reads
// roles from the record), or failed.
func (c *ConversationController) tellGrant(parent context.Context, id string, g grantChange) string {
	s := c.liveSession(id)
	if s == nil {
		return "not_running"
	}
	ctx, cancel := context.WithTimeout(parent, 3*time.Second)
	defer cancel()
	grant := map[string]any{"subject": g.Subject, "generation": g.Generation, "removed": g.Removed}
	if !g.Removed {
		grant["role"] = g.Role
	}
	var outcome struct {
		Told   bool   `json:"told"`
		Reason string `json:"reason"`
	}
	err := s.rpc.processRequest(ctx, map[string]any{"op": "grant", "session_id": id, "generation": s.rpc.processGeneration, "grant": grant}, &outcome)
	if err != nil || !outcome.Told {
		if c.liveSession(id) == nil {
			return "not_running"
		}
		return "failed"
	}
	return "delivered"
}

func (c *ConversationController) liveSession(id string) *conversation {
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.sessions[id]
	if s == nil || s.dead || s.rpc == nil || s.rpc.processSocket == "" || s.rpc.closing.Load() || channelClosed(s.rpc.exited) || c.closed {
		return nil
	}
	return s
}

func (c *ConversationController) deliverMemberLinesFor(id string) {
	if s := c.liveSession(id); s != nil {
		go c.deliverMemberLines(s)
	}
}

// deliverMemberLines writes the conversation's pending Habitat lines through
// the companion while Pi is idle. A busy Pi keeps them for the settle that
// ends its run; a stopped one for its next launch.
func (c *ConversationController) deliverMemberLines(s *conversation) {
	c.memberLineMu.Lock()
	defer c.memberLineMu.Unlock()
	key := "pi:" + s.id
	c.memberMu.Lock()
	record, err := loadMembership(c.home)
	c.memberMu.Unlock()
	if err != nil || record.Conversations[key] == nil || len(record.Conversations[key].Lines) == 0 {
		return
	}
	for _, line := range record.Conversations[key].Lines {
		c.mu.Lock()
		valid := c.sessions[s.id] == s && !s.dead && !c.closed && s.state == "idle" && !s.runActive
		c.mu.Unlock()
		if !valid || c.liveSession(s.id) != s {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		var outcome struct {
			Written bool   `json:"written"`
			Reason  string `json:"reason"`
		}
		err := s.rpc.processRequest(ctx, map[string]any{"op": "conversation_line", "session_id": s.id, "generation": s.rpc.processGeneration, "line": map[string]any{"line_id": line.ID, "kind": "membership", "event": line.Event, "subject": line.Subject, "display_name": line.DisplayName, "at": line.At}}, &outcome)
		cancel()
		if err != nil || !outcome.Written {
			return
		}
		c.memberMu.Lock()
		current, err := loadMembership(c.home)
		if err == nil && current.Conversations[key] != nil {
			kept := current.Conversations[key].Lines[:0]
			for _, l := range current.Conversations[key].Lines {
				if l.ID != line.ID {
					kept = append(kept, l)
				}
			}
			current.Conversations[key].Lines = kept
			err = saveMembership(c.home, current)
		}
		c.memberMu.Unlock()
		if err != nil {
			return
		}
		if c.journal != nil {
			c.journal.appendInvalidation(key)
		}
	}
}

// GuestJoinHandler serves POST /guest/v1/conversations/<id>/join for the
// guest listener, mounted by the guest socket's own default-deny route table
// (guest_linux.go). identify returns the participant the gateway named for this
// request, after the listener has checked the gateway's peer UID.
func (c *ConversationController) GuestJoinHandler(identify func(*http.Request) (guestParticipant, bool)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		const prefix = "/guest/v1/conversations/"
		rest, ok := strings.CutPrefix(r.URL.Path, prefix)
		id, tail, _ := strings.Cut(rest, "/")
		if !ok || tail != "join" || r.Method != http.MethodPost || !sessionIDPattern.MatchString(id) || r.URL.RawQuery != "" || r.RequestURI != r.URL.Path || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		p, ok := identify(r)
		if !ok {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		reply, ok := c.joinMember(id, p)
		if !ok {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		historyJSON(w, reply)
	})
}
