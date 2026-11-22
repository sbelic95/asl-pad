// News: short flight-sim news from public feeds (add-ons, sceneries, platforms), gathered every hour by the workflow
// sim-news.yml into news.json on the "news" branch. Every story names and links its source; the pad shows only the
// headline and a short teaser – the article is read at the source. Independent feed, not written by the VA.
import { t, LOCALE } from "../i18n.js";
import { esc, store, getJSON } from "../util.js";
import { notify } from "../notify.js";

export const name = "News";
export const tabs = [];
export const NEWS_URL = "https://raw.githubusercontent.com/sbelic95/asl-pad/news/news.json";
let N = store.get("asl.news", null), busy = false, at = 0, src = "";
const seen = () => new Set(store.get("asl.news.seen", []));
export async function pollNews(force) {
  if (busy || (!force && Date.now() - at < 15 * 60e3)) return;
  busy = true; at = Date.now();
  try {
    const d = await getJSON(NEWS_URL + "?_=" + Math.floor(Date.now() / 6e5));
    if (d?.items) {
      const old = new Set((N?.items || []).map((x) => x.id)), fresh = N ? d.items.filter((x) => !old.has(x.id)) : [];
      N = d; store.set("asl.news", d);
      if (fresh.length) notify({ app: "news", ic: "info", lv: "info", title: t("News"), text: fresh[0].title + (fresh.length > 1 ? " " + t("(+{n} more)", { n: fresh.length - 1 }) : "") });
    }
  } catch { if (!N) N = { items: [] }; } // offline and nothing kept yet: show "no stories" instead of loading forever
  busy = false;
}
const when = (iso) => { const ts = Date.parse(iso); const m = Math.round((Date.now() - ts) / 6e4); return m < 60 ? t("{n} min ago", { n: Math.max(1, m) }) : m < 1440 ? t("{n} h ago", { n: Math.round(m / 60) }) : new Intl.DateTimeFormat(LOCALE(), { day: "2-digit", month: "short" }).format(ts); };

export function render(body, ctx) {
  pollNews().then(() => { if (body.isConnected && body._n !== N) ctx.changed("view"); });
  body._n = N;
  if (!body._nw) { body._nw = true; body.addEventListener("click", (e) => {
    const s = e.target.closest("[data-src]"); if (s) { src = s.dataset.src; ctx.changed("view"); return; }
    const a = e.target.closest("[data-story]"); if (a) { const r = seen(); r.add(a.dataset.story); store.set("asl.news.seen", [...r].slice(-400)); }
  }); }
  if (!N) { body.innerHTML = `<div class="empty">${t("Loading…")}</div>`; return; }
  const items = N.items || [], sources = [...new Set(items.map((x) => x.source))], r = seen();
  const list = items.filter((x) => !src || x.source === src);
  body.innerHTML = `<div class="nw-top"><div class="seg"><button data-src="" class="${src ? "" : "on"}">${t("All")}</button>${sources.map((s) => `<button data-src="${esc(s)}" class="${s === src ? "on" : ""}">${esc(s)}</button>`).join("")}</div></div>
    <div class="nw-list">${list.map((x) => `<a class="nw-i${r.has(x.id) ? " read" : ""}" href="${esc(x.link)}" target="_blank" rel="noopener" data-story="${esc(x.id)}">
      <div class="nw-meta"><span class="tag">${esc(x.source)}</span><span class="dim">${when(x.date)}</span></div><b>${esc(x.title)}</b>${x.text ? `<p>${esc(x.text)}</p>` : ""}<span class="nw-go">${t("Read at {s}", { s: x.source })} ↗</span></a>`).join("")
      || `<div class="empty">${t("No stories right now.")}</div>`}</div>
    <p class="dim nw-note">${t("Headlines from public flight-sim news sites, updated every hour. Not from Air Serbia Virtual.")}</p>`;
}
export function summary() { const n = (N?.items || []).filter((x) => !seen().has(x.id)).length; return [t("News"), n ? t("{n} new stories", { n }) : ""]; }
