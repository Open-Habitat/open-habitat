//go:build linux

package daemon

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"net"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/unix"
)

//go:embed process-extension.mjs
var processExtension []byte

var errStaleProcess = errors.New("stale process")

// The socket is never supplied by the browser. Peer PID fences even another
// same-UID Pi child; the fresh 0700 service-private directory fences other users.
func (p *piRPC) dialProcesses(ctx context.Context) (*net.UnixConn, error) {
	if p.processSocket == "" || p.cmd == nil || p.cmd.Process == nil || p.closing.Load() {
		return nil, errors.New("bridge unavailable")
	}
	select {
	case <-p.exited:
		return nil, errors.New("Pi exited")
	default:
	}
	conn, err := (&net.Dialer{}).DialContext(ctx, "unix", p.processSocket)
	if err != nil {
		return nil, err
	}
	u := conn.(*net.UnixConn)
	raw, err := u.SyscallConn()
	if err != nil {
		u.Close()
		return nil, err
	}
	var cred *unix.Ucred
	var peerErr error
	err = raw.Control(func(fd uintptr) { cred, peerErr = unix.GetsockoptUcred(int(fd), unix.SOL_SOCKET, unix.SO_PEERCRED) })
	if err != nil || peerErr != nil || cred == nil || int(cred.Uid) != os.Geteuid() || int(cred.Pid) != p.cmd.Process.Pid {
		u.Close()
		return nil, errors.New("bridge peer denied")
	}
	return u, nil
}

func (p *piRPC) processRequest(ctx context.Context, request any, result any) error {
	conn, err := p.dialProcesses(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(5 * time.Second)
	}
	_ = conn.SetDeadline(deadline)
	if err := json.NewEncoder(conn).Encode(request); err != nil {
		return err
	}
	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 4096), 256*1024)
	if !scanner.Scan() {
		return errors.New("bridge reply unavailable")
	}
	var reply struct {
		OK    bool            `json:"ok"`
		Error string          `json:"error"`
		Data  json.RawMessage `json:"data"`
	}
	if json.Unmarshal(scanner.Bytes(), &reply) != nil {
		return errors.New("invalid bridge reply")
	}
	if !reply.OK {
		if reply.Error == "stale_process" {
			return errStaleProcess
		}
		if reply.Error == "extension_missing" {
			return errors.New("extension_missing")
		}
		return errors.New("bridge unavailable")
	}
	if result != nil {
		return json.Unmarshal(reply.Data, result)
	}
	return nil
}

// watchProcesses carries invalidation hints, never retained log data. A lost
// connection changes no process authority; clients resnapshot (and also poll).
func (c *ConversationController) watchProcesses(s *conversation) {
	if s.rpc.processSocket == "" {
		return
	}
	for {
		select {
		case <-s.rpc.exited:
			return
		case <-time.After(500 * time.Millisecond):
		}
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		conn, err := s.rpc.dialProcesses(ctx)
		cancel()
		if err != nil {
			if s.rpc.closing.Load() {
				return
			}
			continue
		}
		_ = conn.SetWriteDeadline(time.Now().Add(time.Second))
		if json.NewEncoder(conn).Encode(map[string]string{"op": "watch"}) != nil {
			conn.Close()
			continue
		}
		scanner := bufio.NewScanner(conn)
		scanner.Buffer(make([]byte, 4096), 8192)
		for scanner.Scan() {
			var hint struct {
				Kind string `json:"kind"`
				ID   string `json:"process_id"`
			}
			if json.Unmarshal(scanner.Bytes(), &hint) != nil || (hint.Kind != "process.changed" && hint.Kind != "process.output") {
				break
			}
			if hint.ID != "" && !processIDPattern.MatchString(hint.ID) {
				break
			}
			c.mu.Lock()
			valid := !c.closed && !s.dead && c.sessions[s.id] == s
			c.mu.Unlock()
			if !valid {
				conn.Close()
				return
			}
			if c.journal != nil {
				payload := map[string]any{"owner_generation": s.rpc.processGeneration}
				if hint.ID != "" {
					payload["process_id"] = hint.ID
				}
				c.journal.appendEvent(hint.Kind, "pi:"+s.id, payload)
				if hint.Kind == "process.changed" {
					c.journal.appendInvalidation("pi:" + s.id)
				}
			}
		}
		conn.Close()
	}
}

func installProcessExtension(dir string) (string, error) {
	path := filepath.Join(dir, "process-extension.mjs")
	return path, os.WriteFile(path, processExtension, 0600)
}
