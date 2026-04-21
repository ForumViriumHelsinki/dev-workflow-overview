// Package web embeds the compiled frontend bundle so the aggregator
// can serve the UI and API from the same origin (PRD-002 §4.2 /
// ADR D-static.a). The bundle is produced by `bun run build` at the
// repo root and copied into `aggregator/internal/web/dist/` by the
// Dockerfile before `go build`.
//
// Local `go run` paths use the stub index.html checked into the repo
// — operators who want the real bundle locally should copy `dist/*`
// into this directory before running.
package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed dist
var distFS embed.FS

// FS returns the embedded frontend bundle rooted at dist/ (i.e. so
// FS().Open("index.html") works without a "dist/" prefix).
func FS() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		// embed paths are checked at compile time; any error here
		// indicates the directory layout has drifted, which is a
		// programming error and should surface immediately.
		panic("web: dist subtree missing: " + err.Error())
	}
	return sub
}

// Handler returns an http.Handler that serves the embedded bundle with
// an SPA-style fallback: requests that don't map to an existing file
// are served the root index.html so the static site's router (if any)
// can handle them client-side. For this project the site is a single
// HTML document, so the fallback is effectively a 200 on every path
// below /api.
func Handler() http.Handler {
	root := FS()
	fileServer := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip leading slash to test against the fs root.
		p := r.URL.Path
		if p == "/" || p == "" {
			serveIndex(w, r, root)
			return
		}
		// Does the requested path exist in the bundle?
		name := p
		if len(name) > 0 && name[0] == '/' {
			name = name[1:]
		}
		f, err := root.Open(name)
		if err != nil {
			serveIndex(w, r, root)
			return
		}
		_ = f.Close()
		fileServer.ServeHTTP(w, r)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, root fs.FS) {
	f, err := root.Open("index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	rs, ok := f.(interface {
		Seek(offset int64, whence int) (int64, error)
		Read(p []byte) (n int, err error)
	})
	if !ok {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, "index.html", st.ModTime(), rs)
}
