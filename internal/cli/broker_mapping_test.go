package cli

import (
	"errors"
	"testing"

	"github.com/maintainer/native-agent-host/internal/gateway"
	"github.com/maintainer/native-agent-host/internal/provision"
)

func TestMapBrokerReply(t *testing.T) {
	for _, tc := range []struct {
		name        string
		reply       provision.Reply
		err         error
		want        gateway.BrokerFailure
		unavailable bool
	}{
		{"transport", provision.Reply{}, errors.New("private transport details"), gateway.BrokerTransport, true},
		{"state", provision.Reply{Failure: provision.StateUnavailable}, nil, gateway.BrokerStateUnavailable, true},
		{"denied", provision.Reply{Failure: provision.Denied}, nil, gateway.BrokerDenied, false},
		{"name", provision.Reply{Failure: provision.NameCollision}, nil, gateway.BrokerNameCollision, false},
		{"drift", provision.Reply{Failure: provision.Drift}, nil, gateway.BrokerDrift, false},
		{"invalid", provision.Reply{Failure: provision.Invalid}, nil, gateway.BrokerInvalidRequest, false},
		{"missing route", provision.Reply{}, nil, gateway.BrokerInvalidReply, false},
		{"unknown", provision.Reply{Failure: provision.Failure("private reply text")}, nil, gateway.BrokerInvalidReply, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, err := mapBrokerReply(tc.reply, tc.err)
			if err != tc.want || errors.Is(err, gateway.ErrBrokerUnavailable) != tc.unavailable || err.Error() == "private transport details" || err.Error() == "private reply text" {
				t.Fatalf("classification: %v", err)
			}
		})
	}
	route, err := mapBrokerReply(provision.Reply{Route: &provision.Route{UID: 1001, Username: "synthetic", Socket: "/private"}, Generation: 2, Epoch: 1}, nil)
	if err != nil || route.Route.UID != 1001 || route.Generation != 2 || route.Epoch != 1 {
		t.Fatalf("valid reply: %+v %v", route, err)
	}
}
