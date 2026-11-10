//go:build linux

package browserhost

import (
	"bufio"
	"io"
	"net"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/wsframe"
)

// wsConn is the server side of one agent's DevTools WebSocket.
type wsConn struct {
	c   net.Conn
	r   *bufio.Reader
	wmu sync.Mutex
}

// cdpMessageLimit bounds one message from an agent. File uploads travel
// inside CDP messages, so it is generous; Chrome's own pipe limit is larger.
const cdpMessageLimit = 64 << 20

func (w *wsConn) write(op byte, payload []byte) error {
	w.wmu.Lock()
	defer w.wmu.Unlock()
	_ = w.c.SetWriteDeadline(time.Now().Add(30 * time.Second))
	_, err := w.c.Write(wsframe.AppendFrame(nil, op, payload, false))
	return err
}

func (w *wsConn) close(code uint16, reason string) {
	_ = w.write(wsframe.OpClose, wsframe.ClosePayload(code, reason))
	_ = w.c.Close()
}

// next returns the next text message, answering pings and assembling
// fragments. An agent may stay silent for as long as it likes: a CDP client
// that waits for an event sends nothing meanwhile.
func (w *wsConn) next() ([]byte, error) {
	var op byte
	var data []byte
	for {
		_ = w.c.SetReadDeadline(time.Time{})
		f, err := wsframe.ReadFrame(w.r, cdpMessageLimit, true)
		if err != nil {
			return nil, err
		}
		switch f.Op {
		case wsframe.OpPing:
			if err := w.write(wsframe.OpPong, f.Payload); err != nil {
				return nil, err
			}
			continue
		case wsframe.OpPong:
			continue
		case wsframe.OpClose:
			w.close(1000, "")
			return nil, io.EOF
		case wsframe.OpContinuation:
			if op == 0 || len(data)+len(f.Payload) > cdpMessageLimit {
				return nil, wsframe.ErrProtocol
			}
			data = append(data, f.Payload...)
		default:
			if op != 0 {
				return nil, wsframe.ErrProtocol
			}
			op, data = f.Op, f.Payload
		}
		if f.Fin {
			if op != wsframe.OpText {
				return nil, wsframe.ErrProtocol
			}
			return data, nil
		}
	}
}
