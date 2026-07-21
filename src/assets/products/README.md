# Product photos

Drop an **approved** product image here, named after the product's `id` in
`src/lib/shopCatalog.ts`. It is wired into that product's `image` automatically
and shown across the whole Shop (cards, detail page, featured spotlight).

- Accepted formats: `.png`, `.webp`, `.avif`, `.jpg` / `.jpeg`
- Name = product id, e.g. `carpro-reset.webp`, `carpro-ironx.png`, `ps-bead-maker.webp`
- Prefer a transparent-background PNG/WebP or a clean, roughly-square studio shot
  from a CDN-friendly source. The image component contains (never crops/stretches)
  and lazy-loads it, and falls back to the premium placeholder if it fails.

No file for a product → that product keeps the premium placeholder. Nothing here
invents, fetches, or scrapes URLs.

**Only add images you are licensed to use or that the brand has provided** —
no scraped/hotlinked brand images, no stock stand-ins, no AI-generated photos.

Flagship ids to prioritize (Pass #1):
`carpro-reset`, `carpro-ironx`, `carpro-perl`, `carpro-cquartz-uk`,
`koch-green-star`, `koch-gsf`, `koch-pol-star`,
`ps-bead-maker`, `ps-brake-buster`, `ps-xpress`,
`gyeon-bathe-plus`, `gyeon-wetcoat`, `gyeon-mohs`,
`meg-ultimate-compound`, `meg-hybrid-ceramic-wax`, `meg-gold-class`, `meg-m205`,
`rupes-lhr15`, `rupes-blue-pads`,
`griots-g9`, `griots-best-of-show-wax`,
`cg-honeydew`, `cg-torq-cannon`,
`rag-eagle-500`, `rag-creature`,
`lc-hdo`, `ik-foam-pro-2`, `mtm-pf22`,
`sonax-wheel-full`, `opt-onr`, `adams-graphene-spray`.
