// Offline shell: the pad's own files come from the network first (so an update is there at once)
// and from the cache when there is no network (or it takes longer than 4 s).
// Live data (SimBrief, VATSIM, weather, map tiles) always goes to the network.
const CACHE = "asl-pad-v12";
const SHELL = ["./", "index.html", "css/pad.css", "vendor/fonts.css", "vendor/leaflet.css", "vendor/leaflet.js", "airports.json", "manifest.webmanifest", "icons/icon.svg",
  "js/main.js", "js/util.js", "js/data.js", "js/ofp.js", "js/wx.js", "js/flight.js", "js/stands.js", "js/demo.js", "js/i18n.js", "js/i18n-dict.js", "js/icons.js",
  "js/actions.js", "js/units.js", "js/tz.js", "js/lock.js", "js/home.js", "js/sheet.js", "js/wall.js", "js/whatsnew.js", "js/career.js", "js/apps/downloads.js", "js/ground.js", "js/cold.js", "js/sigmet.js", "js/apps/airport.js", "js/apps/fly.js", "js/apps/map.js", "js/apps/perf.js", "js/apps/ops.js", "js/apps/log.js", "js/apps/settings.js"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(e.request, { cache: "no-cache" }).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; });
    net.catch(() => {});
    const slow = new Promise((ok) => setTimeout(ok, 4000));
    try {
      const r = await Promise.race([net, slow]);
      if (r) return r;
    } catch {}
    return (await c.match(e.request, { ignoreSearch: true })) || net;
  })());
});
