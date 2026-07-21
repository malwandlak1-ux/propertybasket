# design-sync notes — Property Basket

## Shape: this repo is NOT a component library

Property Basket is a Laravel 12 + Inertia + React **application**, not a design-system package. There is no Storybook, no `*.stories.*`, no `dist/`, and `package.json` is `private: true` with no library entry/exports. **`package-build.mjs` cannot run here** — its `.d.ts` discovery resolves `node_modules/<cfg.pkg>/package.json`, which will never exist (attempted 2026-07; fails with ENOENT at `lib/dts.mjs:87`).

The `ds-bundle/` layout is therefore **authored off-script**, which the base SKILL.md explicitly permits ("the converter is the deterministic path to it, not the only path"). `package-validate.mjs` is still the gate and **exits 0**.

## Scope: foundations only

Synced = design tokens + the Tailwind utility vocabulary + 4 reference cards (Colors, Typography, Elevation, Patterns). Deliberately **no components**: 19 of 24 files in `resources/js/Components/` import `@inertiajs` (router, `usePage` props, live app routes) and cannot render standalone. `_ds_bundle.js` has an intentionally empty export surface.

## How the bundle is built (repeat these steps on re-sync)

1. `node "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build` — produces `public/build/assets/app-<hash>.css`.
2. Copy that file to `ds-bundle/_ds_bundle.css`. It is the **real compiled stylesheet**: 167 CSS custom properties (all `@theme` tokens) plus every Tailwind utility the app actually uses.
3. `styles.css` must `@import './_ds_bundle.css'` — rendered designs receive only the `styles.css` import closure.
4. `.ds-build-meta.json` must exist with `componentCount` equal to the number of `<Name>.html` previews (validate hard-fails on a mismatch).
5. Validate: `node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check`.

## Known render warns (expected, non-blocking)

- `_ds_sync.json absent` — correct for an off-script layout; there is no anchor, so every sync re-verifies from scratch.
- `[FONT_REMOTE]` — Plus Jakarta Sans / Space Grotesk load from a Google Fonts `@import`. Intentional; the app does the same.
- `[RENDER_SKIPPED]` — playwright was not installed (~200MB). Renders were instead verified in a real browser via computed styles (brand `#F26A1B`, ink-900 buttons, ink-200 borders, 12px radius, `bg-success/15` alpha, gradient, Plus Jakarta Sans all confirmed applied). Install playwright if you want the machine check.
- `tokens: 1 missing, below threshold` — a single unreferenced var in the compiled CSS; harmless.

## Bug found and FIXED (Jul 2026) — `shadow-soft` was undefined

**Found during this sync:** `shadow-soft` was used in **73 files** under `resources/js/`, but no `--shadow-soft` token existed and the class compiled to **zero** CSS — every one of those cards rendered with **no shadow at all**. The `@theme` only defined `--shadow-card` (used in 18 files) and `--shadow-lift`. CLAUDE.md's "Always use `shadow-soft` on cards" is what produced the drift.

**Fix applied:** added `--shadow-soft: 0 4px 12px rgba(15, 23, 42, 0.06);` to the `@theme` block in `resources/css/app.css`, alongside `--shadow-card` (kept as an equivalent alias so the 18 existing call sites keep working). Verified in-browser: `.shadow-soft` now computes to `rgba(15,23,42,0.06) 0px 4px 12px`.

⚠️ **This is a visual change across 73 files** — those cards gained their intended elevation. It ships to users only once `public/build` is rebuilt AND deployed (prod serves the built bundle, not the CSS source).

The design system documents **`shadow-soft`** as the canonical resting-elevation class, with `shadow-card` noted as the alias.

## Re-sync risks — what can silently go stale

- **`cfg.cssEntry` is pinned to a content-hashed filename** (`public/build/assets/app-CbsYpFiL.css`). **Every `vite build` changes that hash.** Re-resolve it (`ls public/build/assets/app-*.css`) and update `config.json`, or the sync ships a stale stylesheet.
- **The token layer is duplicated** in `ds-bundle/tokens/tokens.css` (hand-written for readability). If `@theme` in `resources/css/app.css` changes, update that file too — the compiled `_ds_bundle.css` updates automatically, the hand-written one does not.
- `conventions.md` enumerates real class names. If the utility vocabulary changes, re-validate every name with `grep -F` against the compiled CSS (regex escaping of Tailwind's `\:` and `\/` is error-prone — use fixed-string matching).
- No `_ds_sync.json` anchor is uploaded, so a re-sync re-verifies everything. That is correct and expected here.
