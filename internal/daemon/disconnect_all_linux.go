//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// DisconnectAllPath is the gateway's own request, before a person's removal
// (ADR 0037, section 4), to disconnect everything the person connected. The
// gateway builds it after its administrator check and never proxies it from
// a browser; it is never mounted on the agent listener. The daemon acts as
// the person with the person's own credentials only, and answers with counts
// per provider, never an account name, address or token. Repeating it finds
// nothing left and is harmless. gh is left alone: revoking the Habitat OAuth
// app's token needs the app's client secret, and its only copy goes with the
// home.
const DisconnectAllPath = "/internal/v1/account/disconnect-all"

// disconnectAllDeadline bounds the whole request; the gateway waits a
// little longer.
const disconnectAllDeadline = 100 * time.Second

type disconnectAllReply struct {
	SchemaVersion int                            `json:"schema_version"`
	Providers     []integrations.DisconnectCount `json:"providers"`
}

func DisconnectAllHandler(cfg transport.Config, trusted func(*http.Request) bool, catalog *integrations.Catalog, machines ownMachineEnv) http.Handler {
	return disconnectAllHandler(cfg, trusted, catalog.DisconnectAll, machines.logout)
}

func disconnectAllHandler(cfg transport.Config, trusted func(*http.Request) bool, catalog func(context.Context) []integrations.DisconnectCount, tailnet func(context.Context) string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != DisconnectAllPath || r.URL.RawQuery != "" {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int `json:"schema_version"`
		}
		decoder := json.NewDecoder(io.LimitReader(r.Body, 257))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil || decoder.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		// The work finishes on its own deadline even if the gateway leaves:
		// a half-disconnected person is worse than a late answer.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), disconnectAllDeadline)
		defer cancel()
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(disconnectAllDeadline + 5*time.Second))
		reply := disconnectAllReply{SchemaVersion: 1, Providers: []integrations.DisconnectCount{}}
		if catalog != nil {
			reply.Providers = append(reply.Providers, catalog(ctx)...)
		}
		if tailnet != nil {
			switch tailnet(ctx) {
			case integrations.DisconnectRevoked:
				reply.Providers = append(reply.Providers, integrations.DisconnectCount{Provider: "tailscale", Revoked: 1})
			case integrations.DisconnectFailed:
				reply.Providers = append(reply.Providers, integrations.DisconnectCount{Provider: "tailscale", Failed: 1})
			}
		}
		w.Header().Set("Cache-Control", "no-store")
		historyJSON(w, reply)
	})
}
