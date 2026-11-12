// Service worker do app instalável. NÃO guarda dados do hotel: tudo vem
// sempre do servidor. Só mostra uma página amigável quando o aparelho
// perde a conexão com o servidor.
const CACHE = "hotel-offline-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icone.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // o resto segue direto para a rede
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
