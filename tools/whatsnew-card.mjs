// Renders the update graphic (tools/whatsnew-card.html) to a PNG for Discord, 1920x1080.
//   node tools/whatsnew-card.mjs            Serbian, saved as whatsnew-sr.png
//   node tools/whatsnew-card.mjs de out.png German, saved as out.png
//   node tools/whatsnew-card.mjs sr out.png --logo ~/airserbia-logo.png   with the Air Serbia logo from a file (PNG, SVG or JPG; turn a PDF into PNG first)
// Without --logo the logo is loaded from pics.avs.io at render time, as in the pad. The logo never goes into the repo.
// Needs Playwright with Chromium, like tests/smoke.mjs. Do not commit the PNG.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), li = args.indexOf("--logo");
const logo = li >= 0 ? path.resolve(args.splice(li, 2)[1]) : null;
const lang = args[0] || "sr", out = path.resolve(args[1] || `whatsnew-${lang}.png`);
const { chromium } = createRequire(import.meta.url)("playwright");
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if (p === "/__logo" && logo) { r.writeHead(200, { "content-type": TYPES[path.extname(logo).toLowerCase()] || "application/octet-stream" }); fs.createReadStream(logo).pipe(r); return; }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, serviceWorkers: "block" })).newPage();
// only the pad, the VDGS stand data and the logo; live services stay offline (the previews use the test flight)
await page.route("**/*", (r) => (r.request().url().startsWith(base) || /raw\.githubusercontent\.com\/sbelic95\/vdgs-slot-board\/|pics\.avs\.io\//.test(r.request().url()) ? r.continue() : r.abort()));
await page.goto(`${base}tools/whatsnew-card.html?lang=${lang}${logo ? "&logo=/__logo" : ""}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
await b.close(); server.close();
console.log("saved", out);
