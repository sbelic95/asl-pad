// Messages: everything the pad and the networks told the pilot, as conversations – the notifications of each app
// (asl.notes from notify.js) and the ACARS/CPDLC traffic with Hoppie (received and sent). Read-only; replies to ATC
// stay in ASL Fly → Radio & ACARS, where the answer buttons are.
import { t, LOCALE } from "../i18n.js";
import { esc } from "../util.js";
import { notes } from "../notify.js";
import { A } from "../hoppie.js";
import { APP_ICONS } from "../icons.js";
import { HOME_APPS } from "../home.js";

export const name = "Messages";
export const tabs = [];
let open = null;

function threads() {
  const th = {};
  const add = (key, title, icon, m) => { (th[key] ||= { key, title, icon, msgs: [] }).msgs.push(m); };
  for (const n of notes()) {
    const app = HOME_APPS.find((a) => a.id === n.app);
    add("app:" + (n.app || "pad"), app ? t(app.name) : "ASL Pad", app?.icon || "settings", { at: n.at, text: [n.title, n.text].filter(Boolean).join(" – "), app: n.app, tab: n.tab });
  }
  for (const m of A.msgs || []) add("acars:" + m.from, m.from, "fly", { at: A.seen.get(m.id) || A.at || Date.now(), text: m.text, kind: m.type }); // Hoppie gives no time: when the pad first saw it
  for (const m of A.sent || []) add("acars:" + m.to, m.to, "fly", { at: m.at, text: m.text, kind: m.type, mine: true });
  return Object.values(th).map((x) => ({ ...x, msgs: x.msgs.sort((a, b) => a.at - b.at), last: Math.max(...x.msgs.map((m) => m.at)) })).sort((a, b) => b.last - a.last);
}
const when = (ts) => new Intl.DateTimeFormat(LOCALE(), Date.now() - ts < 864e5 ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }).format(ts);

export function render(body, ctx) {
  if (!body._msg) { body._msg = true; body.addEventListener("click", (e) => {
    const b = e.target.closest("[data-th]"); if (b) { open = b.dataset.th; ctx.changed("view"); return; }
    const g = e.target.closest("[data-goapp]"); if (g) ctx.open(g.dataset.goapp, g.dataset.gotab || undefined);
  }); }
  const all = threads(), cur = all.find((x) => x.key === open) || all[0];
  body.innerHTML = `<div class="msg">
    <div class="msg-list">${all.map((x) => `<button class="msg-th${x === cur ? " on" : ""}" data-th="${esc(x.key)}"><span class="ico">${APP_ICONS[x.icon] || ""}</span><div><b>${esc(x.title)}</b><small>${esc(x.msgs.at(-1).text.slice(0, 60))}</small></div><span class="dim">${when(x.last)}</span></button>`).join("")
      || `<div class="empty">${t("No messages yet. Notifications and ACARS messages show up here.")}</div>`}</div>
    <div class="msg-view">${cur ? `<div class="msg-head"><b>${esc(cur.title)}</b>${cur.key.startsWith("acars:") ? `<button class="btn small" data-goapp="fly" data-gotab="radio">${t("Reply in ASL Fly")}</button>` : ""}</div>
      <div class="msg-bubbles">${cur.msgs.map((m) => `<div class="bub${m.mine ? " mine" : ""}">${m.kind ? `<span class="tag">${esc(m.kind)}</span> ` : ""}${esc(m.text)}<small>${when(m.at)}</small>${m.app ? `<button class="lnk" data-goapp="${esc(m.app)}" data-gotab="${esc(m.tab || "")}">${t("Open")}</button>` : ""}</div>`).join("")}</div>` : ""}</div></div>`;
  const bb = body.querySelector(".msg-bubbles"); if (bb) bb.scrollTop = bb.scrollHeight;
}
export function summary() { const n = threads().length; return [t("Messages"), n ? t("{n} conversations", { n }) : ""]; }
