// Package webpush sends one Web Push message: the payload encrypted to a
// browser's subscription (RFC 8291, aes128gcm of RFC 8188) and signed with
// the sender's VAPID key (RFC 8292). It is written on the standard library
// alone, which was less code to trust than a third-party library and its
// JWT and HKDF dependencies. It holds no keys or subscriptions itself: the
// caller (the person's daemon) passes them in for each send.
package webpush

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/egress"
)

var b64 = base64.RawURLEncoding

// Keys is a VAPID key pair: the P-256 private scalar and the uncompressed
// public point, both base64url without padding as the browser takes them.
type Keys struct {
	Private string `json:"private"`
	Public  string `json:"public"`
}

// NewKeys makes a VAPID key pair.
func NewKeys() (Keys, error) {
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return Keys{}, err
	}
	d, err := k.Bytes()
	if err != nil {
		return Keys{}, err
	}
	pub, err := k.PublicKey.Bytes()
	if err != nil {
		return Keys{}, err
	}
	return Keys{Private: b64.EncodeToString(d), Public: b64.EncodeToString(pub)}, nil
}

func (k Keys) signer() (*ecdsa.PrivateKey, error) {
	d, err := b64.DecodeString(k.Private)
	if err != nil {
		return nil, err
	}
	key, err := ecdsa.ParseRawPrivateKey(elliptic.P256(), d)
	if err != nil {
		return nil, err
	}
	pub, err := key.PublicKey.Bytes()
	if err != nil || b64.EncodeToString(pub) != k.Public {
		return nil, errors.New("vapid key pair does not match")
	}
	return key, nil
}

// Valid says whether the pair parses and matches.
func (k Keys) Valid() bool {
	_, err := k.signer()
	return err == nil
}

// Subscription is what the browser's PushManager gave: the push service's
// endpoint and the keys the payload is encrypted to.
type Subscription struct {
	Endpoint string
	P256dh   string
	Auth     string
}

// ValidKeys checks the subscription's key material: a P-256 point and a
// 16-byte authentication secret.
func (s Subscription) ValidKeys() bool {
	pub, err := b64.DecodeString(s.P256dh)
	if err != nil || len(pub) != 65 {
		return false
	}
	if _, err := ecdh.P256().NewPublicKey(pub); err != nil {
		return false
	}
	auth, err := b64.DecodeString(s.Auth)
	return err == nil && len(auth) == 16
}

// Encrypt is RFC 8291 section 3.4 with one record: the ephemeral key and
// salt come from the caller so the RFC's test vector can be checked.
func Encrypt(sub Subscription, plaintext []byte, ephemeral *ecdh.PrivateKey, salt []byte) ([]byte, error) {
	uaRaw, err := b64.DecodeString(sub.P256dh)
	if err != nil {
		return nil, err
	}
	ua, err := ecdh.P256().NewPublicKey(uaRaw)
	if err != nil {
		return nil, err
	}
	auth, err := b64.DecodeString(sub.Auth)
	if err != nil || len(auth) != 16 || len(salt) != 16 {
		return nil, errors.New("invalid subscription secret")
	}
	shared, err := ephemeral.ECDH(ua)
	if err != nil {
		return nil, err
	}
	asPublic := ephemeral.PublicKey().Bytes()
	keyInfo := append(append([]byte("WebPush: info\x00"), uaRaw...), asPublic...)
	ikm, err := hkdf.Key(sha256.New, shared, auth, string(keyInfo), 32)
	if err != nil {
		return nil, err
	}
	prk, err := hkdf.Extract(sha256.New, ikm, salt)
	if err != nil {
		return nil, err
	}
	cek, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		return nil, err
	}
	nonce, err := hkdf.Expand(sha256.New, prk, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	// One record, so its delimiter is 0x02 and no padding is added: the
	// record size only has to exceed the record.
	record := append(append([]byte{}, plaintext...), 2)
	header := make([]byte, 0, 16+4+1+len(asPublic))
	header = append(header, salt...)
	header = binary.BigEndian.AppendUint32(header, 4096)
	header = append(header, byte(len(asPublic)))
	header = append(header, asPublic...)
	return gcm.Seal(header, nonce, record, nil), nil
}

// vapidJWT signs the RFC 8292 token for the endpoint's origin, valid for
// twelve hours (the services accept at most 24).
func vapidJWT(key *ecdsa.PrivateKey, audience, subject string, now time.Time) (string, error) {
	header := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`))
	claims, err := json.Marshal(map[string]any{"aud": audience, "exp": now.Add(12 * time.Hour).Unix(), "sub": subject})
	if err != nil {
		return "", err
	}
	signing := header + "." + b64.EncodeToString(claims)
	digest := sha256.Sum256([]byte(signing))
	r, s, err := ecdsa.Sign(rand.Reader, key, digest[:])
	if err != nil {
		return "", err
	}
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	s.FillBytes(sig[32:])
	return signing + "." + b64.EncodeToString(sig), nil
}

// Outcome is what one send ended in, as the person's card words it.
type Outcome string

const (
	// Delivered: the push service accepted the message. It says nothing about
	// whether the device has shown it yet.
	Delivered Outcome = "delivered"
	// Gone: the push service no longer knows the subscription (404 or 410);
	// the caller forgets the device.
	Gone Outcome = "gone"
	// Rejected: the push service answered with another refusal.
	Rejected Outcome = "rejected"
	// Unreachable: no answer, typically because the server's outbound HTTPS
	// is restricted.
	Unreachable Outcome = "unreachable"
)

// Message is one notification's send parameters.
type Message struct {
	Payload []byte
	// Topic lets the push service replace an undelivered earlier message
	// with the same topic (RFC 8030 section 5.4); at most 32 base64url
	// characters.
	Topic   string
	TTL     time.Duration
	Urgency string
}

// Sender posts messages to push services. Production uses the zero value's
// defaults; the fields are test seams.
type Sender struct {
	// Client replaces the egress-checked client (tests route every endpoint
	// to a local recorder).
	Client *http.Client
	// Subject is the VAPID contact, the site's https origin.
	Subject string
	Now     func() time.Time
}

// Send encrypts and posts one message. The endpoint must already have been
// checked by the caller's allowlist; Send only refuses non-https URLs.
func (s Sender) Send(ctx context.Context, keys Keys, sub Subscription, m Message) Outcome {
	u, err := url.Parse(sub.Endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return Rejected
	}
	signer, err := keys.signer()
	if err != nil {
		return Rejected
	}
	now := time.Now
	if s.Now != nil {
		now = s.Now
	}
	jwt, err := vapidJWT(signer, "https://"+u.Host, s.subject(), now())
	if err != nil {
		return Rejected
	}
	ephemeral, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return Rejected
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return Rejected
	}
	body, err := Encrypt(sub, m.Payload, ephemeral, salt)
	if err != nil {
		return Rejected
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, strings.NewReader(string(body)))
	if err != nil {
		return Rejected
	}
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("TTL", strconv.Itoa(int(m.TTL/time.Second)))
	if m.Urgency != "" {
		req.Header.Set("Urgency", m.Urgency)
	}
	if m.Topic != "" {
		req.Header.Set("Topic", m.Topic)
	}
	req.Header.Set("Authorization", "vapid t="+jwt+", k="+keys.Public)
	client := s.Client
	if client == nil {
		client = defaultClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return Unreachable
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	resp.Body.Close()
	switch {
	case resp.StatusCode >= 200 && resp.StatusCode < 300:
		return Delivered
	case resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone:
		return Gone
	}
	return Rejected
}

func (s Sender) subject() string {
	if s.Subject != "" {
		return s.Subject
	}
	// Apple refuses a subject that is not a real https or mailto URL
	// (403 BadJwtToken); without a published site origin, the project's.
	return "https://github.com/Open-Habitat/open-habitat"
}

var errForbidden = errors.New("forbidden destination")

// defaultClient never follows a redirect or uses a proxy, verifies TLS
// against the system roots and dials only addresses the shared egress rule
// allows, checked on every resolved address so DNS cannot move a push
// service's name onto a refused class.
var defaultClient = &http.Client{
	CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	Transport: &http.Transport{
		Proxy: nil,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil || port != "443" {
				return nil, errForbidden
			}
			ips, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
			if err != nil || len(ips) == 0 {
				return nil, errors.New("unresolved")
			}
			for _, ip := range ips {
				if !egress.Allowed(ip, false) {
					return nil, errForbidden
				}
			}
			dialer := &net.Dialer{Timeout: 10 * time.Second}
			var last error
			for _, ip := range ips {
				conn, err := dialer.DialContext(ctx, "tcp", netip.AddrPortFrom(ip.Unmap(), 443).String())
				if err == nil {
					return conn, nil
				}
				last = err
			}
			return nil, last
		},
		TLSClientConfig:        &tls.Config{MinVersion: tls.VersionTLS12},
		TLSHandshakeTimeout:    10 * time.Second,
		ResponseHeaderTimeout:  10 * time.Second,
		MaxResponseHeaderBytes: 64 << 10,
		DisableKeepAlives:      true,
		ForceAttemptHTTP2:      true,
	},
}

// pushServices are the browser vendors' push services, the only hosts a
// subscription may name: Google's FCM (Chrome, Edge, Android), Mozilla's
// autopush (Firefox), Apple's (Safari, iPhone home-screen apps) and
// Microsoft's WNS (legacy Edge). Anything else would make the person's
// daemon post to an address a browser chose.
var pushServices = []string{"fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"}

// AllowedEndpoint says whether an endpoint is an https URL on a known push
// service's default port with no credentials or fragment.
func AllowedEndpoint(endpoint string) bool {
	if len(endpoint) > 1024 {
		return false
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || u.Fragment != "" || u.Opaque != "" || u.Path == "" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	for _, service := range pushServices {
		if host == service || strings.HasSuffix(host, "."+service) {
			return true
		}
	}
	return false
}
