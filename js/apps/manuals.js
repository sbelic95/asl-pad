// Manuals: the airline's documents as links only (va/manuals.json – the repo is public, so no PDFs in it), with search.
// Opening the app asks for Face ID like a real crew pad (played, see main.js).
import { S } from "../data.js";
import { t, loc } from "../i18n.js";
import { esc, getJSON } from "../util.js";

export const name = "Manuals";
export const tabs = [];
let M = null, q = "", busy = false;
async function load(C) { if (busy || M) return; busy = true; try { M = await getJSON("va/manuals.json"); } catch { M = { sections: [] }; } busy = false; C.changed("view"); }
export function render(body, ctx) {
  load(ctx);
  if (!body._man) { body._man = true; body.addEventListener("input", (e) => { if (e.target.matches(".man-q")) { q = e.target.value.trim().toLowerCase(); draw(body); } }); }
  if (!body.querySelector(".man-q")) body.innerHTML = `<div class="man-top"><input class="man-q" type="search" placeholder="${t("Search manuals")}" value="${esc(q)}"></div><div class="man-list"></div>`;
  draw(body);
}
function draw(body) {
  const el = body.querySelector(".man-list"); if (!el) return;
  if (!M) { el.innerHTML = `<div class="dim">${t("Loading…")}</div>`; return; }
  const hit = (i) => !q || [loc(i.title), loc(i.text), i.type, i.tag && loc(i.tag)].join(" ").toLowerCase().includes(q);
  el.innerHTML = (M.sections || []).map((s) => { const items = (s.items || []).filter(hit);
    if (!items.length && q) return "";
    return `<div class="card"><div class="lbl" style="margin-bottom:8px">${esc(loc(s.title))}</div>${items.map((i) => `<a class="man-i" href="${esc(i.url)}" target="_blank" rel="noopener"><span class="ic">📘</span><div><b>${esc(loc(i.title))}</b>${i.text ? `<small>${esc(loc(i.text))}</small>` : ""}</div>${i.type ? `<span class="tag">${esc(i.type)}</span>` : ""}${i.tag ? `<span class="tag">${esc(loc(i.tag))}</span>` : ""}<span class="go">↗</span></a>`).join("")
      || `<div class="dim" style="font-size:13px">${t("The airline's documents will appear here once the VA management adds them.")}</div>`}</div>`; }).join("") || `<div class="empty">${t("Nothing found.")}</div>`;
}
export function summary() { return [t("Manuals"), M ? t("{n} documents", { n: (M.sections || []).reduce((n, s) => n + (s.items || []).length, 0) }) : ""]; }
