//go:build linux

package daemon

import (
	"os/user"
	"reflect"
	"strconv"
	"testing"

	"github.com/maintainer/native-agent-host/internal/transport"
)

func TestProductionNativeHandoffHasKeyringEvidence(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, err := strconv.Atoi(u.Uid)
	if err != nil || uid <= 0 {
		t.Skip("requires nonroot mapped test UID")
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
	server, adapter, err := NewNativeHandoff(cfg)
	if err != nil || server == nil || adapter == nil {
		t.Fatalf("constructor: %v", err)
	}
	// No bus or credentials are accessed during construction; inspect only the
	// private evidence type to catch accidental removal of production wiring.
	field := reflect.ValueOf(adapter).Elem().FieldByName("evidence")
	if !field.IsValid() || field.IsNil() || field.Elem().Type().String() != "nativegh.secretServiceEvidence" {
		t.Fatal("production keyring inspector missing")
	}
}
