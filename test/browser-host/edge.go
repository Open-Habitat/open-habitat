package main

import (
	"io"
	"net"
	"sync"
	"time"
)

// edgeRelay stands between the browser and the TLS gateway as the network
// and a proxy do live, so a test can break the browser's real connections
// the way a laptop's sleep, a lost network or a proxy's idle timeout does.
// It relays bytes only; TLS still ends at the gateway.
type edgeRelay struct {
	ln       net.Listener
	upstream string
	mu       sync.Mutex
	pairs    map[*edgePair]struct{}
	// Until this time new connections are accepted and then hold silently,
	// as with no route to the host.
	downUntil time.Time
}

type edgePair struct {
	client, server net.Conn
	frozen         chan struct{}
	once           sync.Once
}

func (p *edgePair) freeze() { p.once.Do(func() { close(p.frozen) }) }

func newEdgeRelay(ln net.Listener, upstream string) *edgeRelay {
	r := &edgeRelay{ln: ln, upstream: upstream, pairs: map[*edgePair]struct{}{}}
	go r.serve()
	return r
}

func (r *edgeRelay) serve() {
	for {
		c, err := r.ln.Accept()
		if err != nil {
			return
		}
		go r.relay(c)
	}
}

func (r *edgeRelay) relay(c net.Conn) {
	r.mu.Lock()
	down := time.Until(r.downUntil)
	r.mu.Unlock()
	if down > 0 {
		// A SYN that reached nothing: the browser waits on its own timeouts.
		time.Sleep(down)
		_ = c.Close()
		return
	}
	s, err := net.Dial("tcp", r.upstream)
	if err != nil {
		_ = c.Close()
		return
	}
	p := &edgePair{client: c, server: s, frozen: make(chan struct{})}
	r.mu.Lock()
	r.pairs[p] = struct{}{}
	r.mu.Unlock()
	done := make(chan struct{}, 2)
	pipe := func(dst, src net.Conn) {
		buf := make([]byte, 32<<10)
		for {
			n, err := src.Read(buf)
			if n > 0 {
				select {
				case <-p.frozen:
					// Silently dropped: neither side learns of it.
					<-make(chan struct{})
				default:
				}
				if _, werr := dst.Write(buf[:n]); werr != nil {
					break
				}
			}
			if err != nil {
				if err != io.EOF {
					_ = dst.Close()
				}
				break
			}
		}
		if tcp, ok := dst.(*net.TCPConn); ok {
			_ = tcp.CloseWrite()
		}
		done <- struct{}{}
	}
	go pipe(s, c)
	go pipe(c, s)
	<-done
	<-done
	_ = c.Close()
	_ = s.Close()
	r.mu.Lock()
	delete(r.pairs, p)
	r.mu.Unlock()
}

// apply changes the existing connections, except the one a fixture request
// itself arrived on (named by the gateway-side address of its relay leg).
func (r *edgeRelay) apply(mode string, except string, d time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if mode == "down" {
		r.downUntil = time.Now().Add(d)
	}
	for p := range r.pairs {
		if p.server.LocalAddr().String() == except {
			continue
		}
		switch mode {
		case "freeze", "down":
			p.freeze()
		case "cut":
			if tcp, ok := p.client.(*net.TCPConn); ok {
				_ = tcp.SetLinger(0) // a reset, as an idle-timeout proxy sends
			}
			_ = p.client.Close()
			_ = p.server.Close()
		}
	}
}
