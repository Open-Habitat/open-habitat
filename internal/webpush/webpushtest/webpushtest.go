// Package webpushtest is a browser's side of Web Push for tests: a
// subscription key pair that can decrypt what was sent to it, and a fake
// push service that records every message in memory. It is never imported
// by the product binary.
package webpushtest

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"sync"
)

var b64 = base64.RawURLEncoding

// Browser is one device's subscription keys.
type Browser struct {
	Endpoint string
	key      *ecdh.PrivateKey
	auth     []byte
}

// NewBrowser makes a subscription for endpoint.
func NewBrowser(endpoint string) *Browser {
	key, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	auth := make([]byte, 16)
	_, _ = rand.Read(auth)
	return &Browser{Endpoint: endpoint, key: key, auth: auth}
}

// P256dh and Auth are the subscription's keys as PushSubscription.toJSON
// gives them.
func (b *Browser) P256dh() string { return b64.EncodeToString(b.key.PublicKey().Bytes()) }
func (b *Browser) Auth() string   { return b64.EncodeToString(b.auth) }

// Decrypt opens one aes128gcm message (RFC 8291) sent to this browser.
func (b *Browser) Decrypt(body []byte) ([]byte, error) {
	if len(body) < 86 || body[20] != 65 {
		return nil, errors.New("short header")
	}
	salt, asRaw, sealed := body[:16], body[21:86], body[86:]
	as, err := ecdh.P256().NewPublicKey(asRaw)
	if err != nil {
		return nil, err
	}
	shared, err := b.key.ECDH(as)
	if err != nil {
		return nil, err
	}
	info := append(append([]byte("WebPush: info\x00"), b.key.PublicKey().Bytes()...), asRaw...)
	ikm, err := hkdf.Key(sha256.New, shared, b.auth, string(info), 32)
	if err != nil {
		return nil, err
	}
	prk, _ := hkdf.Extract(sha256.New, ikm, salt)
	cek, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	nonce, _ := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	block, _ := aes.NewCipher(cek)
	gcm, _ := cipher.NewGCM(block)
	plain, err := gcm.Open(nil, nonce, sealed, nil)
	if err != nil || len(plain) == 0 || plain[len(plain)-1] != 2 {
		return nil, errors.New("undecryptable")
	}
	return plain[:len(plain)-1], nil
}

// Message is one recorded push.
type Message struct {
	Endpoint string
	Header   http.Header
	Body     []byte
}

// Service is a fake push service. Its client answers every request in
// process, whatever host the endpoint names, so the product's endpoint
// allowlist can stay as it is.
type Service struct {
	mu       sync.Mutex
	messages []Message
	status   map[string]int
}

func NewService() *Service { return &Service{status: map[string]int{}} }

// SetStatus makes the service answer pushes to endpoint with status (for
// example 410 for a subscription the browser dropped).
func (s *Service) SetStatus(endpoint string, status int) {
	s.mu.Lock()
	s.status[endpoint] = status
	s.mu.Unlock()
}

// Messages returns what was posted so far.
func (s *Service) Messages() []Message {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]Message(nil), s.messages...)
}

// Reset forgets the recorded messages and statuses.
func (s *Service) Reset() {
	s.mu.Lock()
	s.messages, s.status = nil, map[string]int{}
	s.mu.Unlock()
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Client is the http.Client the product's sender uses in tests.
func (s *Service) Client() *http.Client {
	return &http.Client{Transport: roundTrip(func(r *http.Request) (*http.Response, error) {
		body, _ := io.ReadAll(io.LimitReader(r.Body, 8192))
		r.Body.Close()
		s.mu.Lock()
		endpoint := r.URL.String()
		s.messages = append(s.messages, Message{Endpoint: endpoint, Header: r.Header.Clone(), Body: body})
		status, ok := s.status[endpoint]
		s.mu.Unlock()
		if !ok {
			status = http.StatusCreated
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(bytes.NewReader(nil)), Header: http.Header{}, Request: r}, nil
	})}
}
