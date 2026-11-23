// The Air Serbia fleet for the EFB apps (Checklist, Landing): type picker, and which VA data block (va/checklists.json,
// va/landing.json) belongs to the aircraft of the OFP. The data itself comes only from the VA's documents.
import { S } from "./data.js";
import { getJSON, store } from "./util.js";

export const FLEET_TYPES = [["A319", "A319"], ["A320", "A320"], ["A332", "A330-200"], ["BCS3", "A220-300"], ["E190", "E190"], ["E195", "E195"], ["AT76", "ATR 72-600"]];
const files = {};
export function vaFile(name, done) {
  if (files[name]) return files[name].data;
  files[name] = { data: null };
  getJSON(`va/${name}.json?_=${Math.floor(Date.now() / 6e5)}`).then((d) => { files[name].data = d || { types: {} }; done?.(); }).catch(() => { files[name].data = { types: {} }; done?.(); });
  return null;
}
// the type the pilot picked in this app, else the OFP's aircraft
export function pickedType(app) { return store.get("asl.efbtype." + app, "") || (S.ofp?.type || "").toUpperCase() || "A320"; }
export function pickType(app, ty) { store.set("asl.efbtype." + app, ty); }
export const blockFor = (data, ty) => Object.entries(data?.types || {}).find(([k, v]) => k === ty || (v.applies || []).includes(ty))?.[1] || null;
export const typePicker = (app, cur) => `<div class="efb-types">${FLEET_TYPES.map(([k, l]) => `<button data-efbtype="${k}" data-efbapp="${app}" class="${k === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
