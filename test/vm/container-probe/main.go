// A synthetic, static guest image entrypoint. No shell, network fetch or secrets.
package main

import (
	"fmt"
	"net/http"
	"os"
)

func main() {
	if err := os.WriteFile("/data/owned", []byte("synthetic\n"), 0600); err != nil {
		panic(err)
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, "fixture uid=%d\n", os.Getuid()) })
	if err := http.ListenAndServe(":8080", nil); err != nil {
		panic(err)
	}
}
