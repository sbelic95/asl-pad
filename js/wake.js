// Keep the screen on while the pad is open (Settings → Keep screen on, on by default): the Screen Wake Lock API, on the
// iPad from iOS 16.4. The lock ends when the pad goes to the background, so it is taken again when it comes back.
import { settings } from "./data.js";

export const WAKE = { supported: typeof navigator !== "undefined" && "wakeLock" in navigator, on: false, err: "" };
let lock = null;
export async function applyWake() {
  const want = settings.awake !== false && !document.hidden;
  if (!WAKE.supported) return;
  if (want && !lock) {
    try {
      lock = await navigator.wakeLock.request("screen");
      WAKE.on = true; WAKE.err = "";
      lock.addEventListener("release", () => { lock = null; WAKE.on = false; });
    } catch (e) { WAKE.on = false; WAKE.err = e.name || "error"; } // e.g. NotAllowedError until the first touch on some systems
  } else if (!want && lock) { try { await lock.release(); } catch {} lock = null; WAKE.on = false; }
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", applyWake);
  addEventListener("pointerdown", () => { if (!WAKE.on) applyWake(); }, { capture: true }); // retry after a touch
}
