package gateway

import (
	"bytes"
	"strconv"
	"strings"
	"testing"

	"golang.org/x/text/encoding/unicode"
)

func TestViewHTMLBootstrapUTF16(t *testing.T) {
	for _, endian := range []unicode.Endianness{unicode.LittleEndian, unicode.BigEndian} {
		input := "<!doctype html><html><body>å漢🙂</body></html>"
		encoded, err := unicode.UTF16(endian, unicode.UseBOM).NewEncoder().Bytes([]byte(input))
		if err != nil {
			t.Fatal(err)
		}
		var out bytes.Buffer
		writeViewHTML(&out, bytes.NewReader(encoded), "<script></script>")
		if out.String() != "<!doctype html><script></script><html><body>å漢🙂</body></html>" {
			t.Fatalf("UTF-16 lost its encoding or doctype: %q", out.String())
		}
	}
}

func TestViewHTMLBootstrapBeforeOversizedComment(t *testing.T) {
	comment := "<!--" + strings.Repeat("x", 200<<10) + "-->"
	input := "<!doctype html>" + comment + "<body>view</body>"
	var out bytes.Buffer
	writeViewHTML(&out, strings.NewReader(input), "<script></script>")
	if out.String() != "<!doctype html><script></script>"+comment+"<body>view</body>" {
		t.Fatal("bootstrap inserted inside comment or export bytes changed")
	}
}

func TestViewHTMLBootstrap(t *testing.T) {
	for i, input := range []string{
		"<!doctype html><html><body>view</body></html>",
		"<!--comment--><!DOCTYPE HTML PUBLIC \"legacy\"><html></html>",
		"<iframe src='part.html'></iframe>",
		"\ufeff<!doctype html><html></html>",
		"<!--" + strings.Repeat("x", 200<<10),
		"plain text", "", "<!--unclosed", "<script>location.href='/other'</script>",
	} {
		t.Run(strconv.Itoa(i), func(t *testing.T) {
			var out bytes.Buffer
			bootstrap := viewBootstrap("https://app.example")
			writeViewHTML(&out, strings.NewReader(input), bootstrap)
			if got := strings.Replace(out.String(), bootstrap, "", 1); got != input {
				t.Fatalf("export bytes changed: %q != %q", got, input)
			}
			if strings.HasPrefix(input, "\ufeff<!doctype html>") && !strings.HasPrefix(out.String(), "\ufeff<!doctype html>") {
				t.Fatal("BOM or doctype moved")
			}
			if out.Len() != len(input)+len(bootstrap) {
				t.Fatal("wrong content length")
			}
			if strings.HasPrefix(input, "<!doctype") && !strings.HasPrefix(out.String(), "<!doctype html>") {
				t.Fatal("doctype moved")
			}
			if strings.HasPrefix(input, "<iframe") && !strings.HasPrefix(out.String(), bootstrap) {
				t.Fatal("bootstrap missed early frame")
			}
		})
	}
}
