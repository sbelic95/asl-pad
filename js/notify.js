// One notification system for every app: an app only says that something is worth telling; this module keeps the list
// for the Notification Center (asl.notes), shows the banner (not while "Do not disturb" is on) and, if the pilot allows
// it and the pad is in the background, a system notification.
import { store } from "./util.js";

export const N = { banner: null, dnd: () => false, system: () => false, changed: null };
export const notes = () => store.get("asl.notes", []);
export function notify(n) {
  const item = { id: Date.now() + Math.random(), at: Date.now(), lv: "info", ic: "plane", ...n };
  store.set("asl.notes", [item, ...notes()].slice(0, 60));
  if (!N.dnd() || item.lv === "red") N.banner?.(item);
  try { if (N.system() && "Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(item.title, { body: item.text || "", tag: item.tag || String(item.id) }); } catch {}
  N.changed?.();
  return item;
}
export function clearNote(id) { store.set("asl.notes", id == null ? [] : notes().filter((x) => x.id !== id)); N.changed?.(); }
