// Sounds of the pad, made in the browser (Web Audio) – no recordings. iPad/Safari only plays sound after a tap,
// so the audio is unlocked on the first tap (and again after the iPad was locked). Tones (own designs):
//   cpdlc – the ATC message chime: a bright two-tone chime, twice (CPDLC uplink from Hoppie)
//   msg   – one soft chime (telex / other ACARS message)
//   atis  – rising double chime (new ATIS letter)
//   slot  – three short beeps (TSAT, CTOT, TOBT or off-block time changed shortly before departure)
import { settings } from "./data.js";

let ctx = null, unlocked = false, silent = null;
const SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
// iPad: Web Audio follows the ring/silent switch and the mute in Control Center. As a "playback" audio session (Safari's
// Audio Session API) the pad's tones play like media – also in silent mode, at the media volume.
function session() { try { if (navigator.audioSession && navigator.audioSession.type !== "playback") navigator.audioSession.type = "playback"; } catch {} }
function audio() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; session(); ctx = new A(); }
  if (ctx.state !== "running") ctx.resume().catch(() => {}); // "suspended" before the first tap, "interrupted" after locking the iPad
  return ctx;
}
// unlock inside a real tap (iPadOS counts the end of a touch or a click, not the start): a silent buffer through Web Audio,
// plus a short silent HTML audio for older iPadOS without the Audio Session API. Tried again on every tap until it runs.
function unlock() {
  session();
  const a = audio(); if (!a) return;
  try { if (!silent) { silent = new Audio(SILENT); silent.setAttribute("playsinline", ""); } silent.currentTime = 0; silent.play().catch(() => {}); } catch {}
  try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0); } catch {}
  if (a.state === "running") unlocked = true;
}
if (typeof window !== "undefined") {
  for (const ev of ["touchend", "click", "keydown"]) addEventListener(ev, () => { if (!unlocked || !ctx || ctx.state !== "running") { unlocked = false; unlock(); } }, { capture: true, passive: true });
  // back from the lock screen or another app: iPadOS has stopped the audio – start it again
  document.addEventListener("visibilitychange", () => { if (!document.hidden && ctx && ctx.state !== "running") ctx.resume().catch(() => { unlocked = false; }); });
}
// "running" = sound works; "suspended"/"interrupted" = waits for the next tap; "off" = not started yet
export const soundState = () => (ctx ? ctx.state : "off");
function tone(a, t, freq, dur, vol, type = "sine") {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
// a chime: fundamental plus a quiet octave, like a struck bell
const chime = (a, t, f, d, v) => { tone(a, t, f, d, v); tone(a, t, f * 2, d * 0.6, v * 0.25); tone(a, t, f * 3.01, d * 0.35, v * 0.08); };
const PATTERNS = {
  cpdlc: (a, t, v) => { for (const k of [0, 0.9]) { chime(a, t + k, 1397, 0.42, v); chime(a, t + k + 0.2, 1046, 0.55, v); } },
  msg: (a, t, v) => chime(a, t, 1175, 0.6, v * 0.8),
  atis: (a, t, v) => { chime(a, t, 784, 0.45, v * 0.8); chime(a, t + 0.22, 1175, 0.7, v * 0.8); },
  slot: (a, t, v) => { for (const k of [0, 0.22, 0.44]) tone(a, t + k, 988, 0.14, v * 0.7, "square"); },
};
export const SOUNDS = Object.keys(PATTERNS);
let last = {};
// play a tone (not more often than every 4 s per kind), only if sounds are on (Settings → Sounds)
export function play(kind, force) {
  if (!force && settings.sound === false) return;
  if (!force && Date.now() - (last[kind] || 0) < 4000) return;
  last[kind] = Date.now();
  const a = audio(), p = PATTERNS[kind]; if (!a || !p) return;
  p(a, a.currentTime + 0.03, Math.max(0.05, Math.min(1, settings.soundVol ?? 0.7)) * 0.35);
}
