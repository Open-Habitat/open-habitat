package diagnostic

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/base64"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RequestIDHeader carries the gateway's request ID to the mapped daemon so
// both journals can be joined. It is a log key only: the daemon never derives
// identity, routing or authorization from it.
const RequestIDHeader = "X-Agent-Host-Request-Id"

// A read faster than SlowRead is routine and not logged; a request at or above
// Slow is logged as a warning with slow=true, whatever its method.
const (
	SlowRead = 250 * time.Millisecond
	Slow     = time.Second
)

var now = time.Now // replaced by tests

// NewRequestID returns 16 URL-safe characters from 96 random bits, or "" if
// the system random source fails; an absent ID is never invented.
func NewRequestID() string {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return ""
	}
	return base64.RawURLEncoding.EncodeToString(b[:])
}

// ValidRequestID accepts only the shape NewRequestID produces, so a forwarded
// header cannot carry other bytes into a record.
func ValidRequestID(id string) bool {
	if len(id) != 16 {
		return false
	}
	for _, c := range id {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// routeWords are the fixed path segments of host routes. Any other segment,
// such as a conversation, workspace, agent, process or entry ID, is recorded as
// {id}: IDs can name content, and a URL from the browser is not a fixed field.
var routeWords = map[string]bool{}

func init() {
	for _, w := range strings.Fields(`api v1 auth github google start callback session profile logout
		server administration storage account snapshot workspaces git publish disconnect git-identity
		events conversations onboarding pi status credentials openai models claude-login repos clone
		stream checkout attempt agents healthz readyz send steer follow_up clear_queue regenerate_title
		history_title recap presence question abort eligibility receipt stop continue cancel_held close processes
		clear-finished output spinoffs history entries blocks content integrations accounts login
		terminal terminals editor workspace open file-offers inline download zip`) {
		routeWords[w] = true
	}
}

// Route maps a URL path to a template of fixed words and {id} placeholders.
// Paths outside /api/ and /auth/ are the static UI and become "ui".
func Route(path string) string {
	if path == "/healthz" || path == "/readyz" {
		return path
	}
	if !strings.HasPrefix(path, "/api/") && !strings.HasPrefix(path, "/auth/") {
		return "ui"
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	for i, p := range parts {
		if !routeWords[p] {
			parts[i] = "{id}"
		}
	}
	if len(parts) > 10 {
		parts = append(parts[:10], "...")
	}
	return "/" + strings.Join(parts, "/")
}

type record struct {
	mu     sync.Mutex
	id     string
	user   string
	reason string
	phases []any
}

type recordKey struct{}

// RequestID returns the ID of the logged request in ctx, or "".
func RequestID(ctx context.Context) string {
	if r, ok := ctx.Value(recordKey{}).(*record); ok {
		return r.id
	}
	return ""
}

// SetUser names the verified Unix user once the handler has established it.
func SetUser(ctx context.Context, user string) {
	if r, ok := ctx.Value(recordKey{}).(*record); ok {
		r.mu.Lock()
		r.user = user
		r.mu.Unlock()
	}
}

// Phase adds the elapsed time of one named part of the request, measured from
// start, to the request's record. Names must be fixed strings.
func Phase(ctx context.Context, name string, start time.Time) {
	if r, ok := ctx.Value(recordKey{}).(*record); ok {
		ms := now().Sub(start).Milliseconds()
		r.mu.Lock()
		r.phases = append(r.phases, slog.Int64(name, ms))
		r.mu.Unlock()
	}
}

// RequestOptions configures Requests. ID returns the request ID to use; the
// gateway generates one and the daemon accepts the gateway's.
type RequestOptions struct {
	ID func(*http.Request) string
}

// Requests writes one http_request record for each request that changes
// state, fails with a 5xx, or is slow. Fast reads are routine and omitted.
// Streams are judged by the time to their response header, not their length.
// Records carry the method, route template, status, durations, request ID and
// user; never the query, headers, cookies or bodies.
func Requests(log *slog.Logger, opts RequestOptions, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := now()
		rec := &record{}
		if opts.ID != nil {
			rec.id = opts.ID(r)
		}
		rw := &statusWriter{ResponseWriter: w, start: start}
		next.ServeHTTP(rw, r.WithContext(context.WithValue(r.Context(), recordKey{}, rec)))
		total := now().Sub(start)
		status, header := rw.status, rw.header
		if status == 0 {
			// Nothing written: net/http answers 200 with an empty body.
			status, header = http.StatusOK, total
		}
		judged := total
		if rw.streamed {
			judged = header
		}
		read := r.Method == http.MethodGet || r.Method == http.MethodHead
		if read && judged < SlowRead && (status < 500 || r.Context().Err() != nil) {
			return
		}
		level := slog.LevelInfo
		if judged >= Slow || status >= 500 {
			level = slog.LevelWarn
		}
		outcome := "completed"
		switch {
		case r.Context().Err() != nil:
			// The caller went away; a status written afterwards is not a host
			// failure. A slow one stays a warning: on the daemon this is also
			// how the gateway's own timeout looks.
			outcome = "client_canceled"
			if judged < Slow {
				level = slog.LevelInfo
			}
		case status >= 500:
			outcome = "failed"
		}
		attrs := []slog.Attr{
			slog.String("outcome", outcome),
			slog.String("method", method(r.Method)),
			slog.String("route", Route(r.URL.Path)),
			slog.Int("status", status),
			slog.Int64("duration_ms", total.Milliseconds()),
			slog.Int64("header_ms", header.Milliseconds()),
			slog.Bool("slow", judged >= Slow),
		}
		if rw.streamed {
			attrs = append(attrs, slog.Bool("stream", true))
		}
		rec.mu.Lock()
		if rec.id != "" {
			attrs = append(attrs, slog.String("request_id", rec.id))
		}
		if rec.user != "" {
			attrs = append(attrs, slog.String("user", rec.user))
		}
		if rec.reason != "" {
			attrs = append(attrs, slog.String("reason", rec.reason))
		}
		if len(rec.phases) > 0 {
			attrs = append(attrs, slog.Group("phases_ms", rec.phases...))
		}
		rec.mu.Unlock()
		log.LogAttrs(context.Background(), level, "http_request", attrs...)
	})
}

// method keeps the record to fixed strings: net/http accepts any token as a
// method, so a client could otherwise write arbitrary bytes into the log.
func method(m string) string {
	switch m {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions:
		return m
	}
	return "other"
}

// statusWriter records the status and the time to the response header. It
// keeps Flush and Unwrap so streams and http.ResponseController still work.
type statusWriter struct {
	http.ResponseWriter
	start    time.Time
	status   int
	header   time.Duration
	streamed bool
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status, w.header = code, now().Sub(w.start)
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

func (w *statusWriter) Flush() {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	w.streamed = true
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// Hijack hands an upgraded connection to its handler. The record is the
// handshake: its status is 101 and its time is the time to the upgrade, not
// how long the connection then lives.
func (w *statusWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	conn, rw, err := http.NewResponseController(w.ResponseWriter).Hijack()
	if err == nil && w.status == 0 {
		w.status, w.header = http.StatusSwitchingProtocols, now().Sub(w.start)
		w.streamed = true
	}
	return conn, rw, err
}

// Reason names, as a fixed code, why the handler refused the request; the
// record carries it as reason. A wire error code is often shared by several
// checks, and the journal must say which one refused.
func Reason(ctx context.Context, code string) {
	if r, ok := ctx.Value(recordKey{}).(*record); ok && validReason(code) {
		r.mu.Lock()
		r.reason = code
		r.mu.Unlock()
	}
}

// validReason keeps reason a fixed vocabulary word: lowercase letters, digits
// and underscores, never content.
func validReason(code string) bool {
	if code == "" || len(code) > 64 {
		return false
	}
	for _, c := range code {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_') {
			return false
		}
	}
	return true
}
