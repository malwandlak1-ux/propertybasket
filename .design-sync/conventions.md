# Property Basket — how to build with this design system

Property Basket is a South African proptech dashboard product. This design system is **tokens + a Tailwind utility vocabulary**, not a React component library: `_ds_bundle.js` has an empty export surface on purpose. Build screens from HTML elements plus the utility classes below — that is exactly how the product itself is written, so what you produce maps 1:1 onto shippable code.

## Setup

No provider, no theme wrapper, no imports. Link the stylesheet and write markup:

```html
<link rel="stylesheet" href="styles.css">
```

`styles.css` pulls in the brand webfonts, the compiled utility layer, and the token layer. Nothing else is required.

## The styling idiom — use these class families

Every name below is verified present in the shipped stylesheet.

| Family | Real class names |
|---|---|
| Brand | `bg-brand-500` `bg-brand-50` `bg-brand-100` `text-brand-600` `text-brand-700` `border-brand-100` `hover:bg-brand-500` `hover:bg-brand-50` `from-brand-500` `to-brand-700` |
| Neutrals (ink) | `text-ink-900` `text-ink-700` `text-ink-500` `text-ink-400` `bg-ink-50` `bg-ink-100` `bg-ink-900` `border-ink-200` `hover:bg-ink-50` |
| Status | `text-success` `text-warning` `text-danger` + tints `bg-success/15` `bg-warning/15` `bg-danger/15` |
| Elevation | `shadow-soft` (resting — preferred) · `shadow-card` (equivalent alias) · `shadow-lift` / `hover:shadow-lift` (hover) |
| Radius | `rounded-lg` (controls) · `rounded-xl` (cards) · `rounded-full` (chips) |
| Type | `font-display` (Space Grotesk) · `font-sans` (Plus Jakarta Sans) · `tracking-wider` `uppercase` `font-semibold` `font-bold` |

**Use `shadow-soft` for resting card elevation** — it's the name the product's own code uses everywhere. `shadow-card` is an equivalent alias kept for older call sites; prefer `shadow-soft` in new work.

## Non-negotiable brand rules

1. **Primary buttons are black at rest, brand orange on hover** — `bg-ink-900 text-white hover:bg-brand-500`. Never orange at rest; this inversion is the product's signature.
2. **Page background `bg-ink-50`, cards `bg-white`.** White cards on white are invisible here.
3. **The card recipe is fixed**: `bg-white rounded-xl border border-ink-200 p-5 shadow-soft`.
4. **Headings use Space Grotesk** (automatic on `h1/h2/h3`), body uses Plus Jakarta Sans. Never set display type on body copy.
5. **Dense, small type**: body `text-[13px]`/`text-[14px]`, eyebrow labels `text-[11px] uppercase tracking-wider font-semibold text-ink-500`, chips `text-[10px]`.
6. **One brand-gradient panel per screen**, for the single focal figure: `bg-gradient-to-br from-brand-500 to-brand-700`.
7. **South African formatting**: money `R 8 500` (space separator, no decimals), dates `08 Jul 2026`, timezone SAST.

## Where the truth lives

Read these before styling: `styles.css` and its imports (`_ds_bundle.css` — the full compiled utility layer; `tokens/tokens.css` — the readable token list), and the per-card notes in `components/Foundations/*/*.prompt.md` (Colors, Typography, Elevation, Patterns).

## Idiomatic example

```html
<div class="bg-ink-50 p-6">
  <p class="text-[11px] text-ink-500 uppercase tracking-wider font-semibold">Next rent due</p>
  <div class="mt-3 grid grid-cols-2 gap-4">
    <div class="bg-white rounded-xl border border-ink-200 p-5 shadow-soft hover:shadow-lift transition">
      <h3 class="text-base font-semibold">14 Marula Street</h3>
      <p class="text-[13px] text-ink-500 mt-1">Braamfontein, Johannesburg</p>
      <p class="text-2xl font-bold mt-3">R 8 500</p>
      <span class="mt-3 inline-block text-[10px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-bold uppercase">Due</span>
    </div>
  </div>
  <button class="mt-4 px-3.5 py-2 text-[13px] bg-ink-900 text-white rounded-lg hover:bg-brand-500 transition font-medium">Pay rent</button>
</div>
```
