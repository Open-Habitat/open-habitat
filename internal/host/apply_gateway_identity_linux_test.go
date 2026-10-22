//go:build linux

package host

import (
	"strings"
	"testing"
)

func TestGatewayIdentityIsExclusiveNotAdopted(t *testing.T) {
	s := Site{Gateway: Gateway{UID: 21003, GID: 21003}}
	passwd := []byte("root:x:0:0:root:/root:/bin/bash\nopen-habitat-gateway:x:21003:21003:gateway:/nonexistent:/usr/sbin/nologin\n")
	group := []byte("root:x:0:\nopen-habitat-gateway:x:21003:\n")
	for db, b := range map[string][]byte{"passwd": passwd, "group": group} {
		if e := gatewayNSSSafe(s, false, db, b); e != nil {
			t.Fatal("dedicated published identity refused", db, e)
		}
		if e := gatewayNSSSafe(s, true, db, b); e == nil {
			t.Fatal("fresh install adopted existing gateway", db)
		}
	}
	for label, c := range map[string]struct {
		db string
		b  []byte
	}{
		"supplementary person":     {"group", []byte("open-habitat-gateway:x:21003:foreign-person\n")},
		"primary person":           {"passwd", append(append([]byte{}, passwd...), []byte("foreign-person:x:22000:21003:person:/home/foreign-person:/bin/bash\n")...)},
		"gateway privileged group": {"group", append(append([]byte{}, group...), []byte("sudo:x:27:open-habitat-gateway\n")...)},
		"interactive account":      {"passwd", []byte(strings.ReplaceAll(string(passwd), "/nonexistent:/usr/sbin/nologin", "/home/service:/bin/bash"))},
		"gid alias":                {"group", append(append([]byte{}, group...), []byte("foreign-group:x:21003:\n")...)},
	} {
		t.Run(label, func(t *testing.T) {
			if e := gatewayNSSSafe(s, false, c.db, c.b); e == nil {
				t.Fatal("unsafe gateway identity accepted")
			}
		})
	}
}
