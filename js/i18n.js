// English is the source language; Serbian (Latin) and German are looked up by the English text.
import { store } from "./util.js";
import { SR, DE } from "./i18n-dict.js";

export const LANGS = { en: "English", sr: "Srpski", de: "Deutsch" };
let lang = store.get("asl.lang", "en");
if (!LANGS[lang]) lang = "en";
export const getLang = () => lang;
export function setLang(l) { if (LANGS[l]) { lang = l; store.set("asl.lang", l); document.documentElement.lang = l === "sr" ? "sr-Latn" : l; } }
export const LOCALE = () => ({ en: "en-GB", sr: "sr-Latn-RS", de: "de-DE" }[lang]);

// t("Next fix"), t("{n} flights", { n: 3 })
export function t(s, vars) {
  let out = lang === "sr" ? SR[s] ?? s : lang === "de" ? DE[s] ?? s : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return out;
}
export const nf = (v, d = 0) => (v == null || isNaN(v) ? "—" : Number(v).toLocaleString(LOCALE(), { maximumFractionDigits: d, minimumFractionDigits: d }));
export function dateLong(t, tz) {
  try { return new Intl.DateTimeFormat(LOCALE(), { weekday: "long", day: "numeric", month: "long", timeZone: tz || undefined }).format(t); } catch { return new Date(t).toDateString(); }
}
export function dateShort(t, tz) {
  try { return new Intl.DateTimeFormat(LOCALE(), { day: "2-digit", month: "short", year: "numeric", timeZone: tz || "UTC" }).format(t); } catch { return new Date(t).toISOString().slice(0, 10); }
}
