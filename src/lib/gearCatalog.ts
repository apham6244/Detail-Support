import {
  Droplet, Droplets, CloudRain, SprayCan, Layers, FlaskConical, FlaskRound,
  CircleDashed, Disc3, ShieldCheck, Shield, Sparkles, GlassWater, Wind, Armchair,
  Footprints, Brush, Cable, CircleDot, Container, Package, Lightbulb, Zap, Gauge,
  Cylinder, ThermometerSun, type LucideIcon,
} from "lucide-react";

/**
 * Detailer Gear Guide — curated catalog + recommendation engine.
 *
 * This is reference data, identical for every shop: what pressure washer suits a
 * beginner on a tight budget doesn't depend on which tenant is asking. So it
 * lives in the frontend as a static dataset with deterministic ranking, rather
 * than a per-tenant database table with RLS — there's nothing here to isolate or
 * secure. Prices are approximate street prices for guidance, not live quotes,
 * and ratings are editorial fit scores, not aggregated user reviews. Nothing
 * here is sponsored.
 */

export type Experience = "beginner" | "intermediate" | "professional";
export type BudgetTier = "under100" | "100to300" | "300to500" | "500to1000" | "custom";
export type Goal = "start_mobile" | "upgrade" | "improve_quality" | "work_faster" | "more_services";

export type BusinessType = "hobby" | "mobile" | "shop";
export type ProductTag = "popular" | "pro" | "budget" | "premium";

export type CategoryKey = "exterior" | "interior" | "paint_care" | "mobile";

// Department keys for the marketplace "Browse" taxonomy — a superset of the
// wizard's CATEGORIES below (Browse also covers the chemicals the Build-a-Setup
// guide skips).
export type DepartmentKey =
  | "exterior_wash" | "decon" | "protection" | "interior_care"
  | "wash_tools" | "correction" | "interior_tools" | "mobile_shop";

export type SubcategoryKey =
  // wash chemicals
  | "shampoo" | "snow_foam" | "pre_wash" | "wheel_cleaner" | "tire_cleaner" | "glass_cleaner"
  // decontamination
  | "clay" | "iron_remover" | "tar_remover" | "water_spot"
  // protection
  | "ceramic_coating" | "sealant" | "spray_wax" | "tire_dressing"
  // interior chemicals
  | "interior_cleaner" | "apc" | "leather_cleaner" | "leather_conditioner"
  | "fabric_cleaner" | "carpet_cleaner" | "odor_remover"
  // wash tools
  | "pressure_washers" | "foam_cannons" | "towels" | "brushes_exterior" | "hoses"
  // correction
  | "polishers" | "pads" | "compounds"
  // interior tools
  | "vacuums" | "extractors" | "steam_cleaners" | "brushes_interior"
  // mobile & shop
  | "generators" | "water_tanks" | "storage" | "lighting";

export interface Product {
  id: string;
  name: string;
  sub: SubcategoryKey;
  price: number; // approximate street price, USD
  rating: number; // editorial quality/fit rating, 1–5
  bestFor: Experience[];
  goals: Goal[];
  pros: string[];
  cons: string[];
  // Optional enrichment used by the marketplace + comparison. Older tool entries
  // omit these; the helpers below fall back to sensible derivations so nothing
  // breaks.
  brand?: string;
  useCase?: string;
  business?: BusinessType[];
  tags?: ProductTag[];
  quality?: number;    // editorial 1–5 (defaults to `rating`)
  durability?: number; // editorial 1–5
  ease?: number;       // editorial 1–5 ease of use
}

// ---------------------------------------------------------------------------
// Option metadata (labels + helper copy for the wizard)
// ---------------------------------------------------------------------------

export const EXPERIENCE_OPTIONS: { key: Experience; label: string; blurb: string }[] = [
  { key: "beginner", label: "Beginner", blurb: "New to detailing or just getting started" },
  { key: "intermediate", label: "Intermediate", blurb: "Comfortable with the basics, building a kit" },
  { key: "professional", label: "Professional", blurb: "Detailing for a living, daily use" },
];

export const BUDGET_OPTIONS: { key: BudgetTier; label: string; ceiling: number | null }[] = [
  { key: "under100", label: "Under $100", ceiling: 100 },
  { key: "100to300", label: "$100 – $300", ceiling: 300 },
  { key: "300to500", label: "$300 – $500", ceiling: 500 },
  { key: "500to1000", label: "$500 – $1000", ceiling: 1000 },
  { key: "custom", label: "Custom amount", ceiling: null },
];

export const GOAL_OPTIONS: { key: Goal; label: string; blurb: string }[] = [
  { key: "start_mobile", label: "Start mobile detailing", blurb: "Get a mobile setup off the ground" },
  { key: "upgrade", label: "Upgrade equipment", blurb: "Replace entry-level gear with better tools" },
  { key: "improve_quality", label: "Improve quality", blurb: "Get cleaner, more consistent results" },
  { key: "work_faster", label: "Work faster", blurb: "Cut time per job without cutting corners" },
  { key: "more_services", label: "Offer more services", blurb: "Add correction, interior shampoo, steam" },
];

export const CATEGORIES: { key: CategoryKey; label: string; subs: { key: SubcategoryKey; label: string }[] }[] = [
  {
    key: "exterior",
    label: "Exterior",
    subs: [
      { key: "pressure_washers", label: "Pressure washers" },
      { key: "foam_cannons", label: "Foam cannons" },
      { key: "towels", label: "Towels" },
      { key: "brushes_exterior", label: "Brushes" },
    ],
  },
  {
    key: "interior",
    label: "Interior",
    subs: [
      { key: "vacuums", label: "Vacuums" },
      { key: "extractors", label: "Extractors" },
      { key: "steam_cleaners", label: "Steam cleaners" },
      { key: "brushes_interior", label: "Brushes" },
    ],
  },
  {
    key: "paint_care",
    label: "Paint Care",
    subs: [
      { key: "polishers", label: "Polishers" },
      { key: "pads", label: "Pads" },
      { key: "compounds", label: "Compounds" },
    ],
  },
  {
    key: "mobile",
    label: "Mobile Setup",
    subs: [
      { key: "generators", label: "Generators" },
      { key: "water_tanks", label: "Water tanks" },
      { key: "storage", label: "Storage" },
      { key: "lighting", label: "Lighting" },
    ],
  },
];

export const BUSINESS_OPTIONS: { key: BusinessType; label: string; blurb: string }[] = [
  { key: "hobby", label: "Hobby detailer", blurb: "Your own or friends' cars" },
  { key: "mobile", label: "Mobile detailer", blurb: "Travelling to customers" },
  { key: "shop", label: "Detailing shop", blurb: "A fixed-location business" },
];

export type Priority = "cheapest" | "value" | "performance" | "premium";
export const PRIORITY_OPTIONS: { key: Priority; label: string; blurb: string }[] = [
  { key: "value", label: "Best value", blurb: "Smartest price-to-quality" },
  { key: "cheapest", label: "Cheapest setup", blurb: "Lowest cost to get working" },
  { key: "performance", label: "Best performance", blurb: "Top results, any tier" },
  { key: "premium", label: "Premium setup", blurb: "The best money can buy" },
];

// ---------------------------------------------------------------------------
// Marketplace taxonomy (Browse) — every subcategory with an icon + department.
// This is the superset the storefront walks; CATEGORIES above is the subset the
// Build-a-Setup wizard uses for its per-category equipment picks.
// ---------------------------------------------------------------------------

export const SUBCATEGORIES: Record<SubcategoryKey, { label: string; icon: LucideIcon; dept: DepartmentKey }> = {
  shampoo: { label: "Car shampoos", icon: Droplet, dept: "exterior_wash" },
  snow_foam: { label: "Snow foam", icon: CloudRain, dept: "exterior_wash" },
  pre_wash: { label: "Pre-wash", icon: SprayCan, dept: "exterior_wash" },
  wheel_cleaner: { label: "Wheel cleaners", icon: CircleDashed, dept: "exterior_wash" },
  tire_cleaner: { label: "Tire cleaners", icon: Disc3, dept: "exterior_wash" },
  glass_cleaner: { label: "Glass cleaners", icon: GlassWater, dept: "exterior_wash" },
  clay: { label: "Clay bars & mitts", icon: Layers, dept: "decon" },
  iron_remover: { label: "Iron removers", icon: FlaskConical, dept: "decon" },
  tar_remover: { label: "Tar removers", icon: FlaskRound, dept: "decon" },
  water_spot: { label: "Water spot removers", icon: Droplets, dept: "decon" },
  ceramic_coating: { label: "Ceramic coatings", icon: ShieldCheck, dept: "protection" },
  sealant: { label: "Paint sealants", icon: Shield, dept: "protection" },
  spray_wax: { label: "Spray waxes", icon: Sparkles, dept: "protection" },
  tire_dressing: { label: "Tire dressings", icon: CircleDot, dept: "protection" },
  interior_cleaner: { label: "Interior cleaners", icon: SprayCan, dept: "interior_care" },
  apc: { label: "All-purpose cleaners", icon: SprayCan, dept: "interior_care" },
  leather_cleaner: { label: "Leather cleaners", icon: Armchair, dept: "interior_care" },
  leather_conditioner: { label: "Leather conditioners", icon: Armchair, dept: "interior_care" },
  fabric_cleaner: { label: "Fabric cleaners", icon: Brush, dept: "interior_care" },
  carpet_cleaner: { label: "Carpet cleaners", icon: Footprints, dept: "interior_care" },
  odor_remover: { label: "Odor removers", icon: Wind, dept: "interior_care" },
  pressure_washers: { label: "Pressure washers", icon: Gauge, dept: "wash_tools" },
  foam_cannons: { label: "Foam cannons", icon: Cylinder, dept: "wash_tools" },
  towels: { label: "Microfiber towels", icon: Layers, dept: "wash_tools" },
  brushes_exterior: { label: "Exterior brushes", icon: Brush, dept: "wash_tools" },
  hoses: { label: "Hoses & reels", icon: Cable, dept: "wash_tools" },
  polishers: { label: "Polishers", icon: Disc3, dept: "correction" },
  pads: { label: "Pads", icon: CircleDot, dept: "correction" },
  compounds: { label: "Compounds & polishes", icon: FlaskConical, dept: "correction" },
  vacuums: { label: "Vacuums", icon: Wind, dept: "interior_tools" },
  extractors: { label: "Extractors", icon: Droplets, dept: "interior_tools" },
  steam_cleaners: { label: "Steam cleaners", icon: ThermometerSun, dept: "interior_tools" },
  brushes_interior: { label: "Interior brushes", icon: Brush, dept: "interior_tools" },
  generators: { label: "Generators", icon: Zap, dept: "mobile_shop" },
  water_tanks: { label: "Water tanks", icon: Container, dept: "mobile_shop" },
  storage: { label: "Storage solutions", icon: Package, dept: "mobile_shop" },
  lighting: { label: "Detailing lights", icon: Lightbulb, dept: "mobile_shop" },
};

export const DEPARTMENTS: { key: DepartmentKey; label: string; icon: LucideIcon; blurb: string }[] = [
  { key: "exterior_wash", label: "Exterior Wash", icon: Droplets, blurb: "Shampoos, foams & wheel care" },
  { key: "decon", label: "Decontamination", icon: FlaskConical, blurb: "Clay, iron, tar & spots" },
  { key: "protection", label: "Protection & Shine", icon: ShieldCheck, blurb: "Coatings, sealants & dressings" },
  { key: "interior_care", label: "Interior Care", icon: Armchair, blurb: "Cleaners, leather & fabric" },
  { key: "wash_tools", label: "Wash Tools", icon: Gauge, blurb: "Washers, cannons, towels & hoses" },
  { key: "correction", label: "Paint Correction", icon: Disc3, blurb: "Polishers, pads & compounds" },
  { key: "interior_tools", label: "Interior Tools", icon: Wind, blurb: "Vacuums, extractors & steam" },
  { key: "mobile_shop", label: "Mobile & Shop", icon: Zap, blurb: "Power, water, storage & lights" },
];

/** Subcategories a goal most directly touches — surfaced first, badged. */
export const GOAL_FOCUS: Record<Goal, SubcategoryKey[]> = {
  start_mobile: ["pressure_washers", "foam_cannons", "vacuums", "generators", "water_tanks", "storage", "lighting"],
  upgrade: ["pressure_washers", "polishers", "extractors", "storage", "water_tanks"],
  improve_quality: ["polishers", "pads", "compounds", "towels", "foam_cannons", "lighting"],
  work_faster: ["extractors", "steam_cleaners", "polishers", "vacuums", "pressure_washers"],
  more_services: ["extractors", "steam_cleaners", "polishers", "pads", "compounds"],
};

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const PRODUCTS: Product[] = [
  // ---- Exterior · Pressure washers ----
  { id: "pw-ryobi1900", name: "Ryobi 1900 PSI Electric", sub: "pressure_washers", price: 110, rating: 3.9,
    bestFor: ["beginner"], goals: ["start_mobile"],
    pros: ["Cheap and compact", "Light enough to carry between jobs"], cons: ["Lower pressure", "Light-duty motor"] },
  { id: "pw-sunjoe3000", name: "Sun Joe SPX3000", sub: "pressure_washers", price: 160, rating: 4.1,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile", "upgrade", "work_faster"],
    pros: ["Strong value", "Dual detergent tanks", "Good starter pressure"], cons: ["Plastic fittings", "Corded only"] },
  { id: "pw-active20", name: "Active 2.0 Pressure Washer", sub: "pressure_washers", price: 300, rating: 4.6,
    bestFor: ["intermediate", "professional"], goals: ["upgrade", "work_faster", "more_services"],
    pros: ["Brass fittings", "Quiet", "Detailer-favorite build"], cons: ["Pricier", "Still needs an outlet"] },
  { id: "pw-dewalt3400", name: "DeWalt 3400 PSI Gas (DXPW3400)", sub: "pressure_washers", price: 600, rating: 4.7,
    bestFor: ["professional"], goals: ["upgrade", "work_faster"],
    pros: ["Gas — no outlet needed", "High flow for mobile work"], cons: ["Heavy and loud", "Engine maintenance"] },

  // ---- Exterior · Foam cannons ----
  { id: "fc-torq", name: "Chemical Guys TORQ Snow Foam", sub: "foam_cannons", price: 40, rating: 3.8,
    bestFor: ["beginner"], goals: ["start_mobile", "upgrade"],
    pros: ["Inexpensive", "Fine for casual use"], cons: ["Mostly plastic", "Thinner foam"] },
  { id: "fc-adams", name: "Adam's Standard Foam Cannon", sub: "foam_cannons", price: 60, rating: 4.3,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile", "improve_quality"],
    pros: ["Reliable", "Good foam for the price"], cons: ["Mid-thickness foam"] },
  { id: "fc-mtmpf22", name: "MTM Hydro PF22.2", sub: "foam_cannons", price: 80, rating: 4.8,
    bestFor: ["intermediate", "professional"], goals: ["upgrade", "improve_quality", "work_faster"],
    pros: ["Thick, clinging foam", "Adjustable, durable brass"], cons: ["Wants a strong pressure washer"] },

  // ---- Exterior · Towels ----
  { id: "tw-bulk12", name: "Bulk Microfiber (12-pack)", sub: "towels", price: 18, rating: 3.6,
    bestFor: ["beginner"], goals: ["start_mobile"],
    pros: ["Cheapest way to stock up", "Fine for wheels/dirty work"], cons: ["Lints", "Shorter lifespan"] },
  { id: "tw-eagle500", name: "The Rag Company Eagle Edgeless 500 (3-pack)", sub: "towels", price: 25, rating: 4.6,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Plush and scratch-free", "Excellent value"], cons: ["Small packs add up"] },
  { id: "tw-woolly", name: "Chemical Guys Woolly Mammoth Drying Towel", sub: "towels", price: 28, rating: 4.4,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile", "improve_quality"],
    pros: ["Big and very absorbent"], cons: ["Bulky", "Edges wear over time"] },
  { id: "tw-gauntlet", name: "The Rag Company Gauntlet XL Drying Towel", sub: "towels", price: 40, rating: 4.8,
    bestFor: ["professional"], goals: ["work_faster", "upgrade"],
    pros: ["Dries a whole car fast", "Premium plush"], cons: ["Expensive per towel"] },

  // ---- Exterior · Brushes ----
  { id: "bx-cg", name: "Chemical Guys Wheel & Tire Brush", sub: "brushes_exterior", price: 12, rating: 3.9,
    bestFor: ["beginner"], goals: ["start_mobile"],
    pros: ["Cheap", "Soft on finishes"], cons: ["Wears out fairly quickly"] },
  { id: "bx-detailset", name: "Boar-Hair Detailing Brush Set (5pc)", sub: "brushes_exterior", price: 18, rating: 4.2,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality", "more_services"],
    pros: ["Versatile", "Gentle on trim and emblems"], cons: ["Small", "Not for heavy grime"] },
  { id: "bx-ezdetail", name: "EZ Detail Brush (wheel barrels)", sub: "brushes_exterior", price: 22, rating: 4.5,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Reaches wheel barrels", "Protected core won't scratch"], cons: ["Single-purpose"] },

  // ---- Interior · Vacuums ----
  { id: "vac-shopvac5", name: "Shop-Vac 5 Gallon", sub: "vacuums", price: 70, rating: 3.9,
    bestFor: ["beginner"], goals: ["start_mobile"],
    pros: ["Cheap", "Corded power"], cons: ["Bulky", "Loud", "No fine filtration"] },
  { id: "vac-ridgidnxt", name: "Ridgid 6 Gal NXT", sub: "vacuums", price: 100, rating: 4.4,
    bestFor: ["intermediate"], goals: ["start_mobile", "upgrade"],
    pros: ["Strong suction", "Durable", "Good attachments"], cons: ["Corded", "Heavy"] },
  { id: "vac-metrovac", name: "MetroVac Vac N Blo", sub: "vacuums", price: 170, rating: 4.6,
    bestFor: ["professional"], goals: ["upgrade", "work_faster"],
    pros: ["Powerful", "Vacuums and blows out cracks"], cons: ["No wet pickup", "Pricey"] },
  { id: "vac-bissellmc", name: "Bissell MultiClean Wet/Dry Auto", sub: "vacuums", price: 180, rating: 4.3,
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "more_services"],
    pros: ["Handles wet and dry", "Car-focused tools"], cons: ["Smaller tank"] },

  // ---- Interior · Extractors ----
  { id: "ex-littlegreen", name: "Bissell Little Green", sub: "extractors", price: 120, rating: 4.2,
    bestFor: ["beginner", "intermediate"], goals: ["more_services", "improve_quality"],
    pros: ["Affordable entry extractor", "Compact"], cons: ["Small tank", "Hand unit only"] },
  { id: "ex-tornador", name: "Tornador Black Z-020", sub: "extractors", price: 150, rating: 4.5,
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "more_services"],
    pros: ["Deep-cleans upholstery", "Air-powered"], cons: ["Needs an air compressor"] },
  { id: "ex-myteelite", name: "Mytee Lite 8070 (heated)", sub: "extractors", price: 700, rating: 4.7,
    bestFor: ["professional"], goals: ["more_services", "work_faster", "upgrade"],
    pros: ["Heated", "Powerful", "Pro-grade"], cons: ["Expensive", "Heavy"] },

  // ---- Interior · Steam cleaners ----
  { id: "st-mc1275", name: "McCulloch MC1275", sub: "steam_cleaners", price: 130, rating: 4.2,
    bestFor: ["beginner", "intermediate"], goals: ["more_services", "improve_quality"],
    pros: ["Affordable", "Lots of attachments"], cons: ["Smaller boiler", "Refill waits"] },
  { id: "st-dupray", name: "Dupray Neat Steam Cleaner", sub: "steam_cleaners", price: 170, rating: 4.5,
    bestFor: ["intermediate"], goals: ["more_services", "work_faster"],
    pros: ["Long steam time", "Durable"], cons: ["Heavier unit"] },
  { id: "st-vapamore", name: "Vapamore MR-100 Primo", sub: "steam_cleaners", price: 300, rating: 4.6,
    bestFor: ["professional"], goals: ["more_services", "upgrade"],
    pros: ["Continuous refill", "Pro-grade", "Lifetime warranty"], cons: ["Pricey"] },

  // ---- Interior · Brushes ----
  { id: "bi-softset", name: "Soft Interior Brush Set (5pc)", sub: "brushes_interior", price: 16, rating: 4.2,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality", "more_services"],
    pros: ["Gentle on interior surfaces", "Versatile"], cons: ["Small"] },
  { id: "bi-drillbrush", name: "Drill Brush Attachment Kit", sub: "brushes_interior", price: 15, rating: 4.0,
    bestFor: ["beginner", "intermediate"], goals: ["work_faster", "more_services"],
    pros: ["Fast on carpets and mats"], cons: ["Can be aggressive if careless"] },
  { id: "bi-tuffstuff", name: "Tuff Stuff Interior Brush Set", sub: "brushes_interior", price: 20, rating: 4.1,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["more_services"],
    pros: ["Durable bristles", "Good on seats and carpet"], cons: ["Basic"] },

  // ---- Paint Care · Polishers ----
  { id: "po-bauerda", name: "Bauer 6\" Dual-Action Polisher", sub: "polishers", price: 90, rating: 3.9,
    bestFor: ["beginner"], goals: ["improve_quality", "more_services"],
    pros: ["Cheapest way into correction", "Forgiving DA action"], cons: ["Less durable", "Weaker motor"] },
  { id: "po-pc7424", name: "Porter Cable 7424XP", sub: "polishers", price: 140, rating: 4.3,
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality", "more_services"],
    pros: ["Proven starter DA", "Huge pad/support ecosystem"], cons: ["Shorter throw", "Older design"] },
  { id: "po-griotsg9", name: "Griot's Garage G9", sub: "polishers", price: 220, rating: 4.7,
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "upgrade", "more_services"],
    pros: ["Smooth long-throw", "Reliable workhorse"], cons: ["Costs more than a starter"] },
  { id: "po-rupes15", name: "Rupes LHR15 Mark III", sub: "polishers", price: 420, rating: 4.8,
    bestFor: ["professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Pro-level finish", "Ergonomic for long days"], cons: ["Expensive"] },

  // ---- Paint Care · Pads ----
  { id: "pd-generic", name: "Generic Foam Pad Kit (7pc)", sub: "pads", price: 20, rating: 3.6,
    bestFor: ["beginner"], goals: ["improve_quality"],
    pros: ["Cheap to learn on"], cons: ["Inconsistent", "Short life"] },
  { id: "pd-lakecountry", name: "Lake Country Hex-Logic Pads (6-pack)", sub: "pads", price: 45, rating: 4.5,
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality", "more_services"],
    pros: ["Versatile set", "Reliable results"], cons: ["Foam wears with use"] },
  { id: "pd-buffshine", name: "Buff and Shine Uro-Tec Pads (set)", sub: "pads", price: 50, rating: 4.4,
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Color-coded", "Consistent cut/finish"], cons: ["Pricier"] },

  // ---- Paint Care · Compounds ----
  { id: "cp-meg-uc", name: "Meguiar's Ultimate Compound", sub: "compounds", price: 15, rating: 4.2,
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    pros: ["Cheap", "Easy", "Everywhere"], cons: ["Less cut on heavy defects"] },
  { id: "cp-sonax-pf", name: "Sonax Perfect Finish", sub: "compounds", price: 22, rating: 4.6,
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "more_services"],
    pros: ["One-step capable", "Great finish"], cons: ["Costs a bit more"] },
  { id: "cp-menzerna400", name: "Menzerna Heavy Cut 400", sub: "compounds", price: 25, rating: 4.5,
    bestFor: ["professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Strong cut", "Pro-level correction"], cons: ["Rewards good technique"] },

  // ---- Mobile · Generators ----
  { id: "gn-predator", name: "Predator 2000 Inverter", sub: "generators", price: 500, rating: 4.2,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile"],
    pros: ["Affordable inverter", "Portable"], cons: ["Less refined", "Thinner support network"] },
  { id: "gn-champion2500", name: "Champion 2500W Inverter", sub: "generators", price: 700, rating: 4.4,
    bestFor: ["intermediate"], goals: ["start_mobile", "upgrade"],
    pros: ["Good balance of price and quiet", "Warranty"], cons: ["Heavier than premium units"] },
  { id: "gn-honda2200", name: "Honda EU2200i", sub: "generators", price: 1100, rating: 4.9,
    bestFor: ["professional"], goals: ["start_mobile", "upgrade"],
    pros: ["Extremely reliable", "Quiet", "Holds resale value"], cons: ["Expensive"] },

  // ---- Mobile · Water tanks ----
  { id: "wt-35", name: "35-Gallon Portable Water Tank", sub: "water_tanks", price: 130, rating: 4.1,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile"],
    pros: ["Right size to start", "Affordable"], cons: ["Needs securing in the vehicle"] },
  { id: "wt-65", name: "65-Gallon Baffled Tank", sub: "water_tanks", price: 260, rating: 4.5,
    bestFor: ["intermediate", "professional"], goals: ["start_mobile", "upgrade", "work_faster"],
    pros: ["Fewer refill trips", "Baffled for safer transport"], cons: ["Weight and space"] },
  { id: "wt-100", name: "100-Gallon System w/ Pump", sub: "water_tanks", price: 500, rating: 4.6,
    bestFor: ["professional"], goals: ["upgrade", "work_faster"],
    pros: ["A full day of jobs between refills", "Pump-fed"], cons: ["Heavy", "Install effort"] },

  // ---- Mobile · Storage ----
  { id: "sto-plano", name: "Plano/Generic Bin Set", sub: "storage", price: 45, rating: 3.7,
    bestFor: ["beginner"], goals: ["start_mobile"],
    pros: ["Cheap", "Gets you rolling"], cons: ["Flimsy", "Disorganized quickly"] },
  { id: "sto-dewalt", name: "DeWalt ToughSystem 2.0 (3pc)", sub: "storage", price: 180, rating: 4.6,
    bestFor: ["intermediate", "professional"], goals: ["start_mobile", "upgrade"],
    pros: ["Modular and stackable", "Durable and mobile"], cons: ["Costs more"] },
  { id: "sto-packout", name: "Milwaukee Packout Starter", sub: "storage", price: 200, rating: 4.7,
    bestFor: ["professional"], goals: ["upgrade", "start_mobile"],
    pros: ["Rugged", "Expandable ecosystem"], cons: ["Premium price"] },

  // ---- Mobile · Lighting ----
  { id: "li-neiko", name: "NEIKO Rechargeable Work Light", sub: "lighting", price: 35, rating: 3.9,
    bestFor: ["beginner", "intermediate"], goals: ["start_mobile", "work_faster"],
    pros: ["Cheap", "Portable"], cons: ["Not color-accurate for defects"] },
  { id: "li-astro", name: "Astro Pneumatic Cordless Swirl Light", sub: "lighting", price: 90, rating: 4.4,
    bestFor: ["intermediate"], goals: ["improve_quality", "work_faster"],
    pros: ["Good balance", "Cordless"], cons: ["Mid brightness"] },
  { id: "li-scangrip", name: "Scangrip Sunmatch 3", sub: "lighting", price: 190, rating: 4.7,
    bestFor: ["professional"], goals: ["improve_quality", "upgrade"],
    pros: ["Color-accurate defect finding", "Pro standard"], cons: ["Pricey", "Niche use"] },

  // ===== Exterior wash chemicals ===========================================
  // ---- Car shampoos ----
  { id: "sh-mrpink", name: "Chemical Guys Mr. Pink", sub: "shampoo", price: 15, rating: 4.2, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], business: ["hobby", "mobile"], tags: ["popular"],
    useCase: "High-suds everyday maintenance wash", pros: ["Slick and sudsy", "Great value"], cons: ["Not very concentrated"] },
  { id: "sh-goldclass", name: "Meguiar's Gold Class Shampoo", sub: "shampoo", price: 12, rating: 4.3, brand: "Meguiar's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Gentle gloss-boosting weekly wash", pros: ["Everywhere", "Conditions paint"], cons: ["Thinner suds"] },
  { id: "sh-bathe", name: "Gyeon Q²M Bathe+", sub: "shampoo", price: 22, rating: 4.6, brand: "Gyeon",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "more_services"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "pH-neutral wash safe over coatings", pros: ["Coating-safe", "Very slick"], cons: ["Costs more per wash"] },

  // ---- Snow foam ----
  { id: "sf-autofoam", name: "Bilt Hamber Auto-Foam", sub: "snow_foam", price: 25, rating: 4.7, brand: "Bilt Hamber",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "work_faster"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Touchless pre-wash that strips traffic film", pros: ["Actually cleans, not just foam", "Very dilutable"], cons: ["Thinner than show-foams"] },
  { id: "sf-honeydew", name: "Chemical Guys Honeydew Snow Foam", sub: "snow_foam", price: 18, rating: 4.1, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["popular"],
    useCase: "Thick, clinging show foam", pros: ["Great foam", "Pleasant scent"], cons: ["More looks than cleaning"] },
  { id: "sf-adams", name: "Adam's Mega Foam", sub: "snow_foam", price: 20, rating: 4.3, brand: "Adam's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Balanced foam-and-clean pre-wash", pros: ["Good clinging foam", "pH balanced"], cons: ["Mid concentration"] },

  // ---- Pre-wash ----
  { id: "prw-surfex", name: "Bilt Hamber Surfex HD", sub: "pre_wash", price: 18, rating: 4.6, brand: "Bilt Hamber",
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "improve_quality"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Bug, grime and traffic-film pre-soak", pros: ["Strong yet safe", "Hugely dilutable"], cons: ["Needs mixing"] },
  { id: "prw-citrifoam", name: "P&S Citri-Foam Concentrate", sub: "pre_wash", price: 22, rating: 4.4, brand: "P&S",
    bestFor: ["intermediate"], goals: ["work_faster"],
    useCase: "Citrus pre-cleaner for heavy soil", pros: ["Cuts grease fast"], cons: ["Not coating-friendly when strong"] },

  // ---- Wheel cleaners ----
  { id: "wc-sonax", name: "Sonax Full Effect Wheel Cleaner", sub: "wheel_cleaner", price: 20, rating: 4.6, brand: "Sonax",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "work_faster"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Color-changing iron & brake-dust remover", pros: ["Reaches tight spots", "Satisfying results"], cons: ["Strong smell"] },
  { id: "wc-brakebuster", name: "P&S Brake Buster", sub: "wheel_cleaner", price: 18, rating: 4.5, brand: "P&S",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["work_faster"], tags: ["popular"],
    useCase: "Non-acid daily wheel & tire cleaner", pros: ["Versatile", "Safe on most finishes"], cons: ["Heavy dirt needs agitation"] },
  { id: "wc-adams", name: "Adam's Wheel & Tire Cleaner", sub: "wheel_cleaner", price: 17, rating: 4.3, brand: "Adam's",
    bestFor: ["beginner"], goals: ["improve_quality"],
    useCase: "Beginner-friendly wheel cleaner", pros: ["Easy to use", "Good scent"], cons: ["Milder on baked-on dust"] },

  // ---- Tire cleaners ----
  { id: "tc-superdegreaser", name: "Meguiar's Super Degreaser", sub: "tire_cleaner", price: 16, rating: 4.3, brand: "Meguiar's",
    bestFor: ["intermediate", "professional"], goals: ["work_faster"],
    useCase: "Deep-cleans tires before dressing", pros: ["Strips old dressing", "Dilutable"], cons: ["Keep off trim"] },
  { id: "tc-adams", name: "Adam's Tire & Rubber Cleaner", sub: "tire_cleaner", price: 15, rating: 4.2, brand: "Adam's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Preps tires for a clean dressing bond", pros: ["Simple", "Affordable"], cons: ["Needs a stiff brush"] },

  // ---- Glass cleaners ----
  { id: "gc-invisible", name: "Stoner Invisible Glass", sub: "glass_cleaner", price: 6, rating: 4.5, brand: "Stoner",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Streak-free auto glass in one pass", pros: ["No haze or film", "Cheap"], cons: ["Aerosol runs out fast"] },
  { id: "gc-cg", name: "Chemical Guys Signature Glass Cleaner", sub: "glass_cleaner", price: 12, rating: 4.1, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Ammonia-free, tint-safe glass", pros: ["Tint safe", "Good value jug"], cons: ["Wants good towels"] },

  // ===== Decontamination ===================================================
  // ---- Clay ----
  { id: "cl-mothers", name: "Mothers California Gold Clay Kit", sub: "clay", price: 18, rating: 4.3, brand: "Mothers",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "First-time paint decontamination", pros: ["Everything to start", "Forgiving"], cons: ["Bar ruins if dropped"] },
  { id: "cl-gyeonmitt", name: "Gyeon Q²M Clay Mitt Fine", sub: "clay", price: 30, rating: 4.6, brand: "Gyeon",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality", "work_faster"], business: ["shop"], tags: ["pro"],
    useCase: "Fast decon over large panels", pros: ["Reusable", "Much quicker than a bar"], cons: ["Needs plenty of lube"] },

  // ---- Iron removers ----
  { id: "ir-ironx", name: "CarPro IronX", sub: "iron_remover", price: 25, rating: 4.7, brand: "CarPro",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Dissolves bonded iron fallout", pros: ["Industry benchmark", "Great on wheels too"], cons: ["Strong sulfur smell"] },
  { id: "ir-gyeon", name: "Gyeon Q²M Iron", sub: "iron_remover", price: 22, rating: 4.6, brand: "Gyeon",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality"],
    useCase: "Coating-prep iron remover", pros: ["Effective", "Milder odor"], cons: ["Premium price"] },
  { id: "ir-adams", name: "Adam's Iron Remover", sub: "iron_remover", price: 20, rating: 4.3, brand: "Adam's",
    bestFor: ["beginner"], goals: ["improve_quality"],
    useCase: "Beginner intro to iron decon", pros: ["Easy to see it work"], cons: ["Less bite on heavy fallout"] },

  // ---- Tar removers ----
  { id: "tr-tarx", name: "CarPro TarX", sub: "tar_remover", price: 20, rating: 4.6, brand: "CarPro",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality"], tags: ["pro"],
    useCase: "Tar, glue and adhesive removal", pros: ["Fast acting", "Rinses clean"], cons: ["Solvent smell"] },
  { id: "tr-tarminator", name: "Stoner Tarminator", sub: "tar_remover", price: 10, rating: 4.4, brand: "Stoner",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Spot tar and sap removal", pros: ["Cheap", "Handy aerosol"], cons: ["Small can"] },

  // ---- Water spot removers ----
  { id: "ws-spotless", name: "CarPro Spotless", sub: "water_spot", price: 22, rating: 4.5, brand: "CarPro",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality"], tags: ["pro"],
    useCase: "Mineral water-spot & scale removal", pros: ["Saves wet-sanding", "Works on glass"], cons: ["Acidic — work carefully"] },
  { id: "ws-cg", name: "Chemical Guys Water Spot Remover", sub: "water_spot", price: 16, rating: 4.0, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Light spotting on paint & glass", pros: ["Affordable"], cons: ["Struggles on etched spots"] },

  // ===== Protection ========================================================
  // ---- Ceramic coatings ----
  { id: "cc-csl", name: "Gtechniq Crystal Serum Light", sub: "ceramic_coating", price: 80, rating: 4.8, brand: "Gtechniq",
    bestFor: ["professional"], goals: ["more_services", "improve_quality"], business: ["shop"], tags: ["premium"],
    useCase: "Multi-year pro-grade ceramic protection", pros: ["Very durable", "High gloss & slickness"], cons: ["Unforgiving of poor prep"] },
  { id: "cc-cquk", name: "CarPro CQuartz UK 3.0", sub: "ceramic_coating", price: 70, rating: 4.7, brand: "CarPro",
    bestFor: ["intermediate", "professional"], goals: ["more_services"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Forgiving pro coating for varied climates", pros: ["Easier to apply", "Great value per ml"], cons: ["Store cold"] },
  { id: "cc-adamsgraphene", name: "Adam's Graphene Ceramic Coating", sub: "ceramic_coating", price: 60, rating: 4.5, brand: "Adam's",
    bestFor: ["intermediate"], goals: ["more_services", "improve_quality"],
    useCase: "Prosumer graphene coating", pros: ["Slick finish", "Good kit support"], cons: ["Shorter life than flagships"] },
  { id: "cc-meghybrid", name: "Meguiar's Hybrid Ceramic Liquid Wax", sub: "ceramic_coating", price: 20, rating: 4.1, brand: "Meguiar's",
    bestFor: ["beginner"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Entry ceramic protection, no cure time", pros: ["Dead simple", "Cheap"], cons: ["Only lasts a few months"] },

  // ---- Paint sealants ----
  { id: "se-netshield", name: "Sonax Polymer Net Shield", sub: "sealant", price: 30, rating: 4.6, brand: "Sonax",
    bestFor: ["intermediate", "professional"], goals: ["improve_quality"], tags: ["pro"],
    useCase: "Durable synthetic sealant, ~6 months", pros: ["Long-lasting", "Slick"], cons: ["Pricey bottle"] },
  { id: "se-jetseal", name: "Chemical Guys JetSeal", sub: "sealant", price: 25, rating: 4.2, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Easy durable paint sealant", pros: ["Simple", "Good durability"], cons: ["Can streak if over-applied"] },
  { id: "se-fastfinish", name: "Meguiar's Ultimate Fast Finish", sub: "sealant", price: 22, rating: 4.4, brand: "Meguiar's",
    bestFor: ["beginner"], goals: ["work_faster"], tags: ["budget"],
    useCase: "Fast whole-car sealant via aerosol", pros: ["Very fast", "Beginner-proof"], cons: ["Aerosol depletes quickly"] },

  // ---- Spray waxes ----
  { id: "sw-detailspray", name: "Adam's Detail Spray", sub: "spray_wax", price: 13, rating: 4.5, brand: "Adam's",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["work_faster", "improve_quality"], tags: ["popular"],
    useCase: "Quick gloss & drying aid between washes", pros: ["Endlessly useful", "Streak-free"], cons: ["Not real protection"] },
  { id: "sw-wetcoat", name: "Gyeon Q²M WetCoat", sub: "spray_wax", price: 25, rating: 4.6, brand: "Gyeon",
    bestFor: ["intermediate", "professional"], goals: ["work_faster"], business: ["shop"], tags: ["pro"],
    useCase: "Spray-on, rinse-off ceramic topper", pros: ["Insanely fast", "Great beading"], cons: ["Needs a clean surface"] },
  { id: "sw-hybridwax", name: "Meguiar's Hybrid Ceramic Wax", sub: "spray_wax", price: 20, rating: 4.4, brand: "Meguiar's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Spray ceramic wax after a wash", pros: ["Easy", "Nice slickness"], cons: ["Shorter-lived than a coating"] },

  // ---- Tire dressings ----
  { id: "td-perl", name: "CarPro PERL", sub: "tire_dressing", price: 20, rating: 4.6, brand: "CarPro",
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "more_services"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Dilutable satin-to-gloss tire & trim dressing", pros: ["One product, many uses", "Natural finish"], cons: ["Multiple coats for high gloss"] },
  { id: "td-adams", name: "Adam's Tire Shine", sub: "tire_dressing", price: 15, rating: 4.3, brand: "Adam's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["popular"],
    useCase: "Glossy, sling-free tire shine", pros: ["Even finish", "Smells great"], cons: ["Glossier than some like"] },
  { id: "td-endurance", name: "Meguiar's Endurance Gel", sub: "tire_dressing", price: 10, rating: 4.1, brand: "Meguiar's",
    bestFor: ["beginner"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Long-lasting high-gloss gel", pros: ["Cheap", "Durable"], cons: ["Sling if over-applied"] },

  // ===== Interior chemicals ================================================
  // ---- Interior cleaners ----
  { id: "ic-xpress", name: "P&S Xpress Interior Cleaner", sub: "interior_cleaner", price: 18, rating: 4.6, brand: "P&S",
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "improve_quality"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Ready-to-use wipe-down for most surfaces", pros: ["No streaks", "Pleasant matte finish"], cons: ["RTU costs more than concentrate"] },
  { id: "ic-total", name: "Chemical Guys Total Interior", sub: "interior_cleaner", price: 14, rating: 4.2, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["popular"],
    useCase: "Clean-and-protect with UV defense", pros: ["One-step", "Anti-static"], cons: ["Not a heavy degreaser"] },

  // ---- All-purpose cleaners ----
  { id: "apc-greenstar", name: "Koch-Chemie Green Star", sub: "apc", price: 22, rating: 4.7, brand: "Koch-Chemie",
    bestFor: ["intermediate", "professional"], goals: ["work_faster", "more_services"], business: ["shop"], tags: ["pro"],
    useCase: "Dilutable pro all-purpose cleaner", pros: ["Scales gentle to strong", "Great value diluted"], cons: ["Concentrate needs mixing"] },
  { id: "apc-d101", name: "Meguiar's D101 All Purpose Cleaner", sub: "apc", price: 20, rating: 4.5, brand: "Meguiar's",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["work_faster"], tags: ["popular"],
    useCase: "Workhorse dilutable APC", pros: ["Versatile", "Widely available"], cons: ["Harsh at strong dilutions"] },
  { id: "apc-adams", name: "Adam's All Purpose Cleaner", sub: "apc", price: 13, rating: 4.2, brand: "Adam's",
    bestFor: ["beginner"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Ready-to-use APC for light jobs", pros: ["Grab-and-go", "Affordable"], cons: ["Less economical than concentrate"] },

  // ---- Leather cleaners ----
  { id: "lc-gyeon", name: "Gyeon Q²M Leather Cleaner", sub: "leather_cleaner", price: 20, rating: 4.5, brand: "Gyeon",
    bestFor: ["intermediate", "professional"], goals: ["more_services", "improve_quality"], tags: ["pro"],
    useCase: "pH-balanced clean for coated leather", pros: ["Gentle yet effective", "No greasy residue"], cons: ["Premium price"] },
  { id: "lc-cg", name: "Chemical Guys Leather Cleaner", sub: "leather_cleaner", price: 15, rating: 4.2, brand: "Chemical Guys",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"],
    useCase: "Everyday leather & vinyl cleaning", pros: ["Affordable", "Mild"], cons: ["Heavy soiling needs repeats"] },

  // ---- Leather conditioners ----
  { id: "lcn-lexol", name: "Lexol Leather Conditioner", sub: "leather_conditioner", price: 12, rating: 4.4, brand: "Lexol",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["improve_quality"], tags: ["budget", "popular"],
    useCase: "Restores suppleness to worn leather", pros: ["Time-tested", "Non-greasy"], cons: ["Plain packaging"] },
  { id: "lcn-l1", name: "Gtechniq L1 Leather Guard", sub: "leather_conditioner", price: 25, rating: 4.6, brand: "Gtechniq",
    bestFor: ["professional"], goals: ["more_services"], business: ["shop"], tags: ["pro"],
    useCase: "Durable protective leather coating", pros: ["Long-lasting protection", "Natural matte look"], cons: ["Coated leather only"] },

  // ---- Fabric cleaners ----
  { id: "fab-303", name: "303 Fabric Cleaner", sub: "fabric_cleaner", price: 14, rating: 4.3, brand: "303",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["popular"],
    useCase: "Spot-clean cloth seats & headliners", pros: ["Gentle on headliners", "Fresh scent"], cons: ["Deep stains need an extractor"] },
  { id: "fab-tuffstuff", name: "Tuff Stuff Multi-Purpose Foam", sub: "fabric_cleaner", price: 8, rating: 4.0, brand: "Tuff Stuff",
    bestFor: ["beginner"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Cheap foaming cleaner for fabric", pros: ["Very cheap", "Foaming action"], cons: ["Basic", "Can over-wet"] },

  // ---- Carpet cleaners ----
  { id: "cpt-bomber", name: "P&S Carpet Bomber", sub: "carpet_cleaner", price: 16, rating: 4.5, brand: "P&S",
    bestFor: ["intermediate", "professional"], goals: ["more_services", "work_faster"], business: ["mobile", "shop"], tags: ["pro"],
    useCase: "Encapsulating carpet & mat cleaner", pros: ["Lifts dirt for easy extraction", "Great scent"], cons: ["Best paired with an extractor"] },
  { id: "cpt-meg", name: "Meguiar's Carpet & Upholstery Cleaner", sub: "carpet_cleaner", price: 12, rating: 4.2, brand: "Meguiar's",
    bestFor: ["beginner", "intermediate"], goals: ["improve_quality"], tags: ["budget"],
    useCase: "Foaming spot cleaner for carpets", pros: ["Easy aerosol", "Cheap"], cons: ["Light-duty"] },

  // ---- Odor removers ----
  { id: "od-ozium", name: "Ozium Air Sanitizer", sub: "odor_remover", price: 8, rating: 4.4, brand: "Ozium",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["more_services"], tags: ["budget", "popular"],
    useCase: "Neutralizes smoke & odor fast", pros: ["Actually removes odor", "Cheap"], cons: ["Small bottle"] },
  { id: "od-newcar", name: "Chemical Guys New Car Scent", sub: "odor_remover", price: 10, rating: 4.1, brand: "Chemical Guys",
    bestFor: ["beginner"], goals: ["improve_quality"],
    useCase: "Fresh finishing scent after cleaning", pros: ["Popular scent", "Cheap"], cons: ["Masks rather than neutralizes"] },

  // ===== Wash tools · Hoses ================================================
  { id: "ho-flexzilla", name: "Flexzilla 5/8in Garden Hose (50ft)", sub: "hoses", price: 40, rating: 4.6, brand: "Flexzilla",
    bestFor: ["beginner", "intermediate", "professional"], goals: ["work_faster"], tags: ["popular"],
    useCase: "Kink-resistant hose that stays flexible", pros: ["Doesn't kink", "Light and flexible"], cons: ["Fittings can loosen over time"] },
  { id: "ho-giraffe", name: "Giraffe Tools Retractable Hose Reel", sub: "hoses", price: 90, rating: 4.5, brand: "Giraffe Tools",
    bestFor: ["professional"], goals: ["work_faster", "upgrade"], business: ["shop"], tags: ["pro"],
    useCase: "Wall-mounted reel for a fixed bay", pros: ["Tidy retractable reel", "Long reach"], cons: ["Needs wall mounting"] },
  { id: "ho-continental", name: "Continental Rubber Water Hose (50ft)", sub: "hoses", price: 30, rating: 4.2, brand: "Continental",
    bestFor: ["beginner"], goals: ["start_mobile"], tags: ["budget"],
    useCase: "Durable no-frills rubber hose", pros: ["Tough rubber", "Cheap"], cons: ["Heavier, can kink"] },
];

// ---------------------------------------------------------------------------
// Recommendation engine
// ---------------------------------------------------------------------------

export interface RecoContext {
  experience: Experience;
  goal: Goal;
  budgetCeiling: number; // per-item spend ceiling derived from the budget choice
  business?: BusinessType;
}

export type RankLabel = "Best Choice" | "Second Best" | "Budget Option" | "Closest to budget" | "Worth the stretch";

export interface Ranked {
  product: Product;
  label: RankLabel;
  overBudget: boolean;
  why: string;
}

const EXPERIENCE_FIT: Record<Experience, string> = {
  beginner: "Forgiving and easy to learn on when you're just starting out.",
  intermediate: "A solid step up that matches where your skills are.",
  professional: "Built to hold up to daily professional use.",
};

const GOAL_FIT: Record<Goal, string> = {
  start_mobile: "Well suited to getting a mobile setup off the ground.",
  upgrade: "A real upgrade over entry-level gear.",
  improve_quality: "Helps you get noticeably cleaner, more consistent results.",
  work_faster: "Helps you get through each job quicker.",
  more_services: "Opens up services you couldn't offer before.",
};

function scoreProduct(p: Product, ctx: RecoContext): number {
  let s = p.rating;
  if (p.bestFor.includes(ctx.experience)) s += 2.5;
  if (p.goals.includes(ctx.goal)) s += 2.5;
  if (ctx.business && productBusiness(p).includes(ctx.business)) s += 1;
  return s;
}

function whyFits(p: Product, ctx: RecoContext): string {
  const bits: string[] = [];
  if (p.bestFor.includes(ctx.experience)) bits.push(EXPERIENCE_FIT[ctx.experience]);
  if (p.goals.includes(ctx.goal)) bits.push(GOAL_FIT[ctx.goal]);
  let why = bits.join(" ");
  if (!why) why = "A dependable option here if you want to round out your kit.";
  if (p.price > ctx.budgetCeiling) {
    why = `Above your budget, but the standout in this category once you can stretch. ${why}`;
  }
  return why;
}

/**
 * Rank a subcategory for the given shopper. Returns up to three distinct picks:
 * the best-fitting affordable product, the runner-up, and the most affordable
 * solid option. If nothing fits the budget, returns the closest reaches instead
 * (clearly flagged over-budget) rather than pretending the category is empty.
 */
export function recommend(sub: SubcategoryKey, ctx: RecoContext): Ranked[] {
  const pool = PRODUCTS.filter((p) => p.sub === sub);
  const byScore = (a: Product, b: Product) =>
    scoreProduct(b, ctx) - scoreProduct(a, ctx) || b.rating - a.rating || a.price - b.price;

  const affordable = pool.filter((p) => p.price <= ctx.budgetCeiling).sort(byScore);
  const out: Ranked[] = [];
  const used = new Set<string>();
  const push = (p: Product | undefined, label: RankLabel) => {
    if (!p || used.has(p.id)) return;
    used.add(p.id);
    out.push({ product: p, label, overBudget: p.price > ctx.budgetCeiling, why: whyFits(p, ctx) });
  };

  if (affordable.length) {
    const best = affordable[0]; // highest fit score
    // The value pick is the genuinely cheapest affordable option — but only
    // call it out when it's actually cheaper than the Best Choice. Otherwise
    // the leftover item (which may be the PRICIEST) would get mislabeled
    // "Budget Option".
    const cheapest = affordable.slice().sort((a, b) => a.price - b.price)[0];
    const budgetPick = cheapest.id !== best.id && cheapest.price < best.price ? cheapest : undefined;
    // Runner-up is the next-highest fit that isn't already the best or budget pick.
    const second = affordable.find((p) => p.id !== best.id && p.id !== budgetPick?.id);

    push(best, "Best Choice");
    push(second, "Second Best");
    push(budgetPick, "Budget Option");
  } else {
    // Nothing within budget — show the nearest reaches, cheapest first.
    const byPrice = pool.slice().sort((a, b) => a.price - b.price);
    push(byPrice[0], "Closest to budget");
    push(byPrice[1], "Worth the stretch");
  }
  return out;
}

export const SUB_LABEL: Record<SubcategoryKey, string> = Object.fromEntries(
  (Object.keys(SUBCATEGORIES) as SubcategoryKey[]).map((k) => [k, SUBCATEGORIES[k].label])
) as Record<SubcategoryKey, string>;

export interface BudgetReality {
  /** True when every goal-critical category has at least one pick within budget. */
  realistic: boolean;
  /** Goal-critical categories where nothing fits the budget, with their entry price. */
  outOfReach: { sub: SubcategoryKey; label: string; entryPrice: number }[];
  /** Smallest per-item ceiling at which the whole goal kit comes into range. */
  suggestedCeiling: number;
}

/**
 * Honest gut-check on the budget for the chosen goal. Everything is derived from
 * the live catalog — entry prices and the suggested ceiling are computed, never
 * hardcoded — so this can't drift out of sync with the products. Only the
 * subcategories a goal actually depends on (GOAL_FOCUS) count against it, so a
 * $100 budget isn't scolded for not covering a $700 heated extractor it never
 * needed.
 */
export function assessBudget(goal: Goal, budgetCeiling: number): BudgetReality {
  const outOfReach: BudgetReality["outOfReach"] = [];
  let suggestedCeiling = budgetCeiling;

  for (const sub of GOAL_FOCUS[goal]) {
    const pool = PRODUCTS.filter((p) => p.sub === sub);
    if (!pool.length) continue;
    const entryPrice = Math.min(...pool.map((p) => p.price));
    suggestedCeiling = Math.max(suggestedCeiling, entryPrice);
    if (entryPrice > budgetCeiling) outOfReach.push({ sub, label: SUB_LABEL[sub], entryPrice });
  }

  outOfReach.sort((a, b) => a.entryPrice - b.entryPrice);
  return { realistic: outOfReach.length === 0, outOfReach, suggestedCeiling };
}

/** Ordered subcategories to display: goal-relevant ones first (badged). */
export function orderedSubcategories(goal: Goal): { category: string; sub: SubcategoryKey; label: string; focus: boolean }[] {
  const focus = new Set(GOAL_FOCUS[goal]);
  const rows = CATEGORIES.flatMap((c) =>
    c.subs.map((s) => ({ category: c.label, sub: s.key, label: s.label, focus: focus.has(s.key) }))
  );
  // Stable sort: focus rows first, otherwise keep catalog order.
  return rows.map((r, i) => ({ r, i })).sort((a, b) => Number(b.r.focus) - Number(a.r.focus) || a.i - b.i).map((x) => x.r);
}

export const PRICE_DISCLAIMER =
  "Prices are approximate street prices for guidance, and ratings are our editorial fit scores — not live pricing or sponsored placements. Always confirm current price and availability before buying.";

// ---------------------------------------------------------------------------
// Marketplace helpers — derivations, comparison metrics, curation & collections
// ---------------------------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp15 = (n: number) => Math.max(1, Math.min(5, n));

export function brandOf(p: Product): string | null {
  return p.brand ?? null;
}

export function useCaseOf(p: Product): string {
  return p.useCase ?? SUBCATEGORIES[p.sub].label;
}

export function productBusiness(p: Product): BusinessType[] {
  if (p.business?.length) return p.business;
  const out = new Set<BusinessType>();
  if (p.bestFor.includes("beginner")) out.add("hobby");
  if (p.bestFor.includes("intermediate")) out.add("mobile");
  if (p.bestFor.includes("professional")) out.add("shop");
  if (p.goals.includes("start_mobile")) out.add("mobile");
  if (!out.size) out.add("hobby");
  return [...out];
}

export interface GearMetrics { quality: number; durability: number; ease: number; pro: number; }

/**
 * Editorial comparison scores. `quality` is our overall fit rating; the others
 * are transparent derivations from the product's own attributes when not set
 * explicitly — guidance for comparison, not lab measurements.
 */
export function metricsOf(p: Product): GearMetrics {
  const quality = round1(clamp15(p.quality ?? p.rating));
  const durability = round1(clamp15(p.durability ?? p.rating + (p.bestFor.includes("professional") ? 0.2 : -0.2)));
  const ease = round1(clamp15(
    p.ease ?? p.rating
      + (p.bestFor.includes("beginner") ? 0.4 : 0)
      - (p.bestFor.length === 1 && p.bestFor[0] === "professional" ? 0.5 : 0)
  ));
  const pro = round1(clamp15(
    p.bestFor.includes("professional") ? p.rating + 0.2
      : p.bestFor.includes("intermediate") ? p.rating - 0.2
      : p.rating - 0.7
  ));
  return { quality, durability, ease, pro };
}

export const TAG_META: Record<ProductTag, { label: string; tone: "amber" | "violet" | "success" | "brand" }> = {
  popular: { label: "Most popular", tone: "amber" },
  pro: { label: "Pro favorite", tone: "violet" },
  budget: { label: "Best value", tone: "success" },
  premium: { label: "Premium", tone: "brand" },
};

/** One curation badge for a card — an explicit tag wins, else it's derived. */
export function badgeOf(p: Product): ProductTag | null {
  const t = p.tags ?? [];
  if (t.includes("premium")) return "premium";
  if (t.includes("pro")) return "pro";
  if (t.includes("popular")) return "popular";
  if (t.includes("budget")) return "budget";
  if (p.rating >= 4.7 && p.bestFor.includes("professional")) return "pro";
  if (p.rating >= 4.5 && p.price <= 30) return "popular";
  return null;
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function productsForSub(sub: SubcategoryKey): Product[] {
  return PRODUCTS.filter((p) => p.sub === sub);
}

export function productsForDept(dept: DepartmentKey): Product[] {
  return PRODUCTS.filter((p) => SUBCATEGORIES[p.sub].dept === dept);
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    (p.brand ?? "").toLowerCase().includes(q) ||
    SUBCATEGORIES[p.sub].label.toLowerCase().includes(q) ||
    useCaseOf(p).toLowerCase().includes(q)
  );
}

// ---- Collections ----------------------------------------------------------

export interface Profile {
  experience?: Experience;
  business?: BusinessType;
  goal?: Goal;
  budgetCeiling?: number;
}

export function mostPopular(limit = 8): Product[] {
  return [...PRODUCTS]
    .filter((p) => p.rating >= 4.4)
    .sort((a, b) => b.rating - a.rating || a.price - b.price)
    .slice(0, limit);
}

export function bestBudgetPicks(limit = 8): Product[] {
  return [...PRODUCTS]
    .filter((p) => p.rating >= 4.2)
    .map((p) => ({ p, v: p.rating - Math.log10(p.price + 1) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, limit)
    .map((x) => x.p);
}

export function proFavorites(limit = 8): Product[] {
  return [...PRODUCTS]
    .filter((p) => p.bestFor.includes("professional") && p.rating >= 4.6)
    .sort((a, b) => b.rating - a.rating || b.price - a.price)
    .slice(0, limit);
}

export function recommendedFor(profile: Profile, limit = 8): Product[] {
  const score = (p: Product) => {
    let s = p.rating;
    if (profile.experience && p.bestFor.includes(profile.experience)) s += 2;
    if (profile.goal && p.goals.includes(profile.goal)) s += 1.5;
    if (profile.business && productBusiness(p).includes(profile.business)) s += 1;
    if (profile.budgetCeiling && p.price <= profile.budgetCeiling) s += 0.5;
    return s;
  };
  return [...PRODUCTS].sort((a, b) => score(b) - score(a) || b.rating - a.rating).slice(0, limit);
}

export function upgradeSuggestions(profile: Profile, limit = 6): Product[] {
  // A step up: higher-rated gear that isn't strictly entry-level.
  const score = (p: Product) => {
    let s = p.rating + p.price / 400;
    if (profile.business && productBusiness(p).includes(profile.business)) s += 0.5;
    return s;
  };
  return [...PRODUCTS]
    .filter((p) => p.rating >= 4.5 && !(p.bestFor.length === 1 && p.bestFor[0] === "beginner"))
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}

// ---- Build My Setup -------------------------------------------------------

export interface Stage {
  key: "starter" | "growing" | "professional";
  label: string;
  blurb: string;
  subs: SubcategoryKey[];
}

export const STAGES: Stage[] = [
  {
    key: "starter", label: "Starter Detailer", blurb: "The core kit to take on paying jobs.",
    subs: ["pressure_washers", "foam_cannons", "shampoo", "towels", "wheel_cleaner", "tire_dressing", "vacuums", "interior_cleaner", "glass_cleaner"],
  },
  {
    key: "growing", label: "Growing Detailer", blurb: "Add correction and deeper interior work.",
    subs: ["pressure_washers", "foam_cannons", "shampoo", "towels", "iron_remover", "clay", "polishers", "pads", "compounds", "vacuums", "extractors", "interior_cleaner", "lighting", "spray_wax"],
  },
  {
    key: "professional", label: "Professional Detailer", blurb: "A full-service, high-throughput setup.",
    subs: ["pressure_washers", "foam_cannons", "shampoo", "snow_foam", "towels", "iron_remover", "clay", "polishers", "pads", "compounds", "vacuums", "extractors", "steam_cleaners", "ceramic_coating", "apc", "leather_cleaner", "lighting", "storage", "water_tanks"],
  },
];

export interface KitItem { sub: SubcategoryKey; label: string; product: Product; included: boolean; }
export interface KitResult {
  items: KitItem[];
  total: number;      // sum of included items
  fullTotal: number;  // sum of every essential (the ideal kit)
  budget: number;
  upgradeNext: KitItem | null;
  covered: number;
}

function pickForKit(sub: SubcategoryKey, ctx: RecoContext, priority: Priority): Product {
  const list = productsForSub(sub).slice();
  const fit = (p: Product) => scoreProduct(p, ctx);
  switch (priority) {
    case "cheapest":
      list.sort((a, b) => a.price - b.price || fit(b) - fit(a));
      break;
    case "value":
      list.sort((a, b) => (b.rating - Math.log10(b.price + 1)) - (a.rating - Math.log10(a.price + 1)) || fit(b) - fit(a));
      break;
    case "premium":
      list.sort((a, b) => b.rating - a.rating || b.price - a.price);
      break;
    case "performance":
    default:
      list.sort((a, b) => fit(b) - fit(a) || b.rating - a.rating);
  }
  return list[0];
}

/**
 * Assemble a complete kit for a stage within a total budget. Each essential is
 * chosen per the priority, then included in stage-priority order while the
 * running total stays within budget; the first item that doesn't fit is the
 * natural "upgrade next" target.
 */
export function buildSetup(stageKey: Stage["key"], budget: number, ctx: RecoContext, priority: Priority): KitResult {
  const stage = STAGES.find((s) => s.key === stageKey) ?? STAGES[0];
  let running = 0;
  const items: KitItem[] = stage.subs.map((sub) => {
    const product = pickForKit(sub, ctx, priority);
    const included = running + product.price <= budget;
    if (included) running += product.price;
    return { sub, label: SUBCATEGORIES[sub].label, product, included };
  });
  const fullTotal = items.reduce((s, i) => s + i.product.price, 0);
  const upgradeNext = items.find((i) => !i.included) ?? null;
  return { items, total: running, fullTotal, budget, upgradeNext, covered: items.filter((i) => i.included).length };
}

/** 🥇🥈🥉 trio for a single subcategory. */
export interface Trio { best: Product; alternative: Product | null; premium: Product | null; }
export function pickTrio(sub: SubcategoryKey, ctx: RecoContext, priority: Priority): Trio {
  const pool = productsForSub(sub);
  const best = pickForKit(sub, ctx, priority);
  const rest = pool.filter((p) => p.id !== best.id);
  const alternative = rest.slice().sort((a, b) => a.price - b.price)[0] ?? null;   // cheaper / different
  const premium = rest.slice().sort((a, b) => b.rating - a.rating || b.price - a.price)[0] ?? null; // higher-end
  return { best, alternative, premium };
}
