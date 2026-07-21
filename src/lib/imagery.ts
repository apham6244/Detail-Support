/**
 * Curated automotive/detailing imagery.
 *
 * Every ID below is a FREE Unsplash photo (images.unsplash.com — Unsplash
 * License: commercial use allowed, no attribution required) and was verified to
 * decode before being committed. We deliberately avoid plus.unsplash.com
 * (Unsplash+ premium) — those aren't freely usable and can't be hotlinked.
 *
 * URLs are built through the CDN's imgix params so we only pull the size we
 * render. Everything that shows an image also renders a gradient behind it (see
 * DetailImage), so a URL that ever stops resolving degrades to the gradient
 * rather than a broken tile.
 */

const CDN = "https://images.unsplash.com/";

export function unsplash(id: string, opts?: { w?: number; h?: number; q?: number }): string {
  const w = opts?.w ?? 1200;
  const q = opts?.q ?? 62;
  const h = opts?.h ? `&h=${opts.h}` : "";
  return `${CDN}${id}?auto=format&fit=crop&w=${w}${h}&q=${q}`;
}

/** Verified free photo IDs, by role. */
export const PHOTO = {
  glossyBlack: "photo-1535448580089-c7f9490c78b1", // black sports car, deep gloss
  ferrariRed: "photo-1614200179396-2bdb77ebf81b", // red Ferrari
  mercWhite: "photo-1618642624018-a370cbf3cd80", // white Mercedes coupe
  detailerGarage: "photo-1708805282676-0c15476eb8a2", // detailer working in a garage
  detailerRed: "photo-1689182358896-2514cd65dfff", // detailer washing a red sports car
  waxing: "photo-1652987086612-d948b775d358", // waxing / microfiber by hand
  powerTool: "photo-1620584898989-d39f7f9ed1b7", // orbital polisher (power tool)
  sanding: "photo-1632823470270-a7d3d03c3e20", // paint correction / sanding
  interiorMerc: "photo-1625690180114-5530b1304127", // black Mercedes interior
  interiorWheel: "photo-1636763086471-9f29bc34ab9e", // interior + steering wheel
  pressureWash: "photo-1683647115932-b33455fe6a3e", // high-pressure wash
  washBlack: "photo-1520340356584-f9917d1eea6f", // glossy black car, wet
  wheelWash: "photo-1565689876697-e467b6c54da2", // wheel being washed
  mobileDetailer: "photo-1607860108855-64acf2078ed9", // detailer at work outdoors
  waterDroplets: "photo-1611239179213-d972da54091a", // beaded water on paint
  engineBay: "photo-1676743603171-46338ba7cafc", // engine bay detail
} as const;

export type SubKey =
  | "pressure_washers" | "foam_cannons" | "towels" | "brushes_exterior"
  | "vacuums" | "extractors" | "steam_cleaners" | "brushes_interior"
  | "polishers" | "pads" | "compounds"
  | "generators" | "water_tanks" | "storage" | "lighting";

/** Image for each Gear Guide subcategory (maps onto the existing catalog keys). */
export const SUB_PHOTO: Record<SubKey, string> = {
  pressure_washers: PHOTO.pressureWash,
  foam_cannons: PHOTO.washBlack,
  towels: PHOTO.waxing,
  brushes_exterior: PHOTO.wheelWash,
  vacuums: PHOTO.interiorMerc,
  extractors: PHOTO.interiorWheel,
  steam_cleaners: PHOTO.interiorMerc,
  brushes_interior: PHOTO.interiorWheel,
  polishers: PHOTO.powerTool,
  pads: PHOTO.sanding,
  compounds: PHOTO.waxing,
  generators: PHOTO.mobileDetailer,
  water_tanks: PHOTO.detailerRed,
  storage: PHOTO.detailerGarage,
  lighting: PHOTO.glossyBlack,
};
