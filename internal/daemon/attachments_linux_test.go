//go:build linux

package daemon

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestAttachmentsRoundTripAndIsolation(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home}
	h := AttachmentsHandler(cfg, func(*http.Request) bool { return true })
	png := append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{0}, 32)...)
	request := func(handler http.Handler, method, path string, data []byte) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, "http://unix"+path, bytes.NewReader(data))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	denied := request(AttachmentsHandler(cfg, func(*http.Request) bool { return false }), "POST", AttachmentsPath, png)
	if denied.Code != 403 {
		t.Fatal(denied.Code)
	}
	w := request(h, "POST", AttachmentsPath, png)
	var reply struct {
		ID, Path, ContentType string
		Size                  int
	}
	var body map[string]any
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &body) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	reply.ID = body["id"].(string)
	reply.Path = body["path"].(string)
	if reply.Path != filepath.Join(home, "attachments", reply.ID) || body["content_type"] != "image/png" {
		t.Fatal(body)
	}
	st, err := os.Stat(reply.Path)
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatal(st, err)
	}
	get := request(h, "GET", AttachmentsPath+"/"+reply.ID, nil)
	if get.Code != 200 || !bytes.Equal(get.Body.Bytes(), png) || get.Header().Get("Content-Type") != "image/png" {
		t.Fatal(get.Code, get.Header())
	}
	other := AttachmentsHandler(transport.Config{Home: t.TempDir()}, func(*http.Request) bool { return true })
	if request(other, "GET", AttachmentsPath+"/"+reply.ID, nil).Code != 404 {
		t.Fatal("cross-user attachment accessible")
	}
	message, images, err := promptAttachments(home, "![screen]("+AttachmentsPath+"/"+reply.ID+")", true)
	if err != nil || len(images) != 1 || images[0].MimeType != "image/png" || !strings.Contains(message, reply.Path) {
		t.Fatal(message, images, err)
	}
	if err := os.Remove(reply.Path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(home, "secret"), reply.Path); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, "secret"), []byte("secret"), 0600); err != nil {
		t.Fatal(err)
	}
	if request(h, "GET", AttachmentsPath+"/"+reply.ID, nil).Code != 404 {
		t.Fatal("symlink read")
	}
	if _, _, err := promptAttachments(home, AttachmentsPath+"/"+reply.ID, true); err == nil {
		t.Fatal("symlink passed to Pi")
	}
}

func TestPromptAttachmentCountLimit(t *testing.T) {
	home := t.TempDir()
	root, err := attachmentRoot(home)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	var refs []string
	for i := 0; i < 31; i++ {
		id := fmt.Sprintf("%08x-1111-4111-8111-aaaaaaaaaaaa", i)
		if err := os.WriteFile(filepath.Join(home, "attachments", id), []byte("file"), 0600); err != nil {
			t.Fatal(err)
		}
		refs = append(refs, AttachmentsPath+"/"+id)
	}
	for _, images := range []bool{false, true} {
		// Repeated references count once, including at the boundary.
		message := strings.Join(append(append([]string{}, refs[:30]...), refs[0]), "\n")
		got, _, err := promptAttachments(home, message, images)
		if err != nil || strings.Count(got, "Attachment path: ") != 30 {
			t.Fatalf("30 distinct attachments: %v", err)
		}
		if _, _, err := promptAttachments(home, strings.Join(refs, "\n"), images); err == nil {
			t.Fatal("31 distinct attachments accepted")
		}
	}
}

// Thirty images totaling exactly 100 MiB exercise the full base64 payload, not
// just file metadata. Sparse synthetic PNGs keep fixture creation inexpensive.
func TestPromptAttachmentCombinedSize(t *testing.T) {
	home := t.TempDir()
	root, err := attachmentRoot(home)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	var refs []string
	for i := 0; i < 30; i++ {
		id := fmt.Sprintf("%08x-1111-4111-8111-aaaaaaaaaaaa", i)
		f, err := root.OpenFile(id, os.O_CREATE|os.O_WRONLY, 0600)
		if err != nil {
			t.Fatal(err)
		}
		size := int64(3 << 20)
		if i < 10 {
			size = 4 << 20
		}
		if _, err := f.Write([]byte("\x89PNG\r\n\x1a\n")); err != nil {
			t.Fatal(err)
		}
		if err := f.Truncate(size); err != nil {
			t.Fatal(err)
		}
		f.Close()
		refs = append(refs, AttachmentsPath+"/"+id)
	}
	message := strings.Join(refs, "\n")
	for _, includeImages := range []bool{false, true} {
		got, images, err := promptAttachments(home, message, includeImages)
		if err != nil || strings.Count(got, "Attachment path: ") != 30 {
			t.Fatalf("100 MiB refused: %v", err)
		}
		if includeImages {
			if len(images) != 30 {
				t.Fatalf("image count: %d", len(images))
			}
			var decoded int
			for _, image := range images {
				data, err := base64.StdEncoding.DecodeString(image.Data)
				if err != nil || !bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) {
					t.Fatal("invalid native image payload", err)
				}
				decoded += len(data)
			}
			if decoded != 100<<20 {
				t.Fatalf("decoded bytes: %d", decoded)
			}
			// Exercise the production writer and echo reader, with Pi's pinned
			// stdin framing. No provider, personal home or credentials are used.
			node, err := exec.LookPath("node")
			if err != nil {
				t.Fatal(err)
			}
			helper, err := filepath.Abs("pi-device-test/attachment-payload.mjs")
			if err != nil {
				t.Fatal(err)
			}
			script := filepath.Join(home, "pi")
			if err := os.WriteFile(script, []byte("#!/bin/sh\nexec "+strconv.Quote(node)+" "+strconv.Quote(helper)+"\n"), 0700); err != nil {
				t.Fatal(err)
			}
			p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
			if err != nil {
				t.Fatal(err)
			}
			defer p.close()
			started := time.Now()
			accepted, err := p.request("prompt", got, promptRequestTimeout(images), images...)
			if err != nil || !accepted {
				t.Fatalf("native Pi input and image echo: accepted=%v, %v", accepted, err)
			}
			for _, kind := range []string{"message_start", "message_end"} {
				select {
				case event := <-p.events:
					if len(event) > 1<<20 || !bytes.Contains(event, []byte(kind)) {
						t.Fatalf("unbounded or missing %s", kind)
					}
					if kind == "message_start" && !bytes.Contains(event, []byte(refs[0])) {
						t.Fatal("lost user text needed for queue matching")
					}
				case <-time.After(5 * time.Second):
					t.Fatalf("missing %s echo", kind)
				}
			}
			t.Logf("100 MiB images through native framing and bounded echoes in %s", time.Since(started))
		}
	}
	if err := os.Truncate(filepath.Join(home, "attachments", strings.TrimPrefix(refs[0], AttachmentsPath+"/")), 5<<20); err != nil {
		t.Fatal(err)
	}
	for _, includeImages := range []bool{false, true} {
		if _, _, err := promptAttachments(home, message, includeImages); err == nil {
			t.Fatal("101 MiB accepted")
		}
	}
}

func TestAttachmentsLimitsAndUnsafeRoot(t *testing.T) {
	for _, unsafe := range []bool{false, true} {
		home := t.TempDir()
		if unsafe {
			if err := os.Symlink(t.TempDir(), filepath.Join(home, "attachments")); err != nil {
				t.Fatal(err)
			}
		}
		h := AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
		r := httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("abc"))
		if !unsafe {
			r.ContentLength = attachmentLimit + 1
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if unsafe && w.Code != 503 || !unsafe && w.Code != 413 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	home := t.TempDir()
	root, err := attachmentRoot(home)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	f, err := root.Create("existing")
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Truncate(attachmentQuota); err != nil {
		t.Fatal(err)
	}
	f.Close()
	h := AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("abc")))
	if w.Code != 413 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestAttachmentsActiveContentDownloads(t *testing.T) {
	home := t.TempDir()
	h := AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("<html><script>alert(1)</script>")))
	var reply map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &reply)
	r := httptest.NewRecorder()
	h.ServeHTTP(r, httptest.NewRequest("GET", "http://unix"+AttachmentsPath+"/"+reply["id"].(string), nil))
	if r.Header().Get("Content-Type") != "application/octet-stream" || r.Header().Get("Content-Disposition") != "attachment" {
		t.Fatal(r.Header())
	}
}

func TestAttachmentImagesReachRPC(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	// The child refuses the prompt unless the native RPC image payload survived.
	body := `#!/usr/bin/env python3
import sys,json,base64
for line in sys.stdin:
 r=json.loads(line)
 images=r.get('images',[])
 ok=(r['type']=='prompt' and len(images)==1 and images[0]['type']=='image' and images[0]['mimeType']=='image/png' and base64.b64decode(images[0]['data']).startswith(b'\x89PNG'))
 print(json.dumps({'type':'message_start','message':{'role':'user','content':images}}),flush=True)
 print(json.dumps({'type':'message_end','message':{'role':'user','content':images}}),flush=True)
 print(json.dumps({'type':'message_end','message':{'role':'toolResult','toolCallId':'read-1','content':images,'isError':False}}),flush=True)
 print(json.dumps({'type':'tool_execution_end','toolCallId':'read-1','result':{'content':images},'isError':False}),flush=True)
 print(json.dumps({'type':'agent_end','messages':[{'role':'user','content':images}]}),flush=True)
 print(json.dumps({'type':'response','id':r['id'],'command':r['type'],'success':ok}),flush=True)
`
	if err := os.WriteFile(script, []byte(body), 0700); err != nil {
		t.Fatal(err)
	}
	root, err := attachmentRoot(home)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	id := "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"
	f, err := root.Create(id)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = f.Write(append([]byte("\x89PNG\r\n\x1a\n"), bytes.Repeat([]byte{0}, 1<<20)...))
	f.Close()
	text, images, err := promptAttachments(home, "![shot]("+AttachmentsPath+"/"+id+") again "+AttachmentsPath+"/"+id, true)
	if err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	if ok, err := p.request("prompt", text, 3*time.Second, images...); err != nil || !ok {
		t.Fatal(ok, err)
	}
}

func TestAttachmentsPreexistingFoldersDoNotBlockUploads(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "attachments")
	if err := os.Mkdir(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(dir, "old"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("/unreachable", filepath.Join(dir, "link")); err != nil {
		t.Fatal(err)
	}
	h := AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("abc")))
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	// Moving files into a folder must not bypass the attachments budget.
	f, err := os.Create(filepath.Join(dir, "old", "large"))
	if err != nil {
		t.Fatal(err)
	}
	if err = f.Truncate(attachmentQuota); err != nil {
		t.Fatal(err)
	}
	f.Close()
	w = httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("abc")))
	if w.Code != 413 {
		t.Fatal(w.Code, w.Body.String())
	}
}

func TestAttachmentReadDoesNotWaitForAnUpload(t *testing.T) {
	home := t.TempDir()
	h := AttachmentsHandler(transport.Config{Home: home}, func(*http.Request) bool { return true })
	seed := httptest.NewRecorder()
	h.ServeHTTP(seed, httptest.NewRequest("POST", "http://unix"+AttachmentsPath, strings.NewReader("seed")))
	var reply map[string]any
	_ = json.Unmarshal(seed.Body.Bytes(), &reply)
	read, write := io.Pipe()
	defer read.Close()
	defer write.Close()
	upload := httptest.NewRequest("POST", "http://unix"+AttachmentsPath, read)
	upload.ContentLength = 3
	uploadDone := make(chan struct{})
	go func() { defer close(uploadDone); h.ServeHTTP(httptest.NewRecorder(), upload) }()
	// One byte establishes that the upload has started reading while holding its
	// write reservation. The remaining bytes are deliberately withheld.
	if _, err := write.Write([]byte("a")); err != nil {
		t.Fatal(err)
	}
	getDone := make(chan int, 1)
	go func() {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+AttachmentsPath+"/"+reply["id"].(string), nil))
		getDone <- w.Code
	}()
	select {
	case code := <-getDone:
		if code != 200 {
			t.Fatal(code)
		}
	case <-time.After(time.Second):
		t.Fatal("image reads blocked by upload")
	}
	_, _ = write.Write([]byte("bc"))
	write.Close()
	select {
	case <-uploadDone:
	case <-time.After(time.Second):
		t.Fatal("upload did not finish")
	}
}
