//go:build linux

package daemon

import (
	"bytes"
	"net/http/httptest"
	"testing"
)

func TestHistoryTitleUnavailableRuntimeDoesNotPanic(t *testing.T) {
	c := &ConversationController{sessions: map[string]*conversation{}}
	r := httptest.NewRequest("POST", "http://unix/history_title", bytes.NewBufferString(`{"workspace_id":"ws_fixture123"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.historyTitle(w, r, "12345678-1234-4123-8123-123456789abc")
	if w.Code != 503 {
		t.Fatalf("nil runtime: %d %s", w.Code, w.Body.String())
	}
}
