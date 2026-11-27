// Offline shell: the pad's own files come from the network first (so an update is there at once)
// and from the cache when there is no network (or it takes longer than 4 s).
// Live data (SimBrief, VATSIM, weather, map tiles) always goes to the network.
const CACHE = "asl-pad-v24";
const SHELL = ["./", "index.html", "css/pad.css", "vendor/fonts.css", "vendor/leaflet.css", "vendor/leaflet.js", "vendor/world.json", "airports.json", "manifest.webmanifest", "icons/icon.svg",
  "js/main.js", "js/util.js", "js/data.js", "js/ofp.js", "js/wx.js", "js/flight.js", "js/stands.js", "js/demo.js", "js/i18n.js", "js/i18n-dict.js", "js/icons.js",
  "js/actions.js", "js/units.js", "js/tz.js", "js/lock.js", "js/home.js", "js/sheet.js", "js/wall.js", "js/whatsnew.js", "js/career.js", "js/booking.js", "js/atc.js", "js/hoppie.js", "js/apps/radio.js", "js/apps/cabin.js", "js/apps/downloads.js", "js/ground.js", "js/cold.js", "js/sigmet.js", "js/apps/airport.js", "js/apps/fly.js", "js/apps/map.js", "js/apps/perf.js", "js/apps/ops.js", "js/apps/log.js", "js/apps/settings.js",
  "js/notify.js", "js/device.js", "js/crew.js", "js/apps/radar.js", "js/apps/weather.js", "js/apps/clock.js", "js/apps/calc.js", "js/apps/calendar.js", "js/apps/kneeboard.js", "js/apps/manuals.js", "js/apps/store.js", "js/sync.js", "js/apps/vdgs.js", "js/frame.js", "css/apps.css", "js/apps/mail.js", "js/apps/messages.js", "js/apps/academy.js", "js/apps/reference.js", "js/apps/photos.js", "js/apps/browser.js", "js/apps/scenery.js", "js/apps/news.js", "js/sim.js", "js/apps/turnaround.js", "js/apps/fenix.js", "js/fleet.js", "js/apps/checklist.js", "js/apps/landing.js", "js/account.js", "js/sound.js", "js/wake.js", "js/alerts.js", "va/checklists.json", "ctaf-us.json", "va/asl-stands.json", "va/landing.json"];

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
