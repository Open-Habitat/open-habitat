//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const LocalFilesPath = "/api/v1/local-files"

type localFileRequest struct {
	ID      string `json:"id"`
	Action  string `json:"action"`
	Name    string `json:"name"`
	Expires int64  `json:"expires"`
	Offset  int    `json:"offset"`
	claim   string
	result  chan localFileAnswer
}
type localFileAnswer struct {
	Next       *int     `json:"next,omitempty"`
	Error      string   `json:"error,omitempty"`
	Names      []string `json:"names"`
	Attachment string   `json:"attachment,omitempty"`
}
type localFiles struct {
	mu      sync.Mutex
	pending map[string]*localFileRequest
}

func validLocalName(name string) bool {
	return name != "" && name != "." && name != ".." && len(name) <= 255 && !strings.ContainsAny(name, "/\\\x00\r\n")
}

// This listener is inside the Pi child's private 0700 directory, not the
// gateway socket. Native tools run as the person and gain no browser identity.
func (c *ConversationController) attachLocalFiles(p *piRPC) {
	listener, err := net.Listen("unix", filepath.Join(p.processDir, "local-files.sock"))
	if err != nil {
		return
	}
	server := &http.Server{ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 35 * time.Second, Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Action string `json:"action"`
			Name   string `json:"name"`
			Offset int    `json:"offset"`
		}
		if r.Method != "POST" || r.URL.Path != "/" || json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048)).Decode(&body) != nil || (body.Action != "list" && body.Action != "fetch") || (body.Action == "fetch" && !validLocalName(body.Name)) || body.Offset < 0 || body.Offset > 100000 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		c.requestLocalFiles(w, r, body.Action, body.Name, body.Offset, p.done)
	})}
	go server.Serve(listener)
	go func() {
		<-p.done
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
		_ = listener.Close()
	}()
}

// Shared request path: neither adapter can claim or complete browser replies.
func (c *ConversationController) requestLocalFiles(w http.ResponseWriter, r *http.Request, action, name string, offset int, done <-chan struct{}) {
	id, ok := uuid()
	if !ok {
		snapshotError(w, 503, "local_files_unavailable")
		return
	}
	request := &localFileRequest{ID: id, Action: action, Name: name, Offset: offset, Expires: time.Now().Add(30 * time.Second).UnixMilli(), result: make(chan localFileAnswer, 1)}
	c.localFiles.mu.Lock()
	if len(c.localFiles.pending) >= 8 {
		c.localFiles.mu.Unlock()
		snapshotError(w, 429, "local_files_busy")
		return
	}
	c.localFiles.pending[id] = request
	c.localFiles.mu.Unlock()
	defer func() { c.localFiles.mu.Lock(); delete(c.localFiles.pending, id); c.localFiles.mu.Unlock() }()
	if c.journal != nil {
		c.journal.appendEvent("local-files.requested", "", request)
	}
	timer := time.NewTimer(30 * time.Second)
	defer timer.Stop()
	var result localFileAnswer
	select {
	case result = <-request.result:
	case <-timer.C:
		result.Error = "folder_not_reachable"
	case <-r.Context().Done():
		return
	case <-done:
		snapshotError(w, 409, "conversation_not_running")
		return
	}
	if result.Attachment != "" {
		root, err := attachmentRoot(c.home)
		if err != nil {
			result = localFileAnswer{Error: "attachment_unavailable"}
		} else {
			f, err := attachmentFile(root, result.Attachment)
			root.Close()
			if err != nil {
				result = localFileAnswer{Error: "attachment_unavailable"}
			} else {
				f.Close()
			}
		}
	}
	historyJSON(w, map[string]any{"schema_version": 1, "next": result.Next, "error": result.Error, "names": result.Names, "attachment": result.Attachment})
}

// LocalFilesHandler accepts only the authenticated gateway's own-user replies.
// A one-use claim prevents multiple tabs from uploading the same request.
func (c *ConversationController) LocalFilesHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(c.cfg, c.trusted, r) {
			snapshotError(w, 403, "forbidden")
			return
		}
		if r.Method != "POST" || r.URL.Path != LocalFilesPath || r.URL.RawQuery != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			ID       string `json:"id"`
			Claim    string `json:"claim"`
			Complete bool   `json:"complete"`
			localFileAnswer
		}
		d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10))
		d.DisallowUnknownFields()
		if d.Decode(&body) != nil || !attachmentID.MatchString(body.ID) || !attachmentID.MatchString(body.Claim) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		c.localFiles.mu.Lock()
		defer c.localFiles.mu.Unlock()
		req := c.localFiles.pending[body.ID]
		if req == nil || time.Now().UnixMilli() >= req.Expires || (req.claim != "" && req.claim != body.Claim) {
			snapshotError(w, 409, "request_expired")
			return
		}
		if !body.Complete {
			if req.claim != "" {
				snapshotError(w, 409, "request_claimed")
				return
			}
			req.claim = body.Claim
			historyJSON(w, map[string]bool{"claimed": true})
			return
		}
		if req.claim != body.Claim || (body.Next != nil && (*body.Next < 0 || *body.Next > 100000)) || len(body.Names) > 200 || (body.Attachment != "" && !attachmentID.MatchString(body.Attachment)) || !validLocalFileError(body.Error) {
			snapshotError(w, 400, "invalid_request")
			return
		}

		validResult := body.Error != "" && body.Attachment == "" && body.Names == nil && body.Next == nil
		if body.Error == "" {
			validResult = req.Action == "list" && body.Names != nil && body.Attachment == ""
			if req.Action == "fetch" {
				validResult = body.Attachment != "" && body.Names == nil && body.Next == nil
			}
		}
		if !validResult {
			snapshotError(w, 400, "invalid_request")
			return
		}
		for _, name := range body.Names {
			if !validLocalName(name) {
				snapshotError(w, 400, "invalid_request")
				return
			}
		}
		delete(c.localFiles.pending, body.ID)
		req.result <- body.localFileAnswer
		historyJSON(w, map[string]bool{"completed": true})
	})
}

func validLocalFileError(code string) bool {
	switch code {
	case "", "folder_unavailable", "file_not_found", "file_size_invalid", "upload_unconfirmed":
		return true
	}
	return false
}
