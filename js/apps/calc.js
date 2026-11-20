// Calculator: immediate, no network, dark in every look. Keyboard and touch drive the same state.
import { t } from "../i18n.js";
import { esc } from "../util.js";
export const name = "Calculator";
export const tabs = [];
const st = { cur: "0", acc: null, op: null, fresh: true, expr: "" };
const fmt = (n) => (Number.isFinite(n) ? String(+n.toPrecision(12)) : t("Error"));
function run(a, op, b) { return op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : op === "÷" ? (b === 0 ? NaN : a / b) : b; }
function press(k) {
  if (/^\d$/.test(k)) { st.cur = st.fresh || st.cur === "0" ? k : st.cur.length < 14 ? st.cur + k : st.cur; st.fresh = false; }
  else if (k === ",") { if (st.fresh) { st.cur = "0."; st.fresh = false; } else if (!st.cur.includes(".")) st.cur += "."; }
  else if (k === "C") Object.assign(st, { cur: "0", acc: null, op: null, fresh: true, expr: "" });
  else if (k === "±") st.cur = fmt(-parseFloat(st.cur));
  else if (k === "%") st.cur = fmt(parseFloat(st.cur) / 100);
  else if (k === "⌫") { st.cur = st.fresh ? st.cur : st.cur.slice(0, -1) || "0"; }
  else if ("+−×÷".includes(k)) { if (st.op && !st.fresh) st.acc = run(st.acc, st.op, parseFloat(st.cur)); else if (st.acc == null || !st.op) st.acc = parseFloat(st.cur); st.op = k; st.fresh = true; st.cur = fmt(st.acc); st.expr = st.cur + " " + k; }
  else if (k === "=") { if (st.op != null) { const r = run(st.acc, st.op, parseFloat(st.cur)); st.expr = st.expr + " " + st.cur + " ="; st.cur = fmt(r); st.acc = null; st.op = null; st.fresh = true; } }
}
const KEYS = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "⌫", "0", ",", "="];
let body0 = null;
export function render(body) {
  body0 = body;
  if (!body._calc) { body._calc = true; body.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { press(b.dataset.k); draw(); } });
    document.addEventListener("keydown", (e) => { if (!body0?.isConnected || !body0.closest(".app.open")) return; const m = { "-": "−", "*": "×", "/": "÷", Enter: "=", Backspace: "⌫", Escape: "C", ".": ",", ",": "," }[e.key] || e.key; if (KEYS.includes(m)) { press(m); draw(); } }); }
  draw();
}
function draw() {
  body0.innerHTML = `<div class="calc"><div class="calc-d"><small>${esc(st.expr)}</small><b>${esc(st.cur.replace(".", ","))}</b></div>
    <div class="calc-k">${KEYS.map((k) => `<button data-k="${k}" class="${"+−×÷=".includes(k) ? "op" : "C±%⌫".includes(k) ? "fn" : ""}${st.op === k && st.fresh ? " on" : ""}">${k}</button>`).join("")}</div></div>`;
}
export function summary() { return [t("Calculator"), st.cur]; }
