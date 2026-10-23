package gateway

import "net/http"

// Browser HTTPS requests can negotiate HTTP/2. The daemon hop is independently
// serialized as HTTP/1.1; its strict wire-framing checks do not constrain ALPN
// on the browser hop. Body, method and origin checks stay at each route.
func browserHTTP(r *http.Request) bool {
	return r.ProtoMajor == 1 && r.ProtoMinor == 1 || r.ProtoMajor == 2 && r.ProtoMinor == 0
}
