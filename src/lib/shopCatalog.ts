import {
  Droplets,
  CircleDashed,
  CircleDot,
  Armchair,
  SprayCan,
  RectangleHorizontal,
  FlaskConical,
  Magnet,
  Layers,
  Grip,
  ShieldCheck,
  Droplet,
  Disc,
  Disc3,
  Sparkles,
  Circle,
  RotateCw,
  Waves,
  ShowerHead,
  Fan,
  Wind,
  Grid2x2,
  Brush,
  PaintBucket,
  Package,
  type LucideIcon,
} from "lucide-react";

/**
 * Detail Support Shop — a curated marketplace of professional detailing gear.
 *
 * This is a browse-only catalog: there is no checkout. Every product's Buy Now
 * links out to the official brand site (or an authorized retailer) in a new tab.
 * All descriptions are written fresh (no copyrighted marketing copy), and prices
 * are indicative placeholders. Everything here is plain data — add or edit
 * brands, categories, and products (and their `buyUrl`) in one place.
 */

export type BudgetTier = "$" | "$$" | "$$$";

export interface ShopCategory {
  slug: string;
  name: string;
  group: string;
  icon: LucideIcon;
  blurb: string;
}

export interface ShopBrand {
  slug: string;
  name: string;
  blurb: string;
  /** Official brand site. Used for Buy Now unless a product sets its own buyUrl. */
  url: string;
  country?: string;
  /** Signature accent colour (hex) for the brand landing page. */
  accent?: string;
  /** Short original tagline (a few words). */
  tagline?: string;
}

export interface ShopProduct {
  id: string;
  name: string;
  brand: string; // brand slug
  category: string; // category slug
  blurb: string; // short, for cards
  detail?: string; // longer, for the product page
  price?: number; // indicative placeholder
  rating: number; // 0–5
  reviews: number; // placeholder count
  budget: BudgetTier;
  pro?: boolean; // professional grade
  beginner?: boolean; // beginner friendly
  ceramicSafe?: boolean; // safe on ceramic-coated paint
  machine?: boolean; // machine / polisher use
  hand?: boolean; // hand application
  useCases?: string[]; // extra search terms
  featured?: boolean;
  bestSeller?: boolean;
  staffPick?: boolean;
  added: string; // ISO date — drives "Recently added"
  buyUrl?: string; // overrides the brand URL for Buy Now
  /**
   * Real product photo. Set this to a hosted image URL to show the actual
   * product; leave it unset (or if the URL fails to load) to fall back to the
   * premium branded placeholder. Prefer a transparent-background PNG or a clean
   * studio shot, ideally roughly square, served from a CDN. Only use images you
   * are licensed to use or that the brand has provided — do not hotlink or copy
   * from brand sites without permission, and do not use AI-generated shots.
   * e.g. image: "https://cdn.example.com/products/iron-x.png"
   */
  image?: string;
}

/* --- Categories ----------------------------------------------------------- */

export const CATEGORY_GROUPS = [
  "Wash & Clean",
  "Decontamination",
  "Protection",
  "Paint Correction",
  "Equipment",
  "Tools & Supplies",
] as const;

export const categories: ShopCategory[] = [
  { slug: "wash-soaps", name: "Wash Soaps", group: "Wash & Clean", icon: Droplets, blurb: "pH-balanced shampoos and snow foams" },
  { slug: "wheel-cleaners", name: "Wheel Cleaners", group: "Wash & Clean", icon: CircleDashed, blurb: "Brake dust and grime removers" },
  { slug: "tire-dressings", name: "Tire Dressings", group: "Wash & Clean", icon: CircleDot, blurb: "Satin to high-gloss rubber finishes" },
  { slug: "interior-cleaners", name: "Interior Cleaners", group: "Wash & Clean", icon: Armchair, blurb: "Fabric, plastic, and leather safe" },
  { slug: "apc", name: "APC", group: "Wash & Clean", icon: SprayCan, blurb: "Dilutable all-purpose cleaners" },
  { slug: "glass-cleaners", name: "Glass Cleaners", group: "Wash & Clean", icon: RectangleHorizontal, blurb: "Streak-free glass and mirrors" },
  { slug: "degreasers", name: "Degreasers", group: "Wash & Clean", icon: FlaskConical, blurb: "Engine bays and heavy grease" },
  { slug: "iron-removers", name: "Iron Removers", group: "Wash & Clean", icon: Magnet, blurb: "Dissolve embedded brake fallout" },
  { slug: "clay-bars", name: "Clay Bars", group: "Decontamination", icon: Layers, blurb: "Pull bonded surface contamination" },
  { slug: "clay-towels", name: "Clay Towels", group: "Decontamination", icon: Grip, blurb: "Faster mechanical decon" },
  { slug: "ceramic-coatings", name: "Ceramic Coatings", group: "Protection", icon: ShieldCheck, blurb: "Long-term SiO₂ / graphene protection" },
  { slug: "spray-sealants", name: "Spray Sealants", group: "Protection", icon: Droplet, blurb: "Fast-topping hydrophobic boosters" },
  { slug: "waxes", name: "Waxes", group: "Protection", icon: Disc, blurb: "Natural and synthetic paste waxes" },
  { slug: "compound", name: "Compound", group: "Paint Correction", icon: Disc3, blurb: "Cut heavy defects and sanding marks" },
  { slug: "polish", name: "Polish", group: "Paint Correction", icon: Sparkles, blurb: "Refine to a swirl-free finish" },
  { slug: "pads", name: "Pads", group: "Paint Correction", icon: Circle, blurb: "Foam, microfiber, and wool" },
  { slug: "polishers", name: "Polishers", group: "Paint Correction", icon: RotateCw, blurb: "Random-orbital and rotary machines" },
  { slug: "foam-cannons", name: "Foam Cannons", group: "Equipment", icon: Waves, blurb: "Thick pre-wash foam" },
  { slug: "pressure-washers", name: "Pressure Washers", group: "Equipment", icon: ShowerHead, blurb: "Wash-bay power and reach" },
  { slug: "vacuums", name: "Vacuums", group: "Equipment", icon: Fan, blurb: "Wet/dry pickup for interiors" },
  { slug: "air-blowers", name: "Air Blowers", group: "Equipment", icon: Wind, blurb: "Force-dry panels and crevices" },
  { slug: "extractors", name: "Extractors", group: "Equipment", icon: Droplets, blurb: "Deep-clean carpet and upholstery" },
  { slug: "towels", name: "Towels", group: "Tools & Supplies", icon: Grid2x2, blurb: "Buffing, drying, and glass microfiber" },
  { slug: "brushes", name: "Brushes", group: "Tools & Supplies", icon: Brush, blurb: "Wheels, interiors, and detailing" },
  { slug: "buckets", name: "Buckets", group: "Tools & Supplies", icon: PaintBucket, blurb: "Grit guards and wash systems" },
  { slug: "accessories", name: "Accessories", group: "Tools & Supplies", icon: Package, blurb: "Applicators, sprayers, and extras" },
];

/* --- Brands --------------------------------------------------------------- */

export const brands: ShopBrand[] = [
  { slug: "koch-chemie", name: "Koch-Chemie", country: "Germany", url: "https://www.koch-chemie.com", blurb: "German pro-grade chemistry trusted in high-volume shops and body shops." },
  { slug: "carpro", name: "CarPro", country: "South Korea", url: "https://www.carpro-us.com", blurb: "Detailer favorite known for Iron.X decontamination and CQuartz coatings." },
  { slug: "ps", name: "P&S", country: "USA", url: "https://www.pndsdetailproducts.com", blurb: "Professional Detail Products — a body-shop staple in the US pro scene." },
  { slug: "gyeon", name: "Gyeon", country: "South Korea", url: "https://www.gyeonquartz.com", blurb: "Q² coatings and prep chemistry engineered for accredited installers." },
  { slug: "griots", name: "Griot's Garage", country: "USA", url: "https://www.griotsgarage.com", blurb: "The BOSS machine + polish system with a deep accessory range." },
  { slug: "meguiars", name: "Meguiar's", country: "USA", url: "https://www.meguiars.com", blurb: "A century-old California brand spanning enthusiast to production detailing." },
  { slug: "chemical-guys", name: "Chemical Guys", country: "USA", url: "https://www.chemicalguys.com", blurb: "A huge catalog of washes, dressings, and kits for new and pro detailers." },
  { slug: "rag-company", name: "The Rag Company", country: "USA", url: "https://www.theragcompany.com", blurb: "Microfiber specialist — towels, drying, and applicators built for detailers." },
  { slug: "rupes", name: "Rupes", country: "Italy", url: "https://www.rupes.com", blurb: "Maker of the BigFoot random-orbital polishers and matched pad system." },
  { slug: "lake-country", name: "Lake Country", country: "USA", url: "https://www.lakecountrymfg.com", blurb: "Buffing and polishing pad manufacturer used across the industry." },
  { slug: "ik", name: "IK Sprayers", country: "Spain", url: "https://www.ik-sprayers.com", blurb: "Goizper's chemical-resistant pump and foam sprayers built for pro use." },
  { slug: "sonax", name: "Sonax", country: "Germany", url: "https://www.sonax.com", blurb: "German care brand with strong wheel cleaners and correction polishes." },
  { slug: "gtechniq", name: "Gtechniq", country: "UK", url: "https://www.gtechniq.com", blurb: "Coatings brand behind Crystal Serum and an accredited installer network." },
  { slug: "menzerna", name: "Menzerna", country: "Germany", url: "https://www.menzerna.com", blurb: "Precise cut-to-finish compounds and polishes trusted in correction work." },
  { slug: "adams", name: "Adam's Polishes", country: "USA", url: "https://www.adamspolishes.com", blurb: "Enthusiast brand with a broad graphene and ceramic spray range." },
  { slug: "kamikaze", name: "Kamikaze Collection", country: "Japan", url: "https://www.kamikazecollection.com", blurb: "Boutique Japanese coatings and care with a cult professional following." },
  { slug: "nanolex", name: "Nanolex", country: "Germany", url: "https://www.nanolex.com", blurb: "Coatings and prep chemistry made for coating professionals." },
  { slug: "bilt-hamber", name: "Bilt Hamber", country: "UK", url: "https://www.bilthamber.com", blurb: "UK chemistry famed for Auto-Foam pre-wash and Korrosol decon." },
  { slug: "3d", name: "3D", country: "USA", url: "https://www.3dproducts.com", blurb: "Pro line of compounds, polishes, and interior chemistry for shops." },
  { slug: "optimum", name: "Optimum", country: "USA", url: "https://www.optimumcarcare.com", blurb: "Creator of No Rinse (ONR) and shop-friendly coating systems." },
  { slug: "autoglym", name: "Autoglym", country: "UK", url: "https://www.autoglym.com", blurb: "Heritage trade and OEM detailing brand from the UK." },
  { slug: "auto-finesse", name: "Auto Finesse", country: "UK", url: "https://www.autofinesse.com", blurb: "UK detailing brand with a full chemical and accessory range." },
  { slug: "maxshine", name: "Maxshine", country: "China", url: "https://www.maxshine.com", blurb: "Value-focused polishers, brushes, and detailing accessories." },
  { slug: "mtm-hydro", name: "MTM Hydro", country: "Italy/USA", url: "https://www.mtmhydro.com", blurb: "Pressure-wash hardware and the PF22 foam cannon standard." },
  { slug: "metrovac", name: "MetroVac", country: "USA", url: "https://www.metrovac.com", blurb: "US-made metal vacuums and the Master Blaster force dryer." },
  { slug: "mytee", name: "Mytee", country: "USA", url: "https://www.mytee.com", blurb: "Carpet extractors and upholstery machines built for detailing." },
];

/* --- Products ------------------------------------------------------------- */

export const products: ShopProduct[] = [
  // Koch-Chemie
  { id: "koch-green-star", name: "Green Star APC", brand: "koch-chemie", category: "apc", blurb: "A high-alkaline all-purpose cleaner that dilutes wide for interiors, trim, and general grime.", detail: "A concentrated alkaline cleaner that tailors to the job through dilution — strong for engine bays and tires, gentle for interior plastics and fabric. A shop workhorse valued for consistency and yield.", price: 24, rating: 4.8, reviews: 412, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["all purpose", "interior", "engine bay", "pre-clean"], bestSeller: true, featured: true, added: "2024-09-14" },
  { id: "koch-gsf", name: "GSF Gentle Snow Foam", brand: "koch-chemie", category: "wash-soaps", blurb: "A pH-neutral pre-wash foam that clings and lifts loose dirt before contact washing.", detail: "A neutral snow foam designed to soften and lift the first layer of grime with minimal contact, so your wash mitt does less work and inflicts fewer marks. Coating-safe for maintenance washes.", price: 26, rating: 4.7, reviews: 288, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["snow foam", "pre-wash", "prewash"], bestSeller: true, added: "2024-10-01" },
  { id: "koch-reactive-rust", name: "Reactive Rust Remover", brand: "koch-chemie", category: "iron-removers", blurb: "A color-shifting iron remover that dissolves brake fallout from paint and wheels.", price: 28, rating: 4.7, reviews: 176, budget: "$$", pro: true, ceramicSafe: true, hand: true, useCases: ["iron fallout", "decon", "fallout"], added: "2024-08-20" },
  { id: "koch-1k-nano", name: "1K Nano Coating", brand: "koch-chemie", category: "ceramic-coatings", blurb: "A single-layer SiO₂ coating built for quick, durable professional application.", detail: "A one-step ceramic coating aimed at production environments — fast to apply and wipe, with strong gloss and hydrophobics for the time invested.", price: 90, rating: 4.6, reviews: 132, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating", "sio2"], staffPick: true, added: "2024-11-12" },
  { id: "koch-pol-star", name: "Pol Star Finishing Polish", brand: "koch-chemie", category: "polish", blurb: "A body-shop finishing polish that removes holograms and refines to a high gloss.", detail: "A fine finishing polish built to clear holograms and light machine marks, leaving a bright, glossy finish. A shop favorite for the final refinement step, especially on dark paint.", price: 26, rating: 4.7, reviews: 240, budget: "$$", pro: true, machine: true, useCases: ["polish", "finishing", "holograms", "jewelling"], staffPick: true, added: "2024-08-12" },

  // CarPro
  { id: "carpro-reset", name: "Reset Shampoo", brand: "carpro", category: "wash-soaps", blurb: "A pH-neutral maintenance shampoo that cleans well and rinses clean on coated paint.", detail: "A well-balanced wash formulated to be coating-friendly, leaving no fillers behind so protection performs as intended. Suds nicely without stripping.", price: 20, rating: 4.8, reviews: 934, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["shampoo", "maintenance wash", "coating safe"], bestSeller: true, featured: true, added: "2024-07-30" },
  { id: "carpro-ironx", name: "Iron.X Iron Remover", brand: "carpro", category: "iron-removers", blurb: "The category-defining iron remover that bleeds purple as it dissolves fallout.", detail: "The product that popularized chemical iron decontamination. Sprays on clear and turns purple as it reacts with embedded metal particles, then rinses free.", price: 25, rating: 4.9, reviews: 1520, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["iron fallout", "decon", "fallout", "wheels"], bestSeller: true, added: "2024-06-15" },
  { id: "carpro-cquartz-uk", name: "CQuartz UK 3.0", brand: "carpro", category: "ceramic-coatings", blurb: "A forgiving, high-gloss ceramic coating popular with installers in humid climates.", detail: "A prosumer-friendly SiO₂ coating known for an easy application window and warm gloss. A common first professional coating for its balance of durability and workability.", price: 75, rating: 4.8, reviews: 610, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating", "sio2"], featured: true, staffPick: true, added: "2024-10-22" },
  { id: "carpro-eraser", name: "Eraser Prep Spray", brand: "carpro", category: "degreasers", blurb: "A paint-prep solvent that strips polishing oils so coatings bond correctly.", price: 18, rating: 4.7, reviews: 421, budget: "$", pro: true, hand: true, useCases: ["panel prep", "ipa", "prep", "degrease"], added: "2024-09-02" },
  { id: "carpro-dlux", name: "DLUX Trim & Wheel Coating", brand: "carpro", category: "ceramic-coatings", blurb: "A durable coating for plastic trim and wheels that restores and protects.", price: 40, rating: 4.7, reviews: 355, budget: "$$", pro: true, hand: true, useCases: ["trim", "wheels", "coating"], added: "2024-11-05" },
  { id: "carpro-perl", name: "PERL Plastic & Rubber Coat", brand: "carpro", category: "tire-dressings", blurb: "A dilutable water-based dressing for tires, trim, rubber, and interior plastics.", detail: "A versatile, dilutable dressing that brings back a natural satin look on tires, exterior trim, engine bays, and interior plastics — one bottle covers a lot of the car. Dilute higher for a low-sheen interior finish, or use it stronger on tires.", price: 22, rating: 4.8, reviews: 1120, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["tires", "trim", "rubber", "interior", "dressing"], bestSeller: true, added: "2024-07-16" },

  // P&S
  { id: "ps-bead-maker", name: "Bead Maker", brand: "ps", category: "spray-sealants", blurb: "A spray sealant that lays down slick gloss and beading fast, great as a drying aid.", detail: "A hugely popular topper that flashes to a slick, glossy finish and can be applied as a drying aid or over coatings. A fast way to refresh protection between washes.", price: 22, rating: 4.9, reviews: 1980, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["spray sealant", "topper", "drying aid", "gloss"], bestSeller: true, featured: true, added: "2024-08-08" },
  { id: "ps-brake-buster", name: "Brake Buster Wheel Cleaner", brand: "ps", category: "wheel-cleaners", blurb: "A non-acid wheel cleaner that tackles brake dust and road film on most finishes.", price: 24, rating: 4.7, reviews: 640, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["wheels", "brake dust", "non-acid"], bestSeller: true, added: "2024-07-18" },
  { id: "ps-xpress", name: "Xpress Interior Cleaner", brand: "ps", category: "interior-cleaners", blurb: "A ready-to-use interior cleaner for plastics, vinyl, and light fabric with a clean scent.", price: 20, rating: 4.8, reviews: 512, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["interior", "plastics", "dash"], staffPick: true, added: "2024-10-12" },
  { id: "ps-absolute", name: "Absolute Rinseless Wash", brand: "ps", category: "wash-soaps", blurb: "A rinseless wash for low-water washing that encapsulates dirt for safer wiping.", price: 22, rating: 4.6, reviews: 233, budget: "$$", pro: true, ceramicSafe: true, hand: true, useCases: ["rinseless", "waterless", "maintenance"], added: "2024-09-25" },

  // Gyeon
  { id: "gyeon-bathe-plus", name: "Q²M Bathe+", brand: "gyeon", category: "wash-soaps", blurb: "A high-lubricity shampoo with a hydrophobic boost that helps water sheet on rinse.", detail: "A maintenance shampoo that adds a light hydrophobic layer as you wash, extending protection while cleaning. pH-neutral and coating-safe.", price: 23, rating: 4.7, reviews: 448, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["shampoo", "hydrophobic", "coating safe"], bestSeller: true, added: "2024-10-30" },
  { id: "gyeon-mohs", name: "Q² Mohs Evo Coating", brand: "gyeon", category: "ceramic-coatings", blurb: "A flagship professional ceramic coating focused on durability and slickness.", detail: "A high-durability SiO₂ coating aimed at installers, known for a slick finish and strong self-cleaning. Applied in a controlled environment for best results.", price: 110, rating: 4.8, reviews: 205, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating", "sio2"], featured: true, added: "2024-11-18" },
  { id: "gyeon-tire", name: "Q²M Tire Dressing", brand: "gyeon", category: "tire-dressings", blurb: "A water-based tire dressing that dials from satin to glossy with coats.", price: 21, rating: 4.6, reviews: 190, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["tires", "dressing", "satin"], added: "2024-08-28" },
  { id: "gyeon-wetcoat", name: "Q²M WetCoat", brand: "gyeon", category: "spray-sealants", blurb: "A spray-on, rinse-off SiO₂ sealant that leaves strong beading in minutes.", price: 30, rating: 4.7, reviews: 377, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["spray coating", "topper", "sio2", "beading"], staffPick: true, added: "2024-09-09" },

  // Griot's Garage
  { id: "griots-correcting-cream", name: "BOSS Correcting Cream", brand: "griots", category: "compound", blurb: "A one-step correcting compound that cuts moderate defects and finishes cleanly.", detail: "Part of the BOSS system, this cream cuts swirls and light defects while finishing down well enough for a one-step on many paints.", price: 25, rating: 4.7, reviews: 512, budget: "$$", pro: true, machine: true, useCases: ["compound", "correction", "swirls", "one step"], added: "2024-07-22" },
  { id: "griots-finishing-sealant", name: "BOSS Finishing Sealant", brand: "griots", category: "spray-sealants", blurb: "A durable synthetic sealant that locks in gloss after correction.", price: 20, rating: 4.6, reviews: 233, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["sealant", "protection", "gloss"], added: "2024-08-14" },
  { id: "griots-g9", name: "G9 Random Orbital Polisher", brand: "griots", category: "polishers", blurb: "A powerful long-throw random-orbital that corrects fast and stays comfortable.", detail: "A 15mm long-throw random-orbital polisher with strong torque and a comfortable body — a go-to machine for efficient correction with a forgiving learning curve.", price: 200, rating: 4.8, reviews: 640, budget: "$$$", pro: true, machine: true, useCases: ["polisher", "random orbital", "machine"], bestSeller: true, featured: true, added: "2024-11-01" },
  { id: "griots-best-of-show-wax", name: "Best of Show Wax", brand: "griots", category: "waxes", blurb: "A carnauba-rich show wax that lays down a warm, deep gloss by hand.", detail: "A blended carnauba wax that goes on and off easily and leaves a warm, wet-looking gloss — a favorite for a quick show finish over sealant or on its own.", price: 20, rating: 4.7, reviews: 520, budget: "$", beginner: true, hand: true, useCases: ["wax", "carnauba", "show", "gloss"], staffPick: true, added: "2024-08-09" },

  // Meguiar's
  { id: "meg-gold-class", name: "Gold Class Shampoo", brand: "meguiars", category: "wash-soaps", blurb: "A rich-foaming maintenance shampoo that's gentle and widely available.", price: 12, rating: 4.7, reviews: 2100, budget: "$", beginner: true, ceramicSafe: true, hand: true, useCases: ["shampoo", "wash"], bestSeller: true, added: "2024-06-30" },
  { id: "meg-ultimate-compound", name: "Ultimate Compound", brand: "meguiars", category: "compound", blurb: "An accessible compound that removes defects by hand or machine without harsh dust.", price: 14, rating: 4.7, reviews: 1750, budget: "$", beginner: true, machine: true, hand: true, useCases: ["compound", "correction", "swirls"], bestSeller: true, added: "2024-07-05" },
  { id: "meg-hot-rims", name: "Hot Rims Wheel Cleaner", brand: "meguiars", category: "wheel-cleaners", blurb: "A budget-friendly wheel cleaner for regular brake-dust maintenance.", price: 10, rating: 4.4, reviews: 520, budget: "$", beginner: true, hand: true, useCases: ["wheels", "brake dust"], added: "2024-08-02" },
  { id: "meg-m205", name: "M205 Ultra Finishing Polish", brand: "meguiars", category: "polish", blurb: "A pro finishing polish that refines to a high-gloss, swirl-free finish.", detail: "A shop-standard finishing polish that removes light haze and machine marks, leaving a clear, glossy finish ready for protection.", price: 18, rating: 4.8, reviews: 880, budget: "$", pro: true, machine: true, useCases: ["polish", "finishing", "jewelling"], staffPick: true, added: "2024-09-19" },
  { id: "meg-hybrid-ceramic-wax", name: "Hybrid Ceramic Wax", brand: "meguiars", category: "spray-sealants", blurb: "A spray-on, rinse-off SiO₂ wax that adds fast hydrophobic protection and gloss.", detail: "A widely-loved spray coating you mist onto a wet car and rinse — no buffing — for quick hydrophobic protection and shine. An easy way to keep water beading between full details.", price: 18, rating: 4.6, reviews: 1900, budget: "$", beginner: true, ceramicSafe: true, hand: true, useCases: ["spray coating", "ceramic wax", "topper", "hydrophobic"], bestSeller: true, added: "2024-07-02" },

  // Chemical Guys
  { id: "cg-honeydew", name: "Honeydew Snow Foam", brand: "chemical-guys", category: "wash-soaps", blurb: "A thick, scented snow foam pre-wash that's a fan favorite for foam cannons.", price: 20, rating: 4.6, reviews: 1300, budget: "$$", beginner: true, hand: true, useCases: ["snow foam", "pre-wash", "foam cannon"], bestSeller: true, added: "2024-06-20" },
  { id: "cg-torq-cannon", name: "TORQ Professional Foam Cannon", brand: "chemical-guys", category: "foam-cannons", blurb: "An adjustable foam cannon that produces thick foam from most pressure washers.", price: 60, rating: 4.5, reviews: 900, budget: "$$", beginner: true, hand: true, useCases: ["foam cannon", "pre-wash"], bestSeller: true, added: "2024-07-28" },
  { id: "cg-total-interior", name: "Total Interior Cleaner & Protectant", brand: "chemical-guys", category: "interior-cleaners", blurb: "A one-step interior spray that cleans and adds a matte, anti-static finish.", price: 15, rating: 4.5, reviews: 760, budget: "$", beginner: true, hand: true, useCases: ["interior", "protectant", "dash"], added: "2024-10-06" },
  { id: "cg-vrp", name: "VRP Dressing", brand: "chemical-guys", category: "tire-dressings", blurb: "A versatile dressing for tires, trim, and rubber with an even satin sheen.", price: 16, rating: 4.6, reviews: 940, budget: "$", beginner: true, hand: true, useCases: ["tires", "trim", "dressing", "satin"], added: "2024-08-30" },

  // The Rag Company
  { id: "rag-eagle-500", name: "Eagle Edgeless 500 Towel", brand: "rag-company", category: "towels", blurb: "A plush edgeless microfiber for buffing wax, sealant, and quick details.", detail: "A soft, edgeless 70/30 microfiber that buffs residues cleanly without marring — a shop standard sold in packs for high-volume use.", price: 6, rating: 4.9, reviews: 2400, budget: "$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["towel", "buffing", "microfiber"], bestSeller: true, featured: true, added: "2024-09-12" },
  { id: "rag-creature", name: "Creature Edgeless Drying Towel", brand: "rag-company", category: "towels", blurb: "A thick twist-loop drying towel that pulls a lot of water in one pass.", price: 25, rating: 4.8, reviews: 1120, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["drying towel", "microfiber"], staffPick: true, added: "2024-10-18" },
  { id: "rag-ultra-clay", name: "Ultra Clay Towel", brand: "rag-company", category: "clay-towels", blurb: "A rubber-polymer clay towel that decontaminates faster than a traditional bar.", price: 30, rating: 4.5, reviews: 410, budget: "$$", pro: true, hand: true, useCases: ["clay towel", "decon", "fallout"], added: "2024-11-08" },

  // Rupes
  { id: "rupes-lhr15", name: "LHR 15 Mark III BigFoot", brand: "rupes", category: "polishers", blurb: "A refined 15mm random-orbital that's smooth, quiet, and correction-capable.", detail: "The BigFoot 15mm random-orbital is prized for smoothness and low vibration over long sessions, with strong correction ability and an ecosystem of matched pads and polishes.", price: 400, rating: 4.8, reviews: 520, budget: "$$$", pro: true, machine: true, useCases: ["polisher", "random orbital", "bigfoot"], featured: true, added: "2024-11-15" },
  { id: "rupes-mini", name: "LHR 75E Mini BigFoot", brand: "rupes", category: "polishers", blurb: "A compact polisher for pillars, bumpers, and tight panels.", price: 340, rating: 4.7, reviews: 260, budget: "$$$", pro: true, machine: true, useCases: ["polisher", "spot", "tight areas"], added: "2024-10-27" },
  { id: "rupes-pads", name: "BigFoot Foam Pad Set", brand: "rupes", category: "pads", blurb: "Color-coded foam pads matched to the BigFoot machines and polishes.", price: 35, rating: 4.7, reviews: 340, budget: "$$", pro: true, machine: true, useCases: ["pads", "foam"], added: "2024-09-30" },
  { id: "rupes-blue-pads", name: "BigFoot Blue Coarse Foam Pads", brand: "rupes", category: "pads", blurb: "Coarse blue foam pads tuned for cutting on the BigFoot random-orbitals.", detail: "The coarse blue foam pad from the BigFoot system, matched to Rupes machines and polishes for efficient cutting and defect removal on long-throw random-orbitals.", price: 12, rating: 4.8, reviews: 410, budget: "$", pro: true, machine: true, useCases: ["pads", "foam", "cutting", "bigfoot"], added: "2024-09-05" },

  // Lake Country
  { id: "lc-hdo", name: "HDO Foam Cutting Pads", brand: "lake-country", category: "pads", blurb: "Durable high-density foam pads engineered for long-throw polishers.", price: 9, rating: 4.7, reviews: 480, budget: "$", pro: true, machine: true, useCases: ["pads", "foam", "cutting"], bestSeller: true, added: "2024-08-24" },
  { id: "lc-microfiber-pads", name: "Microfiber Cutting Pads", brand: "lake-country", category: "pads", blurb: "Microfiber pads that boost cut for efficient one- and two-step correction.", price: 10, rating: 4.6, reviews: 360, budget: "$", pro: true, machine: true, useCases: ["pads", "microfiber", "cutting"], added: "2024-09-16" },

  // IK Sprayers
  { id: "ik-foam-pro-2", name: "IK Foam Pro 2 Sprayer", brand: "ik", category: "foam-cannons", blurb: "A hand-pump foam sprayer that makes thick foam without a pressure washer.", detail: "A pump-up foamer that produces dense, clingy foam anywhere — ideal for pre-wash, wheels, and interiors where a pressure washer isn't practical.", price: 45, rating: 4.7, reviews: 690, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["foam", "pump sprayer", "pre-wash"], bestSeller: true, added: "2024-10-09" },
  { id: "ik-multi-15", name: "IK Multi 1.5 Sprayer", brand: "ik", category: "accessories", blurb: "A chemical-resistant pump sprayer for APCs, dressings, and prep chemistry.", price: 22, rating: 4.7, reviews: 410, budget: "$", pro: true, beginner: true, hand: true, useCases: ["sprayer", "apc", "chemical resistant"], added: "2024-08-11" },

  // Sonax
  { id: "sonax-wheel-full", name: "Wheel Cleaner Full Effect", brand: "sonax", category: "wheel-cleaners", blurb: "A color-changing wheel cleaner that dissolves iron and grime on delicate finishes.", price: 22, rating: 4.7, reviews: 830, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["wheels", "iron", "fallout"], bestSeller: true, added: "2024-07-14" },
  { id: "sonax-perfect-finish", name: "Profiline Perfect Finish", brand: "sonax", category: "compound", blurb: "A versatile compound that cuts and finishes across a range of paints.", price: 26, rating: 4.7, reviews: 420, budget: "$$", pro: true, machine: true, useCases: ["compound", "correction", "one step"], added: "2024-09-05" },

  // Gtechniq
  { id: "gtechniq-csl", name: "Crystal Serum Light", brand: "gtechniq", category: "ceramic-coatings", blurb: "A hard, glossy ceramic coating available to detailers, with strong chemical resistance.", detail: "A prosumer version of Gtechniq's flagship coating chemistry — a hard, high-gloss layer with good chemical and swirl resistance for the price tier.", price: 90, rating: 4.7, reviews: 300, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating"], featured: true, added: "2024-11-20" },
  { id: "gtechniq-c2", name: "C2v3 Spray Sealant", brand: "gtechniq", category: "spray-sealants", blurb: "A spray-applied SiO₂ sealant that adds slickness and beading in one wipe.", price: 28, rating: 4.6, reviews: 260, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["spray sealant", "sio2", "topper"], added: "2024-10-15" },

  // Menzerna
  { id: "menzerna-fg400", name: "Heavy Cut Compound 400", brand: "menzerna", category: "compound", blurb: "A strong-cutting compound that removes deep defects yet finishes surprisingly well.", detail: "A high-cut compound known for removing sanding marks and heavy swirls while still finishing cleanly enough to reduce polishing steps on many paints.", price: 24, rating: 4.8, reviews: 560, budget: "$$", pro: true, machine: true, useCases: ["compound", "heavy cut", "correction"], staffPick: true, added: "2024-08-18" },
  { id: "menzerna-sf3500", name: "Super Finish 3500", brand: "menzerna", category: "polish", blurb: "A final finishing polish for dark paint that chases the last bit of haze.", price: 26, rating: 4.8, reviews: 480, budget: "$$", pro: true, machine: true, useCases: ["polish", "finishing", "dark paint"], added: "2024-09-22" },

  // Adam's
  { id: "adams-graphene-spray", name: "Graphene Ceramic Spray Coating", brand: "adams", category: "spray-sealants", blurb: "A graphene-infused spray coating for fast, glossy protection between details.", price: 40, rating: 4.6, reviews: 1500, budget: "$$", beginner: true, ceramicSafe: true, hand: true, useCases: ["graphene", "spray coating", "topper"], bestSeller: true, added: "2024-10-25" },
  { id: "adams-shampoo", name: "Car Shampoo", brand: "adams", category: "wash-soaps", blurb: "A slick, pH-balanced shampoo that suds well and rinses clean.", price: 15, rating: 4.6, reviews: 980, budget: "$", beginner: true, ceramicSafe: true, hand: true, useCases: ["shampoo", "wash"], added: "2024-07-26" },

  // Kamikaze
  { id: "kamikaze-ism", name: "ISM Coat", brand: "kamikaze", category: "ceramic-coatings", blurb: "A boutique coating known for a deep, wet-look gloss favored on show cars.", price: 130, rating: 4.7, reviews: 120, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating", "gloss"], staffPick: true, added: "2024-11-10" },

  // Nanolex
  { id: "nanolex-si3d", name: "Si3D Coating", brand: "nanolex", category: "ceramic-coatings", blurb: "A professional SiO₂ coating with strong durability and an easy application window.", price: 80, rating: 4.6, reviews: 140, budget: "$$$", pro: true, hand: true, useCases: ["ceramic", "coating", "sio2"], added: "2024-09-28" },

  // Bilt Hamber
  { id: "bh-auto-foam", name: "Auto-Foam Pre-Wash", brand: "bilt-hamber", category: "wash-soaps", blurb: "A high-performing pre-wash foam that lifts a lot of dirt with little contact.", detail: "A pre-wash foam with a strong reputation for cleaning power, softening and removing traffic film so the contact wash does less and marring drops.", price: 22, rating: 4.8, reviews: 720, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["snow foam", "pre-wash", "traffic film"], featured: true, added: "2024-10-03" },
  { id: "bh-korrosol", name: "Korrosol Iron Remover", brand: "bilt-hamber", category: "iron-removers", blurb: "A fast-acting iron remover for wheels and paint decontamination.", price: 20, rating: 4.7, reviews: 380, budget: "$$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["iron", "fallout", "decon", "wheels"], added: "2024-08-06" },

  // 3D
  { id: "3d-glass", name: "GLW Glass Cleaner", brand: "3d", category: "glass-cleaners", blurb: "An ammonia-free glass cleaner that wipes streak-free on tinted windows.", price: 12, rating: 4.6, reviews: 540, budget: "$", pro: true, beginner: true, hand: true, useCases: ["glass", "windows", "tint safe"], bestSeller: true, added: "2024-07-09" },
  { id: "3d-aca-500", name: "ACA 500 Compound", brand: "3d", category: "compound", blurb: "A body-shop compound that cuts hard and dusts little for fast correction.", price: 22, rating: 4.6, reviews: 280, budget: "$$", pro: true, machine: true, useCases: ["compound", "correction", "body shop"], added: "2024-09-11" },

  // Optimum
  { id: "opt-onr", name: "No Rinse Wash & Shine (ONR)", brand: "optimum", category: "wash-soaps", blurb: "The original rinseless wash for safe, low-water washing and quick maintenance.", detail: "The product that mainstreamed rinseless washing — encapsulates dirt so it can be wiped away safely with minimal water, ideal where hoses aren't practical.", price: 18, rating: 4.7, reviews: 1600, budget: "$", pro: true, beginner: true, ceramicSafe: true, hand: true, useCases: ["rinseless", "waterless", "maintenance"], bestSeller: true, added: "2024-06-25" },

  // Autoglym
  { id: "autoglym-vinyl", name: "Vinyl & Rubber Care", brand: "autoglym", category: "tire-dressings", blurb: "A trim and tire dressing that restores a durable, natural satin finish.", price: 14, rating: 4.6, reviews: 610, budget: "$", beginner: true, hand: true, useCases: ["trim", "tires", "dressing"], added: "2024-08-16" },

  // Auto Finesse
  { id: "af-citrus-power", name: "Citrus Power Bug & Grime Remover", brand: "auto-finesse", category: "degreasers", blurb: "A citrus pre-wash that breaks down bugs, traffic film, and grease.", price: 16, rating: 4.6, reviews: 430, budget: "$", beginner: true, hand: true, useCases: ["degreaser", "bugs", "pre-wash", "traffic film"], added: "2024-09-07" },

  // Maxshine
  { id: "maxshine-m0s", name: "M0S Random Orbital Polisher", brand: "maxshine", category: "polishers", blurb: "A value random-orbital that brings correction to a budget-friendly price.", price: 130, rating: 4.4, reviews: 520, budget: "$$", beginner: true, machine: true, useCases: ["polisher", "random orbital", "budget"], added: "2024-10-20" },
  { id: "maxshine-brushes", name: "Detailing Brush Set", brand: "maxshine", category: "brushes", blurb: "A soft-bristle brush set for interiors, vents, emblems, and wheels.", price: 20, rating: 4.5, reviews: 380, budget: "$", beginner: true, hand: true, useCases: ["brushes", "interior", "detailing"], added: "2024-08-22" },

  // MTM Hydro
  { id: "mtm-pf22", name: "PF22 Foam Cannon", brand: "mtm-hydro", category: "foam-cannons", blurb: "A benchmark foam cannon that produces dense foam with fine adjustability.", detail: "A widely recommended foam cannon known for thick, adjustable foam and solid build quality — a common upgrade for pressure-washer wash setups.", price: 90, rating: 4.8, reviews: 1200, budget: "$$", pro: true, beginner: true, hand: true, useCases: ["foam cannon", "pre-wash", "pressure washer"], bestSeller: true, staffPick: true, added: "2024-10-28" },

  // MetroVac
  { id: "metrovac-master-blaster", name: "Master Blaster Revolution", brand: "metrovac", category: "air-blowers", blurb: "A powerful force dryer that blasts water from panels, grilles, and crevices.", detail: "A high-output filtered air blower that dries panels and flushes water from mirrors, badges, and trim without touching the paint — a touchless drying staple.", price: 300, rating: 4.8, reviews: 640, budget: "$$$", pro: true, useCases: ["air blower", "drying", "force dryer"], featured: true, added: "2024-11-06" },
  { id: "metrovac-vacnblo", name: "Vac N' Blo Detailer", brand: "metrovac", category: "vacuums", blurb: "A metal-body vacuum with strong suction for interior detailing.", price: 200, rating: 4.6, reviews: 300, budget: "$$$", pro: true, useCases: ["vacuum", "interior"], added: "2024-09-18" },

  // Mytee
  { id: "mytee-lite", name: "Lite Heated Extractor", brand: "mytee", category: "extractors", blurb: "A compact heated extractor for deep-cleaning carpets and upholstery.", detail: "A small-footprint carpet extractor with a heated option that helps lift stains and odors from seats and floors — sized for mobile and shop detailing.", price: 550, rating: 4.6, reviews: 210, budget: "$$$", pro: true, useCases: ["extractor", "carpet", "upholstery", "shampoo"], added: "2024-10-11" },

  // Buckets / accessories
  { id: "cg-bucket", name: "Detailing Bucket + Grit Guard", brand: "chemical-guys", category: "buckets", blurb: "A wash bucket with a grit guard that keeps grit off your mitt.", price: 25, rating: 4.6, reviews: 720, budget: "$", beginner: true, hand: true, useCases: ["bucket", "grit guard", "two bucket"], added: "2024-08-04" },
  { id: "griots-boars-brush", name: "Boar's Hair Detailing Brush", brand: "griots", category: "brushes", blurb: "A soft natural-bristle brush for safe agitation on paint, trim, and interiors.", price: 12, rating: 4.7, reviews: 340, budget: "$", pro: true, beginner: true, hand: true, useCases: ["brush", "boars hair", "interior"], added: "2024-09-13" },

  // Clay bars
  { id: "bh-auto-clay", name: "Auto-Clay Regular", brand: "bilt-hamber", category: "clay-bars", blurb: "A water-lubricated clay bar that pulls bonded fallout with very little marring.", price: 16, rating: 4.7, reviews: 410, budget: "$", pro: true, beginner: true, hand: true, useCases: ["clay", "decon", "fallout"], added: "2024-08-19" },
  { id: "meg-smooth-clay", name: "Smooth Surface Clay Kit", brand: "meguiars", category: "clay-bars", blurb: "A beginner-friendly clay kit with lubricant to smooth contaminated paint.", price: 20, rating: 4.6, reviews: 880, budget: "$", beginner: true, hand: true, useCases: ["clay", "decon", "kit"], added: "2024-07-11" },

  // Waxes
  { id: "cg-butter-wax", name: "Butter Wet Wax", brand: "chemical-guys", category: "waxes", blurb: "An easy-on, easy-off carnauba blend that adds warm gloss by hand.", price: 18, rating: 4.5, reviews: 1200, budget: "$", beginner: true, hand: true, useCases: ["wax", "carnauba", "gloss"], added: "2024-08-01" },
  { id: "af-desire", name: "Desire Paste Wax", brand: "auto-finesse", category: "waxes", blurb: "A carnauba paste wax that lays down a deep, glossy show finish.", price: 35, rating: 4.7, reviews: 260, budget: "$$", hand: true, useCases: ["wax", "paste", "carnauba", "show"], staffPick: true, added: "2024-10-14" },

  // Pressure washers
  { id: "mtm-pressure", name: "Pro Wash-Bay Pressure Washer", brand: "mtm-hydro", category: "pressure-washers", blurb: "A pro-oriented electric pressure washer package sized for detailing wash bays.", price: 400, rating: 4.5, reviews: 180, budget: "$$$", pro: true, useCases: ["pressure washer", "wash bay"], added: "2024-09-21" },
];

/* --- Local product photos -------------------------------------------------
   Approved product images live in `src/assets/products/`, named after the
   product id (e.g. `carpro-reset.webp` / `.png` / `.jpg` / `.avif`). Any file
   found there is wired into that product's `image` automatically and shown
   everywhere in the Shop. No files present → every product keeps its premium
   placeholder. This only maps files that actually exist — it never invents,
   fetches, or scrapes URLs. To add a photo, drop an approved file in that
   folder; to remove one, delete the file. */
const localProductImages = import.meta.glob<string>("../assets/products/*.{png,jpg,jpeg,webp,avif}", {
  eager: true,
  import: "default",
  query: "?url",
});
for (const [path, url] of Object.entries(localProductImages)) {
  const id = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  const target = products.find((p) => p.id === id);
  if (target && !target.image) target.image = url;
}

/* --- Lookups & selectors -------------------------------------------------- */

/** Per-brand signature accent + tagline (original copy). Kept separate so the
 *  brands array stays lean; merged into the brand by getBrand(). */
const BRAND_META: Record<string, { accent: string; tagline: string }> = {
  "koch-chemie": { accent: "#16A34A", tagline: "German precision, shop-proven" },
  carpro: { accent: "#E24A3B", tagline: "Decon and coatings, perfected" },
  ps: { accent: "#2563EB", tagline: "Body-shop grade, detailer loved" },
  gyeon: { accent: "#0EA5A6", tagline: "Coating science, installer-ready" },
  griots: { accent: "#DC2626", tagline: "The complete correction system" },
  meguiars: { accent: "#D69E2E", tagline: "A century of shine" },
  "chemical-guys": { accent: "#65A30D", tagline: "Big catalog, bold results" },
  "rag-company": { accent: "#F97316", tagline: "Microfiber, mastered" },
  rupes: { accent: "#EAB308", tagline: "The BigFoot standard" },
  "lake-country": { accent: "#0284C7", tagline: "Pads pros reach for" },
  ik: { accent: "#F59E0B", tagline: "Foam and spray, anywhere" },
  sonax: { accent: "#1D4ED8", tagline: "Engineered in Germany" },
  gtechniq: { accent: "#EA580C", tagline: "Coatings, accredited" },
  menzerna: { accent: "#CA8A04", tagline: "Cut to a flawless finish" },
  adams: { accent: "#DC2626", tagline: "Graphene-forward gloss" },
  kamikaze: { accent: "#E11D48", tagline: "Boutique gloss from Japan" },
  nanolex: { accent: "#2563EB", tagline: "Coating chemistry, refined" },
  "bilt-hamber": { accent: "#0D9488", tagline: "Decon done properly" },
  "3d": { accent: "#1D4ED8", tagline: "Production-line performance" },
  optimum: { accent: "#0891B2", tagline: "The no-rinse original" },
  autoglym: { accent: "#B91C1C", tagline: "British detailing heritage" },
  "auto-finesse": { accent: "#7C3AED", tagline: "Detailing, the British way" },
  maxshine: { accent: "#F97316", tagline: "Tools that punch above price" },
  "mtm-hydro": { accent: "#2563EB", tagline: "Wash-bay hardware" },
  metrovac: { accent: "#0369A1", tagline: "American-built airflow" },
  mytee: { accent: "#1D4ED8", tagline: "Extraction, done right" },
};

const brandMap = new Map(brands.map((b) => [b.slug, b]));
const categoryMap = new Map(categories.map((c) => [c.slug, c]));
const productMap = new Map(products.map((p) => [p.id, p]));

export const getBrand = (slug?: string): ShopBrand | undefined => {
  if (!slug) return undefined;
  const b = brandMap.get(slug);
  if (!b) return undefined;
  const meta = BRAND_META[slug];
  return meta ? { ...b, ...meta } : b;
};
export const getCategory = (slug?: string) => (slug ? categoryMap.get(slug) : undefined);
export const getProduct = (id?: string) => (id ? productMap.get(id) : undefined);

export const brandName = (slug: string) => brandMap.get(slug)?.name ?? slug;
export const categoryName = (slug: string) => categoryMap.get(slug)?.name ?? slug;

/** Buy Now target: product override, else the brand's official site. */
export const buyUrlFor = (p: ShopProduct) => p.buyUrl ?? brandMap.get(p.brand)?.url ?? "#";

export const productsForBrand = (slug: string) => products.filter((p) => p.brand === slug);
export const productsForCategory = (slug: string) => products.filter((p) => p.category === slug);
export const productCountForBrand = (slug: string) => productsForBrand(slug).length;
export const productCountForCategory = (slug: string) => productsForCategory(slug).length;

export const featuredProducts = () => products.filter((p) => p.featured);
export const bestSellers = () => products.filter((p) => p.bestSeller);
export const staffPicks = () => products.filter((p) => p.staffPick);
export const recentlyAdded = (n = 8) =>
  [...products].sort((a, b) => b.added.localeCompare(a.added)).slice(0, n);

export interface ShopFilters {
  brands: string[];
  categories: string[];
  budgets: BudgetTier[];
  pro: boolean;
  beginner: boolean;
  ceramicSafe: boolean;
  machine: boolean;
  hand: boolean;
}

export const emptyFilters = (): ShopFilters => ({
  brands: [],
  categories: [],
  budgets: [],
  pro: false,
  beginner: false,
  ceramicSafe: false,
  machine: false,
  hand: false,
});

/** Full-text-ish search across name, brand, category, and use cases. */
export function searchProducts(query: string, list: ShopProduct[] = products): ShopProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const terms = q.split(/\s+/);
  return list.filter((p) => {
    const hay = [
      p.name,
      brandName(p.brand),
      categoryName(p.category),
      p.blurb,
      ...(p.useCases ?? []),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

export function applyFilters(list: ShopProduct[], f: ShopFilters): ShopProduct[] {
  return list.filter((p) => {
    if (f.brands.length && !f.brands.includes(p.brand)) return false;
    if (f.categories.length && !f.categories.includes(p.category)) return false;
    if (f.budgets.length && !f.budgets.includes(p.budget)) return false;
    if (f.pro && !p.pro) return false;
    if (f.beginner && !p.beginner) return false;
    if (f.ceramicSafe && !p.ceramicSafe) return false;
    if (f.machine && !p.machine) return false;
    if (f.hand && !p.hand) return false;
    return true;
  });
}

export type SortKey = "popular" | "newest" | "rating" | "price-low" | "price-high";

export function sortProducts(list: ShopProduct[], key: SortKey): ShopProduct[] {
  const out = [...list];
  switch (key) {
    case "newest":
      return out.sort((a, b) => b.added.localeCompare(a.added));
    case "rating":
      return out.sort((a, b) => b.rating - a.rating);
    case "price-low":
      return out.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case "price-high":
      return out.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    case "popular":
    default:
      return out.sort((a, b) => b.reviews - a.reviews);
  }
}
