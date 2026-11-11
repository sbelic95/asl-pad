// Smoke test for ASL Pad: flight logic in Node, translations, then every app and tab in Chromium with the demo flight.
//   node tests/smoke.mjs                 run everything
//   node tests/smoke.mjs --shots out/    also save screenshots (iPad 1180x820)
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium) for the browser part.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shotsAt = process.argv.includes("--shots") ? path.resolve(process.argv[process.argv.indexOf("--shots") + 1] || "shots") : null;
let failed = 0;
const fail = (msg) => { failed++; console.log("FAIL", msg); };
const ok = (msg) => console.log("ok  ", msg);

// ---------- 1. flight logic: off block → take-off → fixes → landing → on block → logbook entry ----------
{
  const { normOfp } = await import(ROOT + "/js/ofp.js");
  const { demoSimbrief } = await import(ROOT + "/js/demo.js");
  const F = await import(ROOT + "/js/flight.js");
  const o = normOfp(demoSimbrief(true));
  const st = F.loadFlight(o), ev = [];
  let t = o.times.out - 5 * 60e3;
  const step = (lat, lon, gs, alt, dt = 15e3) => { t += dt; ev.push(...F.updateFlight(st, o, { latitude: lat, longitude: lon, groundspeed: gs, altitude: alt }, t)); };
  step(44.8199, 20.2918, 0, 335); step(44.8199, 20.2918, 8, 335); step(44.82, 20.30, 140, 400);
  for (let k = 1; k < o.navlog.length - 1; k++) step(o.navlog[k].pos[0], o.navlog[k].pos[1], 450, o.navlog[k].alt, 20 * 60e3);
  step(40.645, -73.78, 60, 30); for (let i = 0; i < 4; i++) step(40.644, -73.785, 0, 13);
  const want = ["offBlock", "takeoff", "landing", "onBlock"];
  want.every((e) => ev.includes(e)) ? ok("flight events " + ev.join(" ")) : fail("flight events " + ev.join(" "));
  Object.keys(st.fixTimes).length > 15 ? ok("fix passages recorded") : fail("fix passages " + Object.keys(st.fixTimes).length);
  const e = F.logEntry(st, o, F.fuelState(st, o, null));
  e.dep === "LYBE" && e.arr === "KJFK" && e.onBlock > e.offBlock ? ok("logbook entry") : fail("logbook entry");
  o.tlr?.to?.rwys?.length && o.tlr?.ldg?.dry?.vref ? ok("SimBrief runway analysis parsed") : fail("tlr missing in demo OFP");
}

// ---------- 2. translations: every t("…") text has Serbian and German ----------
{
  const { SR, DE } = await import(ROOT + "/js/i18n-dict.js");
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((f) => f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith(".js") && files.push(path.join(d, f.name)));
  walk(ROOT + "/js");
  const keys = new Set();
  for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
  const brand = new Set(["ASL Fly", "ASL Ops", "VDGS"]);
  for (const [n, D] of [["SR", SR], ["DE", DE]]) {
    const miss = [...keys].filter((k) => !(k in D) && !brand.has(k));
    miss.length ? fail(`${n} missing: ${miss.join(" | ")}`) : ok(`${n} translations complete (${keys.size} texts)`);
    const bad = Object.entries(D).filter(([k, v]) => (k.match(/\{\w+\}/g) || []).sort().join() !== (v.match(/\{\w+\}/g) || []).sort().join());
    if (bad.length) fail(`${n} placeholders differ: ${bad.map((b) => b[0]).join(" | ")}`);
  }
}

// ---------- 3. browser: all apps and tabs, demo in the air and at the gate, three languages ----------
let chromium;
try { ({ chromium } = createRequire(import.meta.url)("playwright")); } catch { console.log("skip browser test: Playwright not installed"); }
if (chromium) {
  const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
  const server = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
  }).listen(0);
  const base = `http://localhost:${server.address().port}/`;
  if (shotsAt) fs.mkdirSync(shotsAt, { recursive: true });
  const b = await chromium.launch();
  const runs = [["air", "?demo"], ["ground", "?demo=ground"], ["sr", "?demo&lang=sr"], ["de", "?demo=ground&lang=de"]];
  const views = [["fly", "overview"], ["fly", "times"], ["fly", "plan"], ["fly", "map"], ["fly", "wx"], ["fly", "fuel"], ["fly", "perf"], ["ops", "ops"], ["ops", "fleet"], ["log"], ["downloads", "dl"], ["downloads", "changes"], ["settings"]];
  for (const [name, q] of runs) {
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: "block" });
    const page = await ctx.newPage(), errs = [];
    page.on("pageerror", (e) => errs.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    // only the pad itself and the VDGS stand/runway data; map tiles, logo and live services stay offline
    await page.route("**/*", (r) => (r.request().url().startsWith(base) || /raw\.githubusercontent\.com\/sbelic95\/vdgs-slot-board\//.test(r.request().url()) ? r.continue() : r.abort()));
    await page.goto(base + q); await page.waitForTimeout(1500);
    if (shotsAt) await page.screenshot({ path: `${shotsAt}/${name}-lock.png` });
    for (const [app, tab] of views) {
      await page.evaluate(([a, t]) => window.ASL.openApp(a, t), [app, tab]); await page.waitForTimeout(app === "fly" && tab === "map" ? 900 : 300);
      const text = await page.evaluate((a) => document.getElementById("app-" + a)?.querySelector(".app-body")?.innerText || "", app);
      if (text.trim().length < 20) errs.push(`${app}/${tab || ""} is empty`);
      if (shotsAt) await page.screenshot({ path: `${shotsAt}/${name}-${app}${tab ? "-" + tab : ""}.png` });
    }
    // real clicks in Settings: a button must change its setting (all clicks once went to the wallpaper)
    await page.evaluate(() => window.ASL.openApp("settings")); await page.waitForTimeout(300);
    await page.click('#app-settings [data-seg="unit"][data-v="lb"]'); await page.waitForTimeout(150);
    await page.click('#app-settings [data-wp="dusk"]'); await page.waitForTimeout(150);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("asl.settings") || "{}"));
    if (saved.unit !== "lb" || saved.wall !== "dusk") errs.push(`settings clicks not saved: unit ${saved.unit}, wall ${saved.wall}`);
    if (saved.demo) errs.push("demo from the URL was saved");
    await page.click("#homebar"); await page.waitForTimeout(80); await page.click("#homebar"); await page.waitForTimeout(500);
    if (!(await page.$("#switcher:not(.gone) .sw-card"))) errs.push("app switcher did not open");
    errs.length ? fail(`${name}: ${errs.join(" | ")}`) : ok(`${name}: all apps and tabs`);
    await ctx.close();
  }
  await b.close(); server.close();
}
console.log(failed ? `\n${failed} failed` : "\nall good");
process.exit(failed ? 1 : 0);
