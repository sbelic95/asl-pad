// App icons and small UI icons, drawn as SVG (own designs, Air Serbia colours).
const grad = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
export const APP_ICONS = {
  fly: `<svg viewBox="0 0 100 100">${grad("gF", "#0b6bdf", "#00306a")}<rect width="100" height="100" fill="url(#gF)"/>
    <path d="M14 70 Q50 18 86 40" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
    <path d="M14 70 Q34 42 56 34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    <g transform="translate(60 33) rotate(-18)"><path d="M-14 0 L10 -3 Q16 0 10 3 L-14 0 Z M-2 -1 L-9 -13 L-4 -13 L6 -1 Z M-2 1 L-9 13 L-4 13 L6 1 Z M-12 -1 L-16 -6 L-13 -6 L-8 -1 Z M-12 1 L-16 6 L-13 6 L-8 1 Z" fill="#fff"/></g>
    <circle cx="86" cy="40" r="5" fill="#e3001f"/><circle cx="14" cy="70" r="4" fill="#fff"/></svg>`,
  ops: `<svg viewBox="0 0 100 100">${grad("gO", "#13305f", "#020e26")}<rect width="100" height="100" fill="url(#gO)"/>
    <rect x="24" y="22" width="52" height="58" rx="6" fill="none" stroke="#fff" stroke-width="4"/>
    <path d="M36 22 v-6 h28 v6" fill="none" stroke="#fff" stroke-width="4"/>
    <path d="M34 40 h32 M34 52 h22 M34 64 h26" stroke="#9cc4ff" stroke-width="4" stroke-linecap="round"/>
    <circle cx="74" cy="72" r="13" fill="#e3001f"/><path d="M68 72 l4 4 l8 -8" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  log: `<svg viewBox="0 0 100 100">${grad("gL", "#2a2f6e", "#0b1438")}<rect width="100" height="100" fill="url(#gL)"/>
    <path d="M24 20 h44 a8 8 0 0 1 8 8 v52 h-44 a8 8 0 0 1 -8 -8 z" fill="#f2f5fb"/>
    <path d="M24 72 a8 8 0 0 1 8 -8 h44" fill="none" stroke="#c9d3e6" stroke-width="3"/>
    <path d="M34 50 Q46 30 66 34" fill="none" stroke="#0059c2" stroke-width="3.5" stroke-dasharray="5 4" stroke-linecap="round"/>
    <circle cx="34" cy="50" r="3.5" fill="#0059c2"/><circle cx="66" cy="34" r="4.5" fill="#e3001f"/></svg>`,
  cabin: `<svg viewBox="0 0 100 100">${grad("gC", "#e9eef6", "#b9c7dc")}<rect width="100" height="100" fill="url(#gC)"/>
    <rect x="18" y="22" width="64" height="44" rx="6" fill="#002e5d"/><path d="M26 54 Q44 34 70 38" fill="none" stroke="#5aa2ff" stroke-width="3" stroke-dasharray="3 4"/>
    <circle cx="70" cy="38" r="3.5" fill="#e3001f"/><rect x="30" y="72" width="40" height="8" rx="4" fill="#002e5d"/></svg>`,
  vdgs: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#0a0e13"/><rect x="18" y="26" width="64" height="48" rx="6" fill="#151b24" stroke="#ffcc00" stroke-width="3"/>
    <text x="50" y="57" text-anchor="middle" font-family="Arial Narrow, Arial" font-weight="700" font-size="22" fill="#ffcc00">VDGS</text></svg>`,
  simbrief: `<svg viewBox="0 0 100 100">${grad("gS", "#f4f6fa", "#d4dbe7")}<rect width="100" height="100" fill="url(#gS)"/>
    <path d="M30 18 h30 l14 14 v50 h-44 z" fill="#fff" stroke="#24406b" stroke-width="3"/><path d="M60 18 v14 h14" fill="none" stroke="#24406b" stroke-width="3"/>
    <path d="M38 44 h28 M38 54 h28 M38 64 h18" stroke="#24406b" stroke-width="3.5" stroke-linecap="round"/><text x="50" y="92" text-anchor="middle" font-family="Arial" font-weight="700" font-size="11" fill="#24406b">OFP</text></svg>`,
  settings: `<svg viewBox="0 0 100 100">${grad("gG", "#8d96a6", "#555e6e")}<rect width="100" height="100" fill="url(#gG)"/>
    <g transform="translate(50 50)" fill="#eef1f6">${Array.from({ length: 8 }, (_, i) => `<rect x="-5" y="-31" width="10" height="14" rx="2" transform="rotate(${i * 45})"/>`).join("")}<circle r="22"/></g>
    <circle cx="50" cy="50" r="10" fill="#6f7888"/></svg>`,
};
export const I = {
  lock: `<svg viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1.5" y="9" width="15" height="11.5" rx="2.5"/><path d="M4.5 9V6a4.5 4.5 0 0 1 9 0v3"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M15 9h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V8l-3-3"/><path d="M8 7h4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  gate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V5l8-2 8 2v16"/><path d="M9 21v-6h6v6"/></svg>`,
  radio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5 9-10"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>`,
  wx: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
};
