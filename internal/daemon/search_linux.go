//go:build linux

package daemon

import (
	"context"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/searchindex"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// SearchPath answers the ⌘K switcher's search across the person's
// conversations (ADR 0036). The index is the person's own derived cache in
// their state directory; this daemon alone opens it, as the person.
const SearchPath = "/api/v1/search"

// searchFresh is how long a synced index answers without looking at the
// session files again: a person types several keys a second, and a stat of
// every history per key would cost more than the search.
var searchFresh = 3 * time.Second

// searchSyncWait bounds the catch-up a search waits for before it answers
// from what is indexed; the rest continues with the next search.
const searchSyncWait = 2 * time.Second

type searchService struct {
	cfg      transport.Config
	sessions func(transport.Config) ([]nativeSession, error)

	mu      sync.Mutex
	index   *searchindex.Index
	path    string
	built   bool
	syncing bool
	synced  time.Time
}

// SearchHandler serves SearchPath for the person's own browser.
func SearchHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return searchHandlerWith(cfg, trusted, nativeSessions)
}

func searchHandlerWith(cfg transport.Config, trusted func(*http.Request) bool, sessions func(transport.Config) ([]nativeSession, error)) http.Handler {
	s := &searchService{cfg: cfg, sessions: sessions}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		if r.Method != http.MethodGet || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.URL.Path != SearchPath || len(q) != 1 || len(q["q"]) != 1 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		text := q.Get("q")
		if !utf8.ValidString(text) || utf8.RuneCountInString(text) > searchindex.MaxQuery {
			snapshotError(w, 400, "invalid_request")
			return
		}
		// A first read of a very long history can outlast the socket's
		// five-second write deadline, as a history read can.
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(historyReadWait))
		body, ok := s.search(r.Context(), text)
		if !ok {
			diagnostic.Reason(r.Context(), "search_index_failed")
			snapshotError(w, 503, "search_unavailable")
			return
		}
		historyJSON(w, body)
	})
}

func (s *searchService) search(ctx context.Context, q string) (map[string]any, bool) {
	index, ready := s.prepare(ctx)
	if index == nil {
		return nil, false
	}
	res, err := index.Search(q)
	if err != nil {
		s.discard(index, err)
		return nil, false
	}
	indexed, total, _ := index.Progress()
	state := "ready"
	if !ready {
		state = "building"
	} else {
		indexed = total
	}
	conversations := make([]map[string]any, 0, len(res.Conversations))
	for _, c := range res.Conversations {
		hits := make([]map[string]any, 0, len(c.Hits))
		for _, h := range c.Hits {
			hits = append(hits, map[string]any{"entry_key": h.Entry, "role": h.Role, "at": h.At.Format(time.RFC3339Nano), "snippet": h.Snippet})
		}
		if len(hits) == 0 {
			continue
		}
		conversations = append(conversations, map[string]any{"agent_id": "pi:" + c.Session, "hit_count": c.HitCount, "hits": hits})
	}
	terms := res.Terms
	if terms == nil {
		terms = []string{}
	}
	return map[string]any{"schema_version": 1, "terms": terms, "index": map[string]any{"state": state, "indexed": indexed, "total": total}, "conversations": conversations}, true
}

// prepare opens the index and keeps it in line with the session files. The
// first build runs in the background, newest conversation first, and
// searches meanwhile answer from what it has read. Later, a search older than
// searchFresh catches up with appended turns before it answers.
func (s *searchService) prepare(ctx context.Context) (*searchindex.Index, bool) {
	s.mu.Lock()
	if s.index == nil {
		index, path, err := openSearchIndex(s.cfg)
		if err != nil {
			s.mu.Unlock()
			diagnostic.New(os.Stderr, "daemon").Warn("search_index", "outcome", "failed", "reason", "open")
			return nil, false
		}
		s.index, s.path, s.built, s.synced = index, path, false, time.Time{}
	}
	index := s.index
	if s.syncing || (s.built && time.Since(s.synced) < searchFresh) {
		ready := s.built
		s.mu.Unlock()
		return index, ready
	}
	s.syncing = true
	first := !s.built
	s.mu.Unlock()
	done := make(chan struct{})
	go func() {
		defer close(done)
		s.sync(index)
	}()
	if first {
		return index, false
	}
	wait := time.NewTimer(searchSyncWait)
	defer wait.Stop()
	select {
	case <-done:
	case <-wait.C:
	case <-ctx.Done():
	}
	// A catch-up that outlasts the wait still answers as ready: the index
	// was complete a moment ago and only newer turns are missing.
	return index, s.isBuilt()
}

func (s *searchService) isBuilt() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.built
}

func (s *searchService) sync(index *searchindex.Index) {
	found, err := s.sessions(s.cfg)
	var sessions []searchindex.Session
	if err == nil {
		for _, n := range found {
			if n.state != "readable" || n.path == "" {
				continue
			}
			changed, _ := time.Parse(time.RFC3339Nano, n.changedAt)
			sessions = append(sessions, searchindex.Session{ID: n.id, Path: n.path, Changed: changed})
		}
		err = index.Sync(context.Background(), sessions)
	}
	s.mu.Lock()
	s.syncing = false
	if err == nil {
		s.built, s.synced = true, time.Now()
	}
	s.mu.Unlock()
	if err != nil {
		s.discard(index, err)
	}
}

// discard drops an index that failed: it is a cache, so the next search
// builds a new one from the histories rather than trusting a doubtful file.
func (s *searchService) discard(index *searchindex.Index, err error) {
	// The error text may quote SQL, never content; the journal keeps only
	// that the index was dropped.
	_ = err
	diagnostic.New(os.Stderr, "daemon").Warn("search_index", "outcome", "rebuild", "reason", "index_error")
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.index != index {
		return
	}
	if s.syncing {
		// The running build still holds it; it discards it when it ends.
		return
	}
	_ = index.Close()
	_ = searchindex.Remove(s.path)
	s.index, s.built = nil, false
}

// openSearchIndex opens the index in the person's verified state directory
// (~/.local/state/open-habitat, 0700, owned by the person).
func openSearchIndex(cfg transport.Config) (*searchindex.Index, string, error) {
	d, err := stateDir(cfg.Home, true)
	if err != nil {
		return nil, "", err
	}
	unix.Close(d)
	path := filepath.Join(cfg.Home, ".local/state/open-habitat/search.sqlite")
	index, err := searchindex.Open(path, func(p string) (*os.File, os.FileInfo, bool) { return openNative(p, cfg.UID) }, maxNativeLine)
	return index, path, err
}

// SearchHandlerWithNativeRoot serves search over an invented home, for the
// synthetic browser host, as HistoryHandlerWithNativeRoot serves history.
func SearchHandlerWithNativeRoot(cfg transport.Config, trusted func(*http.Request) bool, root string) http.Handler {
	cfg.Home = root
	return searchHandlerWith(cfg, trusted, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) })
}
