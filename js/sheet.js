// A modal sheet over the pad (logbook details, forms). Closes on the backdrop, [data-close] or Escape.
export function sheet(html, onClick) {
  const d = document.createElement("div");
  d.className = "sheet";
  d.innerHTML = `<div class="box">${html}</div>`;
  const close = () => { d.remove(); document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); };
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-close]")) { close(); return; }
    onClick?.(e, close, d);
  });
  document.addEventListener("keydown", key);
  document.getElementById("pad").appendChild(d);
  return { el: d, close };
}
