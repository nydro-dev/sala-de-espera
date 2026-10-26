// Guarda a app para funcionar offline. Sobe a versão a cada publicação (sala-v5 → sala-v6).
const VERSION = "sala-v5";
const CORE = [
  "./", "index.html", "manifest.webmanifest",
  "css/base.css", "js/core.js", "js/app.js", "js/games/sudoku.js", "js/games/minas.js",
  "js/games/casino.js", "js/games/blackjack.js", "js/games/roleta.js",
  "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"
];

self.addEventListener("install", e => {
  // "reload" evita apanhar cópias antigas da cache HTTP do browser.
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Página: rede primeiro (para receber atualizações), cópia guardada se estiver offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put("index.html", copy)); }
        return res;
      }).catch(() => caches.match("index.html"))
    );
    return;
  }

  // Ficheiros da app: responde com a cópia guardada e atualiza-a em segundo plano.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // Fontes do Google: cópia guardada primeiro, rede depois.
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
