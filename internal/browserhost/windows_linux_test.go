//go:build linux

package browserhost

import (
	"context"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWindowListDoesNotHidePopupsAfterManyTabs(t *testing.T) {
	c := newFakeChrome(t)
	h := &host{mux: c.mux}
	done := make(chan []window, 1)
	go func() { done <- h.list(context.Background()) }()
	query := c.next()
	var pages []map[string]any
	for i := 0; i < 30; i++ {
		pages = append(pages, map[string]any{"targetId": fmt.Sprintf("%032X", i), "type": "page"})
	}
	c.send(map[string]any{"id": query["id"], "result": map[string]any{"targetInfos": pages}})
	if windows := <-done; len(windows) != 30 {
		t.Fatalf("hidden windows: %d", len(windows))
	}
}

func TestCloseWindowUsesFreshPageInventory(t *testing.T) {
	for _, mode := range []string{"close", "last", "create-failed", "last-refused", "missing", "unreadable", "refused"} {
		t.Run(mode, func(t *testing.T) {
			c := newFakeChrome(t)
			main, popup := strings.Repeat("A", 32), strings.Repeat("B", 32)
			h := &host{mux: c.mux, windows: []window{{id: main}, {id: popup}}, listed: time.Now()}
			req := httptest.NewRequest("POST", WindowPath, strings.NewReader(`{"window":"`+popup+`"}`))
			req.Header.Set("Content-Type", "application/json")
			done := make(chan *httptest.ResponseRecorder, 1)
			go func() { w := httptest.NewRecorder(); h.controlHandler().ServeHTTP(w, req); done <- w }()
			query := c.next()
			if query["method"] != "Target.getTargets" {
				t.Fatalf("first command %v", query)
			}
			pages := []map[string]any{{"targetId": popup, "type": "page"}}
			last := mode == "last" || mode == "create-failed" || mode == "last-refused"
			if !last {
				pages = append(pages, map[string]any{"targetId": main, "type": "page"})
			}
			if mode == "missing" {
				pages = pages[1:]
			}
			// An iframe is not a second closable page.
			pages = append(pages, map[string]any{"targetId": strings.Repeat("C", 32), "type": "iframe"})
			if mode == "unreadable" {
				c.send(map[string]any{"id": query["id"], "error": map[string]any{"code": -1, "message": "failed"}})
			} else {
				c.send(map[string]any{"id": query["id"], "result": map[string]any{"targetInfos": pages}})
			}
			want := 409
			if mode == "unreadable" {
				want = 503
			}
			if last {
				create := c.next()
				if create["method"] != "Target.createTarget" || create["params"].(map[string]any)["url"] != "about:blank" {
					t.Fatalf("replacement command %v", create)
				}
				if mode == "create-failed" {
					c.send(map[string]any{"id": create["id"], "error": map[string]any{"code": -1, "message": "failed"}})
					want = 503
				} else {
					c.send(map[string]any{"id": create["id"], "result": map[string]any{"targetId": main}})
				}
			}
			if mode == "close" || mode == "refused" || mode == "last" || mode == "last-refused" {
				close := c.next()
				if close["method"] != "Target.closeTarget" || close["params"].(map[string]any)["targetId"] != popup {
					t.Fatalf("close command %v", close)
				}
				c.send(map[string]any{"id": close["id"], "result": map[string]any{"success": mode == "close" || mode == "last"}})
				want = 503
				if mode == "close" || mode == "last" {
					if last {
						for _, method := range []string{"Browser.getWindowForTarget", "Browser.setWindowBounds", "Browser.setWindowBounds", "Target.activateTarget"} {
							cmd := c.next()
							if cmd["method"] != method {
								t.Fatalf("activation command %v", cmd)
							}
							if method == "Target.activateTarget" && cmd["params"].(map[string]any)["targetId"] != main {
								t.Fatal("activated something other than replacement")
							}
							c.send(map[string]any{"id": cmd["id"], "result": map[string]any{"windowId": 7}})
						}
					}
					query = c.next()
					if query["method"] != "Target.getTargets" {
						t.Fatalf("refresh %v", query)
					}
					c.send(map[string]any{"id": query["id"], "result": map[string]any{"targetInfos": []map[string]any{{"targetId": main, "type": "page"}}}})
					want = 200
				}
			}
			select {
			case w := <-done:
				if w.Code != want {
					t.Fatalf("status %d: %s", w.Code, w.Body)
				}
			case <-time.After(3 * time.Second):
				t.Fatal("handler stuck")
			}
			select {
			case extra := <-c.got:
				t.Fatalf("unexpected command %v", extra)
			default:
			}
			c.mux.mu.Lock()
			person := c.mux.person
			c.mux.mu.Unlock()
			if person != (mode == "close" || mode == "refused" || last) {
				t.Fatal("control changed on refusal or was not taken for close")
			}
		})
	}
}

func TestActivateWindowNormalizesBoundsBeforeRaising(t *testing.T) {
	c := newFakeChrome(t)
	h := &host{mux: c.mux, cfg: Config{Width: 1280, Height: 800}}
	id := strings.Repeat("A", 32)
	done := make(chan error, 1)
	go func() { done <- h.activateWindow(context.Background(), id) }()
	for i, method := range []string{"Browser.getWindowForTarget", "Browser.setWindowBounds", "Browser.setWindowBounds", "Target.activateTarget"} {
		cmd := c.next()
		if cmd["method"] != method {
			t.Fatalf("command %v", cmd)
		}
		params := cmd["params"].(map[string]any)
		if i == 0 || i == 3 {
			if params["targetId"] != id {
				t.Fatal(params)
			}
		} else {
			if params["windowId"] != float64(7) {
				t.Fatal(params)
			}
			bounds := params["bounds"].(map[string]any)
			if i == 1 && bounds["windowState"] != "normal" {
				t.Fatal(bounds)
			}
			if i == 2 && (bounds["left"] != float64(0) || bounds["top"] != float64(0) || bounds["width"] != float64(1280) || bounds["height"] != float64(800)) {
				t.Fatal(bounds)
			}
		}
		result := map[string]any{}
		if i == 0 {
			result["windowId"] = 7
		}
		c.send(map[string]any{"id": cmd["id"], "result": result})
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}
