import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const ROOT = "/home/user/asl-pad", OUT = process.argv[2], GROUND = process.argv[3]; const { chromium } = createRequire(import.meta.url)("playwright");
const T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": T[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }).listen(0);
const base = `http://localhost:${srv.address().port}/`;
const errs = []; const b = await chromium.launch();
async function shot(q, name, fn) {
  const page = await (await b.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
  page.on("pageerror", (e) => errs.push(name + ": " + e.message)); page.on("console", (m) => { if (m.type() === "error" && !/Failed to load/.test(m.text())) errs.push(name + ": " + m.text()); });
  await page.route("**/*", (r) => { const u = r.request().url();
    if (GROUND && /asl-pad\/ground\/ground\/LYBE\.json/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", body: fs.readFileSync(GROUND) });
    return u.startsWith(base) || /raw\.githubusercontent\.com\/sbelic95\/vdgs-slot-board\//.test(u) ? r.continue() : r.abort(); });
  await page.goto(base + "x.txt"); await page.evaluate(() => { localStorage.setItem("asl.lang", '"en"'); localStorage.setItem("asl.seen", '"1.5"'); });
  await page.goto(base + q); await page.waitForTimeout(2500);
  if (fn) await fn(page);
  await page.screenshot({ path: `${OUT}/${name}.png` }); await page.context().close();
}
const tabs = process.argv[4] ? process.argv[4].split(",") : ["brief", "stands", "map"];
for (const tb of tabs) await shot(`?demo=ground&app=apt&tab=${tb}`, "apt-" + tb, tb === "brief" ? async (p) => {} : null);
if (tabs.includes("map")) await shot(`?demo&app=apt&tab=map`, "apt-map-arr", async (p) => { await p.click('[data-apt="LYBE"]').catch(() => {}); await p.click('[data-mode="arr"]').catch(() => {}); await p.waitForTimeout(800); });
console.log("errors:", errs); await b.close(); srv.close();
