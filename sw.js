// Guarda a app para funcionar offline. Sobe a versão a cada publicação (sala-v18 → sala-v19).
const VERSION = "sala-v18";
const CORE = [
  "./", "index.html", "privacidade.html", "manifest.webmanifest",
  "css/base.css", "js/logic/base.js", "js/logic/sudoku.js", "js/logic/minas.js", "js/logic/dobra.js", "js/logic/solitario.js", "js/logic/palavras.js",
  "js/core.js", "js/backup.js", "js/mudanca.js", "js/menu-art.js", "js/app.js", "js/games/sudoku.js", "js/games/minas.js",
  "js/games/dobra.js", "js/games/palavras.js", "js/data/validas.js", "js/data/solucoes.js",
  "js/data/validas-4.js", "js/data/solucoes-4.js", "js/data/validas-6.js", "js/data/solucoes-6.js", "js/data/validas-7.js", "js/data/solucoes-7.js",
  "js/games/casino.js", "js/games/blackjack.js", "js/games/roleta.js",
  "js/games/solitario.js", "js/games/cobra.js",
  "fonts/roboto-400.woff2", "fonts/roboto-500.woff2", "fonts/roboto-700.woff2", "fonts/roboto-900.woff2",
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

// A página pergunta a versão em uso (aparece nas definições).
self.addEventListener("message", e => {
  if (e.data === "version" && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // O servidor (/api) nunca passa pela cache.
  if (url.pathname.startsWith("/api/")) return;

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
});
