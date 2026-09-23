package daemon

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFoundationFailsClosed(t *testing.T) {
	w := httptest.NewRecorder()
	New().ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/commands", nil))
	if w.Code != http.StatusNotImplemented {
		t.Fatal(w.Code)
	}
}
