// Downloads: links the airline keeps in va/downloads.json (ACARS, liveries, planning), and every update of the pad.
import { S } from "../data.js";
import { t, loc } from "../i18n.js";
import { esc } from "../util.js";
import { releases, relDate, groupsHtml } from "../whatsnew.js";

export const name = "Downloads";
export const tabs = [["dl", "Downloads"], ["changes", "Changes"]];

export function render(body, ctx) {
  body.innerHTML = ctx.tab === "changes" ? changes() : downloads();
}
export function summary() {
  const n = (S.downloads?.sections || []).reduce((s, x) => s + (x.items || []).length, 0);
  return [t("Downloads"), t("{n} links of the airline", { n })];
}

function downloads() {
  const secs = S.downloads?.sections || [];
  if (!secs.length) return `<div class="empty">${t("Loading the downloads of the airline…")}</div>`;
  return `<div class="dl-wrap">${secs.map((sec) => `<div class="card"><div class="lbl" style="margin-bottom:6px">${esc(loc(sec.title))}</div>
    ${(sec.items || []).filter((i) => /^https?:\/\//.test(i.url || "")).map((i) => `<a class="dl-row" href="${esc(i.url)}" target="_blank" rel="noopener">
      <div class="tx"><b>${esc(loc(i.title))}${i.tag ? ` <span class="pill warn">${esc(loc(i.tag))}</span>` : ""}</b><span class="dim">${esc(loc(i.text))}</span></div>
      <span class="host">${esc(new URL(i.url).hostname.replace(/^www\./, ""))} ↗</span></a>`).join("")}</div>`).join("")}
    <p class="dim" style="font-size:12.5px;margin:4px 2px">${t("The airline keeps this list up to date.")}</p></div>`;
}

function changes() {
  return releases().map((r) => `<div class="card" style="margin-bottom:14px"><div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">
    <b style="font:700 22px var(--f-cond)">ASL Pad ${esc(r.v)}</b><span class="dim">${esc(relDate(r))}</span></div><div class="wn-grid" style="padding:0">${groupsHtml(r)}</div></div>`).join("");
}
