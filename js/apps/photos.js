// Photos: the pilot's own screenshots from the simulator, kept only on this device. Each picture is shrunk to at most
// 1600 px and tagged with the flight that was loaded when it was added. Pictures are too big for localStorage, so they
// live in IndexedDB (database "asl.photos"); nothing is uploaded anywhere.
import { S } from "../data.js";
import { t, LOCALE } from "../i18n.js";
import { esc } from "../util.js";

export const name = "Photos";
export const tabs = [["all", "Library"], ["flights", "By flight"]];
let db = null, list = null, view = null, busy = false;
const open = () => db || (db = new Promise((ok, no) => { const r = indexedDB.open("asl.photos", 1); r.onupgradeneeded = () => r.result.createObjectStore("p", { keyPath: "id" }); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
const tx = async (mode, fn) => { const d = await open(); return new Promise((ok, no) => { const s = d.transaction("p", mode).objectStore("p"); const r = fn(s); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }); };
async function load(C) { if (busy) return; busy = true; try { list = (await tx("readonly", (s) => s.getAll())).sort((a, b) => b.at - a.at); } catch { list = []; } busy = false; C.changed("view"); }
function shrink(file) {
  return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); c.toBlob((b) => (b ? ok(b) : no()), "image/jpeg", 0.85); };
    img.onerror = no; img.src = URL.createObjectURL(file); });
}
const urls = new Map(); const url = (p) => urls.get(p.id) || (urls.set(p.id, URL.createObjectURL(p.blob)), urls.get(p.id));
const flightOf = () => (S.ofp ? `${S.ofp.callsign} ${S.ofp.dep?.icao || ""}–${S.ofp.dest?.icao || ""}` : "");

export function render(body, ctx) {
  if (list == null) load(ctx);
  if (!body._ph) { body._ph = true;
    body.addEventListener("change", async (e) => { if (!e.target.matches(".ph-file")) return; const fl = flightOf();
      for (const f of e.target.files) { try { const blob = await shrink(f); await tx("readwrite", (s) => s.put({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), at: f.lastModified || Date.now(), flight: fl, blob })); } catch {} }
      e.target.value = ""; list = null; load(ctx); ctx.toast({ lv: "ok", ic: "check", title: t("Added to Photos") }); });
    body.addEventListener("click", async (e) => {
      const p = e.target.closest("[data-ph]"); if (p) { view = p.dataset.ph; ctx.changed("view"); return; }
      if (e.target.closest("[data-ph-close]")) { view = null; ctx.changed("view"); return; }
      const d = e.target.closest("[data-ph-del]"); if (d) { await tx("readwrite", (s) => s.delete(d.dataset.phDel)); view = null; list = null; load(ctx); }
    });
  }
  const add = `<label class="btn pri ph-add">${t("Add screenshots")}<input class="ph-file" type="file" accept="image/*" multiple hidden></label>`;
  if (list == null) { body.innerHTML = `<div class="dim">${t("Loading…")}</div>`; return; }
  const cur = list.find((x) => x.id === view);
  if (cur) { body.innerHTML = `<div class="ph-view"><img src="${url(cur)}" alt=""><div class="ph-bar"><span>${esc(cur.flight || "")} · ${new Intl.DateTimeFormat(LOCALE(), { dateStyle: "medium", timeStyle: "short" }).format(cur.at)}</span><span class="sp"></span><button class="btn small" data-ph-del="${esc(cur.id)}">${t("Delete")}</button><button class="btn small pri" data-ph-close>${t("Close")}</button></div></div>`; return; }
  if (!list.length) { body.innerHTML = `<div class="ph-empty"><h2>${t("Your flight deck album")}</h2><p class="dim">${t("Add screenshots from your flights. They stay on this device and are tagged with the flight that is loaded.")}</p>${add}</div>`; return; }
  const groups = {};
  for (const p of list) { const k = ctx.tab === "flights" ? p.flight || t("Without flight") : new Intl.DateTimeFormat(LOCALE(), { month: "long", year: "numeric" }).format(p.at); (groups[k] ||= []).push(p); }
  body.innerHTML = `<div class="ph-top"><span class="dim">${t("{n} photos", { n: list.length })}</span>${add}</div>` + Object.entries(groups).map(([k, ps]) => `<div class="lbl ph-h">${esc(k)}</div><div class="ph-grid">${ps.map((p) => `<button data-ph="${esc(p.id)}"><img src="${url(p)}" alt="" loading="lazy"></button>`).join("")}</div>`).join("");
}
export function summary() { return [t("Photos"), list ? t("{n} photos", { n: list.length }) : ""]; }
