package gateway

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// AccessConfig is opt-in test-installation ingress enforcement. The trusted
// config names the Access team issuer and the application audience; Access's
// policy, not an email header or a claim-based domain rule here, admits people.
type AccessConfig struct {
	Issuer   string `json:"issuer"`
	Audience string `json:"audience"`
}

type accessVerifier struct {
	cfg    AccessConfig
	now    func() time.Time
	client *http.Client
	mu     sync.Mutex
	keys   map[string]*rsa.PublicKey
	until  time.Time
}

var accessHost = regexp.MustCompile(`^[a-z0-9][a-z0-9-]*\.cloudflareaccess\.com$`)

func newAccessVerifier(cfg *AccessConfig, now func() time.Time) (*accessVerifier, error) {
	if cfg == nil {
		return nil, nil
	}
	u, err := url.Parse(cfg.Issuer)
	if err != nil || u.Scheme != "https" || !accessHost.MatchString(u.Host) || u.Hostname() != u.Host || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil || cfg.Audience == "" || strings.TrimSpace(cfg.Audience) != cfg.Audience {
		return nil, errors.New("invalid Access assertion configuration")
	}
	return &accessVerifier{cfg: *cfg, now: now, client: &http.Client{Timeout: 3 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

type accessContextKey struct{}

func accessEmail(r *http.Request) string {
	v, _ := r.Context().Value(accessContextKey{}).(string)
	return v
}

// accessIngress is outside the route mux: it covers OAuth start/callback,
// session, every daemon-backed API and static UI, including unknown routes.
// Only unauthenticated health probes are exempt. It never trusts forwarded
// email headers, even if the request came from loopback.
// Anonymous Access failures share a process-wide diagnostic budget. This
// affects only the record, never the ingress decision or HTTP response.
func (a *Auth) logAccessDenial(reason string) {
	if a.log == nil {
		return
	}
	a.mu.Lock()
	now := a.now()
	if a.accessLog.at.IsZero() {
		a.accessLog.tokens = 32
	} else if elapsed := now.Sub(a.accessLog.at).Seconds(); elapsed > 0 {
		a.accessLog.tokens += elapsed
		if a.accessLog.tokens > 32 {
			a.accessLog.tokens = 32
		}
	}
	allowed := a.accessLog.tokens >= 1
	if allowed {
		a.accessLog.tokens--
	}
	a.accessLog.at = now
	a.mu.Unlock()
	if allowed {
		a.log.Warn("access_assertion", "outcome", "rejected", "reason", reason)
	}
}

func (a *Auth) accessIngress(next http.Handler) http.Handler {
	if a.access == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
			next.ServeHTTP(w, r)
			return
		}
		header := r.Header.Values("Cf-Access-Jwt-Assertion")
		if len(header) != 1 {
			a.logAccessDenial("assertion_missing_or_ambiguous")
			safe(w, 403, "authentication_required")
			return
		}
		email, err := a.access.verify(r.Context(), header[0])
		if err != nil {
			a.logAccessDenial("assertion_invalid")
			safe(w, 403, "authentication_required")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), accessContextKey{}, email)))
	})
}

func (v *accessVerifier) verify(ctx context.Context, token string) (string, error) {
	deny := errors.New("invalid Access assertion")
	if len(token) > 16384 || len(token) == 0 || strings.TrimSpace(token) != token {
		return "", deny
	}
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", deny
	}
	hb, e1 := base64.RawURLEncoding.DecodeString(parts[0])
	pb, e2 := base64.RawURLEncoding.DecodeString(parts[1])
	sig, e3 := base64.RawURLEncoding.DecodeString(parts[2])
	if e1 != nil || e2 != nil || e3 != nil {
		return "", deny
	}
	var hdr struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
		Typ string `json:"typ"`
	}
	if json.Unmarshal(hb, &hdr) != nil || hdr.Alg != "RS256" || hdr.Kid == "" || len(hdr.Kid) > 256 || (hdr.Typ != "" && hdr.Typ != "JWT") {
		return "", deny
	}
	key, err := v.key(ctx, hdr.Kid)
	if err != nil {
		return "", deny
	}
	hash := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], sig) != nil {
		return "", deny
	}
	var claims struct {
		Iss   string          `json:"iss"`
		Aud   json.RawMessage `json:"aud"`
		Exp   json.Number     `json:"exp"`
		Nbf   json.Number     `json:"nbf"`
		Email string          `json:"email"`
	}
	if json.Unmarshal(pb, &claims) != nil || claims.Iss != v.cfg.Issuer {
		return "", deny
	}
	var audience string
	var audiences []string
	if json.Unmarshal(claims.Aud, &audience) == nil {
		audiences = []string{audience}
	} else if json.Unmarshal(claims.Aud, &audiences) != nil {
		return "", deny
	}
	matched := false
	for _, aud := range audiences {
		if aud == v.cfg.Audience {
			matched = true
		}
	}
	exp, err := claims.Exp.Int64()
	if err != nil || !matched || v.now().Unix() >= exp {
		return "", deny
	}
	if claims.Nbf != "" {
		nbf, err := claims.Nbf.Int64()
		if err != nil || v.now().Unix() < nbf {
			return "", deny
		}
	}
	email := strings.ToLower(claims.Email)
	at := strings.IndexByte(email, '@')
	if at < 1 || at == len(email)-1 || strings.TrimSpace(email) != email || strings.ContainsAny(email, " \t\r\n") || strings.Count(email, "@") != 1 {
		return "", deny
	}
	return email, nil
}

func (v *accessVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.Lock()
	defer v.mu.Unlock()
	if v.now().Before(v.until) {
		if k := v.keys[kid]; k != nil {
			return k, nil
		}
		return nil, errors.New("unknown Access key")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.cfg.Issuer+"/cdn-cgi/access/certs", nil)
	if err != nil {
		return nil, err
	}
	resp, err := v.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("Access certs unavailable")
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 131073))
	if err != nil || len(body) > 131072 {
		return nil, errors.New("invalid Access certs")
	}
	var certs struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if json.Unmarshal(body, &certs) != nil || len(certs.Keys) == 0 || len(certs.Keys) > 64 {
		return nil, errors.New("invalid Access certs")
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range certs.Keys {
		if k.Kty != "RSA" || (k.Alg != "" && k.Alg != "RS256") || (k.Use != "" && k.Use != "sig") || k.Kid == "" || keys[k.Kid] != nil {
			return nil, errors.New("invalid Access key")
		}
		nb, ne := base64.RawURLEncoding.DecodeString(k.N)
		eb, ee := base64.RawURLEncoding.DecodeString(k.E)
		if ne != nil || ee != nil || len(nb) < 256 || len(nb) > 512 || len(eb) == 0 || len(eb) > 4 {
			return nil, errors.New("invalid Access key")
		}
		exponent := new(big.Int).SetBytes(eb)
		if !exponent.IsInt64() || exponent.Int64() < 3 || exponent.Int64() > 65537 || exponent.Int64()%2 == 0 {
			return nil, errors.New("invalid Access key")
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(nb), E: int(exponent.Int64())}
	}
	v.keys = keys
	v.until = v.now().Add(5 * time.Minute)
	if k := keys[kid]; k != nil {
		return k, nil
	}
	return nil, errors.New("unknown Access key")
}
