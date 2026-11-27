// Mail: the pilot's company inbox on this device. Letters come from three real sources only: the airline's notices
// (va/notices.json, written by the VA staff), a welcome letter of the pad, and a monthly flying summary built from
// the pilot's own logbook. Nothing is sent anywhere; read marks stay on the device (asl.mail.read).
import { S, logbook } from "../data.js";
import { t, loc, LOCALE } from "../i18n.js";
import { esc, store } from "../util.js";

export const name = "Mail";
export const tabs = [["inbox", "Inbox"], ["read", "Read"]];
let open = null;
const readSet = () => new Set(store.get("asl.mail.read", []));
const markRead = (id) => { const r = readSet(); if (!r.has(id)) { r.add(id); store.set("asl.mail.read", [...r].slice(-300)); } };

const WELCOME = {
  en: "Welcome on board! This pad is your crew tablet for Air Serbia Virtual: ASL Fly carries your flight from the OFP, ASL Ops your duty and roster, the logbook keeps every flight. Sign in with your VATSIM CID and PIN in Settings, and the pad takes over your profile (SimBrief, Hoppie) from the dashboard. Have a good flight.",
  sr: "Dobro došli na brod! Ovaj pad je tvoj tablet posade za Air Serbia Virtual: ASL Fly nosi tvoj let iz OFP-a, ASL Ops dužnost i raspored, a dnevnik čuva svaki let. Prijavi se VATSIM CID-om i PIN-om u Podešavanjima i pad preuzima tvoj profil (SimBrief, Hoppie) sa kontrolne table. Srećan let.",
  de: "Willkommen an Bord! Dieses Pad ist dein Crew-Tablet für Air Serbia Virtual: ASL Fly trägt deinen Flug aus dem OFP, ASL Ops Dienst und Dienstplan, das Logbuch hält jeden Flug fest. Melde dich in den Einstellungen mit VATSIM-CID und PIN an, dann übernimmt das Pad dein Profil (SimBrief, Hoppie) aus dem Dashboard. Guten Flug.",
};

function letters() {
  const out = [{ id: "welcome", from: "ASL Pad", subject: t("Welcome to the ASL Pad"), date: store.get("asl.mail.since", null) || (store.set("asl.mail.since", Date.now()), Date.now()), body: loc(WELCOME) }];
  for (const n of S.notices?.notices || []) {
    if (n.until && Date.parse(n.until) + 864e5 < Date.now()) continue;
    out.push({ id: "n:" + n.id, from: "Air Serbia Virtual", subject: loc(n.title), date: Date.parse(n.date) || Date.now(), body: loc(n.text) });
  }
  // one summary letter per finished month with flights, made from the logbook
  const months = {};
  for (const e of logbook()) { const d = new Date(e.date), k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; (months[k] ||= []).push(e); }
  const nowK = new Date().toISOString().slice(0, 7);
  for (const [k, list] of Object.entries(months)) {
    if (k >= nowK) continue;
    const mins = list.reduce((m, e) => m + (e.offBlock && e.onBlock ? (e.onBlock - e.offBlock) / 6e4 : 0), 0), nm = list.reduce((s, e) => s + (e.distNm || 0), 0);
    const month = new Intl.DateTimeFormat(LOCALE(), { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.parse(k + "-15"));
    const routes = [...new Set(list.map((e) => `${e.dep}–${e.arr}`))].slice(0, 12).join(", ");
    out.push({ id: "m:" + k, from: "ASL Ops", subject: t("Your flying in {m}", { m: month }), date: Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 1), // the first day of the next month
      body: t("Flights: {n} · block time: {h} h {m} min · distance: {d} NM.", { n: list.length, h: Math.floor(mins / 60), m: Math.round(mins % 60), d: Math.round(nm).toLocaleString(LOCALE()) }) + "\n\n" + t("Routes: {r}", { r: routes }) });
  }
  return out.sort((a, b) => b.date - a.date);
}
const day = (ts) => new Intl.DateTimeFormat(LOCALE(), { day: "2-digit", month: "short" }).format(ts);

export function render(body, ctx) {
  if (!body._mail) { body._mail = true; body.addEventListener("click", (e) => { const b = e.target.closest("[data-mail]"); if (b) { open = b.dataset.mail; markRead(open); ctx.changed("view"); } if (e.target.closest("[data-mail-back]")) { open = null; ctx.changed("view"); } }); }
  const all = letters(), r = readSet(), list = all.filter((m) => (ctx.tab === "read" ? r.has(m.id) : !r.has(m.id) || m.id === open));
  const cur = all.find((m) => m.id === open);
  body.innerHTML = `<div class="mail">
    <div class="mail-list">${list.map((m) => `<button class="mail-i${m.id === open ? " on" : ""}${r.has(m.id) ? "" : " new"}" data-mail="${esc(m.id)}"><b>${esc(m.from)}</b><span class="dim">${day(m.date)}</span><div>${esc(m.subject)}</div><small>${esc(m.body.slice(0, 90))}</small></button>`).join("")
      || `<div class="empty">${ctx.tab === "read" ? t("No read mail yet.") : t("All caught up.")}</div>`}</div>
    <div class="mail-view">${cur ? `<button class="btn small" data-mail-back>${t("Close")}</button><h2>${esc(cur.subject)}</h2><div class="dim mail-meta">${esc(cur.from)} · ${new Intl.DateTimeFormat(LOCALE(), { dateStyle: "long" }).format(cur.date)}</div><div class="mail-body">${esc(cur.body).replace(/\n/g, "<br>")}</div>`
      : `<div class="empty">${t("Choose a letter.")}</div>`}</div></div>`;
}
export const unreadMail = () => { const r = readSet(); return letters().filter((m) => !r.has(m.id)).length; };
export function summary() { const n = unreadMail(); return [t("Mail"), n ? t("{n} unread", { n }) : t("All caught up.")]; }
