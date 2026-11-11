// Renders the update graphic (tools/whatsnew-card.html) to a PNG for Discord, 1920x1080.
//   node tools/whatsnew-card.mjs            Serbian, saved as whatsnew-sr.png
//   node tools/whatsnew-card.mjs de out.png German, saved as out.png
// Needs Playwright with Chromium, like tests/smoke.mjs. Do not commit the PNG.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lang = process.argv[2] || "sr", out = path.resolve(process.argv[3] || `whatsnew-${lang}.png`);
const { chromium } = createRequire(import.meta.url)("playwright");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: "block" })).newPage();
// only the pad and the VDGS stand data; live services stay offline (the previews use the test flight)
await page.route("**/*", (r) => (r.request().url().startsWith(base) || /raw\.githubusercontent\.com\/sbelic95\/vdgs-slot-board\//.test(r.request().url()) ? r.continue() : r.abort()));
await page.goto(`${base}tools/whatsnew-card.html?lang=${lang}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
await b.close(); server.close();
console.log("saved", out);
