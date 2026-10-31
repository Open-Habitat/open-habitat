package webpush

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"io"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// RFC 8291 Appendix A: the one published vector for aes128gcm Web Push.
func TestEncryptMatchesRFC8291Vector(t *testing.T) {
	asPrivate, _ := b64.DecodeString("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw")
	ephemeral, err := ecdh.P256().NewPrivateKey(asPrivate)
	if err != nil {
		t.Fatal(err)
	}
	salt, _ := b64.DecodeString("DGv6ra1nlYgDCS1FRnbzlw")
	sub := Subscription{
		P256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		Auth:   "BTBZMqHH6r4Tts7J_aSIgg",
	}
	got, err := Encrypt(sub, []byte("When I grow up, I want to be a watermelon"), ephemeral, salt)
	if err != nil {
		t.Fatal(err)
	}
	want := "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN"
	if b64.EncodeToString(got) != want {
		t.Fatalf("ciphertext differs from RFC 8291:\n got %s\nwant %s", b64.EncodeToString(got), want)
	}
}

func TestKeysRoundTripAndRejectMismatch(t *testing.T) {
	k, err := NewKeys()
	if err != nil || !k.Valid() {
		t.Fatalf("new keys invalid: %v", err)
	}
	other, _ := NewKeys()
	if (Keys{Private: k.Private, Public: other.Public}).Valid() {
		t.Fatal("a private key with another public key was accepted")
	}
}

func TestAllowedEndpoint(t *testing.T) {
	for endpoint, want := range map[string]bool{
		"https://fcm.googleapis.com/fcm/send/abc":                 true,
		"https://updates.push.services.mozilla.com/wpush/v2/abc":  true,
		"https://web.push.apple.com/QGx":                          true,
		"https://wns2-par02p.notify.windows.com/w/?token=x":       true,
		"http://fcm.googleapis.com/fcm/send/abc":                  false,
		"https://fcm.googleapis.com:8443/fcm/send/abc":            false,
		"https://user@fcm.googleapis.com/fcm/send/abc":            false,
		"https://evilfcm.googleapis.com.example.org/fcm/send/abc": false,
		"https://notfcm.googleapis.com.evil/x":                    false,
		"https://example.org/push":                                false,
		"https://127.0.0.1/push":                                  false,
		"https://push.apple.com.evil.example/x":                   false,
		"https://fcm.googleapis.com":                              false,
	} {
		if AllowedEndpoint(endpoint) != want {
			t.Errorf("%s: want %v", endpoint, want)
		}
	}
}

// A browser's side: the subscription's private key and secret, so the test
// can decrypt what Send posted with code independent of Encrypt's.
func browserSubscription(t *testing.T, endpoint string) (Subscription, *ecdh.PrivateKey, []byte) {
	t.Helper()
	ua, err := ecdh.P256().GenerateKey(nil)
	if err != nil {
		t.Fatal(err)
	}
	auth := []byte("0123456789abcdef")
	return Subscription{Endpoint: endpoint, P256dh: b64.EncodeToString(ua.PublicKey().Bytes()), Auth: b64.EncodeToString(auth)}, ua, auth
}

func TestSendPostsEncryptedSignedMessage(t *testing.T) {
	var got *http.Request
	var body []byte
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r
		body, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()
	keys, _ := NewKeys()
	sub, ua, auth := browserSubscription(t, srv.URL+"/push/abc")
	now := time.Unix(1_800_000_000, 0)
	out := Sender{Client: srv.Client(), Subject: "https://habitat.example", Now: func() time.Time { return now }}.Send(context.Background(), keys, sub, Message{Payload: []byte(`{"kind":"turn"}`), Topic: "t1", TTL: time.Hour, Urgency: "high"})
	if out != Delivered {
		t.Fatalf("outcome %s", out)
	}
	if got.Header.Get("Content-Encoding") != "aes128gcm" || got.Header.Get("TTL") != "3600" || got.Header.Get("Topic") != "t1" || got.Header.Get("Urgency") != "high" {
		t.Fatalf("headers %v", got.Header)
	}
	if plain := decrypt(t, body, ua, auth); string(plain) != `{"kind":"turn"}` {
		t.Fatalf("decrypted %q", plain)
	}
	// The VAPID token names the endpoint's origin, expires within a day and
	// verifies under the public key sent beside it.
	authz := got.Header.Get("Authorization")
	token, k, ok := strings.Cut(strings.TrimPrefix(authz, "vapid t="), ", k=")
	if !ok || k != keys.Public {
		t.Fatalf("authorization %q", authz)
	}
	parts := strings.Split(token, ".")
	claimsRaw, _ := b64.DecodeString(parts[1])
	var claims struct {
		Aud string `json:"aud"`
		Exp int64  `json:"exp"`
		Sub string `json:"sub"`
	}
	if json.Unmarshal(claimsRaw, &claims) != nil || claims.Aud != srv.URL || claims.Sub != "https://habitat.example" || claims.Exp <= now.Unix() || claims.Exp > now.Add(24*time.Hour).Unix() {
		t.Fatalf("claims %s", claimsRaw)
	}
	pubRaw, _ := b64.DecodeString(keys.Public)
	pub, err := ecdsa.ParseUncompressedPublicKey(elliptic.P256(), pubRaw)
	if err != nil {
		t.Fatal(err)
	}
	sig, _ := b64.DecodeString(parts[2])
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if len(sig) != 64 || !ecdsa.Verify(pub, digest[:], new(big.Int).SetBytes(sig[:32]), new(big.Int).SetBytes(sig[32:])) {
		t.Fatal("VAPID signature does not verify")
	}
}

func TestSendOutcomes(t *testing.T) {
	keys, _ := NewKeys()
	for status, want := range map[int]Outcome{201: Delivered, 404: Gone, 410: Gone, 400: Rejected, 403: Rejected, 429: Rejected, 503: Rejected} {
		srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status) }))
		sub, _, _ := browserSubscription(t, srv.URL+"/p")
		if got := (Sender{Client: srv.Client()}).Send(context.Background(), keys, sub, Message{Payload: []byte("x"), TTL: time.Minute}); got != want {
			t.Errorf("status %d: %s, want %s", status, got, want)
		}
		srv.Close()
	}
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	sub, _, _ := browserSubscription(t, srv.URL+"/p")
	client := srv.Client()
	srv.Close()
	if got := (Sender{Client: client}).Send(context.Background(), keys, sub, Message{Payload: []byte("x")}); got != Unreachable {
		t.Errorf("closed server: %s", got)
	}
	sub.Endpoint = strings.Replace(sub.Endpoint, "https:", "http:", 1)
	if got := (Sender{Client: client}).Send(context.Background(), keys, sub, Message{Payload: []byte("x")}); got != Rejected {
		t.Errorf("plain http: %s", got)
	}
}

// The production client refuses loopback and other non-443 destinations
// before any connection, whatever the caller's allowlist said.
func TestDefaultClientRefusesLoopback(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { t.Error("reached") }))
	defer srv.Close()
	keys, _ := NewKeys()
	sub, _, _ := browserSubscription(t, srv.URL+"/p")
	if got := (Sender{}).Send(context.Background(), keys, sub, Message{Payload: []byte("x")}); got != Unreachable {
		t.Fatalf("loopback: %s", got)
	}
	sub.Endpoint = "https://127.0.0.1/p"
	if got := (Sender{}).Send(context.Background(), keys, sub, Message{Payload: []byte("x")}); got != Unreachable {
		t.Fatalf("loopback 443: %s", got)
	}
}

// decrypt is the user agent's side of RFC 8291, written from the RFC rather
// than from Encrypt: it reads the salt and sender key from the header.
func decrypt(t *testing.T, body []byte, ua *ecdh.PrivateKey, auth []byte) []byte {
	t.Helper()
	if len(body) < 21+65 || body[20] != 65 {
		t.Fatalf("header too short")
	}
	salt, asRaw, ciphertext := body[:16], body[21:86], body[86:]
	as, err := ecdh.P256().NewPublicKey(asRaw)
	if err != nil {
		t.Fatal(err)
	}
	shared, _ := ua.ECDH(as)
	info := append(append([]byte("WebPush: info\x00"), ua.PublicKey().Bytes()...), asRaw...)
	prkKey := hmacSHA256(auth, shared)
	ikm := hmacSHA256(prkKey, append(info, 1))
	prk := hmacSHA256(salt, ikm)
	cek := hmacSHA256(prk, []byte("Content-Encoding: aes128gcm\x00\x01"))[:16]
	nonce := hmacSHA256(prk, []byte("Content-Encoding: nonce\x00\x01"))[:12]
	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	if plain[len(plain)-1] != 2 {
		t.Fatalf("last record delimiter %d", plain[len(plain)-1])
	}
	return plain[:len(plain)-1]
}

func hmacSHA256(key, data []byte) []byte {
	m := hmac.New(sha256.New, key)
	m.Write(data)
	return m.Sum(nil)
}
