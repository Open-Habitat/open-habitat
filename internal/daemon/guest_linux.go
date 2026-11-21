//go:build linux

package daemon

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"unicode"

	"github.com/open-habitat/open-habitat/internal/jsoncheck"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// The guest socket's route table (ADR 0038 sections 2 and 6). Other people
// on the server reach this person's conversations here, through the gateway
// only. The table is default-deny and separate from the browser mux and the
// agent table: it holds participant operations under
// /guest/v1/conversations/<id>/ and nothing else, so a bug on the guest path
// reaches no workspace, file, terminal, editor, view, setting or other
// conversation route, because none is mounted here.
//
// The gateway names the speaking person in one header. On this socket, and
// only here, that header is the statement of who speaks; it is never
// permission. What the person may do is decided by the owner's membership
// record alone (membership_linux.go). On daemon.sock and agent.sock the header
// has no meaning and is refused.

// GuestParticipantHeader carries the participant the gateway authenticated:
// base64url (no padding) of {"subject","display_name","avatar_url"}. It
// never names a Unix user, UID or home path.
const GuestParticipantHeader = "Open-Habitat-Participant"

const guestParticipantHeaderLimit = 1024

const guestPrefix = "/guest/v1/conversations/"

// guestOperations is the whole guest table. Each entry is one participant
// operation of ADR 0038 section 6; a path that is not here is refused before
// anything is read. The later issues of the multiplayer lane add their
// routes here (send, abort, cancel_held, presence, history, events), each
// checking authorizeGuest or admitGuestStream itself.
func guestOperations(c *ConversationController, identify func(*http.Request) (guestParticipant, bool)) map[string]http.Handler {
	return map[string]http.Handler{
		"join": c.GuestJoinHandler(identify),
	}
}

func guestHandler(c *ConversationController) http.Handler {
	return guestHandlerFor(c, transport.GuestPeer)
}

// guestHandlerFor takes the listener's peer check as the other handlers take
// TrustedPeer; production passes transport.GuestPeer.
func guestHandlerFor(c *ConversationController, peer func(*http.Request) bool) http.Handler {
	identify := guestIdentity(peer)
	ops := map[string]http.Handler{}
	if c != nil {
		ops = guestOperations(c, identify)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !peer(r) {
			snapshotError(w, 403, "peer_not_authorized")
			return
		}
		// Every refusal past the peer check is the same answer as an unknown
		// conversation, so a guest learns nothing about what else exists.
		rest, ok := strings.CutPrefix(r.URL.Path, guestPrefix)
		id, op, _ := strings.Cut(rest, "/")
		handler := ops[op]
		if !ok || r.URL.RawPath != "" || r.RequestURI != r.URL.RequestURI() || !sessionIDPattern.MatchString(id) || handler == nil {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		if _, ok := identify(r); !ok {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		handler.ServeHTTP(w, r)
	})
}

// guestIdentity reads the participant the gateway named. It is valid only
// on a request the guest listener accepted from the gateway's UID.
func guestIdentity(peer func(*http.Request) bool) func(*http.Request) (guestParticipant, bool) {
	return func(r *http.Request) (guestParticipant, bool) {
		if !peer(r) {
			return guestParticipant{}, false
		}
		return parseGuestParticipant(r.Header.Values(GuestParticipantHeader))
	}
}

func parseGuestParticipant(values []string) (guestParticipant, bool) {
	if len(values) != 1 || len(values[0]) > guestParticipantHeaderLimit {
		return guestParticipant{}, false
	}
	raw, err := base64.RawURLEncoding.Strict().DecodeString(values[0])
	if err != nil || !jsoncheck.NoDuplicates(raw) {
		return guestParticipant{}, false
	}
	var in struct {
		Subject     string `json:"subject"`
		DisplayName string `json:"display_name"`
		AvatarURL   string `json:"avatar_url"`
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if dec.Decode(&in) != nil || dec.More() || !memberSubjectPattern.MatchString(in.Subject) || !validMemberName(in.DisplayName) || !validGuestAvatar(in.AvatarURL) {
		return guestParticipant{}, false
	}
	return guestParticipant{Subject: in.Subject, DisplayName: in.DisplayName, AvatarURL: in.AvatarURL}, true
}

func validGuestAvatar(s string) bool {
	if s == "" {
		return true
	}
	if len(s) > 1024 || !strings.HasPrefix(s, "https://avatars.githubusercontent.com/") {
		return false
	}
	for _, r := range s {
		if r > unicode.MaxASCII || unicode.IsControl(r) || r == ' ' {
			return false
		}
	}
	return true
}

// refuseParticipantHeader keeps the guest statement of identity off every
// other listener: there it carries no meaning, so a request bearing it is
// malformed, not an owner's.
func refuseParticipantHeader(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, present := r.Header[http.CanonicalHeaderKey(GuestParticipantHeader)]; present {
			snapshotError(w, 400, "invalid_request")
			return
		}
		next.ServeHTTP(w, r)
	})
}
