package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
)

// streamSilence stands for a proxy between the browser and the gateway whose
// upstream vanished without a close (a host that went down under it): the
// browser's open event stream stays open and carries nothing more, not even
// heartbeats, while every new request is relayed as usual. Each
// /fixture/edge-silence-streams silences the streams open at that moment.
var streamSilence atomic.Int64

type silencedStream struct {
	http.ResponseWriter
	generation int64
}

func (w *silencedStream) silent() bool { return streamSilence.Load() != w.generation }

func (w *silencedStream) Write(b []byte) (int, error) {
	if w.silent() {
		return len(b), nil
	}
	return w.ResponseWriter.Write(b)
}

func (w *silencedStream) Flush() {
	if !w.silent() {
		w.ResponseWriter.(http.Flusher).Flush()
	}
}

func (w *silencedStream) Unwrap() http.ResponseWriter { return w.ResponseWriter }

// serveSilenceable relays an event stream that a later silence leaves open:
// once silenced, the upstream's end does not end the browser's response.
func serveSilenceable(w http.ResponseWriter, r *http.Request, next http.Handler) {
	s := &silencedStream{ResponseWriter: w, generation: streamSilence.Load()}
	next.ServeHTTP(s, r)
	if s.silent() {
		<-r.Context().Done()
	}
}

// runFakeTitleModel answers the daemon's title helper. Without a configured
// title it is unavailable, as before, so cases that do not ask for one keep
// the first-message fallback; nothing contacts a real model.
func runFakeTitleModel() int {
	if storyActive(os.Getenv("HOME")) {
		// The README story names its conversations by their first prompt.
		text, _ := io.ReadAll(io.LimitReader(os.Stdin, 1<<20))
		if title := storyTitle(string(text)); title != "" {
			b, _ := json.Marshal(map[string]string{"title": title, "model": "synthetic/title"})
			_, _ = os.Stdout.Write(b)
			return 0
		}
	}
	title, err := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-title"))
	if err != nil || strings.TrimSpace(string(title)) == "" {
		_, _ = os.Stdout.WriteString(`{"failure":"model_unavailable"}`)
		return 0
	}
	b, _ := json.Marshal(map[string]string{"title": strings.TrimSpace(string(title)), "model": "synthetic/title"})
	_, _ = os.Stdout.Write(b)
	return 0
}
