package server

import (
	"embed"
	"net/http"
)

// The two design files, served as-is: console.html (operator) and portal.html (customer).
//
//go:embed pages/*.html
var pages embed.FS

func page(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := pages.ReadFile(name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(b)
	}
}
