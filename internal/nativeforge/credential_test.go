package nativeforge

import (
	"strings"
	"testing"
)

func TestParseCredentialRequest(t *testing.T) {
	req, err := ParseCredentialRequest(strings.NewReader("capability[]=authtype\nprotocol=https\nhost=git.example.org:3000\npath=o/r.git\nusername=bob\nwwwauth[]=Basic realm=x\n\nignored=after-blank\n"))
	if err != nil || req != (CredentialRequest{Protocol: "https", Host: "git.example.org:3000", Path: "o/r.git", Username: "bob"}) {
		t.Fatalf("%+v %v", req, err)
	}
	for _, in := range []string{
		"protocol=https\nprotocol=http\n",
		"host=a\nhost=b\n",
		"url=https://git.example.org/o/r.git\n",
		"protocol=https\x00\n",
		"novalue\n",
		"path=" + strings.Repeat("a", maxRequestLine) + "\n",
		strings.Repeat("capability[]=x\n", maxRequest/10),
	} {
		if _, err := ParseCredentialRequest(strings.NewReader(in)); err != ErrInvalidRequest {
			t.Errorf("%.40q accepted: %v", in, err)
		}
	}
}
