package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/browserhost"
)

// fakeBrowser stands in for one person's browser host: its control socket
// answers as the real host does, from state a spec sets through
// /fixture/browser, and its VNC socket is a tiny RFB server whose screen is
// a drawing, counting the input it receives so a spec can tell a look from
// control. Nothing runs Chrome or a display.
//
// BROWSER_HOST_REAL_BROWSER=<Xvnc>:<Chrome> runs the real host in-process
// instead (lab evidence on a machine that has both).
type fakeBrowser struct {
	mu       sync.Mutex
	running  bool
	control  string
	agent    bool
	request  *browserhost.Request
	pointer  *browserhost.Pointer
	pointers int
	keys     int
	stop     func()
}

var fakeBrowsers = map[string]*fakeBrowser{}

var fakeWindows = []browserhost.Window{
	{ID: "0A1B2C3D4E5F60718293A4B5C6D7E8F9", Title: "Vahvista uudelleen", Origin: "https://login.example.invalid", Agent: true},
	{ID: "F9E8D7C6B5A4938271605F4E3D2C1B0A", Title: "Kustannuspaikat", Origin: "https://app.example.invalid"},
	{ID: "11223344556677889900AABBCCDDEEFF", Title: "Lasku 48213", Origin: "https://app.example.invalid"},
}

const fakeScreenW, fakeScreenH = 800, 500

func newBrowserStart(tmp, user string) func(dir string) error {
	if real := os.Getenv("BROWSER_HOST_REAL_BROWSER"); real != "" {
		return realBrowserStart(tmp, user, real)
	}
	b := &fakeBrowser{control: "agent"}
	fakeBrowsers[user] = b
	return b.start
}

func realBrowserStart(tmp, user, spec string) func(dir string) error {
	xvnc, chrome, _ := strings.Cut(spec, ":")
	return func(dir string) error {
		home := filepath.Join(tmp, "browser-home-"+user)
		cfg := browserhost.Config{Dir: dir, Xvnc: xvnc, Chrome: chrome, Profile: filepath.Join(home, "profile"), Cache: filepath.Join(home, "cache"),
			Idle: time.Hour, Width: 1280, Height: 800, Env: []string{"HOME=" + home, "LANG=fi_FI.UTF-8", "PATH=/usr/bin:/bin"},
			Log: slog.New(slog.NewTextHandler(os.Stderr, nil))}
		go func() { _ = browserhost.Run(context.Background(), cfg) }()
		return nil
	}
}

func (b *fakeBrowser) start(dir string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.running {
		return nil
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	var listeners []net.Listener
	for _, name := range []string{browserhost.ControlSocket, browserhost.VNCSocket} {
		p := filepath.Join(dir, name)
		_ = os.Remove(p)
		l, err := net.Listen("unix", p)
		if err != nil {
			return err
		}
		_ = os.Chmod(p, 0600)
		listeners = append(listeners, l)
	}
	srv := &http.Server{Handler: http.HandlerFunc(b.serveControl)}
	go func() { _ = srv.Serve(listeners[0]) }()
	go func() {
		for {
			c, err := listeners[1].Accept()
			if err != nil {
				return
			}
			go b.serveRFB(c)
		}
	}()
	b.running = true
	b.stop = func() {
		_ = srv.Close()
		_ = listeners[1].Close()
	}
	return nil
}

func (b *fakeBrowser) status() browserhost.Status {
	st := browserhost.Status{Control: b.control, Agent: b.agent, Windows: fakeWindows, Request: b.request, Pointer: b.pointer}
	return st
}

func (b *fakeBrowser) serveControl(w http.ResponseWriter, r *http.Request) {
	reply := func() {
		b.mu.Lock()
		st := b.status()
		b.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(st)
	}
	switch r.URL.Path {
	case browserhost.StatusPath:
		reply()
	case browserhost.WindowPath:
		id := r.URL.Query().Get("id")
		for i, win := range fakeWindows {
			if win.ID == id {
				w.Header().Set("Content-Type", "image/jpeg")
				_, _ = w.Write(fakePicture(i))
				return
			}
		}
		w.WriteHeader(404)
	case browserhost.ControlPath:
		var body struct {
			Control string `json:"control"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		b.mu.Lock()
		b.control = body.Control
		if body.Control == "agent" {
			b.request = nil
		}
		b.mu.Unlock()
		reply()
	case browserhost.RequestPath:
		var body struct {
			Window string `json:"window"`
			Text   string `json:"text"`
			Clear  bool   `json:"clear"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		b.mu.Lock()
		if body.Clear {
			b.request = nil
		} else {
			if body.Window == "" {
				body.Window = fakeWindows[0].ID
			}
			b.request = &browserhost.Request{Window: body.Window, Text: body.Text}
		}
		b.mu.Unlock()
		reply()
	case browserhost.ViewerPath:
		w.WriteHeader(204)
	case browserhost.StopPath:
		w.WriteHeader(204)
		go func() {
			b.mu.Lock()
			defer b.mu.Unlock()
			if b.running {
				b.stop()
				b.running = false
			}
		}()
	default:
		w.WriteHeader(400)
	}
}

// fakeBrowserFixture is /fixture/browser: ?agent=on|off, ?request=TEXT
// (&window=N), ?clear=1, ?pointer=X,Y (fractions, window 0) and ?input=1,
// which answers the input counts the RFB server has seen.
func fakeBrowserFixture(w http.ResponseWriter, r *http.Request, user string) {
	b := fakeBrowsers[user]
	if b == nil {
		http.Error(w, "no fake browser", 404)
		return
	}
	q := r.URL.Query()
	b.mu.Lock()
	defer b.mu.Unlock()
	switch {
	case q.Get("input") == "1":
		_ = json.NewEncoder(w).Encode(map[string]int{"pointer_events": b.pointers, "key_events": b.keys})
		return
	case q.Has("agent"):
		b.agent = q.Get("agent") == "on"
	case q.Has("request"):
		i, _ := strconv.Atoi(q.Get("window"))
		if i < 0 || i >= len(fakeWindows) {
			i = 0
		}
		b.request = &browserhost.Request{Window: fakeWindows[i].ID, Text: q.Get("request")}
	case q.Has("clear"):
		b.request = nil
	case q.Has("pointer"):
		var x, y float64
		for i, c := range q.Get("pointer") {
			if c == ',' {
				x, _ = strconv.ParseFloat(q.Get("pointer")[:i], 64)
				y, _ = strconv.ParseFloat(q.Get("pointer")[i+1:], 64)
			}
		}
		b.pointer = &browserhost.Pointer{Window: fakeWindows[0].ID, X: x, Y: y, Clicks: []browserhost.Click{{X: x, Y: y}}}
	}
	w.WriteHeader(204)
}

func fakePicture(i int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 320, 200))
	bg := []color.RGBA{{235, 240, 245, 255}, {250, 250, 250, 255}, {80, 84, 88, 255}}[i%3]
	for y := 0; y < 200; y++ {
		for x := 0; x < 320; x++ {
			c := bg
			if y < 16 {
				c = color.RGBA{220, 224, 228, 255}
			} else if x > 100 && x < 220 && y > 50 && y < 150 {
				c = color.RGBA{255, 255, 255, 255}
			}
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 70})
	return buf.Bytes()
}

// serveRFB speaks just enough RFB 3.8 for noVNC: no security, one raw
// framebuffer update per full request, and a count of input events.
func (b *fakeBrowser) serveRFB(c net.Conn) {
	defer c.Close()
	r := bufio.NewReader(c)
	if _, err := io.WriteString(c, "RFB 003.008\n"); err != nil {
		return
	}
	version := make([]byte, 12)
	if _, err := io.ReadFull(r, version); err != nil {
		return
	}
	if _, err := c.Write([]byte{1, 1}); err != nil {
		return
	}
	choice := make([]byte, 1)
	if _, err := io.ReadFull(r, choice); err != nil || choice[0] != 1 {
		return
	}
	_, _ = c.Write([]byte{0, 0, 0, 0})
	if _, err := io.ReadFull(r, choice); err != nil { // ClientInit
		return
	}
	name := "Open Habitat"
	init := binary.BigEndian.AppendUint16(nil, fakeScreenW)
	init = binary.BigEndian.AppendUint16(init, fakeScreenH)
	// 32 bpp, depth 24, little-endian, true colour, 255 max, shifts 16/8/0.
	init = append(init, 32, 24, 0, 1, 0, 255, 0, 255, 0, 255, 16, 8, 0, 0, 0, 0)
	init = binary.BigEndian.AppendUint32(init, uint32(len(name)))
	init = append(init, name...)
	if _, err := c.Write(init); err != nil {
		return
	}
	bigEndian := false
	rs, gs, bs := uint(16), uint(8), uint(0)
	for {
		kind, err := r.ReadByte()
		if err != nil {
			return
		}
		switch kind {
		case 0: // SetPixelFormat
			pf := make([]byte, 19)
			if _, err := io.ReadFull(r, pf); err != nil {
				return
			}
			bigEndian = pf[5] != 0
			rs, gs, bs = uint(pf[13]), uint(pf[14]), uint(pf[15])
		case 2: // SetEncodings
			head := make([]byte, 3)
			if _, err := io.ReadFull(r, head); err != nil {
				return
			}
			n := int(binary.BigEndian.Uint16(head[1:]))
			if _, err := io.ReadFull(r, make([]byte, 4*n)); err != nil {
				return
			}
		case 3: // FramebufferUpdateRequest
			req := make([]byte, 9)
			if _, err := io.ReadFull(r, req); err != nil {
				return
			}
			if req[0] != 0 {
				continue
			}
			out := []byte{0, 0, 0, 1}
			out = binary.BigEndian.AppendUint16(out, 0)
			out = binary.BigEndian.AppendUint16(out, 0)
			out = binary.BigEndian.AppendUint16(out, fakeScreenW)
			out = binary.BigEndian.AppendUint16(out, fakeScreenH)
			out = binary.BigEndian.AppendUint32(out, 0)
			for y := 0; y < fakeScreenH; y++ {
				for x := 0; x < fakeScreenW; x++ {
					cr, cg, cb := uint32(240), uint32(243), uint32(246)
					if y < 40 {
						cr, cg, cb = 222, 226, 230
					} else if x > 250 && x < 550 && y > 150 && y < 350 {
						cr, cg, cb = 255, 255, 255
					}
					px := cr<<rs | cg<<gs | cb<<bs
					if bigEndian {
						out = binary.BigEndian.AppendUint32(out, px)
					} else {
						out = binary.LittleEndian.AppendUint32(out, px)
					}
				}
			}
			if _, err := c.Write(out); err != nil {
				return
			}
		case 4: // KeyEvent
			if _, err := io.ReadFull(r, make([]byte, 7)); err != nil {
				return
			}
			b.mu.Lock()
			b.keys++
			b.mu.Unlock()
		case 5: // PointerEvent
			if _, err := io.ReadFull(r, make([]byte, 5)); err != nil {
				return
			}
			b.mu.Lock()
			b.pointers++
			b.mu.Unlock()
		case 6: // ClientCutText
			head := make([]byte, 7)
			if _, err := io.ReadFull(r, head); err != nil {
				return
			}
			n := binary.BigEndian.Uint32(head[3:])
			if n > 1<<20 {
				return
			}
			if _, err := io.ReadFull(r, make([]byte, n)); err != nil {
				return
			}
		default:
			return
		}
	}
}
