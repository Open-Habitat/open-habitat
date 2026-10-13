//go:build linux

package daemon

import "net/http"

// A read-only probe for histories without a daemon handle. It does not reserve
// continuation: the POST repeats admission while holding the ownership fence.
func (c *ConversationController) historyEligibility(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	process, continuation := "unknown", "unproven"
	histories, err := nativeSessions(c.nativeCfg())
	if err == nil {
		seen := false
		for _, h := range histories {
			if h.id != id {
				continue
			}
			if seen || h.state != "readable" {
				process = "unknown"
				break
			}
			seen = true
			process = c.piWriter(h.path, h.cwd)
		}
	}
	if release, ok := c.proofPermit(r.Context()); ok {
		defer release()
		owner, _, ws, _, _, _, proof := c.continuationProof(id)
		if ws != nil {
			_ = ws.Close()
		}
		if owner != nil {
			_ = owner.release()
		}
		if proof != "source_unavailable" {
			continuation = proof
		}
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "process": process, "continuation": continuation})
}
