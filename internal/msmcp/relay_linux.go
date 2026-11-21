//go:build linux

package msmcp

import (
	"io"
	"net"
	"sync"
	"time"
)

// Relay copies a Pi entry's stdio to the person's endpoint until either side
// ends. It reads nothing and holds nothing: the protocol, the area filter
// and the native server all belong to the daemon. When Pi closes the
// conversation it closes the relay's stdin, the daemon sees the connection
// end and cancels whatever that conversation still had in flight.
func Relay(home string, h Hello, wake func(), stdin io.Reader, stdout io.Writer) error {
	if AreaTools(h.Area) == nil {
		return errUnknownArea
	}
	conn, err := Dial(home, h, wake, 20*time.Second)
	if err != nil {
		return err
	}
	return pipe(conn, stdin, stdout)
}

type relayError string

func (e relayError) Error() string { return string(e) }

const errUnknownArea = relayError("unknown Microsoft area")

func pipe(conn *net.UnixConn, stdin io.Reader, stdout io.Writer) error {
	var once sync.Once
	done := make(chan struct{})
	finish := func() { once.Do(func() { close(done) }) }
	go func() {
		_, _ = io.Copy(conn, stdin)
		// Pi closed the entry: the daemon reads EOF and lets the
		// connection go, which ends the copy below too.
		_ = conn.CloseWrite()
		finish()
	}()
	go func() {
		_, _ = io.Copy(stdout, conn)
		finish()
	}()
	<-done
	conn.Close()
	return nil
}
