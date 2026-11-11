// Wallpaper of the lock and home screen: a few built-in skies or a photo from the device.
// The photo is made smaller (JPEG, max. 2000 px) and kept in the browser (store "asl.wall.photo").
import { store } from "./util.js";

const PHOTO = "asl.wall.photo";

// every wallpaper has a dark and a light version, so the text on the home screen stays readable
export const WALLS = {
  night: { name: "Night sky",
    dark: "radial-gradient(120% 90% at 85% 10%, #0a3a8a 0%, rgba(10, 58, 138, 0) 55%), radial-gradient(90% 80% at 0% 100%, #0b2a63 0%, rgba(11, 42, 99, 0) 60%), linear-gradient(160deg, #031029 0%, #04163a 55%, #020b1f 100%)",
    light: "radial-gradient(120% 90% at 85% 10%, #cfe0fa 0%, rgba(207, 224, 250, 0) 55%), linear-gradient(160deg, #f4f8fd 0%, #e6eef9 100%)" },
  strato: { name: "Stratosphere",
    dark: "radial-gradient(140% 70% at 50% 120%, rgba(0, 89, 194, .85) 0%, rgba(0, 89, 194, 0) 60%), linear-gradient(180deg, #000814 0%, #001634 40%, #002e5d 100%)",
    light: "radial-gradient(140% 70% at 50% 120%, rgba(0, 89, 194, .28) 0%, rgba(0, 89, 194, 0) 60%), linear-gradient(180deg, #f2f7fe 0%, #d9e7fa 60%, #bcd4f4 100%)" },
  dusk: { name: "Dusk",
    dark: "radial-gradient(120% 60% at 70% 115%, rgba(255, 128, 64, .75) 0%, rgba(255, 128, 64, 0) 55%), linear-gradient(180deg, #070b26 0%, #1a1747 45%, #4a2560 75%, #8a3b55 100%)",
    light: "radial-gradient(120% 60% at 70% 115%, rgba(255, 150, 90, .45) 0%, rgba(255, 150, 90, 0) 60%), linear-gradient(180deg, #f6f3fb 0%, #ece2f3 55%, #f7d9cf 100%)" },
  beacon: { name: "Beacon",
    dark: "radial-gradient(70% 70% at 100% 100%, rgba(227, 0, 31, .55) 0%, rgba(227, 0, 31, 0) 60%), radial-gradient(80% 70% at 0% 0%, rgba(0, 89, 194, .45) 0%, rgba(0, 89, 194, 0) 60%), linear-gradient(160deg, #050d22 0%, #0a1430 100%)",
    light: "radial-gradient(70% 70% at 100% 100%, rgba(227, 0, 31, .18) 0%, rgba(227, 0, 31, 0) 60%), radial-gradient(80% 70% at 0% 0%, rgba(0, 89, 194, .18) 0%, rgba(0, 89, 194, 0) 60%), linear-gradient(160deg, #f7f9fd 0%, #eef2f9 100%)" },
  polar: { name: "Polar night",
    dark: "radial-gradient(90% 55% at 30% 0%, rgba(40, 210, 170, .45) 0%, rgba(40, 210, 170, 0) 60%), radial-gradient(70% 50% at 80% 10%, rgba(110, 90, 255, .35) 0%, rgba(110, 90, 255, 0) 60%), linear-gradient(180deg, #03141f 0%, #041a2c 50%, #020c18 100%)",
    light: "radial-gradient(90% 55% at 30% 0%, rgba(40, 210, 170, .25) 0%, rgba(40, 210, 170, 0) 60%), radial-gradient(70% 50% at 80% 10%, rgba(110, 90, 255, .16) 0%, rgba(110, 90, 255, 0) 60%), linear-gradient(180deg, #f2fbf9 0%, #e7f1f7 100%)" },
  graphite: { name: "Graphite",
    dark: "radial-gradient(100% 80% at 80% 0%, #2a3038 0%, rgba(42, 48, 56, 0) 60%), linear-gradient(160deg, #111418 0%, #0a0c0f 100%)",
    light: "radial-gradient(100% 80% at 80% 0%, #ffffff 0%, rgba(255, 255, 255, 0) 60%), linear-gradient(160deg, #eceef1 0%, #dcdfe4 100%)" },
};

export const getPhoto = () => store.get(PHOTO, null);
export function delPhoto() { store.del(PHOTO); }

// set the CSS of the wallpaper on <html>; s = settings
export function applyWall(s) {
  const root = document.documentElement, light = s.theme === "light";
  const photo = getPhoto();
  root.style.setProperty("--wall-img", photo ? `url("${photo}")` : "none");
  const id = s.wall === "photo" && photo ? "photo" : WALLS[s.wall] ? s.wall : "night";
  root.dataset.wall = id;
  if (id === "photo") {
    const a = Math.max(0, Math.min(0.8, Number(s.wallDim) || 0)), c = light ? "244, 248, 253" : "2, 10, 30";
    root.style.setProperty("--wall", `linear-gradient(rgba(${c}, ${a}), rgba(${c}, ${a})), var(--wall-img) center / cover no-repeat`);
  } else root.style.setProperty("--wall", WALLS[id][light ? "light" : "dark"]);
}

// file from <input type="file"> → smaller JPEG as data URL → store; true when it is saved
export async function savePhoto(file, max = 2000) {
  const img = await loadImage(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  img.close?.();
  for (const q of [0.82, 0.7, 0.55]) { // smaller if the browser storage is too full
    const url = cv.toDataURL("image/jpeg", q);
    store.set(PHOTO, url);
    if (store.get(PHOTO) === url) return true;
  }
  return false;
}
async function loadImage(file) {
  if (self.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch {} }
  const url = URL.createObjectURL(file);
  try {
    const im = new Image(); im.src = url; await im.decode();
    im.width = im.naturalWidth; im.height = im.naturalHeight;
    return im;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
