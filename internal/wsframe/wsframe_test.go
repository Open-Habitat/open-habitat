package wsframe

import (
	"bytes"
	"errors"
	"net/http/httptest"
	"testing"
)

// RFC 6455 §1.3 gives this key and accept value.
func TestAcceptKeyMatchesRFC(t *testing.T) {
	if got := AcceptKey("dGhlIHNhbXBsZSBub25jZQ=="); got != "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=" {
		t.Fatal(got)
	}
}

func TestFramesRoundTripAtLengthBoundaries(t *testing.T) {
	for _, n := range []int{0, 125, 126, 0xffff, 0x10000} {
		for _, mask := range []bool{false, true} {
			payload := bytes.Repeat([]byte{'x'}, n)
			wire := AppendFrame(nil, OpBinary, payload, mask)
			f, err := ReadFrame(bytes.NewReader(wire), 1<<20, mask)
			if err != nil || !f.Fin || f.Op != OpBinary || !bytes.Equal(f.Payload, payload) {
				t.Fatalf("n=%d mask=%v: %v", n, mask, err)
			}
		}
	}
}

func TestReadFrameRejects(t *testing.T) {
	for name, tc := range map[string]struct {
		wire   []byte
		masked bool
	}{
		"unmasked from client":  {AppendFrame(nil, OpText, []byte("a"), false), true},
		"masked from server":    {AppendFrame(nil, OpText, []byte("a"), true), false},
		"over limit":            {AppendFrame(nil, OpBinary, make([]byte, 65), true), true},
		"reserved bit":          {append([]byte{0xC1}, AppendFrame(nil, OpText, nil, true)[1:]...), true},
		"unknown opcode":        {append([]byte{0x83}, AppendFrame(nil, OpText, nil, true)[1:]...), true},
		"fragmented control":    {append([]byte{0x09}, AppendFrame(nil, OpPing, nil, true)[1:]...), true},
		"oversized control len": {[]byte{0x89, 0x80 | 126, 0, 200}, true},
	} {
		if _, err := ReadFrame(bytes.NewReader(tc.wire), 64, tc.masked); !errors.Is(err, ErrProtocol) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestIsUpgradeRequiresEveryHandshakeField(t *testing.T) {
	base := map[string]string{"Upgrade": "websocket", "Connection": "keep-alive, Upgrade", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ=="}
	r := httptest.NewRequest("GET", "/", nil)
	for k, v := range base {
		r.Header.Set(k, v)
	}
	if !IsUpgrade(r) {
		t.Fatal("valid handshake refused")
	}
	for k := range base {
		r := httptest.NewRequest("GET", "/", nil)
		for k2, v := range base {
			if k2 != k {
				r.Header.Set(k2, v)
			}
		}
		if IsUpgrade(r) {
			t.Errorf("accepted without %s", k)
		}
	}
	r.Header.Set("Sec-WebSocket-Key", "c2hvcnQ=")
	if IsUpgrade(r) {
		t.Error("accepted a short key")
	}
}
