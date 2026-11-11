// Career: rank by block hours in the logbook of this device, with the ranks from va/ranks.json (set by the airline).
// A new rank shows a letter once (main.js).
import { S, logbook } from "./data.js";
import { t, loc } from "./i18n.js";
import { esc, store, dur } from "./util.js";

const blockOf = (e) => (e.onBlock && e.offBlock ? e.onBlock - e.offBlock : e.schedIn && e.schedOut ? e.schedIn - e.schedOut : 0);

export function career() {
  const ranks = (S.ranks?.ranks || []).filter((r) => r.name && r.hours != null).sort((a, b) => a.hours - b.hours);
  if (!ranks.length) return null;
  const list = logbook(), ms = list.reduce((s, e) => s + blockOf(e), 0), h = ms / 36e5;
  let i = 0; ranks.forEach((r, k) => { if (h >= r.hours) i = k; });
  const cur = ranks[i], nxt = ranks[i + 1];
  const pct = nxt ? Math.min(1, (h - cur.hours) / (nxt.hours - cur.hours)) : 1;
  return { i, rank: loc(cur.name), next: nxt ? loc(nxt.name) : "", ms, flights: list.length, pct, left: nxt ? (nxt.hours - h) * 36e5 : 0 };
}

export function careerHtml(c, big) {
  if (!c) return "";
  return `<div class="career${big ? " big" : ""}"><div class="row"><b>${esc(c.rank)}</b>${c.next ? `<span class="arr">→</span><span>${esc(c.next)}</span>` : ""}
    <span class="sp"></span><span class="dim num">${dur(c.ms)} h</span></div><div class="bar"><i style="width:${Math.round(c.pct * 100)}%"></i></div>
    ${big ? `<div class="dim" style="font-size:12.5px;margin-top:6px">${c.next ? t("{t} block time to {rank}", { t: dur(c.left), rank: c.next }) : t("Highest rank reached")} · ${t(c.flights === 1 ? "{n} flight" : "{n} flights", { n: c.flights })}</div>` : ""}</div>`;
}

// true once when the rank went up since the last look
export function promoted(c) {
  if (!c) return false;
  const was = store.get("asl.rank", null);
  store.set("asl.rank", c.i);
  return was != null && c.i > was;
}
