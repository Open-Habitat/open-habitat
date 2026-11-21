//go:build linux

package msmcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"testing"
	"time"
)

func TestInvalidArgumentsNeverWriteProtocol(t *testing.T) {
	for _, args := range [][]string{nil, {"microsoft", "--account", " ", "--area", "mail"}, {"microsoft", "--account", "person@example.test", "--area", "all"}, {"microsoft", "--account", "person@example.test", "--area", "mail", "--extra"}} {
		var out, err bytes.Buffer
		if code := Command(args, bytes.NewReader(nil), &out, &err); code != 1 || out.Len() != 0 || !json.Valid(err.Bytes()) {
			t.Fatalf("code/output for %q: %d %q %q", args, code, out.String(), err.String())
		}
	}
}

func TestRelayProtocolAndEOF(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("relay requires a nonroot UID")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	ctx, cancel := context.WithCancel(context.Background())
	srv := NewServer(func(string) (Binding, error) { return Binding{}, errors.New("no native child in this test") }, Options{})
	served := make(chan error, 1)
	go func() { served <- srv.Serve(ctx, home) }()
	defer func() { cancel(); <-served }()
	in, input := io.Pipe()
	output, out := io.Pipe()
	defer in.Close()
	defer input.Close()
	defer output.Close()
	defer out.Close()
	var stderr bytes.Buffer
	done := make(chan int, 1)
	go func() {
		done <- Command([]string{"microsoft", "--account", "person@example.test", "--area", "mail"}, in, out, &stderr)
	}()
	answer := make(chan string, 1)
	go func() {
		_, _ = io.WriteString(input, "{\"jsonrpc\":\"2.0\",\"id\":7,\"method\":\"ping\"}\n")
		line, _ := bufio.NewReader(output).ReadString('\n')
		answer <- line
	}()
	select {
	case line := <-answer:
		var reply struct {
			ID     int       `json:"id"`
			Result *struct{} `json:"result"`
		}
		if json.Unmarshal([]byte(line), &reply) != nil || reply.ID != 7 || reply.Result == nil {
			t.Fatalf("protocol corrupted: %q", line)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no reply over own-UID socket")
	}
	input.Close()
	select {
	case code := <-done:
		if code != 0 || stderr.Len() != 0 {
			t.Fatalf("exit %d: %s", code, &stderr)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("relay did not exit on stdin EOF")
	}
	if srv.Running() != 0 {
		t.Fatal("ping started a native child")
	}
}
