// Package wsframe is the small part of RFC 6455 that the browser shell needs:
// the opening handshake and frame encoding. The gateway uses it to accept the
// browser's upgrade, read the one message that proves CSRF, and open a
// matching upgrade to the daemon; after that it relays bytes without parsing
// them. The daemon uses it to serve the terminal. No extensions or
// subprotocols are ever negotiated, which is what lets the gateway relay
// frames unchanged between its two connections.
package wsframe

import (
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
	"net/http"
	"strings"
)

const guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// Opcodes.
const (
	OpContinuation = 0x0
	OpText         = 0x1
	OpBinary       = 0x2
	OpClose        = 0x8
	OpPing         = 0x9
	OpPong         = 0xA
)

// ErrProtocol is any violation of the framing rules or the size limit.
var ErrProtocol = errors.New("websocket protocol violation")

// AcceptKey is the Sec-WebSocket-Accept value for a client key.
func AcceptKey(key string) string {
	h := sha1.Sum([]byte(key + guid))
	return base64.StdEncoding.EncodeToString(h[:])
}

// NewKey returns a fresh client key.
func NewKey() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(b[:]), nil
}

func validKey(key string) bool {
	b, err := base64.StdEncoding.DecodeString(key)
	return err == nil && len(b) == 16
}

func hasToken(values []string, token string) bool {
	for _, v := range values {
		for _, part := range strings.Split(v, ",") {
			if strings.EqualFold(strings.TrimSpace(part), token) {
				return true
			}
		}
	}
	return false
}

// IsUpgrade reports whether r is a well-formed version 13 opening handshake.
func IsUpgrade(r *http.Request) bool {
	return r.Method == http.MethodGet && r.ProtoMajor == 1 && r.ProtoMinor == 1 &&
		hasToken(r.Header.Values("Upgrade"), "websocket") && hasToken(r.Header.Values("Connection"), "upgrade") &&
		len(r.Header.Values("Sec-WebSocket-Version")) == 1 && r.Header.Get("Sec-WebSocket-Version") == "13" &&
		len(r.Header.Values("Sec-WebSocket-Key")) == 1 && validKey(r.Header.Get("Sec-WebSocket-Key")) &&
		r.ContentLength <= 0 && len(r.TransferEncoding) == 0
}

// SwitchingProtocols is the server's 101 response for a client key.
func SwitchingProtocols(key string) []byte {
	return []byte("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + AcceptKey(key) + "\r\n\r\n")
}

// ValidResponse checks a server's reply to a handshake made with key.
func ValidResponse(res *http.Response, key string) bool {
	return res.StatusCode == http.StatusSwitchingProtocols && hasToken(res.Header.Values("Upgrade"), "websocket") &&
		hasToken(res.Header.Values("Connection"), "upgrade") && res.Header.Get("Sec-WebSocket-Accept") == AcceptKey(key) &&
		res.Header.Get("Sec-WebSocket-Extensions") == "" && res.Header.Get("Sec-WebSocket-Protocol") == ""
}

// Frame is one frame with its payload unmasked.
type Frame struct {
	Fin     bool
	Op      byte
	Payload []byte
}

// ReadFrame reads one frame. masked says whether the peer must mask (a client)
// or must not (a server). A payload longer than limit, a reserved bit, an
// unknown opcode or a fragmented or oversized control frame is ErrProtocol.
func ReadFrame(r io.Reader, limit int, masked bool) (Frame, error) {
	var head [2]byte
	if _, err := io.ReadFull(r, head[:]); err != nil {
		return Frame{}, err
	}
	f := Frame{Fin: head[0]&0x80 != 0, Op: head[0] & 0x0f}
	if head[0]&0x70 != 0 || (head[1]&0x80 != 0) != masked {
		return Frame{}, ErrProtocol
	}
	switch f.Op {
	case OpContinuation, OpText, OpBinary:
	case OpClose, OpPing, OpPong:
		if !f.Fin || head[1]&0x7f > 125 {
			return Frame{}, ErrProtocol
		}
	default:
		return Frame{}, ErrProtocol
	}
	n := uint64(head[1] & 0x7f)
	switch n {
	case 126:
		var b [2]byte
		if _, err := io.ReadFull(r, b[:]); err != nil {
			return Frame{}, err
		}
		n = uint64(binary.BigEndian.Uint16(b[:]))
	case 127:
		var b [8]byte
		if _, err := io.ReadFull(r, b[:]); err != nil {
			return Frame{}, err
		}
		n = binary.BigEndian.Uint64(b[:])
	}
	if n > uint64(limit) {
		return Frame{}, ErrProtocol
	}
	var mask [4]byte
	if masked {
		if _, err := io.ReadFull(r, mask[:]); err != nil {
			return Frame{}, err
		}
	}
	f.Payload = make([]byte, n)
	if _, err := io.ReadFull(r, f.Payload); err != nil {
		return Frame{}, err
	}
	if masked {
		for i := range f.Payload {
			f.Payload[i] ^= mask[i%4]
		}
	}
	return f, nil
}

// AppendFrame appends one final frame to dst. A client must mask.
func AppendFrame(dst []byte, op byte, payload []byte, mask bool) []byte {
	dst = append(dst, 0x80|op)
	bit := byte(0)
	if mask {
		bit = 0x80
	}
	switch n := len(payload); {
	case n < 126:
		dst = append(dst, bit|byte(n))
	case n <= 0xffff:
		dst = append(dst, bit|126, byte(n>>8), byte(n))
	default:
		dst = append(dst, bit|127)
		dst = binary.BigEndian.AppendUint64(dst, uint64(n))
	}
	if !mask {
		return append(dst, payload...)
	}
	var key [4]byte
	_, _ = rand.Read(key[:])
	dst = append(dst, key[:]...)
	start := len(dst)
	dst = append(dst, payload...)
	for i := range payload {
		dst[start+i] ^= key[i%4]
	}
	return dst
}

// ClosePayload is a close frame body: a status code and a short reason.
func ClosePayload(code uint16, reason string) []byte {
	if len(reason) > 120 {
		reason = reason[:120]
	}
	return append(binary.BigEndian.AppendUint16(nil, code), reason...)
}
