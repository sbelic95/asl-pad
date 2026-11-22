// App icons and small UI icons, drawn as SVG (own designs, Air Serbia colours).
const grad = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`;
export const APP_ICONS = {
  mail: `<svg viewBox="0 0 100 100">${grad("gMl", "#2f8cff", "#0050b8")}<rect width="100" height="100" fill="url(#gMl)"/>
    <rect x="18" y="28" width="64" height="46" rx="6" fill="#fff"/><path d="M20 31 L50 54 L80 31" fill="none" stroke="#0059c2" stroke-width="4" stroke-linejoin="round"/></svg>`,
  messages: `<svg viewBox="0 0 100 100">${grad("gMs", "#3fd17a", "#13924a")}<rect width="100" height="100" fill="url(#gMs)"/>
    <path d="M50 22 C30 22 18 34 18 48 C18 57 23 64 31 68 L28 80 L42 72 C45 73 47 73 50 73 C70 73 82 61 82 48 C82 34 70 22 50 22 Z" fill="#fff"/>
    <path d="M36 44 h28 M36 54 h18" stroke="#13924a" stroke-width="4" stroke-linecap="round"/></svg>`,
  academy: `<svg viewBox="0 0 100 100">${grad("gAc", "#002e5d", "#001530")}<rect width="100" height="100" fill="url(#gAc)"/>
    <path d="M50 24 L86 40 L50 56 L14 40 Z" fill="#fff"/><path d="M30 48 v14 c0 6 9 11 20 11 s20 -5 20 -11 v-14 L50 57 Z" fill="#9cc4ff"/>
    <path d="M80 43 v18" stroke="#e3001f" stroke-width="3.5" stroke-linecap="round"/><circle cx="80" cy="64" r="4" fill="#e3001f"/></svg>`,
  reference: `<svg viewBox="0 0 100 100">${grad("gRf", "#fdb913", "#d48a00")}<rect width="100" height="100" fill="url(#gRf)"/>
    <rect x="24" y="18" width="52" height="64" rx="6" fill="#fff"/><text x="50" y="47" text-anchor="middle" font-family="Arial" font-weight="700" font-size="20" fill="#002e5d">A·B</text>
    <path d="M34 60 h32 M34 70 h20" stroke="#d48a00" stroke-width="4" stroke-linecap="round"/></svg>`,
  photos: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/>
    ${[["#e3001f", 0], ["#f47920", 45], ["#fdb913", 90], ["#3fd17a", 135], ["#22aed1", 180], ["#0059c2", 225], ["#885dac", 270], ["#f49e90", 315]].map(([c, r]) => `<ellipse cx="50" cy="32" rx="9" ry="17" fill="${c}" fill-opacity=".85" transform="rotate(${r} 50 50)"/>`).join("")}</svg>`,
  browser: `<svg viewBox="0 0 100 100">${grad("gBr", "#e9eef6", "#b9c7dc")}<rect width="100" height="100" fill="url(#gBr)"/>
    <circle cx="50" cy="50" r="30" fill="#0059c2"/><path d="M20 50 h60 M50 20 c-14 16 -14 44 0 60 M50 20 c14 16 14 44 0 60" fill="none" stroke="#fff" stroke-width="3"/>
    <path d="M50 50 l18 -18 l-6 24 z" fill="#e3001f"/></svg>`,
  scenery: `<svg viewBox="0 0 100 100">${grad("gSc", "#7cc4ff", "#2a7bd4")}<rect width="100" height="100" fill="url(#gSc)"/>
    <circle cx="72" cy="28" r="9" fill="#ffd34d"/><path d="M0 74 L28 46 L46 62 L64 40 L100 74 V100 H0 Z" fill="#1d5f3a"/>
    <path d="M10 86 L90 70" stroke="#2b2f36" stroke-width="9"/><path d="M14 85 L86 71" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4"/></svg>`,
  news: `<svg viewBox="0 0 100 100">${grad("gNw", "#e3001f", "#9c0016")}<rect width="100" height="100" fill="url(#gNw)"/>
    <rect x="20" y="22" width="60" height="56" rx="6" fill="#fff"/><rect x="28" y="30" width="20" height="16" rx="2" fill="#002e5d"/>
    <path d="M54 32 h18 M54 40 h18 M28 54 h44 M28 62 h44 M28 70 h30" stroke="#75787b" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  radar: `<svg viewBox="0 0 100 100">${grad("gR", "#062a1e", "#01120c")}<rect width="100" height="100" fill="url(#gR)"/>
    <g fill="none" stroke="#3ddc97" stroke-opacity=".5" stroke-width="2"><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="22"/><circle cx="50" cy="50" r="10"/></g>
    <path d="M50 50 L50 16 A34 34 0 0 1 80 34 Z" fill="#3ddc97" fill-opacity=".35"/><circle cx="64" cy="30" r="3.5" fill="#fff"/><circle cx="36" cy="62" r="3" fill="#e3001f"/><circle cx="70" cy="64" r="2.5" fill="#fff"/></svg>`,
  ivao: `<svg viewBox="0 0 100 100">${grad("gI", "#1b2a6b", "#090f33")}<rect width="100" height="100" fill="url(#gI)"/>
    <g fill="none" stroke="#7fb2ff" stroke-opacity=".55" stroke-width="2"><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="20"/></g>
    <path d="M50 50 L84 50 A34 34 0 0 0 74 26 Z" fill="#7fb2ff" fill-opacity=".35"/><text x="50" y="57" text-anchor="middle" font-family="Arial" font-weight="700" font-size="17" fill="#fff">IVAO</text></svg>`,
  weather: `<svg viewBox="0 0 100 100">${grad("gW", "#3d8bf2", "#0b4fae")}<rect width="100" height="100" fill="url(#gW)"/>
    <circle cx="38" cy="38" r="15" fill="#ffd34d"/><path d="M30 72 h40 a12 12 0 0 0 0 -24 a16 16 0 0 0 -30 4 a10 10 0 0 0 -10 20 z" fill="#fff"/></svg>`,
  calendar: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/><rect width="100" height="28" fill="#e3001f"/>
    <text x="50" y="21" text-anchor="middle" font-family="Arial" font-weight="700" font-size="15" fill="#fff">${["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date().getDay()]}</text>
    <text x="50" y="80" text-anchor="middle" font-family="Arial" font-weight="700" font-size="46" fill="#002e5d">${new Date().getDate()}</text></svg>`,
  clock: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0f18"/><circle cx="50" cy="50" r="34" fill="#fff"/>
    ${Array.from({ length: 12 }, (_, i) => `<rect x="49" y="19" width="2" height="6" fill="#002e5d" transform="rotate(${i * 30} 50 50)"/>`).join("")}
    <path d="M50 50 V28 M50 50 L64 58" stroke="#002e5d" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="50" r="3" fill="#e3001f"/>
    <text x="50" y="76" text-anchor="middle" font-family="Arial" font-weight="700" font-size="9" fill="#e3001f">UTC</text></svg>`,
  calc: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#1a1d24"/>${[[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]].map(([x, y]) => `<circle cx="${28 + x * 22}" cy="${30 + y * 22}" r="8" fill="${x === 2 ? "#e3001f" : "#4a4f5c"}"/>`).join("")}</svg>`,
  kneeboard: `<svg viewBox="0 0 100 100">${grad("gK", "#f6f1e3", "#ddd3b8")}<rect width="100" height="100" fill="url(#gK)"/>
    <rect x="22" y="16" width="56" height="70" rx="5" fill="#fff" stroke="#8a7d5a" stroke-width="2.5"/><rect x="38" y="11" width="24" height="10" rx="3" fill="#5c5440"/>
    <path d="M30 34 h40 M30 46 h40 M30 58 h26" stroke="#0059c2" stroke-width="3" stroke-linecap="round"/><path d="M56 74 l14 -14 l5 5 l-14 14 h-5 z" fill="#e3001f"/></svg>`,
  manuals: `<svg viewBox="0 0 100 100">${grad("gM", "#5a2a14", "#2a1208")}<rect width="100" height="100" fill="url(#gM)"/>
    <rect x="22" y="22" width="14" height="58" rx="2" fill="#e3001f"/><rect x="38" y="18" width="14" height="62" rx="2" fill="#0059c2"/><rect x="54" y="24" width="12" height="56" rx="2" fill="#f2f5fb"/>
    <rect x="66" y="28" width="12" height="52" rx="2" transform="rotate(-10 72 54)" fill="#ffd34d"/></svg>`,
  store: `<svg viewBox="0 0 100 100">${grad("gT", "#1fa2ff", "#0059c2")}<rect width="100" height="100" fill="url(#gT)"/>
    <path d="M36 70 L56 32 M64 70 L44 32 M30 58 h40" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`,
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
  airport: `<svg viewBox="0 0 100 100">${grad("gA", "#0b4a3a", "#03261d")}<rect width="100" height="100" fill="url(#gA)"/>
    <path d="M18 76 L70 18" stroke="#0a0e14" stroke-width="16" stroke-linecap="butt"/><path d="M18 76 L70 18" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 5"/>
    <path d="M30 84 C40 64 52 60 60 52 S78 40 86 44" fill="none" stroke="#ffd200" stroke-width="5" stroke-linecap="round"/>
    <path d="M36 56 h12" stroke="#e3001f" stroke-width="4" stroke-linecap="round"/><circle cx="86" cy="44" r="5" fill="#e3001f"/></svg>`,
  downloads: `<svg viewBox="0 0 100 100">${grad("gD", "#e3001f", "#8c0013")}<rect width="100" height="100" fill="url(#gD)"/>
    <path d="M50 20 v38 M34 44 l16 16 l16 -16" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M24 62 v12 a6 6 0 0 0 6 6 h40 a6 6 0 0 0 6 -6 v-12" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="6" stroke-linecap="round"/></svg>`,
};
export const I = {
  wifi: `<svg viewBox="0 0 20 15" fill="currentColor"><path d="M10 2.2c3.1 0 5.9 1.2 8 3.2l1.4-1.5A13.6 13.6 0 0 0 10 .2 13.6 13.6 0 0 0 .6 3.9L2 5.4c2.1-2 4.9-3.2 8-3.2z"/><path d="M10 6.3c2 0 3.8.8 5.1 2l1.4-1.4A9.3 9.3 0 0 0 10 4.3c-2.5 0-4.8 1-6.5 2.6l1.4 1.4c1.3-1.2 3.1-2 5.1-2z"/><path d="M10 10.3c.9 0 1.7.3 2.3.9L10 13.6l-2.3-2.4c.6-.6 1.4-.9 2.3-.9z"/></svg>`,
  wifiOff: `<svg viewBox="0 0 20 15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M1.3 4.6A12.4 12.4 0 0 1 10 1.2c3.4 0 6.4 1.3 8.7 3.4M4.2 7.6A8 8 0 0 1 10 5.3c2.3 0 4.3.9 5.8 2.3M10 13.5h0M3 1l14 13" opacity=".8"/></svg>`,
  lock: `<svg viewBox="0 0 18 22" fill="none" stroke="currentColor" stroke-width="2"><rect x="1.5" y="9" width="15" height="11.5" rx="2.5"/><path d="M4.5 9V6a4.5 4.5 0 0 1 9 0v3"/></svg>`,
  plane: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
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
